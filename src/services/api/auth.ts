import { storageService } from '../storageService';
import { logger } from '../../utils/errorLogger';
import { getUserFriendlyErrorMessage } from '../../utils/networkUtils';
import { getUserAgent, rethrowIfAuthError } from './helpers';
import type { ApiContext } from './types';

export function buildHeaders(
  apiKey: string,
  token: string,
  includeAuth: boolean = true,
  contentType?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Api-Key': apiKey || '',
    'User-Agent': getUserAgent(),
    'X-User-Agent': getUserAgent(),
  };
  if (contentType) headers['Content-Type'] = contentType;
  if (includeAuth && token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export function buildAIUrl(baseURL: string, endpoint: string, apiUrlParameter: string): string {
  const baseUrl = `${baseURL}/ai${endpoint}`;
  return apiUrlParameter ? `${baseUrl}${apiUrlParameter}` : baseUrl;
}

export function buildLoginUrl(baseURL: string, endpoint: string, apiUrlParameter: string): string {
  const baseUrl = `${baseURL}${endpoint}`;
  return apiUrlParameter ? `${baseUrl}${apiUrlParameter}` : baseUrl;
}

export function getApiContext(
  baseURL: string,
  apiKey: string,
  token: string,
  apiUrlParameter: string,
): ApiContext {
  return {
    apiKey,
    token,
    baseURL,
    apiUrlParameter,
    getHeaders: (includeAuth?: boolean, contentType?: string) =>
      buildHeaders(apiKey, token, includeAuth, contentType),
    getAIUrl: (endpoint: string) => buildAIUrl(baseURL, endpoint, apiUrlParameter),
    getLoginUrl: (endpoint: string) => buildLoginUrl(baseURL, endpoint, apiUrlParameter),
  };
}

export async function loginRequest(
  ctx: ApiContext,
  username: string,
  password: string,
): Promise<{ success: boolean; token?: string; user_id?: number; error?: string }> {
  if (!username || !password) return { success: false, error: 'Username and password are required' };

  try {
    logger.info('API', `Attempting login with username: ${username}`);
    const response = await fetch(ctx.getLoginUrl('/login'), {
      method: 'POST',
      headers: ctx.getHeaders(false, 'application/json'),
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const parsed = JSON.parse(errorText);
        errorMessage = parsed.error || parsed.message || errorMessage;
      } catch {
        if (errorText) errorMessage = errorText;
      }

      if (errorMessage.toLowerCase() === 'blocked') {
        errorMessage = 'Account temporarily blocked by the API. Please wait a few minutes and try again.';
      } else if (response.status === 401) {
        errorMessage = 'Invalid username or password.';
      } else if (response.status === 429) {
        errorMessage = 'Too many login attempts. Please wait before trying again.';
      }

      logger.error('API', `Login failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }

    const responseData = await response.json();
    if (responseData.token) {
      storageService.saveToken(responseData.token);
      logger.info('API', 'Login successful, token set and cached');
      return { success: true, token: responseData.token, user_id: responseData.user?.user_id };
    }
    return { success: false, error: 'No token received from server' };
  } catch (error: any) {
    logger.error('API', 'Login error', { error: error.message });
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

export function loadCachedTokenSync(): { token: string | null } {
  try {
    const cachedToken = storageService.getValidToken();
    if (cachedToken) {
      logger.info('API', 'Using cached authentication token');
      return { token: cachedToken };
    }
    return { token: null };
  } catch (error) {
    logger.error('API', 'Failed to load cached token', error);
    return { token: null };
  }
}

export function saveToken(token: string): void {
  try {
    storageService.saveToken(token);
    logger.info('API', 'Token saved to cache');
  } catch (error) {
    logger.error('API', 'Failed to save token', error);
  }
}

export function clearCachedTokenSync(): void {
  try {
    storageService.clearToken();
    logger.info('API', 'Cached token cleared');
  } catch (error) {
    logger.error('API', 'Failed to clear token', error);
  }
}

export { rethrowIfAuthError };
