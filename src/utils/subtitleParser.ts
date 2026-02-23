// Subtitle parser utility to extract text content from various subtitle formats

export interface ParsedSubtitle {
  text: string;
  characterCount: number;
  wordCount: number;
  lineCount: number;
}

export interface SubtitleEntry {
  start: string;
  end: string;
  text: string;
}

function parseSRT(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const blocks = content.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    const timeLine = lines[1];
    const textLines = lines.slice(2);
    const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
    if (timeMatch) {
      entries.push({ start: timeMatch[1], end: timeMatch[2], text: textLines.join(' ').trim() });
    }
  }
  return entries;
}

function parseVTT(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length && !lines[i].includes('-->')) { i++; }

  while (i < lines.length) {
    const line = lines[i].trim();
    const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
    if (timeMatch) {
      const start = timeMatch[1];
      const end = timeMatch[2];
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
        textLines.push(lines[i].trim());
        i++;
      }
      if (textLines.length > 0) {
        entries.push({ start, end, text: textLines.join(' ').trim() });
      }
    } else {
      i++;
    }
  }
  return entries;
}

function parseASS(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('Dialogue:')) {
      const parts = trimmedLine.split(',');
      if (parts.length >= 10) {
        const start = parts[1].trim();
        const end = parts[2].trim();
        const text = parts.slice(9).join(',').trim();
        const cleanText = text.replace(/\{[^}]*\}/g, '').trim();
        if (cleanText) {
          entries.push({ start, end, text: cleanText });
        }
      }
    }
  }
  return entries;
}

function cleanSubtitleText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/^\[.*?\]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSubtitleFile(content: string, fileName: string): ParsedSubtitle {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  let entries: SubtitleEntry[] = [];

  try {
    switch (extension) {
      case 'srt': entries = parseSRT(content); break;
      case 'vtt': entries = parseVTT(content); break;
      case 'ass': case 'ssa': entries = parseASS(content); break;
      default:
        if (content.includes('WEBVTT')) { entries = parseVTT(content); }
        else if (content.includes('--&gt;') || content.includes('-->')) { entries = parseSRT(content); }
        else if (content.includes('[Script Info]') || content.includes('Dialogue:')) { entries = parseASS(content); }
        else {
          return {
            text: content.trim(),
            characterCount: content.trim().length,
            wordCount: content.trim().split(/\s+/).filter(word => word.length > 0).length,
            lineCount: content.trim().split('\n').length
          };
        }
        break;
    }

    const allText = entries.map(entry => cleanSubtitleText(entry.text)).filter(text => text.length > 0).join(' ');
    const words = allText.split(/\s+/).filter(word => word.length > 0);

    return { text: allText, characterCount: allText.length, wordCount: words.length, lineCount: entries.length };
  } catch (error) {
    console.error('Error parsing subtitle file:', error);
    return {
      text: content.trim(),
      characterCount: content.trim().length,
      wordCount: content.trim().split(/\s+/).filter(word => word.length > 0).length,
      lineCount: content.trim().split('\n').length
    };
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.round(seconds % 60);
    return `${hours}h ${mins}m ${secs}s`;
  }
}

export function formatCharacterCount(count: number): string {
  return count.toLocaleString();
}
