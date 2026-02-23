import { logger } from './errorLogger';
import networkConfigManager from './networkConfig';
import { activityTracker } from './activityTracker';

export { activityTracker };

/**
 * Gets a session ID (browser-native, no Electron dependency)
 */
function getSessionId(): string {
  let id = sessionStorage.getItem('session_id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('session_id', id);
  }
  return id;
}

export enum NetworkErrorType {
  OFFLINE = 'offline',
  TIMEOUT = 'timeout',
  PROXY_ERROR = 'proxy_error',
  CLOUDFLARE_ERROR = 'cloudflare_error',
  SERVER_ERROR = 'server_error',
  AUTH_ERROR = 'auth_error',
  RATE_LIMIT = 'rate_limit',
  UNKNOWN = 'unknown'
}

export interface NetworkError {
  type: NetworkErrorType;
  message: string;
  originalError?: any;
  isRetryable: boolean;
}

export function isNetworkError(error: any): boolean {
  if (!error) return false;
  const errorMessage = error.message?.toLowerCase() || '';
  const networkErrorPatterns = [
    'failed to fetch', 'network error', 'err_internet_disconnected',
    'err_network_changed', 'err_connection_refused', 'err_name_not_resolved',
    'err_connection_timed_out', 'err_connection_reset'
  ];
  return networkErrorPatterns.some(pattern => errorMessage.includes(pattern));
}

export function categorizeNetworkError(error: any): NetworkError {
  if (!error) {
    return { type: NetworkErrorType.UNKNOWN, message: networkConfigManager.getUserMessage('unknown'), isRetryable: false };
  }

  const errorMessage = error.message?.toLowerCase() || '';
  const responseText = error.responseText?.toLowerCase() || '';
  const status = error.status || 0;
  const config = networkConfigManager.getConfig();

  for (const [errorTypeName, errorConfig] of Object.entries(config.errorTypes)) {
    if (!errorConfig.enabled) continue;
    if (errorConfig.statusCodes.length > 0 && errorConfig.statusCodes.includes(status)) {
      return createNetworkError(errorTypeName, error, errorConfig.maxRetries > 0);
    }
    if (errorConfig.keywords.length > 0) {
      const hasKeyword = errorConfig.keywords.some(keyword =>
        errorMessage.includes(keyword.toLowerCase()) || responseText.includes(keyword.toLowerCase())
      );
      if (hasKeyword) {
        return createNetworkError(errorTypeName, error, errorConfig.maxRetries > 0);
      }
    }
  }

  if (!navigator.onLine) {
    return createNetworkError('offlineErrors', error, true);
  }

  return { type: NetworkErrorType.UNKNOWN, message: networkConfigManager.getUserMessage('unknown'), originalError: error, isRetryable: false };
}

function createNetworkError(errorTypeName: string, originalError: any, isRetryable: boolean): NetworkError {
  const typeMapping: { [key: string]: NetworkErrorType } = {
    'rateLimitErrors': NetworkErrorType.RATE_LIMIT,
    'cloudflareErrors': NetworkErrorType.CLOUDFLARE_ERROR,
    'proxyErrors': NetworkErrorType.PROXY_ERROR,
    'serverErrors': NetworkErrorType.SERVER_ERROR,
    'timeoutErrors': NetworkErrorType.TIMEOUT,
    'offlineErrors': NetworkErrorType.OFFLINE,
    'authErrors': NetworkErrorType.AUTH_ERROR
  };
  const messageMapping: { [key: string]: string } = {
    'rateLimitErrors': 'rateLimited', 'cloudflareErrors': 'cloudflare',
    'proxyErrors': 'proxy', 'serverErrors': 'server',
    'timeoutErrors': 'timeout', 'offlineErrors': 'offline', 'authErrors': 'auth'
  };
  return {
    type: typeMapping[errorTypeName] || NetworkErrorType.UNKNOWN,
    message: networkConfigManager.getUserMessage(messageMapping[errorTypeName] || 'unknown'),
    originalError, isRetryable
  };
}

export function getUserFriendlyErrorMessage(error: any): string {
  return categorizeNetworkError(error).message;
}

// API connectivity cache
let apiConnectivityCache = {
  connected: true, lastChecked: 0, cacheValidMs: 30000
};

export function isOnline(): boolean { return navigator.onLine; }

export function isFullyOnline(): boolean {
  if (!navigator.onLine) return false;
  const now = Date.now();
  const cacheExpired = (now - apiConnectivityCache.lastChecked) > apiConnectivityCache.cacheValidMs;
  if (!cacheExpired) return apiConnectivityCache.connected;
  return apiConnectivityCache.connected;
}

export function updateAPIConnectivityCache(connected: boolean, cacheValidMs: number = 30000): void {
  apiConnectivityCache = { connected, lastChecked: Date.now(), cacheValidMs };
}

export function invalidateConnectivityCache(): void {
  apiConnectivityCache = { connected: true, lastChecked: 0, cacheValidMs: 30000 };
}

export async function forceConnectivityCheck(apiBaseUrl: string, timeoutMs: number = 5000): Promise<boolean> {
  const result = await checkAPIConnectivity(apiBaseUrl, timeoutMs);
  updateAPIConnectivityCache(result.connected, 30000);
  return result.connected;
}

export function getAPIConnectivityStatus(): { connected: boolean; lastChecked: number; cacheExpired: boolean } {
  const now = Date.now();
  return {
    connected: apiConnectivityCache.connected,
    lastChecked: apiConnectivityCache.lastChecked,
    cacheExpired: (now - apiConnectivityCache.lastChecked) > apiConnectivityCache.cacheValidMs
  };
}

export async function checkAPIConnectivity(
  apiBaseUrl: string, timeoutMs: number = 5000
): Promise<{ connected: boolean; error?: string; responseTime?: number }> {
  if (!navigator.onLine) {
    return { connected: false, error: 'Device is offline (no network adapter connection)' };
  }

  const startTime = Date.now();
  try {
    const sessionId = getSessionId();
    const discoveryUrl = `${apiBaseUrl}/ai/info/discovery?sessionId=${encodeURIComponent(sessionId)}`;
    logger.debug(2, 'NetworkUtils', `Testing connectivity to: ${discoveryUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(discoveryUrl, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-cache',
      headers: { 'Accept': 'application/json' }
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      await response.text();
      return { connected: true, responseTime };
    } else {
      const responseText = await response.text();
      return { connected: false, error: `API server responded with status ${response.status}: ${responseText}`, responseTime };
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    let errorMessage = 'Unknown connectivity error';
    if (error.name === 'AbortError') errorMessage = `Connection timeout after ${timeoutMs}ms`;
    else if (error.message?.toLowerCase().includes('failed to fetch')) errorMessage = 'Cannot reach API server (DNS resolution or connectivity issue)';
    else if (error.message) errorMessage = error.message;
    return { connected: false, error: errorMessage, responseTime };
  }
}

export function setupNetworkListeners(onOnline: () => void, onOffline: () => void): () => void {
  const handleOnline = () => { logger.info('NetworkUtils', 'Network connection restored'); onOnline(); };
  const handleOffline = () => { logger.info('NetworkUtils', 'Network connection lost'); onOffline(); };
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number = 3, baseDelay: number = 1000): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const networkError = categorizeNetworkError(error);
      if (!networkError.isRetryable) throw error;
      if (attempt === maxRetries) break;
      const delay = calculateRetryDelay(networkError.type, attempt, baseDelay);
      logger.info('NetworkUtils', `Retry attempt ${attempt + 1}/${maxRetries + 1} for ${networkError.type} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

function calculateRetryDelay(errorType: NetworkErrorType, attempt: number, baseDelay: number): number {
  const typeToConfigMap: { [key in NetworkErrorType]: string } = {
    [NetworkErrorType.RATE_LIMIT]: 'rateLimitErrors',
    [NetworkErrorType.CLOUDFLARE_ERROR]: 'cloudflareErrors',
    [NetworkErrorType.PROXY_ERROR]: 'proxyErrors',
    [NetworkErrorType.SERVER_ERROR]: 'serverErrors',
    [NetworkErrorType.TIMEOUT]: 'timeoutErrors',
    [NetworkErrorType.OFFLINE]: 'offlineErrors',
    [NetworkErrorType.AUTH_ERROR]: 'authErrors',
    [NetworkErrorType.UNKNOWN]: 'unknown'
  };
  const configKey = typeToConfigMap[errorType];
  if (configKey && configKey !== 'unknown') {
    return networkConfigManager.getDelayForErrorType(configKey, attempt);
  }
  const delay = baseDelay * Math.pow(2, attempt);
  return networkConfigManager.applyJitter(delay);
}

export async function apiRequestWithRetry<T>(
  requestFn: () => Promise<T>, context: string = 'API Request', maxRetries?: number
): Promise<T> {
  const requestId = activityTracker.generateRequestId();
  activityTracker.startActivity(requestId, context);
  const effectiveMaxRetries = maxRetries ?? networkConfigManager.getMaxRetries();

  try {
    if (!networkConfigManager.isRetryEnabled()) {
      return await executeRequest(requestFn, context);
    }
    return await retryWithBackoff(async () => executeRequest(requestFn, context), effectiveMaxRetries);
  } catch (error: any) {
    const networkError = categorizeNetworkError(error);
    if (networkConfigManager.getConfig().logging.logErrors) {
      logger.error('NetworkUtils', `${context} failed after ${effectiveMaxRetries + 1} attempts:`, {
        type: networkError.type, message: networkError.message, originalError: error
      });
    }
    if (error.message && error.message !== 'An unexpected error occurred' && error.message !== networkError.message) {
      const enhancedError = new Error(error.message);
      (enhancedError as any).type = networkError.type;
      (enhancedError as any).isRetryable = networkError.isRetryable;
      (enhancedError as any).originalError = error;
      throw enhancedError;
    }
    const enhancedError = new Error(networkError.message);
    (enhancedError as any).type = networkError.type;
    (enhancedError as any).isRetryable = networkError.isRetryable;
    (enhancedError as any).originalError = error;
    throw enhancedError;
  } finally {
    activityTracker.endActivity(requestId);
  }
}

async function executeRequest<T>(requestFn: () => Promise<T>, context: string): Promise<T> {
  if (!isFullyOnline()) {
    if (!isOnline()) throw new Error('Device is offline');
    else throw new Error('API server unreachable');
  }
  try {
    const result = await requestFn();
    networkConfigManager.onRequestSuccess();
    if (networkConfigManager.getConfig().logging.logSuccess) {
      logger.info('NetworkUtils', `${context}: Request successful`);
    }
    return result;
  } catch (error: any) {
    if (networkConfigManager.getConfig().logging.logErrors) {
      logger.warn('NetworkUtils', `${context}: Request failed`, { error: error.message, status: error.status });
    }
    throw error;
  }
}
