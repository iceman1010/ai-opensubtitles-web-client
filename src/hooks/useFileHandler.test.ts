import { describe, it, expect } from 'vitest';
import { getAcceptString, validateFile, formatFileSize } from './useFileHandler';

describe('getAcceptString', () => {
  it('returns all extensions when no types specified', () => {
    const result = getAcceptString();
    expect(result).toContain('.mp4');
    expect(result).toContain('.mp3');
    expect(result).toContain('.srt');
  });

  it('filters to video only', () => {
    const result = getAcceptString(['video']);
    expect(result).toContain('.mp4');
    expect(result).not.toContain('.mp3');
    expect(result).not.toContain('.srt');
  });

  it('filters to audio only', () => {
    const result = getAcceptString(['audio']);
    expect(result).toContain('.mp3');
    expect(result).not.toContain('.mp4');
  });

  it('filters to subtitle only', () => {
    const result = getAcceptString(['subtitle']);
    expect(result).toContain('.srt');
    expect(result).not.toContain('.mp4');
  });

  it('combines multiple types', () => {
    const result = getAcceptString(['video', 'audio']);
    expect(result).toContain('.mp4');
    expect(result).toContain('.mp3');
    expect(result).not.toContain('.srt');
  });
});

describe('validateFile', () => {
  it('accepts valid video file', () => {
    const file = new File(['data'], 'movie.mp4', { type: 'video/mp4' });
    const result = validateFile(file);
    expect(result.isValid).toBe(true);
    expect(result.fileType).toBe('video');
  });

  it('accepts valid subtitle file', () => {
    const file = new File(['data'], 'subs.srt', { type: 'text/plain' });
    const result = validateFile(file);
    expect(result.isValid).toBe(true);
    expect(result.fileType).toBe('subtitle');
  });

  it('rejects unsupported file', () => {
    const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
    const result = validateFile(file);
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe('1.50 GB');
  });
});
