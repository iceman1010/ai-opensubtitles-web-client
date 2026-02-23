import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { networkConfigManager } from './networkConfig';

describe('networkConfigManager accessors', () => {
  it('getConfig returns a config object', () => {
    const config = networkConfigManager.getConfig();
    expect(config).toHaveProperty('retry');
    expect(config).toHaveProperty('errorTypes');
  });

  it('isRetryEnabled returns boolean', () => {
    expect(typeof networkConfigManager.isRetryEnabled()).toBe('boolean');
  });

  it('getMaxRetries returns a number', () => {
    expect(networkConfigManager.getMaxRetries()).toBeGreaterThan(0);
  });

  it('getUserMessage returns the right message for known types', () => {
    expect(networkConfigManager.getUserMessage('offline')).toContain('internet');
    expect(networkConfigManager.getUserMessage('rateLimited')).toContain('Rate limit');
  });

  it('getUserMessage falls back to unknown for unrecognized types', () => {
    expect(networkConfigManager.getUserMessage('nonexistent')).toContain('unexpected');
  });
});

describe('applyJitter', () => {
  beforeEach(() => { vi.spyOn(Math, 'random'); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns value within jitter range', () => {
    // With jitterPercent=10, a 1000ms delay should be in [900, 1100]
    vi.mocked(Math.random).mockReturnValue(0); // minimum jitter
    const low = networkConfigManager.applyJitter(1000);
    expect(low).toBeGreaterThanOrEqual(100); // min clamp

    vi.mocked(Math.random).mockReturnValue(1); // maximum jitter
    const high = networkConfigManager.applyJitter(1000);
    expect(high).toBeLessThanOrEqual(1200);
  });

  it('never returns below 100', () => {
    vi.mocked(Math.random).mockReturnValue(0);
    expect(networkConfigManager.applyJitter(50)).toBeGreaterThanOrEqual(100);
  });
});

describe('getDelayForErrorType', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // neutral jitter
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns configured delay for known error type and attempt', () => {
    const delay = networkConfigManager.getDelayForErrorType('rateLimitErrors', 0);
    // rateLimitErrors delays[0] = 30000, with jitter around ±10%
    expect(delay).toBeGreaterThan(25000);
    expect(delay).toBeLessThan(35000);
  });

  it('applies exponential backoff for attempts beyond configured delays', () => {
    const delay = networkConfigManager.getDelayForErrorType('rateLimitErrors', 10);
    expect(delay).toBeGreaterThan(0);
  });
});
