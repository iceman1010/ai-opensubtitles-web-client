import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import the class fresh for each test by using dynamic import
// But since logger is a singleton, we'll work with it directly
import { logger } from './errorLogger';

describe('ErrorLogger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
    logger.clear();
    logger.setDebugLevel(0);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'clear').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('logs errors and warns regardless of debug level', () => {
    logger.error('Cat', 'err msg');
    logger.warn('Cat', 'warn msg');
    expect(logger.getLogs()).toHaveLength(2);
    expect(console.error).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it('suppresses info logs at debug level 0', () => {
    logger.info('Cat', 'info msg');
    // Log is stored but not printed
    expect(logger.getLogs()).toHaveLength(1);
    expect(console.log).not.toHaveBeenCalled();
  });

  it('prints info logs at debug level 1 (non-polling)', () => {
    logger.setDebugLevel(1);
    logger.info('General', 'info msg');
    expect(console.log).toHaveBeenCalled();
  });

  it('filters polling at debug level 1', () => {
    logger.setDebugLevel(1);
    logger.info('polling-check', 'poll msg');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('prints all at debug level 2', () => {
    logger.setDebugLevel(2);
    logger.info('polling-check', 'poll msg');
    expect(console.log).toHaveBeenCalled();
  });

  it('debug() respects the level threshold', () => {
    logger.setDebugLevel(1);
    logger.debug(2, 'Cat', 'deep debug');
    // Level 2 debug at debugLevel 1 should not log
    expect(logger.getLogs()).toHaveLength(0);

    logger.debug(1, 'Cat', 'shallow debug');
    expect(logger.getLogs()).toHaveLength(1);
  });

  it('getLogs returns copy of logs', () => {
    logger.error('Cat', 'msg');
    const logs = logger.getLogs();
    expect(logs).toHaveLength(1);
    logs.pop(); // mutate copy
    expect(logger.getLogs()).toHaveLength(1); // original unchanged
  });

  it('getLogsAsText formats correctly', () => {
    logger.error('TestCat', 'Something broke');
    const text = logger.getLogsAsText();
    expect(text).toContain('[ERROR]');
    expect(text).toContain('[TestCat]');
    expect(text).toContain('Something broke');
  });

  it('getErrorCount counts only errors', () => {
    logger.error('A', 'e1');
    logger.warn('A', 'w1');
    logger.error('A', 'e2');
    expect(logger.getErrorCount()).toBe(2);
  });

  it('getRecentErrors filters by time', () => {
    logger.error('A', 'old error');
    vi.advanceTimersByTime(10 * 60 * 1000); // 10 minutes
    logger.error('A', 'new error');
    const recent = logger.getRecentErrors(5);
    expect(recent).toHaveLength(1);
    expect(recent[0].message).toBe('new error');
  });

  it('rotates logs at 1000 cap', () => {
    logger.setDebugLevel(2); // ensure all get stored
    for (let i = 0; i < 1050; i++) {
      logger.info('Bulk', `msg ${i}`);
    }
    expect(logger.getLogs().length).toBeLessThanOrEqual(1000);
  });

  it('clear empties logs', () => {
    logger.error('A', 'msg');
    logger.clear();
    expect(logger.getLogs()).toHaveLength(0);
    expect(console.clear).toHaveBeenCalled();
  });
});
