import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

async function loadFFmpeg() {
  ffmpeg = new FFmpeg();

  ffmpeg.on('progress', ({ progress }) => {
    self.postMessage({ type: 'progress', progress: progress * 100 });
  });

  ffmpeg.on('log', ({ message }) => {
    self.postMessage({ type: 'log', message });
  });

  // Load WASM core from CDN
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  self.postMessage({ type: 'loaded' });
}

async function extractAudio(
  fileData: Uint8Array,
  inputName: string,
  outputName: string,
  durationSeconds?: number
) {
  if (!ffmpeg) throw new Error('FFmpeg not loaded');

  await ffmpeg.writeFile(inputName, fileData);

  // Same parameters as desktop app: MP3, libmp3lame, mono, 16kHz
  const args = ['-i', inputName];
  if (durationSeconds) {
    args.push('-t', String(durationSeconds));
  }
  args.push(
    '-vn',
    '-acodec', 'libmp3lame',
    '-ac', '1',
    '-ar', '16000',
    outputName
  );

  await ffmpeg.exec(args);
  const data = await ffmpeg.readFile(outputName);

  // Clean up virtual FS
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  // Transfer buffer (zero-copy) back to main thread
  if (data instanceof Uint8Array) {
    self.postMessage({ type: 'result', data }, [data.buffer]);
  } else {
    // String response (shouldn't happen for binary)
    self.postMessage({ type: 'result', data: new TextEncoder().encode(data as string) });
  }
}

async function convertAudio(
  fileData: Uint8Array,
  inputName: string,
  outputName: string
) {
  if (!ffmpeg) throw new Error('FFmpeg not loaded');

  await ffmpeg.writeFile(inputName, fileData);

  await ffmpeg.exec([
    '-i', inputName,
    '-vn',
    '-acodec', 'libmp3lame',
    '-ac', '1',
    '-ar', '16000',
    outputName
  ]);

  const data = await ffmpeg.readFile(outputName);

  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  if (data instanceof Uint8Array) {
    self.postMessage({ type: 'result', data }, [data.buffer]);
  } else {
    self.postMessage({ type: 'result', data: new TextEncoder().encode(data as string) });
  }
}

async function getMediaInfo(fileData: Uint8Array, inputName: string) {
  if (!ffmpeg) throw new Error('FFmpeg not loaded');

  await ffmpeg.writeFile(inputName, fileData);

  // Parse ffmpeg log output for media info (no ffprobe in WASM)
  let logOutput = '';
  const logHandler = ({ message }: { message: string }) => {
    logOutput += message + '\n';
  };
  ffmpeg.on('log', logHandler);

  try {
    // Run ffmpeg with no output — it will error but logs contain media info
    await ffmpeg.exec(['-i', inputName, '-f', 'null', '-']);
  } catch {
    // Expected: ffmpeg exits with error when no valid output
  }

  ffmpeg.off('log', logHandler);
  await ffmpeg.deleteFile(inputName);

  const hasAudio = /Audio:/.test(logOutput);
  const hasVideo = /Video:/.test(logOutput);

  const durationMatch = logOutput.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  let duration: number | undefined;
  if (durationMatch) {
    duration =
      parseInt(durationMatch[1]) * 3600 +
      parseInt(durationMatch[2]) * 60 +
      parseInt(durationMatch[3]) +
      parseInt(durationMatch[4]) / 100;
  }

  const formatMatch = logOutput.match(/Input #0,\s*(\w+)/);

  self.postMessage({
    type: 'mediaInfo',
    data: {
      duration,
      hasAudio,
      hasVideo,
      format: formatMatch?.[1]
    }
  });
}

self.onmessage = async (e: MessageEvent) => {
  try {
    switch (e.data.cmd) {
      case 'load':
        await loadFFmpeg();
        break;
      case 'extractAudio':
        await extractAudio(
          e.data.fileData,
          e.data.inputName,
          e.data.outputName,
          e.data.durationSeconds
        );
        break;
      case 'convertAudio':
        await convertAudio(
          e.data.fileData,
          e.data.inputName,
          e.data.outputName
        );
        break;
      case 'getMediaInfo':
        await getMediaInfo(e.data.fileData, e.data.inputName);
        break;
    }
  } catch (error) {
    self.postMessage({ type: 'error', error: (error as Error).message });
  }
};
