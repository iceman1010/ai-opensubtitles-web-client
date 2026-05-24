import appConfig from '../../config/appConfig.json';

export const rethrowIfAuthError = (error: any): void => {
  const status = error?.status || error?.originalError?.status || 0;
  if (status === 401 || status === 403) throw error;
};

export const getUserAgent = (): string => {
  if (appConfig && appConfig.userAgent) {
    return appConfig.userAgent;
  }
  return 'AI.Opensubtitles.com-Web v1.0.0';
};

export const DEFAULT_BASE_URL = import.meta.env.DEV
  ? '/api/v1'
  : '/ai-web/api/v1';
