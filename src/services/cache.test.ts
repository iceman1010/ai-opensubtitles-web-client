import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CacheManager from './cache';

describe('CacheManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('set/get round-trip', () => {
    CacheManager.set('test', { foo: 'bar' });
    expect(CacheManager.get('test')).toEqual({ foo: 'bar' });
  });

  it('returns null for missing key', () => {
    expect(CacheManager.get('nonexistent')).toBeNull();
  });

  it('expires after cache duration', () => {
    CacheManager.set('temp', 'value');
    // Default 24 hours
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    expect(CacheManager.get('temp')).toBeNull();
  });

  it('isExpired returns true for expired items', () => {
    CacheManager.set('exp', 123);
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    expect(CacheManager.isExpired('exp')).toBe(true);
  });

  it('isExpired returns true for missing keys', () => {
    expect(CacheManager.isExpired('nope')).toBe(true);
  });

  it('isExpired returns false for fresh items', () => {
    CacheManager.set('fresh', 'data');
    expect(CacheManager.isExpired('fresh')).toBe(false);
  });

  it('remove deletes a key', () => {
    CacheManager.set('del', 'me');
    CacheManager.remove('del');
    expect(CacheManager.get('del')).toBeNull();
  });

  it('clear removes all ai_opensubtitles_ keys', () => {
    CacheManager.set('a', 1);
    CacheManager.set('b', 2);
    localStorage.setItem('unrelated', 'keep');
    CacheManager.clear();
    expect(CacheManager.get('a')).toBeNull();
    expect(CacheManager.get('b')).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });

  it('handles corrupt JSON gracefully', () => {
    localStorage.setItem('ai_opensubtitles_bad', '{invalid json');
    expect(CacheManager.get('bad')).toBeNull();
  });
});
