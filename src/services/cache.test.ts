import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CacheManager from './cache';

describe('CacheManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    localStorage.clear();
    CacheManager.clearUser();
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

  describe('user-scoped cache keys', () => {
    it('uses username in cache key prefix', () => {
      CacheManager.setUser('alice');
      CacheManager.set('test', 'alice-data');
      expect(localStorage.getItem('ai_opensubtitles_alice_test')).toBeTruthy();
    });

    it('different users have separate caches', () => {
      CacheManager.setUser('alice');
      CacheManager.set('prefs', 'alice-prefs');

      CacheManager.setUser('bob');
      CacheManager.set('prefs', 'bob-prefs');

      CacheManager.setUser('alice');
      expect(CacheManager.get('prefs')).toBe('alice-prefs');

      CacheManager.setUser('bob');
      expect(CacheManager.get('prefs')).toBe('bob-prefs');
    });

    it('clear only removes current user cache', () => {
      CacheManager.setUser('alice');
      CacheManager.set('data', 'alice-data');

      CacheManager.setUser('bob');
      CacheManager.set('data', 'bob-data');
      CacheManager.clear();

      expect(CacheManager.get('data')).toBeNull();

      CacheManager.setUser('alice');
      expect(CacheManager.get('data')).toBe('alice-data');
    });

    it('clearUser falls back to generic prefix', () => {
      CacheManager.setUser('alice');
      CacheManager.set('test', 'user-data');
      CacheManager.clearUser();
      // Without user, looks under generic prefix — should not find alice's data
      expect(CacheManager.get('test')).toBeNull();
    });
  });
});
