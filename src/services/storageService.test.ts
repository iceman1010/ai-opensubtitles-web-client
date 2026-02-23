import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { storageService } from './storageService';

describe('StorageService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('config', () => {
    it('getConfig returns empty object when nothing stored', () => {
      expect(storageService.getConfig()).toEqual({});
    });

    it('saveConfig merges with existing config', () => {
      storageService.saveConfig({ username: 'alice' });
      storageService.saveConfig({ debugMode: true });
      const config = storageService.getConfig();
      expect(config.username).toBe('alice');
      expect(config.debugMode).toBe(true);
    });

    it('resetAllSettings clears config and token', () => {
      storageService.saveConfig({ username: 'bob' });
      storageService.saveToken('tok123');
      storageService.resetAllSettings();
      expect(storageService.getConfig()).toEqual({});
      expect(storageService.getValidToken()).toBeNull();
    });
  });

  describe('token', () => {
    it('saves and retrieves a valid token', () => {
      storageService.saveToken('mytoken');
      expect(storageService.getValidToken()).toBe('mytoken');
    });

    it('returns null when token has expired (6h)', () => {
      storageService.saveToken('mytoken');
      vi.advanceTimersByTime(7 * 60 * 60 * 1000); // 7 hours
      expect(storageService.getValidToken()).toBeNull();
    });

    it('returns token before expiry', () => {
      storageService.saveToken('mytoken');
      vi.advanceTimersByTime(5 * 60 * 60 * 1000); // 5 hours
      expect(storageService.getValidToken()).toBe('mytoken');
    });

    it('clearToken removes token', () => {
      storageService.saveToken('mytoken');
      storageService.clearToken();
      expect(storageService.getValidToken()).toBeNull();
    });
  });

  describe('sessionId', () => {
    it('generates and persists a session ID', () => {
      // Mock crypto.randomUUID since happy-dom may not have it
      const mockUUID = '12345678-1234-1234-1234-123456789abc';
      vi.stubGlobal('crypto', { ...crypto, randomUUID: () => mockUUID });

      const id = storageService.getSessionId();
      expect(id).toBe(mockUUID);

      // Second call returns same value from sessionStorage
      expect(storageService.getSessionId()).toBe(mockUUID);

      vi.unstubAllGlobals();
    });

    it('reuses existing sessionStorage value', () => {
      sessionStorage.setItem('session_id', 'existing-id');
      expect(storageService.getSessionId()).toBe('existing-id');
    });
  });
});
