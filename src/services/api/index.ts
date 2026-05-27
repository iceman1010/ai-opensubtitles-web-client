import CacheManager from '../cache';
import { DEFAULT_BASE_URL } from './helpers';
import { getApiContext, loginRequest, loadCachedTokenSync, saveToken, clearCachedTokenSync } from './auth';
import * as transcriptionApi from './transcription';
import * as translationApi from './translation';
import * as languageDetectionApi from './languageDetection';
import * as creditsApi from './credits';
import * as subtitlesApi from './subtitles';
import * as filesApi from './files';
import * as supportApi from './support';

export type { ApiContext } from './types';
export type {
  TranscriptionOptions,
  TranslationOptions,
  APIResponse,
  LanguageInfo,
  TranscriptionInfo,
  TranslationInfo,
  ServiceModel,
  ServicesInfo,
  CreditPackage,
  SubtitleSearchParams,
  SubtitleDownloadParams,
  SubtitleLanguage,
  SubtitleLanguagesResponse,
  FeatureSearchParams,
  FeatureAttributes,
  Feature,
  FeatureSearchResponse,
  CompletedTaskData,
  DetectedLanguage,
  LanguageDetectionResult,
  RecentMediaItem,
  RecentActivityItem,
  PaymentHistoryItem,
  SupportTicketResponse,
} from './types';

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
  setApiKey(apiKey: string): void { this.apiKey = apiKey; }

  private ctx() {
    return getApiContext(this.baseURL, this.apiKey, this.token, this.apiUrlParameter);
  }

  async loadCachedToken(): Promise<boolean> {
    const result = loadCachedTokenSync();
    if (result.token) {
      this.token = result.token;
      return true;
    }
    return false;
  }

  async clearCachedToken(): Promise<void> {
    clearCachedTokenSync();
    this.token = '';
  }

  async login(username: string, password: string) {
    if (!username || !password) return { success: false as const, error: 'Username and password are required' };
    if (!this.apiKey) return { success: false as const, error: 'API Key is required for authentication' };
    const result = await loginRequest(this.ctx(), username, password);
    if (result.success && result.token) {
      this.token = result.token;
      saveToken(this.token);
    }
    return result;
  }

  async getTranscriptionInfo() { return transcriptionApi.getTranscriptionInfo(this.ctx()); }
  async initiateTranscription(audioFile: File | Blob, options: import('./types').TranscriptionOptions) { return transcriptionApi.initiateTranscription(this.ctx(), audioFile, options); }
  async checkTranscriptionStatus(correlationId: string) { return transcriptionApi.checkTranscriptionStatus(this.ctx(), correlationId); }
  async getTranscriptionLanguagesForApi(apiId: string) { return transcriptionApi.getTranscriptionLanguagesForApi(this.ctx(), apiId); }

  async getTranslationInfo() { return translationApi.getTranslationInfo(this.ctx()); }
  async initiateTranslation(subtitleFile: File | Blob, options: import('./types').TranslationOptions) { return translationApi.initiateTranslation(this.ctx(), subtitleFile, options); }
  async checkTranslationStatus(correlationId: string) { return translationApi.checkTranslationStatus(this.ctx(), correlationId); }
  async getTranslationLanguagesForApi(apiId: string) { return translationApi.getTranslationLanguagesForApi(this.ctx(), apiId); }
  async getTranslationApisForLanguage(sourceLanguage: string, targetLanguage: string) { return translationApi.getTranslationApisForLanguage(this.ctx(), sourceLanguage, targetLanguage); }

  async detectLanguage(file: File | Blob, duration?: number) { return languageDetectionApi.detectLanguage(this.ctx(), file, duration); }
  async checkLanguageDetectionStatus(correlationId: string) { return languageDetectionApi.checkLanguageDetectionStatus(this.ctx(), correlationId); }

  async getCredits() { return creditsApi.getCredits(this.ctx()); }
  async getServicesInfo() { return creditsApi.getServicesInfo(this.ctx()); }
  async getCreditPackages(email?: string) { return creditsApi.getCreditPackages(this.ctx(), email); }

  async searchSubtitles(params: import('./types').SubtitleSearchParams) { return subtitlesApi.searchSubtitles(this.ctx(), params); }
  async searchForFeatures(params: import('./types').FeatureSearchParams) { return subtitlesApi.searchForFeatures(this.ctx(), params); }
  async downloadSubtitle(params: import('./types').SubtitleDownloadParams) { return subtitlesApi.downloadSubtitle(this.ctx(), params); }
  async getSubtitleSearchLanguages() { return subtitlesApi.getSubtitleSearchLanguages(this.ctx()); }

  async downloadFile(url: string) { return filesApi.downloadFile(this.ctx(), url); }
  async downloadFileByMediaId(mediaId: string, fileName: string) { return filesApi.downloadFileByMediaId(this.ctx(), mediaId, fileName); }
  async getRecentMedia(page?: number) { return filesApi.getRecentMedia(this.ctx(), page); }
  async getRecentActivities(page?: number) { return filesApi.getRecentActivities(this.ctx(), page); }
  async getPaymentHistory(page?: number) { return filesApi.getPaymentHistory(this.ctx(), page); }

  async createSupportTicket(problem_description: string, email: string, name: string) { return supportApi.createSupportTicket(this.ctx(), problem_description, email, name); }

  clearCache(): void {
    CacheManager.clear();
  }
}
