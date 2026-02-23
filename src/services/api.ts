import CacheManager from './cache';
import { storageService } from './storageService';
import { logger } from '../utils/errorLogger';
import { apiRequestWithRetry, getUserFriendlyErrorMessage } from '../utils/networkUtils';
import appConfig from '../config/appConfig.json';

const getUserAgent = () => {
  if (appConfig && appConfig.userAgent) {
    return appConfig.userAgent;
  }
  return 'AI.Opensubtitles.com-Web v1.0.0';
};

export interface TranscriptionOptions {
  language: string;
  api: string;
  returnContent?: boolean;
}

export interface TranslationOptions {
  translateFrom: string;
  translateTo: string;
  api: string;
  returnContent?: boolean;
}

export interface APIResponse<T = any> {
  correlation_id?: string;
  status: 'CREATED' | 'PENDING' | 'COMPLETED' | 'ERROR' | 'TIMEOUT';
  data?: T;
  errors?: string[];
  translation?: string;
}

export interface LanguageInfo {
  language_code: string;
  language_name: string;
}

export interface TranscriptionInfo {
  apis: any;
  languages: LanguageInfo[] | { [apiName: string]: LanguageInfo[] };
}

export interface TranslationInfo {
  apis: any;
  languages: { [apiName: string]: LanguageInfo[] };
}

export interface ServiceModel {
  name: string;
  display_name: string;
  description: string;
  pricing: string;
  reliability: string;
  price: number;
  languages_supported: LanguageInfo[];
}

export interface ServicesInfo {
  Translation: ServiceModel[];
  Transcription: ServiceModel[];
}

export interface CreditPackage {
  name: string;
  value: string;
  discount_percent: number;
  checkout_url: string;
}

export interface SubtitleSearchParams {
  query?: string;
  imdb_id?: string;
  tmdb_id?: string;
  parent_imdb_id?: string;
  parent_tmdb_id?: string;
  moviehash?: string;
  languages?: string;
  episode_number?: number;
  season_number?: number;
  year?: number;
  type?: string;
  page?: number;
  order_by?: string;
  order_direction?: string;
  ai_translated?: boolean;
  foreign_parts_only?: boolean;
  hearing_impaired?: boolean;
  machine_translated?: boolean;
  trusted_sources?: boolean;
  user_id?: string;
  parent_feature_id?: string;
}

export interface SubtitleDownloadParams {
  file_id: number;
  sub_format?: string;
  file_name?: string;
  in_fps?: number;
  out_fps?: number;
  timeshift?: number;
  force_download?: boolean;
}

export interface SubtitleLanguage {
  language_code: string;
  language_name: string;
}

export interface SubtitleLanguagesResponse {
  data: SubtitleLanguage[];
}

export interface FeatureSearchParams {
  feature_id?: number;
  full_search?: boolean;
  imdb_id?: string;
  query?: string;
  query_match?: 'start' | 'word' | 'exact';
  tmdb_id?: string;
  type?: 'movie' | 'tvshow' | 'episode';
  year?: number;
}

export interface FeatureAttributes {
  title?: string;
  original_title?: string;
  year?: number | string;
  kind?: string;
  imdb_id?: number;
  tmdb_id?: number;
  feature_id?: number | string;
  episode_number?: number;
  season_number?: number;
  parent_title?: string;
  parent_imdb_id?: number;
  parent_tmdb_id?: number;
  parent_feature_id?: number;
  subtitles_count?: number;
  seasons_count?: number;
  subtitles_counts?: { [languageCode: string]: number };
  ai_subtitles_counts?: { [languageCode: string]: number };
  title_aka?: string[];
  feature_type?: string;
  url?: string;
  img_url?: string;
  seasons?: Array<{
    season_number: number;
    episodes: Array<{
      episode_number: number;
      title: string;
      feature_id: number;
      feature_imdb_id: number;
      slug: string;
    }>;
  }>;
}

export interface Feature {
  id: string;
  type: string;
  attributes: FeatureAttributes;
}

export interface FeatureSearchResponse {
  data: Feature[];
  total_count?: number;
  total_pages?: number;
  page?: number;
  per_page?: number;
}

export interface CompletedTaskData {
  file_name: string;
  url: string;
  character_count: number;
  unit_price: number;
  total_price: number;
  credits_left: number;
  task: {
    login: string;
    loginid: string;
    id: string;
    api: string;
    language: string;
    translation?: string;
    start_time: number;
  };
  complete: number;
}

export interface DetectedLanguage {
  W3C: string;
  name: string;
  native: string;
  ISO_639_1: string;
  ISO_639_2b: string;
}

export interface LanguageDetectionResult {
  format?: string;
  type: 'text' | 'audio';
  language?: DetectedLanguage;
  duration?: number;
  media?: string;
}

export interface RecentMediaItem {
  id: number;
  time: number;
  time_str: string;
  files?: string[];
}

// In dev mode, use relative URL so Vite proxy handles CORS
// In production, we use the dedicated Nginx proxy path to bypass CORS and inject the required User-Agent
const DEFAULT_BASE_URL = import.meta.env.DEV
  ? '/api/v1'
  : '/ai-web/api-log.php';

export class OpenSubtitlesAPI {
  private baseURL = DEFAULT_BASE_URL;
  public apiKey: string = '';
  private token: string = '';
  private apiUrlParameter: string = '';

  constructor(apiKey?: string, baseUrl?: string, apiUrlParameter?: string) {
    if (apiKey) this.setApiKey(apiKey);
    if (baseUrl) this.setBaseUrl(baseUrl);
    if (apiUrlParameter) this.setApiUrlParameter(apiUrlParameter);
  }

  setBaseUrl(baseUrl: string): void { this.baseURL = baseUrl; }
  setApiUrlParameter(apiUrlParameter: string): void { this.apiUrlParameter = apiUrlParameter; }

  private getAIUrl(endpoint: string): string {
    const baseUrl = `${this.baseURL}/ai${endpoint}`;
    return this.apiUrlParameter ? `${baseUrl}${this.apiUrlParameter}` : baseUrl;
  }

  private getLoginUrl(endpoint: string): string {
    const baseUrl = `${this.baseURL}${endpoint}`;
    return this.apiUrlParameter ? `${baseUrl}${this.apiUrlParameter}` : baseUrl;
  }

  setApiKey(apiKey: string): void { this.apiKey = apiKey; }

  async loadCachedToken(): Promise<boolean> {
    try {
      const cachedToken = storageService.getValidToken();
      if (cachedToken) {
        this.token = cachedToken;
        logger.info('API', 'Using cached authentication token');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('API', 'Failed to load cached token', error);
      return false;
    }
  }

  private saveToken(token: string): void {
    try {
      storageService.saveToken(token);
      logger.info('API', 'Token saved to cache');
    } catch (error) {
      logger.error('API', 'Failed to save token', error);
    }
  }

  async clearCachedToken(): Promise<void> {
    try {
      storageService.clearToken();
      this.token = '';
      logger.info('API', 'Cached token cleared');
    } catch (error) {
      logger.error('API', 'Failed to clear token', error);
    }
  }

  private getHeaders(includeAuth: boolean = true, contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Api-Key': this.apiKey || '',
      'User-Agent': getUserAgent(),
    };
    if (contentType) headers['Content-Type'] = contentType;
    if (includeAuth && this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  async login(username: string, password: string): Promise<{ success: boolean; token?: string; error?: string }> {
    if (!username || !password) return { success: false, error: 'Username and password are required' };
    if (!this.apiKey) return { success: false, error: 'API Key is required for authentication' };

    try {
      // Single attempt — never retry login to avoid hammering the server
      logger.info('API', `Attempting login with username: ${username}`);
      const response = await fetch(this.getLoginUrl('/login'), {
        method: 'POST',
        headers: this.getHeaders(false, 'application/json'),
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

        // Provide user-friendly messages for known errors
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
        this.token = responseData.token;
        this.saveToken(this.token);
        logger.info('API', 'Login successful, token set and cached');
        return { success: true, token: this.token };
      }
      return { success: false, error: 'No token received from server' };
    } catch (error: any) {
      logger.error('API', 'Login error', { error: error.message });
      return { success: false, error: getUserFriendlyErrorMessage(error) };
    }
  }

  async getTranscriptionInfo(): Promise<{ success: boolean; data?: TranscriptionInfo; error?: string }> {
    const cacheKey = 'transcription_info';
    const cached = CacheManager.get<TranscriptionInfo>(cacheKey);
    if (cached) return { success: true, data: cached };
    if (!this.apiKey) return { success: false, error: 'API Key is required' };

    try {
      return await apiRequestWithRetry(async () => {
        const headers = this.getHeaders(true, 'application/json');
        const [apisResponse, languagesResponse] = await Promise.all([
          fetch(this.getAIUrl('/info/transcription_apis'), { method: 'POST', headers }),
          fetch(this.getAIUrl('/info/transcription_languages'), { method: 'POST', headers }),
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
      return { success: false, error: getUserFriendlyErrorMessage(error) };
    }
  }

  async getTranslationInfo(): Promise<{ success: boolean; data?: TranslationInfo; error?: string }> {
    const cacheKey = 'translation_info';
    const cached = CacheManager.get<TranslationInfo>(cacheKey);
    if (cached) return { success: true, data: cached };
    if (!this.apiKey) return { success: false, error: 'API Key is required' };

    try {
      return await apiRequestWithRetry(async () => {
        const headers = this.getHeaders(true, 'application/json');
        const [apisResponse, languagesResponse] = await Promise.all([
          fetch(this.getAIUrl('/info/translation_apis'), { method: 'POST', headers }),
          fetch(this.getAIUrl('/info/translation_languages'), { method: 'POST', headers }),
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
      return { success: false, error: getUserFriendlyErrorMessage(error) };
    }
  }

  async initiateTranscription(audioFile: File | Blob, options: TranscriptionOptions): Promise<APIResponse> {
    try {
      logger.info('API', 'Initiating transcription', { api: options.api, language: options.language });
      CacheManager.remove('recent_media');

      return await apiRequestWithRetry(async () => {
        const formData = new FormData();
        formData.append('file', audioFile, (audioFile as File).name || 'audio.mp3');
        formData.append('language', options.language);
        formData.append('api', options.api);
        if (options.returnContent) formData.append('return_content', 'true');

        const headers: Record<string, string> = { 'Api-Key': this.apiKey || '' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

        const response = await fetch(this.getAIUrl('/transcribe'), { method: 'POST', headers, body: formData });
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
      let errorMessage = error.message || 'Transcription failed';
      if (error.responseText) {
        try { const parsed = JSON.parse(error.responseText); errorMessage = parsed.error || parsed.message || (parsed.errors && parsed.errors.join(', ')) || errorMessage; } catch { errorMessage = error.responseText || errorMessage; }
      }
      return { status: 'ERROR', errors: [errorMessage] };
    }
  }

  async initiateTranslation(subtitleFile: File | Blob, options: TranslationOptions): Promise<APIResponse> {
    try {
      logger.info('API', 'Initiating translation', { api: options.api, translateFrom: options.translateFrom, translateTo: options.translateTo });
      CacheManager.remove('recent_media');

      return await apiRequestWithRetry(async () => {
        const formData = new FormData();
        formData.append('file', subtitleFile, (subtitleFile as File).name || 'subtitle.srt');
        formData.append('translate_from', options.translateFrom);
        formData.append('translate_to', options.translateTo);
        formData.append('api', options.api);
        if (options.returnContent) formData.append('return_content', 'true');

        const headers: Record<string, string> = { 'Accept': 'application/json', 'Api-Key': this.apiKey || '' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

        const response = await fetch(this.getAIUrl('/translate'), { method: 'POST', headers, body: formData });
        if (!response.ok) {
          const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
          (error as any).status = response.status;
          (error as any).responseText = await response.text().catch(() => '');
          throw error;
        }
        return await response.json();
      }, 'Initiate Translation', 3);
    } catch (error: any) {
      let errorMessage = error.message || 'Translation failed';
      if (error.responseText) {
        try { const parsed = JSON.parse(error.responseText); errorMessage = parsed.error || parsed.message || (parsed.errors && parsed.errors.join(', ')) || errorMessage; } catch { errorMessage = error.responseText || errorMessage; }
      }
      return { status: 'ERROR', errors: [errorMessage] };
    }
  }

  async checkTranscriptionStatus(correlationId: string): Promise<APIResponse<CompletedTaskData>> {
    try {
      return await apiRequestWithRetry(async () => {
        const response = await fetch(this.getAIUrl(`/transcribe/${correlationId}`), { method: 'POST', headers: this.getHeaders(true, 'application/json') });
        if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
        return await response.json();
      }, `Check Transcription Status (${correlationId})`);
    } catch (error: any) {
      return { status: 'ERROR', errors: [error.message || 'Failed to check transcription status'] };
    }
  }

  async checkTranslationStatus(correlationId: string): Promise<APIResponse<CompletedTaskData>> {
    try {
      return await apiRequestWithRetry(async () => {
        const response = await fetch(this.getAIUrl(`/translation/${correlationId}`), { method: 'POST', headers: this.getHeaders(true, 'application/json') });
        if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
        return await response.json();
      }, `Check Translation Status (${correlationId})`);
    } catch (error: any) {
      return { status: 'ERROR', errors: [error.message || 'Failed to check translation status'] };
    }
  }

  async detectLanguage(file: File | Blob, duration?: number): Promise<APIResponse<LanguageDetectionResult>> {
    try {
      return await apiRequestWithRetry(async () => {
        const formData = new FormData();
        formData.append('file', file, (file as File).name || 'audio.mp3');
        if (duration) formData.append('duration', duration.toString());

        const headers: Record<string, string> = { 'Api-Key': this.apiKey || '' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

        const response = await fetch(this.getAIUrl('/detect_language'), { method: 'POST', headers, body: formData });
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
      let errorMessage = error.message || 'Language detection failed';
      if (error.responseText) {
        try { const parsed = JSON.parse(error.responseText); errorMessage = parsed.error || parsed.message || errorMessage; } catch { errorMessage = error.responseText || errorMessage; }
      }
      return { status: 'ERROR', errors: [errorMessage] };
    }
  }

  async checkLanguageDetectionStatus(correlationId: string): Promise<APIResponse<LanguageDetectionResult>> {
    try {
      return await apiRequestWithRetry(async () => {
        const response = await fetch(this.getAIUrl(`/detectLanguage/${correlationId}`), { method: 'POST', headers: this.getHeaders(true, 'application/json') });
        if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
        return await response.json();
      }, `Check Language Detection Status (${correlationId})`);
    } catch (error: any) {
      let errorMessage = error.message || 'Language detection status check failed';
      if (error.responseText) {
        try { const parsed = JSON.parse(error.responseText); errorMessage = parsed.error || parsed.message || errorMessage; } catch { errorMessage = error.responseText || errorMessage; }
      }
      return { status: 'ERROR', errors: [errorMessage] };
    }
  }

  async getTranscriptionLanguagesForApi(apiId: string): Promise<{ success: boolean; data?: LanguageInfo[]; error?: string }> {
    const cacheKey = `transcription_languages_${apiId}`;
    const cached = CacheManager.get<LanguageInfo[]>(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      return await apiRequestWithRetry(async () => {
        const response = await fetch(this.getAIUrl('/info/transcription_languages'), {
          method: 'POST', headers: this.getHeaders(true, 'application/json'), body: JSON.stringify({ api: apiId })
        });
        if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
        const data: LanguageInfo[] = await response.json();
        CacheManager.set(cacheKey, data);
        return { success: true, data };
      }, `Get Transcription Languages (${apiId})`, 3);
    } catch (error: any) {
      return { success: false, error: getUserFriendlyErrorMessage(error) };
    }
  }

  async getTranslationLanguagesForApi(apiId: string): Promise<{ success: boolean; data?: LanguageInfo[]; error?: string }> {
    const cacheKey = `translation_languages_${apiId}`;
    const cached = CacheManager.get<LanguageInfo[]>(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      return await apiRequestWithRetry(async () => {
        const response = await fetch(this.getAIUrl('/info/translation_languages'), {
          method: 'POST', headers: this.getHeaders(true, 'application/json'), body: JSON.stringify({ api: apiId })
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
      return { success: false, error: getUserFriendlyErrorMessage(error) };
    }
  }

  async getTranslationApisForLanguage(sourceLanguage: string, targetLanguage: string): Promise<{ success: boolean; data?: string[]; error?: string }> {
    const cacheKey = `translation_apis_${sourceLanguage}_${targetLanguage}`;
    const cached = CacheManager.get<string[]>(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      return await apiRequestWithRetry(async () => {
        const response = await fetch(this.getAIUrl('/info/translation_apis'), { method: 'POST', headers: this.getHeaders(true, 'application/json') });
        if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
        const responseData = await response.json();
        const allApis: string[] = responseData.data || responseData;
        CacheManager.set(cacheKey, allApis);
        return { success: true, data: allApis };
      }, `Get Translation APIs (${sourceLanguage}-${targetLanguage})`, 3);
    } catch (error: any) {
      return { success: false, error: getUserFriendlyErrorMessage(error) };
    }
  }

  async downloadFile(url: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const result = await apiRequestWithRetry(async () => {
        const response = await fetch(url, { method: 'GET', headers: this.getHeaders(true) });
        if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
        return await response.text();
      }, 'Download File', 3);
      return { success: true, content: result };
    } catch (error: any) {
      return { success: false, error: getUserFriendlyErrorMessage(error) };
    }
  }

  async downloadFileByMediaId(mediaId: string, fileName: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const result = await apiRequestWithRetry(async () => {
        const url = this.getAIUrl(`/files/${mediaId}/${fileName}`);
        const response = await fetch(url, { method: 'GET', headers: this.getHeaders(true) });
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
      return { success: false, error: getUserFriendlyErrorMessage(error) };
    }
  }

  async getCredits(): Promise<{ success: boolean; credits?: number; error?: string }> {
    try {
      return await apiRequestWithRetry(async () => {
        const response = await fetch(this.getAIUrl('/credits'), { method: 'POST', headers: this.getHeaders(true) });
        if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
        const responseData = await response.json();
        return { success: true, credits: responseData.data?.credits || responseData.credits || 0 };
      }, 'Get Credits', 3);
    } catch (error: any) {
      return { success: false, error: getUserFriendlyErrorMessage(error) };
    }
  }

  async getServicesInfo(): Promise<{ success: boolean; data?: ServicesInfo; error?: string }> {
    const cacheKey = 'services_info';
    const cached = CacheManager.get<ServicesInfo>(cacheKey);
    if (cached) return { success: true, data: cached };
    if (!this.apiKey) return { success: false, error: 'API Key is required' };

    try {
      return await apiRequestWithRetry(async () => {
        const response = await fetch(this.getAIUrl('/info/services'), { method: 'GET', headers: this.getHeaders(true, 'application/json') });
        if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
        const responseData = await response.json();
        const data: ServicesInfo = responseData.data || responseData;
        CacheManager.set(cacheKey, data);
        return { success: true, data };
      }, 'Get Services Info', 3);
    } catch (error: any) {
      return { success: false, error: getUserFriendlyErrorMessage(error) };
    }
  }

  async getCreditPackages(email?: string): Promise<{ success: boolean; data?: CreditPackage[]; error?: string }> {
    const cacheKey = `credit_packages_${email || 'default'}`;
    const cached = CacheManager.get<CreditPackage[]>(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      return await apiRequestWithRetry(async () => {
        const headers: Record<string, string> = { 'Accept': 'application/json', 'Api-Key': this.apiKey || '' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

        const body = new FormData();
        if (email) body.append('email', email);

        const response = await fetch(this.getAIUrl('/credits/buy'), { method: 'POST', headers, body });
        if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
        const responseData = await response.json();
        if (responseData.data && Array.isArray(responseData.data)) {
          CacheManager.set(cacheKey, responseData.data);
          return { success: true, data: responseData.data };
        }
        throw new Error('Invalid response format');
      }, 'Get Credit Packages', 3);
    } catch (error: any) {
      return { success: false, error: getUserFriendlyErrorMessage(error) };
    }
  }

  async getRecentMedia(): Promise<{ success: boolean; data?: RecentMediaItem[]; error?: string }> {
    const cacheKey = 'recent_media';
    const cached = CacheManager.get<RecentMediaItem[]>(cacheKey);
    if (cached) return { success: true, data: cached };
    if (!this.apiKey) return { success: false, error: 'API Key is required' };

    try {
      return await apiRequestWithRetry(async () => {
        const response = await fetch(this.getAIUrl('/recent_media'), { method: 'POST', headers: this.getHeaders(true, 'application/json') });
        if (!response.ok) { const e = new Error(`Request failed: ${response.status}`); (e as any).status = response.status; throw e; }
        const responseData = await response.json();
        const data: RecentMediaItem[] = responseData.data || responseData;
        CacheManager.set(cacheKey, data);
        return { success: true, data };
      }, 'Get Recent Media', 3);
    } catch (error: any) {
      return { success: false, error: getUserFriendlyErrorMessage(error) };
    }
  }

  async searchSubtitles(params: SubtitleSearchParams): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.apiKey) return { success: false, error: 'API Key is required' };
    try {
      const result = await apiRequestWithRetry(async () => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') queryParams.append(key, String(value));
        });
        const queryString = queryParams.toString();
        const url = this.getAIUrl(`/proxy/subtitles${queryString ? `?${queryString}` : ''}`);
        const response = await fetch(url, { method: 'GET', headers: this.getHeaders(true) });
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
      return { success: false, error: getUserFriendlyErrorMessage(error) };
    }
  }

  async searchForFeatures(params: FeatureSearchParams): Promise<{ success: boolean; data?: FeatureSearchResponse; error?: string }> {
    if (!this.apiKey) return { success: false, error: 'API Key is required' };
    try {
      const result = await apiRequestWithRetry(async () => {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') queryParams.append(key, String(value));
        });
        const queryString = queryParams.toString();
        const url = this.getAIUrl(`/proxy/features${queryString ? `?${queryString}` : ''}`);
        const response = await fetch(url, { method: 'GET', headers: this.getHeaders(true) });
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
      return { success: false, error: getUserFriendlyErrorMessage(error) };
    }
  }

  async downloadSubtitle(params: SubtitleDownloadParams): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.apiKey) return { success: false, error: 'API Key is required' };
    if (!this.token) return { success: false, error: 'Authentication token is required' };

    try {
      const result = await apiRequestWithRetry(async () => {
        const response = await fetch(this.getAIUrl('/proxy/download'), {
          method: 'POST',
          headers: { ...this.getHeaders(true, 'application/json') },
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
      return { success: false, error: getUserFriendlyErrorMessage(error) };
    }
  }

  async getSubtitleSearchLanguages(): Promise<{ success: boolean; data?: SubtitleLanguage[]; error?: string }> {
    const cacheKey = 'subtitle_search_languages';
    const cacheExpiry = 24 * 60 * 60 * 1000;

    try {
      const cachedData = CacheManager.get<any>(cacheKey);
      if (cachedData && (Date.now() - cachedData.timestamp) < cacheExpiry) {
        return { success: true, data: cachedData.data };
      }

      const result = await apiRequestWithRetry(async () => {
        const headers: Record<string, string> = { 'Accept': 'application/json', 'Api-Key': this.apiKey || '' };
        const url = `${this.baseURL}/infos/languages`;
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
      return { success: false, error: getUserFriendlyErrorMessage(error) };
    }
  }

  clearCache(): void {
    CacheManager.clear();
  }
}
