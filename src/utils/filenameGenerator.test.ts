import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateFilename } from './filenameGenerator';

describe('generateFilename', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T10:30:45.123Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const pattern = '{filename}_{timestamp}_{type}_{format}_{language_code}_{language_name}.{extension}';

  it('replaces {filename} with name without extension', () => {
    const result = generateFilename('{filename}', 'movie.mp4', 'en', 'English', 'transcription', 'srt');
    expect(result).toBe('movie');
  });

  it('replaces {timestamp} with ISO-like string', () => {
    const result = generateFilename('{timestamp}', 'movie.mp4', 'en', 'English', 'transcription', 'srt');
    expect(result).toBe('2025-06-15T10-30-45');
  });

  it('replaces {type}', () => {
    const result = generateFilename('{type}', 'movie.mp4', 'en', 'English', 'transcription', 'srt');
    expect(result).toBe('transcription');
  });

  it('replaces {format}', () => {
    const result = generateFilename('{format}', 'movie.mp4', 'en', 'English', 'transcription', 'srt');
    expect(result).toBe('srt');
  });

  it('replaces {language_code} and {language_name}', () => {
    const result = generateFilename('{language_code}-{language_name}', 'movie.mp4', 'fr', 'French', 'translation', 'vtt');
    expect(result).toBe('fr-French');
  });

  it('maps extension correctly for srt/vtt/other', () => {
    expect(generateFilename('{extension}', 'f.mp4', 'en', 'English', 'transcription', 'srt')).toBe('srt');
    expect(generateFilename('{extension}', 'f.mp4', 'en', 'English', 'transcription', 'vtt')).toBe('vtt');
    expect(generateFilename('{extension}', 'f.mp4', 'en', 'English', 'transcription', 'plain')).toBe('txt');
  });

  it('replaces all placeholders in a full pattern', () => {
    const result = generateFilename(pattern, 'movie.mp4', 'en', 'English', 'transcription', 'srt');
    expect(result).toBe('movie_2025-06-15T10-30-45_transcription_srt_en_English.srt');
  });

  it('handles file without extension', () => {
    const result = generateFilename('{filename}', 'noext', 'en', 'English', 'transcription', 'srt');
    expect(result).toBe('noext');
  });
});
