import { apiRequestWithRetry, getUserFriendlyErrorMessage } from '../../utils/networkUtils';
import { rethrowIfAuthError } from './helpers';
import type { ApiContext, APIResponse, LanguageDetectionResult } from './types';

export async function detectLanguage(ctx: ApiContext, file: File | Blob, duration?: number): Promise<APIResponse<LanguageDetectionResult>> {
  try {
    return await apiRequestWithRetry(async () => {
      const formData = new FormData();
      formData.append('file', file, (file as File).name || 'audio.mp3');
      if (duration) formData.append('duration', duration.toString());

      const headers: Record<string, string> = { 'Api-Key': ctx.apiKey || '' };
      if (ctx.token) headers['Authorization'] = `Bearer ${ctx.token}`;

      const response = await fetch(ctx.getAIUrl('/detect_language'), { method: 'POST', headers, body: formData });
      if (!response.ok) {
        const errorBody = await response.text();
        const error = new Error(`Request failed: ${response.status} - ${errorBody}`);
        (error as any).status = response.status;
        (error as any).responseText = errorBody;
        throw error;
      }
      return await response.json();
    }, 'Detect Language', 3);
  } catch (error: any) {
    rethrowIfAuthError(error);
    let errorMessage = error.message || 'Language detection failed';
    if (error.responseText) {
      try { const parsed = JSON.parse(error.responseText); errorMessage = parsed.error || parsed.message || errorMessage; } catch { errorMessage = error.responseText || errorMessage; }
    }
    return { status: 'ERROR', errors: [errorMessage] };
  }
}

export async function checkLanguageDetectionStatus(ctx: ApiContext, correlationId: string): Promise<APIResponse<LanguageDetectionResult>> {
  try {
    return await apiRequestWithRetry(async () => {
      const response = await fetch(ctx.getAIUrl(`/detectLanguage/${correlationId}`), { method: 'POST', headers: ctx.getHeaders(true, 'application/json') });
      if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
      return await response.json();
    }, `Check Language Detection Status (${correlationId})`);
  } catch (error: any) {
    rethrowIfAuthError(error);
    let errorMessage = error.message || 'Language detection status check failed';
    if (error.responseText) {
      try { const parsed = JSON.parse(error.responseText); errorMessage = parsed.error || parsed.message || errorMessage; } catch { errorMessage = error.responseText || errorMessage; }
    }
    return { status: 'ERROR', errors: [errorMessage] };
  }
}
