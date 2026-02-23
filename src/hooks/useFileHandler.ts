import { useCallback } from 'react';
import { getAllSupportedExtensions, getFileTypeFromExtension, validateFileExtension, SUPPORTED_FORMATS } from '../config/fileFormats';

/**
 * Generates the accept string for <input type="file"> from supported formats
 */
export function getAcceptString(types?: ('video' | 'audio' | 'subtitle')[]): string {
  if (!types) {
    return getAllSupportedExtensions().map(ext => `.${ext}`).join(',');
  }

  const exts: string[] = [];
  for (const type of types) {
    if (type === 'video') exts.push(...SUPPORTED_FORMATS.video);
    else if (type === 'audio') exts.push(...SUPPORTED_FORMATS.audio);
    else if (type === 'subtitle') exts.push(...SUPPORTED_FORMATS.subtitle);
  }
  return exts.map(ext => `.${ext}`).join(',');
}

/**
 * Validates a dropped/selected file
 */
export function validateFile(file: File): { isValid: boolean; error?: string; fileType?: string } {
  const result = validateFileExtension(file.name);
  if (!result.isValid) return result;
  const fileType = getFileTypeFromExtension(file.name);
  return { isValid: true, fileType };
}

/**
 * Triggers a browser file download for text content
 */
export function saveTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Triggers a browser file download for binary content
 */
export function saveBlobFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Reads a text file from a File object
 */
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Hook for drag-and-drop file handling
 */
export function useFileDrop(
  onFilesSelected: (files: File[]) => void,
  acceptedTypes?: ('video' | 'audio' | 'subtitle')[]
) {
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter(file => {
      const result = validateFile(file);
      if (!result.isValid) {
        console.warn(`Rejected file: ${file.name} — ${result.error}`);
        return false;
      }
      if (acceptedTypes) {
        return acceptedTypes.includes(result.fileType as any);
      }
      return true;
    });

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  }, [onFilesSelected, acceptedTypes]);

  return { handleDragOver, handleDrop };
}
