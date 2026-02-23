import { describe, it, expect } from 'vitest';
import { isNetworkError, categorizeNetworkError, NetworkErrorType } from './networkUtils';

describe('NetworkErrorType enum', () => {
  it('has expected values', () => {
    expect(NetworkErrorType.OFFLINE).toBe('offline');
    expect(NetworkErrorType.TIMEOUT).toBe('timeout');
    expect(NetworkErrorType.RATE_LIMIT).toBe('rate_limit');
    expect(NetworkErrorType.PROXY_ERROR).toBe('proxy_error');
    expect(NetworkErrorType.SERVER_ERROR).toBe('server_error');
    expect(NetworkErrorType.UNKNOWN).toBe('unknown');
  });
});

describe('isNetworkError', () => {
  it('detects "failed to fetch"', () => {
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true);
  });

  it('detects "network error"', () => {
    expect(isNetworkError(new Error('Network Error'))).toBe(true);
  });

  it('detects connection refused', () => {
    expect(isNetworkError(new Error('ERR_CONNECTION_REFUSED'))).toBe(true);
  });

  it('returns false for null/undefined', () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });

  it('returns false for non-network errors', () => {
    expect(isNetworkError(new Error('Syntax error'))).toBe(false);
  });
});

describe('categorizeNetworkError', () => {
  it('categorizes 429 as RATE_LIMIT', () => {
    const err = { status: 429, message: 'too many' };
    expect(categorizeNetworkError(err).type).toBe(NetworkErrorType.RATE_LIMIT);
  });

  it('categorizes 502 as PROXY_ERROR', () => {
    const err = { status: 502, message: 'bad gateway' };
    expect(categorizeNetworkError(err).type).toBe(NetworkErrorType.PROXY_ERROR);
  });

  it('categorizes 500 as SERVER_ERROR', () => {
    const err = { status: 500, message: 'internal' };
    expect(categorizeNetworkError(err).type).toBe(NetworkErrorType.SERVER_ERROR);
  });

  it('categorizes timeout keyword as TIMEOUT', () => {
    const err = { message: 'Connection timeout' };
    expect(categorizeNetworkError(err).type).toBe(NetworkErrorType.TIMEOUT);
  });

  it('returns UNKNOWN for null', () => {
    expect(categorizeNetworkError(null).type).toBe(NetworkErrorType.UNKNOWN);
  });

  it('returns UNKNOWN for unrecognized error', () => {
    const err = { status: 418, message: 'I am a teapot' };
    expect(categorizeNetworkError(err).type).toBe(NetworkErrorType.UNKNOWN);
  });
});
