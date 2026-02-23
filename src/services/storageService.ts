export interface AppConfig {
  username: string;
  password: string;
  apiKey?: string;
  lastUsedLanguage?: string;
  debugMode?: boolean;
  debugLevel?: number;
  cacheExpirationHours?: number;
  apiBaseUrl?: string;
  apiUrlParameter?: string;
  autoLanguageDetection?: boolean;
  darkMode?: boolean;
  hideRecentMediaInfoPanel?: boolean;
  defaultFilenameFormat?: string;
  audio_language_detection_time?: number;
  credits?: {
    used: number;
    remaining: number;
  };
}

const CONFIG_KEY = 'ai_opensubtitles_config';
const TOKEN_KEY = 'ai_opensubtitles_token';
const TOKEN_EXPIRY_KEY = 'ai_opensubtitles_token_expiry';
const TOKEN_VALIDITY_HOURS = 6;

class StorageService {
  getConfig(): AppConfig {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      return raw ? JSON.parse(raw) : ({} as AppConfig);
    } catch {
      return {} as AppConfig;
    }
  }

  saveConfig(partialConfig: Partial<AppConfig>): boolean {
    try {
      const current = this.getConfig();
      const merged = { ...current, ...partialConfig };
      localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
      return true;
    } catch (error) {
      console.error('Failed to save config:', error);
      return false;
    }
  }

  resetAllSettings(): boolean {
    try {
      localStorage.removeItem(CONFIG_KEY);
      this.clearToken();
      return true;
    } catch {
      return false;
    }
  }

  getValidToken(): string | null {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
      if (!token || !expiry) return null;
      if (Date.now() > parseInt(expiry, 10)) {
        this.clearToken();
        return null;
      }
      return token;
    } catch {
      return null;
    }
  }

  saveToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(
      TOKEN_EXPIRY_KEY,
      String(Date.now() + TOKEN_VALIDITY_HOURS * 3600 * 1000)
    );
  }

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }

  getSessionId(): string {
    let id = sessionStorage.getItem('session_id');
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem('session_id', id);
    }
    return id;
  }
}

export const storageService = new StorageService();
