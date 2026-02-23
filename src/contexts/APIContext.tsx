import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  OpenSubtitlesAPI,
  ServicesInfo, CreditPackage, TranscriptionInfo, TranslationInfo,
  LanguageInfo, RecentMediaItem,
  SubtitleSearchParams, SubtitleDownloadParams, SubtitleLanguage,
  FeatureSearchParams, FeatureSearchResponse,
  TranscriptionOptions, TranslationOptions,
  APIResponse, CompletedTaskData, LanguageDetectionResult
} from '../services/api';
import { storageService, AppConfig } from '../services/storageService';
import { logger } from '../utils/errorLogger';
import CacheManager from '../services/cache';

// ── Context shape ────────────────────────────────────────────
interface APIContextType {
  api: OpenSubtitlesAPI;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  credits: { used: number; remaining: number } | null;
  transcriptionInfo: TranscriptionInfo | null;
  translationInfo: TranslationInfo | null;
  modelInfoVersion: number;
  isLoading: boolean;
  error: string | null;

  // Auth
  login: (username: string, password: string, apiKey: string) => Promise<boolean>;
  logout: () => void;
  autoLogin: () => Promise<boolean>;
  refreshCredits: () => Promise<void>;
  updateCredits: (credits: { used: number; remaining: number }) => void;
  refreshModelInfo: () => Promise<void>;

  // Centralized API methods (all wrapped with auth-retry)
  getServicesInfo: () => Promise<{ success: boolean; data?: ServicesInfo; error?: string }>;
  getCreditPackages: (email?: string) => Promise<{ success: boolean; data?: CreditPackage[]; error?: string }>;
  getTranscriptionInfo: () => Promise<{ success: boolean; data?: TranscriptionInfo; error?: string }>;
  getTranslationInfo: () => Promise<{ success: boolean; data?: TranslationInfo; error?: string }>;
  getTranscriptionLanguagesForApi: (apiId: string) => Promise<{ success: boolean; data?: LanguageInfo[]; error?: string }>;
  getTranslationLanguagesForApi: (apiId: string) => Promise<{ success: boolean; data?: LanguageInfo[]; error?: string }>;
  getTranslationApisForLanguage: (sourceLanguage: string, targetLanguage: string) => Promise<{ success: boolean; data?: string[]; error?: string }>;
  getRecentMedia: () => Promise<{ success: boolean; data?: RecentMediaItem[]; error?: string }>;
  detectLanguage: (file: File | Blob, duration?: number) => Promise<APIResponse<LanguageDetectionResult>>;
  checkLanguageDetectionStatus: (correlationId: string) => Promise<APIResponse<LanguageDetectionResult>>;
  initiateTranscription: (audioFile: File | Blob, options: TranscriptionOptions) => Promise<APIResponse>;
  initiateTranslation: (subtitleFile: File | Blob, options: TranslationOptions) => Promise<APIResponse>;
  checkTranscriptionStatus: (correlationId: string) => Promise<APIResponse<CompletedTaskData>>;
  checkTranslationStatus: (correlationId: string) => Promise<APIResponse<CompletedTaskData>>;
  downloadFile: (url: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  downloadFileByMediaId: (mediaId: string, fileName: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  searchSubtitles: (params: SubtitleSearchParams) => Promise<{ success: boolean; data?: any; error?: string }>;
  downloadSubtitle: (params: SubtitleDownloadParams) => Promise<{ success: boolean; data?: any; error?: string }>;
  searchForFeatures: (params: FeatureSearchParams) => Promise<{ success: boolean; data?: FeatureSearchResponse; error?: string }>;
  getSubtitleSearchLanguages: () => Promise<{ success: boolean; data?: SubtitleLanguage[]; error?: string }>;

  // Sync helpers for filename generation
  getTranslationLanguageNameSync: (apiId: string, languageCode: string) => string | null;
  getTranscriptionLanguageNameSync: (apiId: string, languageCode: string) => string | null;

  // Config helpers
  updateConfig: (partial: Partial<AppConfig>) => void;
  config: AppConfig;
}

const APIContext = createContext<APIContextType | null>(null);

// ── Provider ─────────────────────────────────────────────────
export function APIProvider({ children }: { children: React.ReactNode }) {
  const apiRef = useRef(new OpenSubtitlesAPI());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [credits, setCredits] = useState<{ used: number; remaining: number } | null>(null);
  const [transcriptionInfo, setTranscriptionInfo] = useState<TranscriptionInfo | null>(null);
  const [translationInfo, setTranslationInfo] = useState<TranslationInfo | null>(null);
  const [modelInfoVersion, setModelInfoVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig>(() => storageService.getConfig());

  const authPromiseRef = useRef<Promise<boolean> | null>(null);
  const authAttemptedRef = useRef(false);

  // ── Initialise API from stored config ──
  useEffect(() => {
    const cfg = storageService.getConfig();
    if (cfg.apiKey) apiRef.current.setApiKey(cfg.apiKey);
    if (cfg.apiBaseUrl) apiRef.current.setBaseUrl(cfg.apiBaseUrl);
    if (cfg.apiUrlParameter) apiRef.current.setApiUrlParameter(cfg.apiUrlParameter);
  }, []);

  // ── Load API info sequentially (avoid parallel request storms) ──
  const loadAPIInfo = async (apiInstance: OpenSubtitlesAPI) => {
    try {
      const transcriptionResult = await apiInstance.getTranscriptionInfo();
      if (transcriptionResult.success && transcriptionResult.data) setTranscriptionInfo(transcriptionResult.data);

      const translationResult = await apiInstance.getTranslationInfo();
      if (translationResult.success && translationResult.data) setTranslationInfo(translationResult.data);
    } catch (err) {
      logger.error('APIContext', 'Failed to load API info', err);
    }
  };

  // ── Core authentication (single attempt, no cascading retries) ──
  const performLogin = async (user: string, pass: string, apiKey: string): Promise<boolean> => {
    // If another login is already in flight, wait for it instead of firing another
    if (authPromiseRef.current) {
      return authPromiseRef.current;
    }

    const promise = (async () => {
      setIsAuthenticating(true);
      setIsLoading(true);
      setError(null);

      apiRef.current.setApiKey(apiKey);

      try {
        // Try cached token first
        const hasCached = await apiRef.current.loadCachedToken();
        console.log('[DEBUG APIContext] loadCachedToken result:', hasCached);
        if (hasCached) {
          console.log('[DEBUG APIContext] Calling getCredits...');
          const creditsResult = await apiRef.current.getCredits();
          console.log('[DEBUG APIContext] getCredits result:', creditsResult);
          if (creditsResult.success) {
            setIsAuthenticated(true);
            setCredits({ used: 0, remaining: creditsResult.credits || 0 });
            console.log('[DEBUG APIContext] Credits set:', creditsResult.credits);
            await loadAPIInfo(apiRef.current);
            logger.info('APIContext', 'Cached token verified');
            return true;
          }
          logger.warn('APIContext', 'Cached token invalid, doing fresh login');
          await apiRef.current.clearCachedToken();
        }

        // Fresh login — single attempt, no retries
        const result = await apiRef.current.login(user, pass);
        if (result.success) {
          setIsAuthenticated(true);
          logger.info('APIContext', `Logged in as ${user}`);

          // Load credits first, then API info — sequential to avoid hammering server
          const creditsResult = await apiRef.current.getCredits();
          if (creditsResult.success) {
            setCredits({ used: 0, remaining: creditsResult.credits || 0 });
          }
          await loadAPIInfo(apiRef.current);
          return true;
        }

        setError(result.error || 'Login failed');
        return false;
      } catch (err: any) {
        logger.error('APIContext', 'Authentication error', err);
        setError(err.message || 'Authentication failed');
        return false;
      } finally {
        setIsAuthenticating(false);
        setIsLoading(false);
      }
    })();

    authPromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      authPromiseRef.current = null;
    }
  };

  // ── Public login (saves credentials to storage) ──
  const login = useCallback(async (user: string, pass: string, apiKey: string): Promise<boolean> => {
    storageService.saveConfig({ username: user, password: pass, apiKey });
    setConfig(storageService.getConfig());
    return performLogin(user, pass, apiKey);
  }, []);

  // ── Auto-login from stored credentials (guarded against double-fire) ──
  const autoLogin = useCallback(async (): Promise<boolean> => {
    // Prevent React strict mode or re-renders from firing multiple auto-logins
    if (authAttemptedRef.current || authPromiseRef.current) return false;
    authAttemptedRef.current = true;

    const cfg = storageService.getConfig();
    if (!cfg.apiKey || !cfg.username || !cfg.password) return false;
    if (cfg.apiBaseUrl) apiRef.current.setBaseUrl(cfg.apiBaseUrl);
    if (cfg.apiUrlParameter) apiRef.current.setApiUrlParameter(cfg.apiUrlParameter);
    return performLogin(cfg.username, cfg.password, cfg.apiKey);
  }, []);

  const logout = useCallback(() => {
    apiRef.current.clearCachedToken();
    apiRef.current.clearCache();
    setIsAuthenticated(false);
    setCredits(null);
    setTranscriptionInfo(null);
    setTranslationInfo(null);
    setError(null);
    authAttemptedRef.current = false;
    logger.info('APIContext', 'Logged out');
  }, []);

  // ── Auth-retry wrapper: on 401/403, surface error to user (no silent re-login) ──
  const withAuthRetry = useCallback(async <T,>(fn: () => Promise<T>, context: string = 'API Call'): Promise<T> => {
    try {
      return await fn();
    } catch (err: any) {
      const status = err.status || 0;
      if (status === 401 || status === 403) {
        logger.warn('APIContext', `${context}: Auth error (${status}), session expired`);
        await apiRef.current.clearCachedToken();
        setIsAuthenticated(false);
        setError('Session expired. Please log in again.');
      }
      throw err;
    }
  }, []);

  // ── Credits ──
  const refreshCredits = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) return;
    try {
      const result = await apiRef.current.getCredits();
      if (result.success && typeof result.credits === 'number') {
        setCredits({ used: 0, remaining: result.credits });
      }
    } catch (err) {
      logger.error('APIContext', 'Failed to refresh credits', err);
    }
  }, [isAuthenticated]);

  const updateCredits = useCallback((newCredits: { used: number; remaining: number }) => {
    setCredits(newCredits);
  }, []);

  const refreshModelInfo = useCallback(async () => {
    CacheManager.remove('transcription_info');
    CacheManager.remove('translation_info');
    CacheManager.remove('services_info');
    await loadAPIInfo(apiRef.current);
    setModelInfoVersion(prev => prev + 1);
  }, []);

  // ── Wrapped API methods ──
  const getServicesInfo = useCallback(async () => {
    if (!isAuthenticated && !isAuthenticating) return { success: false, error: 'Not authenticated' };
    return withAuthRetry(() => apiRef.current.getServicesInfo(), 'Get Services Info');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const getCreditPackages = useCallback(async (email?: string) => {
    if (!isAuthenticated && !isAuthenticating) return { success: false, error: 'Not authenticated' };
    return withAuthRetry(() => apiRef.current.getCreditPackages(email), 'Get Credit Packages');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const getTranscriptionInfoWrapped = useCallback(async () => {
    if (!isAuthenticated && !isAuthenticating) return { success: false, error: 'Not authenticated' };
    return withAuthRetry(() => apiRef.current.getTranscriptionInfo(), 'Get Transcription Info');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const getTranslationInfoWrapped = useCallback(async () => {
    if (!isAuthenticated && !isAuthenticating) return { success: false, error: 'Not authenticated' };
    return withAuthRetry(() => apiRef.current.getTranslationInfo(), 'Get Translation Info');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const getTranscriptionLanguagesForApi = useCallback(async (apiId: string) => {
    if (!isAuthenticated && !isAuthenticating) return { success: false, error: 'Not authenticated' };
    return withAuthRetry(() => apiRef.current.getTranscriptionLanguagesForApi(apiId), 'Get Transcription Languages');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const getTranslationLanguagesForApi = useCallback(async (apiId: string) => {
    if (!isAuthenticated && !isAuthenticating) return { success: false, error: 'Not authenticated' };
    return withAuthRetry(() => apiRef.current.getTranslationLanguagesForApi(apiId), 'Get Translation Languages');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const getTranslationApisForLanguage = useCallback(async (sourceLanguage: string, targetLanguage: string) => {
    if (!isAuthenticated && !isAuthenticating) return { success: false, error: 'Not authenticated' };
    return withAuthRetry(() => apiRef.current.getTranslationApisForLanguage(sourceLanguage, targetLanguage), 'Get Translation APIs');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const getRecentMedia = useCallback(async () => {
    if (!isAuthenticated && !isAuthenticating) return { success: false, error: 'Not authenticated' };
    return withAuthRetry(() => apiRef.current.getRecentMedia(), 'Get Recent Media');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const detectLanguage = useCallback(async (file: File | Blob, duration?: number) => {
    if (!isAuthenticated && !isAuthenticating) return { status: 'ERROR' as const, errors: ['Not authenticated'] };
    return withAuthRetry(() => apiRef.current.detectLanguage(file, duration), 'Detect Language');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const checkLanguageDetectionStatus = useCallback(async (correlationId: string) => {
    if (!isAuthenticated && !isAuthenticating) return { status: 'ERROR' as const, errors: ['Not authenticated'] };
    return withAuthRetry(() => apiRef.current.checkLanguageDetectionStatus(correlationId), 'Check Language Detection');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const initiateTranscription = useCallback(async (audioFile: File | Blob, options: TranscriptionOptions) => {
    if (!isAuthenticated && !isAuthenticating) return { status: 'ERROR' as const, errors: ['Not authenticated'] };
    return withAuthRetry(() => apiRef.current.initiateTranscription(audioFile, options), 'Initiate Transcription');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const initiateTranslation = useCallback(async (subtitleFile: File | Blob, options: TranslationOptions) => {
    if (!isAuthenticated && !isAuthenticating) return { status: 'ERROR' as const, errors: ['Not authenticated'] };
    return withAuthRetry(() => apiRef.current.initiateTranslation(subtitleFile, options), 'Initiate Translation');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const checkTranscriptionStatus = useCallback(async (correlationId: string) => {
    if (!isAuthenticated && !isAuthenticating) return { status: 'ERROR' as const, errors: ['Not authenticated'] };
    return withAuthRetry(() => apiRef.current.checkTranscriptionStatus(correlationId), 'Check Transcription Status');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const checkTranslationStatus = useCallback(async (correlationId: string) => {
    if (!isAuthenticated && !isAuthenticating) return { status: 'ERROR' as const, errors: ['Not authenticated'] };
    return withAuthRetry(() => apiRef.current.checkTranslationStatus(correlationId), 'Check Translation Status');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const downloadFile = useCallback(async (url: string) => {
    if (!isAuthenticated && !isAuthenticating) return { success: false, error: 'Not authenticated' };
    return withAuthRetry(() => apiRef.current.downloadFile(url), 'Download File');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const downloadFileByMediaId = useCallback(async (mediaId: string, fileName: string) => {
    if (!isAuthenticated && !isAuthenticating) return { success: false, error: 'Not authenticated' };
    return withAuthRetry(() => apiRef.current.downloadFileByMediaId(mediaId, fileName), 'Download File By Media ID');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const searchSubtitles = useCallback(async (params: SubtitleSearchParams) => {
    if (!isAuthenticated && !isAuthenticating) return { success: false, error: 'Not authenticated' };
    return withAuthRetry(() => apiRef.current.searchSubtitles(params), 'Search Subtitles');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const downloadSubtitle = useCallback(async (params: SubtitleDownloadParams) => {
    if (!isAuthenticated && !isAuthenticating) return { success: false, error: 'Not authenticated' };
    return withAuthRetry(() => apiRef.current.downloadSubtitle(params), 'Download Subtitle');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const searchForFeatures = useCallback(async (params: FeatureSearchParams) => {
    if (!isAuthenticated && !isAuthenticating) return { success: false, error: 'Not authenticated' };
    return withAuthRetry(() => apiRef.current.searchForFeatures(params), 'Search Features');
  }, [isAuthenticated, isAuthenticating, withAuthRetry]);

  const getSubtitleSearchLanguages = useCallback(async () => {
    return withAuthRetry(() => apiRef.current.getSubtitleSearchLanguages(), 'Get Subtitle Search Languages');
  }, [withAuthRetry]);

  // ── Sync helpers for filename generation ──
  const getTranslationLanguageNameSync = useCallback((apiId: string, languageCode: string): string | null => {
    if (!translationInfo?.apis?.[apiId]?.supported_languages) return null;
    const lang = translationInfo.apis[apiId].supported_languages.find((l: any) => l.language_code === languageCode);
    return lang?.language_name || null;
  }, [translationInfo]);

  const getTranscriptionLanguageNameSync = useCallback((apiId: string, languageCode: string): string | null => {
    if (!transcriptionInfo?.apis?.[apiId]?.supported_languages) return null;
    const lang = transcriptionInfo.apis[apiId].supported_languages.find((l: any) => l.language_code === languageCode);
    return lang?.language_name || null;
  }, [transcriptionInfo]);

  const updateConfig = useCallback((partial: Partial<AppConfig>) => {
    storageService.saveConfig(partial);
    setConfig(storageService.getConfig());
  }, []);

  const value: APIContextType = {
    api: apiRef.current,
    isAuthenticated,
    isAuthenticating,
    credits,
    transcriptionInfo,
    translationInfo,
    modelInfoVersion,
    isLoading,
    error,
    login,
    logout,
    autoLogin,
    refreshCredits,
    updateCredits,
    refreshModelInfo,
    getServicesInfo,
    getCreditPackages,
    getTranscriptionInfo: getTranscriptionInfoWrapped,
    getTranslationInfo: getTranslationInfoWrapped,
    getTranscriptionLanguagesForApi,
    getTranslationLanguagesForApi,
    getTranslationApisForLanguage,
    getRecentMedia,
    detectLanguage,
    checkLanguageDetectionStatus,
    initiateTranscription,
    initiateTranslation,
    checkTranscriptionStatus,
    checkTranslationStatus,
    downloadFile,
    downloadFileByMediaId,
    searchSubtitles,
    downloadSubtitle,
    searchForFeatures,
    getSubtitleSearchLanguages,
    getTranslationLanguageNameSync,
    getTranscriptionLanguageNameSync,
    updateConfig,
    config,
  };

  return <APIContext.Provider value={value}>{children}</APIContext.Provider>;
}

// ── Hook ─────────────────────────────────────────────────────
export function useAPI(): APIContextType {
  const ctx = useContext(APIContext);
  if (!ctx) throw new Error('useAPI must be used within an APIProvider');
  return ctx;
}
