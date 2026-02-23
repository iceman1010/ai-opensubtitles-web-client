import { describe, it, expect } from 'vitest';
import { parseSubtitleFile, formatDuration, formatCharacterCount } from './subtitleParser';

describe('parseSubtitleFile — SRT', () => {
  const srt = `1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,000 --> 00:00:08,000
<b>Second</b> line`;

  it('parses entries', () => {
    const result = parseSubtitleFile(srt, 'test.srt');
    expect(result.lineCount).toBe(2);
  });

  it('counts words', () => {
    const result = parseSubtitleFile(srt, 'test.srt');
    expect(result.wordCount).toBe(4); // Hello world Second line
  });

  it('strips HTML tags', () => {
    const result = parseSubtitleFile(srt, 'test.srt');
    expect(result.text).not.toContain('<b>');
    expect(result.text).toContain('Second');
  });
});

describe('parseSubtitleFile — VTT', () => {
  const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
First cue

00:00:05.000 --> 00:00:08.000
Second cue`;

  it('parses cues after WEBVTT header', () => {
    const result = parseSubtitleFile(vtt, 'test.vtt');
    expect(result.lineCount).toBe(2);
  });

  it('concatenates cue text', () => {
    const result = parseSubtitleFile(vtt, 'test.vtt');
    expect(result.text).toContain('First cue');
    expect(result.text).toContain('Second cue');
  });
});

describe('parseSubtitleFile — ASS/SSA', () => {
  const ass = `[Script Info]
Title: Test

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,{\\b1}Hello{\\b0} world
Dialogue: 0,0:00:05.00,0:00:08.00,Default,,0,0,0,,Another line`;

  it('parses Dialogue lines', () => {
    const result = parseSubtitleFile(ass, 'test.ass');
    expect(result.lineCount).toBe(2);
  });

  it('strips override tags', () => {
    const result = parseSubtitleFile(ass, 'test.ass');
    expect(result.text).not.toContain('{\\b1}');
    expect(result.text).toContain('Hello');
  });

  it('works with .ssa extension too', () => {
    const result = parseSubtitleFile(ass, 'test.ssa');
    expect(result.lineCount).toBe(2);
  });
});

describe('parseSubtitleFile — auto-detection', () => {
  it('detects SRT by content', () => {
    const srt = `1\n00:00:01,000 --> 00:00:04,000\nHello`;
    const result = parseSubtitleFile(srt, 'test.txt');
    expect(result.text).toContain('Hello');
  });

  it('detects VTT by WEBVTT header', () => {
    const vtt = `WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHi`;
    const result = parseSubtitleFile(vtt, 'test.txt');
    expect(result.text).toContain('Hi');
  });

  it('detects ASS by Script Info marker', () => {
    const ass = `[Script Info]\nTitle: Test\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Test`;
    const result = parseSubtitleFile(ass, 'test.txt');
    expect(result.text).toContain('Test');
  });
});

describe('formatDuration', () => {
  it('formats seconds', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(125)).toBe('2m 5s');
  });

  it('formats hours, minutes and seconds', () => {
    expect(formatDuration(3661)).toBe('1h 1m 1s');
  });
});

describe('formatCharacterCount', () => {
  it('formats small numbers', () => {
    expect(formatCharacterCount(42)).toBe('42');
  });

  it('formats large numbers with locale separators', () => {
    const result = formatCharacterCount(1234567);
    // toLocaleString is locale-dependent; just check digits are present
    expect(result.replace(/\D/g, '')).toBe('1234567');
  });
});
