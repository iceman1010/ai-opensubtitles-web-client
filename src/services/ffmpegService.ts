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

export class BrowserFFmpegService {
  private worker: Worker | null = null;
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

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
          logger.error('FFmpeg', 'FFmpeg WASM failed to load', e.data.error);
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
    await this.initialize();

    const sizeCheck = this.checkFileSize(file);
    if (!sizeCheck.ok) throw new Error(sizeCheck.error);

    logger.info('FFmpeg', `Extracting audio from: ${file.name} (${formatFileSize(file.size)})`);

    const fileData = new Uint8Array(await file.arrayBuffer());
    const inputName = file.name;
    const outputName = file.name.replace(/\.[^.]+$/, '') + '_converted.mp3';

    return new Promise((resolve, reject) => {
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
  }

  async convertAudioToMp3(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<Blob> {
    await this.initialize();

    const sizeCheck = this.checkFileSize(file);
    if (!sizeCheck.ok) throw new Error(sizeCheck.error);

    logger.info('FFmpeg', `Converting audio: ${file.name} (${formatFileSize(file.size)})`);

    const fileData = new Uint8Array(await file.arrayBuffer());
    const inputName = file.name;
    const outputName = file.name.replace(/\.[^.]+$/, '') + '_converted.mp3';

    return new Promise((resolve, reject) => {
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
  }

  async getMediaInfo(file: File): Promise<MediaInfo> {
    await this.initialize();

    // For media info, we only need a small portion of the file
    // Read first 10MB max to detect format/streams
    const maxProbeSize = 10 * 1024 * 1024;
    const probeSlice = file.slice(0, Math.min(file.size, maxProbeSize));
    const fileData = new Uint8Array(await probeSlice.arrayBuffer());
    const inputName = file.name;

    return new Promise((resolve, reject) => {
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
  }

  /**
   * Terminate the worker and free resources
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isLoaded = false;
      this.loadPromise = null;
      logger.info('FFmpeg', 'FFmpeg worker terminated');
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
