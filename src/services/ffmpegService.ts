import { logger } from '../utils/errorLogger';

export interface MediaInfo {
  duration?: number;
  hasAudio: boolean;
  hasVideo: boolean;
  format?: string;
}

// Max file size we'll attempt to process in WASM (500MB)
const WASM_FILE_SIZE_WARNING = 500 * 1024 * 1024;
// Hard limit: 2GB (WASM linear memory max)
const WASM_FILE_SIZE_LIMIT = 2 * 1024 * 1024 * 1024;

// ffmpeg.wasm never unwinds the WASM stack after exec() (ffmpeg exits via
// exit(), which Emscripten turns into a swallowed exception), so every
// exec() leaks stack space until the module traps with
// "RuntimeError: memory access out of bounds". The upstream fix
// (https://github.com/ffmpegwasm/ffmpeg.wasm/pull/943) is not released yet.
// Workaround verified by the community
// (https://github.com/ffmpegwasm/ffmpeg.wasm/issues/820): recycle the worker
// after every operation and retry once on fatal WASM errors. Once a fixed
// @ffmpeg/core is released, recycling can be relaxed.
const FATAL_WASM_ERROR_PATTERNS = [
  'memory access out of bounds',
  'out of memory',
  'aborted(native code)',
  'unreachable',
  'ffmpeg is not loaded',
];

function isFatalWasmError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return FATAL_WASM_ERROR_PATTERNS.some(pattern => message.includes(pattern));
}

export class BrowserFFmpegService {
  private worker: Worker | null = null;
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;
  private opQueue: Promise<unknown> = Promise.resolve();
  private mediaInfoCache = new WeakMap<File, MediaInfo>();

  private enqueue<T>(op: () => Promise<T>): Promise<T> {
    const next = this.opQueue.then(op, op);
    this.opQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  /**
   * Runs a single FFmpeg operation and always recycles the worker afterwards
   * (see FATAL_WASM_ERROR_PATTERNS). On a fatal WASM error the worker is
   * recycled and the operation retried once on a fresh instance. The op must
   * call initialize() itself and re-read any file data on every attempt,
   * since buffers are transferred to the worker and become detached.
   */
  private runRecycled<T>(op: () => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      try {
        try {
          return await op();
        } catch (error) {
          if (!isFatalWasmError(error)) throw error;
          logger.warn(
            'FFmpeg',
            'Fatal WASM error, recycling worker and retrying once',
            error instanceof Error ? error.message : error,
          );
          this.terminate('wasm-error recovery');
          return await op();
        }
      } finally {
        this.terminate('operation finished');
      }
    });
  }

  async initialize(): Promise<boolean> {
    if (this.isLoaded) return true;
    if (this.loadPromise) {
      await this.loadPromise;
      return this.isLoaded;
    }

    this.loadPromise = new Promise<void>((resolve, reject) => {
      this.worker = new Worker(
        new URL('../workers/ffmpeg.worker.ts', import.meta.url),
        { type: 'module' }
      );

      const handler = (e: MessageEvent) => {
        if (e.data.type === 'loaded') {
          this.isLoaded = true;
          this.worker!.removeEventListener('message', handler);
          logger.info('FFmpeg', 'FFmpeg WASM loaded successfully');
          resolve();
        } else if (e.data.type === 'error') {
          this.worker!.removeEventListener('message', handler);
          console.error('[ffmpeg-service] worker reported load error:', e.data);
          logger.error('FFmpeg', 'FFmpeg WASM failed to load', e.data);
          reject(new Error(e.data.error));
        }
      };

      this.worker.addEventListener('message', handler);
      this.worker.postMessage({ cmd: 'load' });
    });

    try {
      await this.loadPromise;
      return true;
    } catch {
      this.loadPromise = null;
      console.error('[ffmpeg-service] initialize() FAILED, returning false (worker may be unusable)');
      return false;
    }
  }

  isReady(): boolean {
    return this.isLoaded && this.worker !== null;
  }

  /**
   * Check if a file size is within WASM processing limits
   */
  checkFileSize(file: File): { ok: boolean; warning?: string; error?: string } {
    if (file.size > WASM_FILE_SIZE_LIMIT) {
      return {
        ok: false,
        error: `File is too large for browser processing (${formatFileSize(file.size)}). Maximum is 2GB. Please use the desktop app or extract audio externally.`
      };
    }
    if (file.size > WASM_FILE_SIZE_WARNING) {
      return {
        ok: true,
        warning: `Large file (${formatFileSize(file.size)}). Processing may take a while and use significant memory.`
      };
    }
    return { ok: true };
  }

  async extractAudioFromVideo(
    file: File,
    onProgress?: (percent: number) => void,
    durationSeconds?: number
  ): Promise<Blob> {
    const sizeCheck = this.checkFileSize(file);
    if (!sizeCheck.ok) throw new Error(sizeCheck.error);

    logger.info('FFmpeg', `Extracting audio from: ${file.name} (${formatFileSize(file.size)})`);

    const inputName = file.name;
    const outputName = file.name.replace(/\.[^.]+$/, '') + '_converted.mp3';

    return this.runRecycled(async () => {
      if (!(await this.initialize())) {
        throw new Error('FFmpeg WASM failed to load; cannot extract audio');
      }
      // Re-read on every attempt: the buffer is transferred to the worker
      const fileData = new Uint8Array(await file.arrayBuffer());

      return new Promise<Blob>((resolve, reject) => {
        const handler = (e: MessageEvent) => {
          switch (e.data.type) {
            case 'progress':
              if (onProgress) onProgress(e.data.progress);
              break;
            case 'result':
              this.worker!.removeEventListener('message', handler);
              logger.info('FFmpeg', `Audio extraction complete: ${formatFileSize(e.data.data.byteLength)}`);
              resolve(new Blob([e.data.data], { type: 'audio/mpeg' }));
              break;
            case 'error':
              this.worker!.removeEventListener('message', handler);
              console.error('[ffmpeg-service] extractAudioFromVideo worker error:', e.data);
              reject(new Error(e.data.error));
              break;
          }
        };

        this.worker!.addEventListener('message', handler);
        this.worker!.postMessage(
          { cmd: 'extractAudio', fileData, inputName, outputName, durationSeconds },
          [fileData.buffer] // Transfer, not copy
        );
      });
    });
  }

  async convertAudioToMp3(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<Blob> {
    const sizeCheck = this.checkFileSize(file);
    if (!sizeCheck.ok) throw new Error(sizeCheck.error);

    logger.info('FFmpeg', `Converting audio: ${file.name} (${formatFileSize(file.size)})`);

    const inputName = file.name;
    const outputName = file.name.replace(/\.[^.]+$/, '') + '_converted.mp3';

    return this.runRecycled(async () => {
      if (!(await this.initialize())) {
        throw new Error('FFmpeg WASM failed to load; cannot convert audio');
      }
      // Re-read on every attempt: the buffer is transferred to the worker
      const fileData = new Uint8Array(await file.arrayBuffer());

      return new Promise<Blob>((resolve, reject) => {
        const handler = (e: MessageEvent) => {
          switch (e.data.type) {
            case 'progress':
              if (onProgress) onProgress(e.data.progress);
              break;
            case 'result':
              this.worker!.removeEventListener('message', handler);
              resolve(new Blob([e.data.data], { type: 'audio/mpeg' }));
              break;
            case 'error':
              this.worker!.removeEventListener('message', handler);
              reject(new Error(e.data.error));
              break;
          }
        };

        this.worker!.addEventListener('message', handler);
        this.worker!.postMessage(
          { cmd: 'convertAudio', fileData, inputName, outputName },
          [fileData.buffer]
        );
      });
    });
  }

  async getMediaInfo(file: File): Promise<MediaInfo> {
    const cached = this.mediaInfoCache.get(file);
    if (cached) return cached;

    const inputName = file.name;

    const result = await this.runRecycled(async () => {
      if (!(await this.initialize())) {
        throw new Error('FFmpeg WASM failed to load; cannot read media info');
      }

      // For media info, we only need a small portion of the file.
      // Read first 10MB max to detect format/streams.
      const maxProbeSize = 10 * 1024 * 1024;
      const probeSlice = file.slice(0, Math.min(file.size, maxProbeSize));
      const fileData = new Uint8Array(await probeSlice.arrayBuffer());

      return new Promise<MediaInfo>((resolve, reject) => {
        const handler = (e: MessageEvent) => {
          switch (e.data.type) {
            case 'mediaInfo':
              this.worker!.removeEventListener('message', handler);
              resolve(e.data.data);
              break;
            case 'error':
              this.worker!.removeEventListener('message', handler);
              reject(new Error(e.data.error));
              break;
          }
        };

        this.worker!.addEventListener('message', handler);
        this.worker!.postMessage(
          { cmd: 'getMediaInfo', fileData, inputName },
          [fileData.buffer]
        );
      });
    });

    // MP4 and some other containers store metadata (moov atom) at the end
    // of the file. When we only probe the first 10MB, ffmpeg may not find
    // any streams. In that case, infer from the file extension so we don't
    // incorrectly reject a valid file.
    if (!result.hasAudio && !result.hasVideo) {
      const ext = file.name.toLowerCase().split('.').pop();
      const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ts', 'mts', 'm2ts', 'vob', 'mxf', 'asf'];
      const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus', 'ac3', 'dts', 'aiff'];

      if (ext && videoExts.includes(ext)) {
        logger.warn('FFmpeg', `Probe did not detect streams in ${file.name} (likely moov atom at end of file). Assuming video+audio based on extension.`);
        result.hasVideo = true;
        result.hasAudio = true;
        result.format = result.format || ext;
      } else if (ext && audioExts.includes(ext)) {
        logger.warn('FFmpeg', `Probe did not detect streams in ${file.name}. Assuming audio based on extension.`);
        result.hasAudio = true;
        result.format = result.format || ext;
      }
    }

    this.mediaInfoCache.set(file, result);
    return result;
  }

  /**
   * Terminate the worker and free resources
   */
  terminate(reason = 'manual'): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isLoaded = false;
      this.loadPromise = null;
      logger.info('FFmpeg', `FFmpeg worker recycled (${reason})`);
    }
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Singleton instance
export const ffmpegService = new BrowserFFmpegService();
