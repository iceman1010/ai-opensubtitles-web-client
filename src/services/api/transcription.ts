import CacheManager from '../cache';
import { apiRequestWithRetry, getUserFriendlyErrorMessage } from '../../utils/networkUtils';
import { logger } from '../../utils/errorLogger';
import { rethrowIfAuthError } from './helpers';
import type {
  ApiContext,
  TranscriptionOptions,
  TranscriptionInfo,
  LanguageInfo,
  APIResponse,
  CompletedTaskData,
} from './types';

export async function getTranscriptionInfo(ctx: ApiContext): Promise<{ success: boolean; data?: TranscriptionInfo; error?: string }> {
  const cacheKey = 'transcription_info';
  const cached = CacheManager.get<TranscriptionInfo>(cacheKey);
  if (cached) return { success: true, data: cached };
  if (!ctx.apiKey) return { success: false, error: 'API Key is required' };

  try {
    return await apiRequestWithRetry(async () => {
      const headers = ctx.getHeaders(true, 'application/json');
      const [apisResponse, languagesResponse] = await Promise.all([
        fetch(ctx.getAIUrl('/info/transcription_apis'), { method: 'POST', headers }),
        fetch(ctx.getAIUrl('/info/transcription_languages'), { method: 'POST', headers }),
      ]);

      if (!apisResponse.ok) { const e = new Error(`APIs request failed: ${apisResponse.status}`); (e as any).status = apisResponse.status; throw e; }
      if (!languagesResponse.ok) { const e = new Error(`Languages request failed: ${languagesResponse.status}`); (e as any).status = languagesResponse.status; throw e; }

      const apisData = await apisResponse.json();
      const languagesData = await languagesResponse.json();
      const data: TranscriptionInfo = { apis: apisData.data || apisData, languages: languagesData.data || languagesData };
      CacheManager.set(cacheKey, data);
      return { success: true, data };
    }, 'Get Transcription Info', 3);
  } catch (error: any) {
    rethrowIfAuthError(error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}

export async function initiateTranscription(ctx: ApiContext, audioFile: File | Blob, options: TranscriptionOptions): Promise<APIResponse> {
  try {
    logger.info('API', 'Initiating transcription', { api: options.api, language: options.language });
    CacheManager.removeByPrefix('recent_media');
    CacheManager.removeByPrefix('recent_activities');

    return await apiRequestWithRetry(async () => {
      const formData = new FormData();
      formData.append('file', audioFile, (audioFile as File).name || 'audio.mp3');
      formData.append('language', options.language);
      formData.append('api', options.api);
      if (options.returnContent) formData.append('return_content', 'true');

      const headers: Record<string, string> = { 'Api-Key': ctx.apiKey || '' };
      if (ctx.token) headers['Authorization'] = `Bearer ${ctx.token}`;

      const response = await fetch(ctx.getAIUrl('/transcribe'), { method: 'POST', headers, body: formData });
      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Request failed: ${response.status} ${response.statusText} - ${errorText}`);
        (error as any).status = response.status;
        (error as any).responseText = errorText;
        throw error;
      }
      return await response.json();
    }, 'Initiate Transcription', 3);
  } catch (error: any) {
    rethrowIfAuthError(error);
    let errorMessage = error.message || 'Transcription failed';
    if (error.responseText) {
      try { const parsed = JSON.parse(error.responseText); errorMessage = parsed.error || parsed.message || (parsed.errors && parsed.errors.join(', ')) || errorMessage; } catch { errorMessage = error.responseText || errorMessage; }
    }
    return { status: 'ERROR', errors: [errorMessage] };
  }
}

export async function checkTranscriptionStatus(ctx: ApiContext, correlationId: string): Promise<APIResponse<CompletedTaskData>> {
  try {
    return await apiRequestWithRetry(async () => {
      const response = await fetch(ctx.getAIUrl(`/transcribe/${correlationId}`), { method: 'POST', headers: ctx.getHeaders(true, 'application/json') });
      if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
      return await response.json();
    }, `Check Transcription Status (${correlationId})`);
  } catch (error: any) {
    rethrowIfAuthError(error);
    return { status: 'ERROR', errors: [error.message || 'Failed to check transcription status'] };
  }
}

export async function getTranscriptionLanguagesForApi(ctx: ApiContext, apiId: string): Promise<{ success: boolean; data?: LanguageInfo[]; error?: string }> {
  const cacheKey = `transcription_languages_${apiId}`;
  const cached = CacheManager.get<LanguageInfo[]>(cacheKey);
  if (cached) return { success: true, data: cached };

  try {
    return await apiRequestWithRetry(async () => {
      const response = await fetch(ctx.getAIUrl('/info/transcription_languages'), {
        method: 'POST', headers: ctx.getHeaders(true, 'application/json'), body: JSON.stringify({ api: apiId })
      });
      if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
      const data: LanguageInfo[] = await response.json();
      CacheManager.set(cacheKey, data);
      return { success: true, data };
    }, `Get Transcription Languages (${apiId})`, 3);
  } catch (error: any) {
    rethrowIfAuthError(error);
    return { success: false, error: getUserFriendlyErrorMessage(error) };
  }
}
