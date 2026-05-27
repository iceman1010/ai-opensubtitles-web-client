import CacheManager from '../cache';
import { apiRequestWithRetry, getUserFriendlyErrorMessage } from '../../utils/networkUtils';
import { rethrowIfAuthError } from './helpers';
import type { ApiContext, RecentMediaItem, RecentActivityItem } from './types';

export async function downloadFile(ctx: ApiContext, url: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const result = await apiRequestWithRetry(async () => {
      const response = await fetch(url, { method: 'GET', headers: ctx.getHeaders(true) });
      if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
      return await response.text();
    }, 'Download File', 3);
    return { success: true, content: result };
  } catch (error: any) {
    rethrowIfAuthError(error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

export async function downloadFileByMediaId(ctx: ApiContext, mediaId: string, fileName: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const result = await apiRequestWithRetry(async () => {
      const url = ctx.getAIUrl(`/files/${mediaId}/${fileName}`);
      const response = await fetch(url, { method: 'GET', headers: ctx.getHeaders(true) });
      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Request failed: ${response.status} - ${errorText}`);
        (error as any).status = response.status;
        throw error;
      }
      return await response.text();
    }, `Download File (${mediaId}/${fileName})`, 3);
    return { success: true, content: result };
  } catch (error: any) {
    rethrowIfAuthError(error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

export async function getRecentMedia(ctx: ApiContext, page: number = 1): Promise<{ success: boolean; data?: RecentMediaItem[]; error?: string }> {
  const cacheKey = `recent_media_page_${page}`;
  const cached = CacheManager.get<RecentMediaItem[]>(cacheKey);
  if (cached) return { success: true, data: cached };
  if (!ctx.apiKey) return { success: false, error: 'API Key is required' };

  try {
    return await apiRequestWithRetry(async () => {
      const response = await fetch(ctx.getAIUrl(`/recent_media?page=${page}`), { method: 'POST', headers: ctx.getHeaders(true, 'application/json') });
      if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
      const responseData = await response.json();
      const data: RecentMediaItem[] = responseData.data || responseData;
      CacheManager.set(cacheKey, data);
      return { success: true, data };
    }, 'Get Recent Media', 3);
  } catch (error: any) {
    rethrowIfAuthError(error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

export async function getRecentActivities(ctx: ApiContext, page: number = 1): Promise<{ success: boolean; data?: RecentActivityItem[]; error?: string }> {
  if (!ctx.apiKey) return { success: false, error: 'API Key is required' };

  try {
    return await apiRequestWithRetry(async () => {
      const response = await fetch(ctx.getAIUrl(`/recent_activities?page=${page}`), { method: 'POST', headers: ctx.getHeaders(true, 'application/json') });
      if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
      const responseData = await response.json();
      const data: RecentActivityItem[] = responseData.data || responseData;
      return { success: true, data };
    }, 'Get Recent Activities', 3);
  } catch (error: any) {
    rethrowIfAuthError(error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}
