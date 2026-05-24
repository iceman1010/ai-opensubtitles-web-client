import CacheManager from '../cache';
import { apiRequestWithRetry, getUserFriendlyErrorMessage } from '../../utils/networkUtils';
import { rethrowIfAuthError } from './helpers';
import type { ApiContext, ServicesInfo, CreditPackage } from './types';

export async function getCredits(ctx: ApiContext): Promise<{ success: boolean; credits?: number; error?: string }> {
  try {
    return await apiRequestWithRetry(async () => {
      const response = await fetch(ctx.getAIUrl('/credits'), { method: 'POST', headers: ctx.getHeaders(true) });
      if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
      const responseData = await response.json();
      return { success: true, credits: responseData.data?.credits || responseData.credits || 0 };
    }, 'Get Credits', 3);
  } catch (error: any) {
    rethrowIfAuthError(error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

export async function getServicesInfo(ctx: ApiContext): Promise<{ success: boolean; data?: ServicesInfo; error?: string }> {
  const cacheKey = 'services_info';
  const cached = CacheManager.get<ServicesInfo>(cacheKey);
  if (cached) return { success: true, data: cached };
  if (!ctx.apiKey) return { success: false, error: 'API Key is required' };

  try {
    return await apiRequestWithRetry(async () => {
      const response = await fetch(ctx.getAIUrl('/info/services'), { method: 'GET', headers: ctx.getHeaders(true, 'application/json') });
      if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
      const responseData = await response.json();
      const data: ServicesInfo = responseData.data || responseData;
      CacheManager.set(cacheKey, data);
      return { success: true, data };
    }, 'Get Services Info', 3);
  } catch (error: any) {
    rethrowIfAuthError(error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

export async function getCreditPackages(ctx: ApiContext, email?: string): Promise<{ success: boolean; data?: CreditPackage[]; error?: string }> {
  const cacheKey = `credit_packages_${email || 'default'}`;
  const cached = CacheManager.get<CreditPackage[]>(cacheKey);
  if (cached) return { success: true, data: cached };

  try {
    return await apiRequestWithRetry(async () => {
      const headers: Record<string, string> = { 'Accept': 'application/json', 'Api-Key': ctx.apiKey || '' };
      if (ctx.token) headers['Authorization'] = `Bearer ${ctx.token}`;

      const body = new FormData();
      if (email) body.append('email', email);

      const response = await fetch(ctx.getAIUrl('/credits/buy'), { method: 'POST', headers, body });
      if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
      const responseData = await response.json();
      if (responseData.data && Array.isArray(responseData.data)) {
        CacheManager.set(cacheKey, responseData.data);
        return { success: true, data: responseData.data };
      }
      throw new Error('Invalid response format');
    }, 'Get Credit Packages', 3);
  } catch (error: any) {
    rethrowIfAuthError(error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}
