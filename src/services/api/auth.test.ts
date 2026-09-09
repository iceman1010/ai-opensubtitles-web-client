import { describe, it, expect } from 'vitest';
import { buildAIUrl, buildLoginUrl } from './auth';

describe('buildAIUrl', () => {
  it('builds plain URL with no flags', () => {
    expect(buildAIUrl('https://api.example.com', '/translate', '')).toBe('https://api.example.com/ai/translate');
  });

  it('appends beta=true when beta mode is on', () => {
    expect(buildAIUrl('https://api.example.com', '/translate', '', true)).toBe('https://api.example.com/ai/translate?beta=true');
  });

  it('appends dev=true when server dev mode is on', () => {
    expect(buildAIUrl('https://api.example.com', '/translate', '', false, true)).toBe('https://api.example.com/ai/translate?dev=true');
  });

  it('appends both params combined', () => {
    expect(buildAIUrl('https://api.example.com', '/translate', '', true, true)).toBe('https://api.example.com/ai/translate?beta=true&dev=true');
  });

  it('respects existing apiUrlParameter', () => {
    expect(buildAIUrl('https://api.example.com', '/translate', '?x=1', true, true)).toBe('https://api.example.com/ai/translate?x=1&beta=true&dev=true');
  });
});

describe('buildLoginUrl', () => {
  it('builds plain URL with no flags', () => {
    expect(buildLoginUrl('https://api.example.com', '/login', '')).toBe('https://api.example.com/login');
  });

  it('appends dev=true when server dev mode is on', () => {
    expect(buildLoginUrl('https://api.example.com', '/login', '', false, true)).toBe('https://api.example.com/login?dev=true');
  });

  it('appends both params combined', () => {
    expect(buildLoginUrl('https://api.example.com', '/login', '', true, true)).toBe('https://api.example.com/login?beta=true&dev=true');
  });
});
