// Global type declarations for the web app
// No ElectronAPI types — everything runs in browser

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.json' {
  const value: any;
  export default value;
}

// File System Access API (Chrome/Edge only — not in standard TS DOM lib)
interface FileSystemDirectoryHandle {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  values(): AsyncIterableIterator<FileSystemHandle>;
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: string | BufferSource | Blob): Promise<void>;
  close(): Promise<void>;
}

interface Window {
  showDirectoryPicker?(): Promise<FileSystemDirectoryHandle>;
}
