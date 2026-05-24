import CacheManager from '../cache';
import { apiRequestWithRetry, getUserFriendlyErrorMessage } from '../../utils/networkUtils';
import { rethrowIfAuthError } from './helpers';
import type {
  ApiContext,
  SubtitleSearchParams,
  SubtitleDownloadParams,
  SubtitleLanguage,
  SubtitleLanguagesResponse,
  FeatureSearchParams,
  FeatureSearchResponse,
} from './types';

export async function searchSubtitles(ctx: ApiContext, params: SubtitleSearchParams): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!ctx.apiKey) return { success: false, error: 'API Key is required' };
  try {
    const result = await apiRequestWithRetry(async () => {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') queryParams.append(key, String(value));
      });
      const queryString = queryParams.toString();
      const url = ctx.getAIUrl(`/proxy/subtitles${queryString ? `?${queryString}` : ''}`);
      const response = await fetch(url, { method: 'GET', headers: ctx.getHeaders(true) });
      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Request failed: ${response.status} - ${errorText}`);
        (error as any).status = response.status;
        throw error;
      }
      return await response.json();
    }, 'Search Subtitles', 3);
    return { success: true, data: result };
  } catch (error: any) {
    rethrowIfAuthError(error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

export async function searchForFeatures(ctx: ApiContext, params: FeatureSearchParams): Promise<{ success: boolean; data?: FeatureSearchResponse; error?: string }> {
  if (!ctx.apiKey) return { success: false, error: 'API Key is required' };
  try {
    const result = await apiRequestWithRetry(async () => {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') queryParams.append(key, String(value));
      });
      const queryString = queryParams.toString();
      const url = ctx.getAIUrl(`/proxy/features${queryString ? `?${queryString}` : ''}`);
      const response = await fetch(url, { method: 'GET', headers: ctx.getHeaders(true) });
      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Request failed: ${response.status} - ${errorText}`);
        (error as any).status = response.status;
        throw error;
      }
      return await response.json();
    }, 'Search Features', 3);
    return { success: true, data: result };
  } catch (error: any) {
    rethrowIfAuthError(error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

export async function downloadSubtitle(ctx: ApiContext, params: SubtitleDownloadParams): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!ctx.apiKey) return { success: false, error: 'API Key is required' };
  if (!ctx.token) return { success: false, error: 'Authentication token is required' };

  try {
    const result = await apiRequestWithRetry(async () => {
      const response = await fetch(ctx.getAIUrl('/proxy/download'), {
        method: 'POST',
        headers: { ...ctx.getHeaders(true, 'application/json') },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Request failed: ${response.status} - ${errorText}`);
        (error as any).status = response.status;
        throw error;
      }
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) return await response.json();
      else { const srtContent = await response.text(); return { file: srtContent }; }
    }, 'Download Subtitle', 3);
    return { success: true, data: result };
  } catch (error: any) {
    rethrowIfAuthError(error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

export async function getSubtitleSearchLanguages(ctx: ApiContext): Promise<{ success: boolean; data?: SubtitleLanguage[]; error?: string }> {
  const cacheKey = 'subtitle_search_languages';
  const cacheExpiry = 24 * 60 * 60 * 1000;

  try {
    const cachedData = CacheManager.get<any>(cacheKey);
    if (cachedData && (Date.now() - cachedData.timestamp) < cacheExpiry) {
      return { success: true, data: cachedData.data };
    }

    const result = await apiRequestWithRetry(async () => {
      const headers: Record<string, string> = { 'Accept': 'application/json', 'Api-Key': ctx.apiKey || '' };
      const url = `${ctx.baseURL}/infos/languages`;
      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) {
        const error = new Error(`Request failed: ${response.status}`);
        (error as any).status = response.status;
        throw error;
      }
      return await response.json() as SubtitleLanguagesResponse;
    }, 'Get Subtitle Search Languages', 3);

    const languages = result.data;
    CacheManager.set(cacheKey, { data: languages, timestamp: Date.now() });
    return { success: true, data: languages };
  } catch (error: any) {
    rethrowIfAuthError(error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}
