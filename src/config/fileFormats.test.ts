import { describe, it, expect } from 'vitest';
import {
  getFileTypeFromExtension,
  getAllSupportedExtensions,
  getProcessingType,
  validateFileExtension,
  SUPPORTED_FORMATS,
} from './fileFormats';

describe('getFileTypeFromExtension', () => {
  it('identifies video files', () => {
    expect(getFileTypeFromExtension('movie.mp4')).toBe('video');
    expect(getFileTypeFromExtension('clip.mkv')).toBe('video');
    expect(getFileTypeFromExtension('file.avi')).toBe('video');
  });

  it('identifies audio files', () => {
    expect(getFileTypeFromExtension('song.mp3')).toBe('audio');
    expect(getFileTypeFromExtension('track.wav')).toBe('audio');
    expect(getFileTypeFromExtension('audio.flac')).toBe('audio');
  });

  it('identifies subtitle files', () => {
    expect(getFileTypeFromExtension('subs.srt')).toBe('subtitle');
    expect(getFileTypeFromExtension('subs.vtt')).toBe('subtitle');
  });

  it('returns unknown for unsupported extensions', () => {
    expect(getFileTypeFromExtension('doc.pdf')).toBe('unknown');
    expect(getFileTypeFromExtension('image.png')).toBe('unknown');
  });

  it('returns unknown for files without extension', () => {
    expect(getFileTypeFromExtension('noext')).toBe('unknown');
  });

  it('is case-insensitive', () => {
    expect(getFileTypeFromExtension('MOVIE.MP4')).toBe('video');
    expect(getFileTypeFromExtension('Song.MP3')).toBe('audio');
    expect(getFileTypeFromExtension('Subs.SRT')).toBe('subtitle');
  });
});

describe('getAllSupportedExtensions', () => {
  it('returns combined video, audio, and subtitle extensions', () => {
    const all = getAllSupportedExtensions();
    const expected =
      SUPPORTED_FORMATS.video.length +
      SUPPORTED_FORMATS.audio.length +
      SUPPORTED_FORMATS.subtitle.length;
    expect(all).toHaveLength(expected);
  });

  it('includes extensions from each category', () => {
    const all = getAllSupportedExtensions();
    expect(all).toContain('mp4');
    expect(all).toContain('mp3');
    expect(all).toContain('srt');
  });
});

describe('getProcessingType', () => {
  it('returns transcription for video files', () => {
    expect(getProcessingType('movie.mp4')).toBe('transcription');
  });

  it('returns transcription for audio files', () => {
    expect(getProcessingType('song.mp3')).toBe('transcription');
  });

  it('returns translation for subtitle files', () => {
    expect(getProcessingType('subs.srt')).toBe('translation');
  });

  it('returns unknown for unsupported files', () => {
    expect(getProcessingType('doc.pdf')).toBe('unknown');
  });
});

describe('validateFileExtension', () => {
  it('accepts valid extensions', () => {
    expect(validateFileExtension('movie.mp4')).toEqual({ isValid: true });
    expect(validateFileExtension('subs.srt')).toEqual({ isValid: true });
  });

  it('rejects invalid extensions with error message', () => {
    const result = validateFileExtension('doc.pdf');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('pdf');
  });
});
