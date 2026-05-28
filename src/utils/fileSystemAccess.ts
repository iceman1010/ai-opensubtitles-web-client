export function isFileSystemAccessSupported(): boolean {
  return typeof window.showDirectoryPicker === 'function';
}

export async function pickDownloadFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (!window.showDirectoryPicker) return null;
    return await window.showDirectoryPicker();
  } catch {
    return null;
  }
}

export async function writeFileToHandle(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  content: string,
): Promise<void> {
  const sanitized = sanitizeFileName(fileName);
  const fileHandle = await dirHandle.getFileHandle(sanitized, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(content);
  } finally {
    await writable.close();
  }
}

export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 255) || 'subtitle.srt';
}
