import CacheManager from '../cache';
import { apiRequestWithRetry, getUserFriendlyErrorMessage } from '../../utils/networkUtils';
import { logger } from '../../utils/errorLogger';
import { rethrowIfAuthError } from './helpers';
import type {
  ApiContext,
  TranslationOptions,
  TranslationInfo,
  LanguageInfo,
  APIResponse,
  CompletedTaskData,
} from './types';

export async function getTranslationInfo(ctx: ApiContext): Promise<{ success: boolean; data?: TranslationInfo; error?: string }> {
  const cacheKey = 'translation_info';
  const cached = CacheManager.get<TranslationInfo>(cacheKey);
  if (cached) return { success: true, data: cached };
  if (!ctx.apiKey) return { success: false, error: 'API Key is required' };

  try {
    return await apiRequestWithRetry(async () => {
      const headers = ctx.getHeaders(true, 'application/json');
      const [apisResponse, languagesResponse] = await Promise.all([
        fetch(ctx.getAIUrl('/info/translation_apis'), { method: 'POST', headers }),
        fetch(ctx.getAIUrl('/info/translation_languages'), { method: 'POST', headers }),
      ]);

      if (!apisResponse.ok) { const e = new Error(`APIs request failed: ${apisResponse.status}`); (e as any).status = apisResponse.status; throw e; }
      if (!languagesResponse.ok) { const e = new Error(`Languages request failed: ${languagesResponse.status}`); (e as any).status = languagesResponse.status; throw e; }

      const apisData = await apisResponse.json();
      const languagesData = await languagesResponse.json();
      const data: TranslationInfo = { apis: apisData.data || apisData, languages: languagesData.data || languagesData };
      CacheManager.set(cacheKey, data);
      return { success: true, data };
    }, 'Get Translation Info', 3);
  } catch (error: any) {
    rethrowIfAuthError(error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

export async function initiateTranslation(ctx: ApiContext, subtitleFile: File | Blob, options: TranslationOptions): Promise<APIResponse> {
  try {
    logger.info('API', 'Initiating translation', { api: options.api, translateFrom: options.translateFrom, translateTo: options.translateTo });
    CacheManager.removeByPrefix('recent_media');
    CacheManager.removeByPrefix('recent_activities');

    return await apiRequestWithRetry(async () => {
      const formData = new FormData();
      formData.append('file', subtitleFile, (subtitleFile as File).name || 'subtitle.srt');
      formData.append('translate_from', options.translateFrom);
      formData.append('translate_to', options.translateTo);
      formData.append('api', options.api);
      if (options.returnContent) formData.append('return_content', 'true');

      const headers: Record<string, string> = { 'Accept': 'application/json', 'Api-Key': ctx.apiKey || '' };
      if (ctx.token) headers['Authorization'] = `Bearer ${ctx.token}`;

      const response = await fetch(ctx.getAIUrl('/translate'), { method: 'POST', headers, body: formData });
      if (!response.ok) {
        const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).responseText = await response.text().catch(() => '');
        throw error;
      }
      return await response.json();
    }, 'Initiate Translation', 3);
  } catch (error: any) {
    rethrowIfAuthError(error);
    let errorMessage = error.message || 'Translation failed';
    if (error.responseText) {
      try { const parsed = JSON.parse(error.responseText); errorMessage = parsed.error || parsed.message || (parsed.errors && parsed.errors.join(', ')) || errorMessage; } catch { errorMessage = error.responseText || errorMessage; }
    }
    return { status: 'ERROR', errors: [errorMessage] };
  }
}

export async function checkTranslationStatus(ctx: ApiContext, correlationId: string): Promise<APIResponse<CompletedTaskData>> {
  try {
    return await apiRequestWithRetry(async () => {
      const response = await fetch(ctx.getAIUrl(`/translation/${correlationId}`), { method: 'POST', headers: ctx.getHeaders(true, 'application/json') });
      if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
      return await response.json();
    }, `Check Translation Status (${correlationId})`);
  } catch (error: any) {
    rethrowIfAuthError(error);
    return { status: 'ERROR', errors: [error.message || 'Failed to check translation status'] };
  }
}

export async function getTranslationLanguagesForApi(ctx: ApiContext, apiId: string): Promise<{ success: boolean; data?: LanguageInfo[]; error?: string }> {
  const cacheKey = `translation_languages_${apiId}`;
  const cached = CacheManager.get<LanguageInfo[]>(cacheKey);
  if (cached) return { success: true, data: cached };

  try {
    return await apiRequestWithRetry(async () => {
      const response = await fetch(ctx.getAIUrl('/info/translation_languages'), {
        method: 'POST', headers: ctx.getHeaders(true, 'application/json'), body: JSON.stringify({ api: apiId })
      });
      if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
      const responseData = await response.json();

      let data: LanguageInfo[] = [];
      if (responseData.data) {
        if (typeof responseData.data === 'object' && !Array.isArray(responseData.data)) data = responseData.data[apiId] || [];
        else if (Array.isArray(responseData.data)) data = responseData.data;
      } else if (typeof responseData === 'object' && !Array.isArray(responseData)) data = responseData[apiId] || [];
      else if (Array.isArray(responseData)) data = responseData;

      CacheManager.set(cacheKey, data);
      return { success: true, data };
    }, `Get Translation Languages (${apiId})`, 3);
  } catch (error: any) {
    rethrowIfAuthError(error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

export async function getTranslationApisForLanguage(ctx: ApiContext, sourceLanguage: string, targetLanguage: string): Promise<{ success: boolean; data?: string[]; error?: string }> {
  const cacheKey = `translation_apis_${sourceLanguage}_${targetLanguage}`;
  const cached = CacheManager.get<string[]>(cacheKey);
  if (cached) return { success: true, data: cached };

  try {
    return await apiRequestWithRetry(async () => {
      const response = await fetch(ctx.getAIUrl('/info/translation_apis'), { method: 'POST', headers: ctx.getHeaders(true, 'application/json') });
      if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
      const responseData = await response.json();
      const allApis: string[] = responseData.data || responseData;
      CacheManager.set(cacheKey, allApis);
      return { success: true, data: allApis };
    }, `Get Translation APIs (${sourceLanguage}-${targetLanguage})`, 3);
  } catch (error: any) {
    rethrowIfAuthError(error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}
