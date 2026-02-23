import networkConfig from '../config/networkConfig.json';
import { logger } from './errorLogger';

export interface NetworkConfig {
  retry: {
    enabled: boolean;
    maxAttempts: number;
    defaultBaseDelay: number;
    timeouts: { request: number; connection: number };
  };
  errorTypes: {
    [key: string]: {
      enabled: boolean;
      statusCodes: number[];
      keywords: string[];
      maxRetries: number;
      delays: number[];
      maxDelay: number;
    };
  };
  backoffStrategy: {
    type: string;
    multiplier: number;
    jitter: boolean;
    jitterPercent: number;
  };
  logging: {
    enabled: boolean;
    logRetries: boolean;
    logErrors: boolean;
    logSuccess: boolean;
    logSimulation: boolean;
  };
  userMessages: { [key: string]: string };
  statusBar: {
    enabled: boolean;
    showNetworkStatus: boolean;
    showProcessingStatus: boolean;
    showVersion: boolean;
    height: number;
    connectionRestoreDisplayTime: number;
    animations: { enabled: boolean; pulseOnRestore: boolean; spinOnProcessing: boolean };
  };
  development: {
    simulateErrors: boolean;
    simulationMode: string;
    simulationSettings: {
      globalProbability: number;
      consecutiveErrorLimit: number;
      resetAfterSuccess: boolean;
    };
    errorSimulation: { [key: string]: any };
  };
}

class NetworkConfigManager {
  private config: NetworkConfig = networkConfig as NetworkConfig;

  constructor() {
    if (this.config.logging.enabled) {
      logger.info('NetworkConfig', 'Network configuration loaded', {
        retryEnabled: this.config.retry.enabled,
        maxAttempts: this.config.retry.maxAttempts,
      });
    }
  }

  getConfig(): NetworkConfig { return this.config; }
  isRetryEnabled(): boolean { return this.config.retry.enabled; }
  getMaxRetries(): number { return this.config.retry.maxAttempts; }
  getErrorTypeConfig(type: string) { return this.config.errorTypes[type]; }
  getUserMessage(errorType: string): string { return this.config.userMessages[errorType] || this.config.userMessages.unknown; }

  // Simulation disabled for web — no dev tools needed
  isSimulationEnabled(): boolean { return false; }
  shouldSimulateError(): { simulate: boolean; error?: Error } { return { simulate: false }; }
  onRequestSuccess(): void { /* no-op */ }

  applyJitter(delay: number): number {
    if (!this.config.backoffStrategy.jitter) return delay;
    const jitterAmount = delay * (this.config.backoffStrategy.jitterPercent / 100);
    const jitter = (Math.random() * 2 - 1) * jitterAmount;
    return Math.max(100, Math.round(delay + jitter));
  }

  getDelayForErrorType(errorType: string, attemptNumber: number): number {
    const errorConfig = this.config.errorTypes[errorType];
    if (!errorConfig || attemptNumber >= errorConfig.delays.length) {
      const baseDelay = errorConfig?.delays[errorConfig.delays.length - 1] || this.config.retry.defaultBaseDelay;
      return this.applyJitter(Math.min(baseDelay * Math.pow(this.config.backoffStrategy.multiplier, attemptNumber), errorConfig?.maxDelay || 30000));
    }
    return this.applyJitter(errorConfig.delays[attemptNumber]);
  }
}

export const networkConfigManager = new NetworkConfigManager();
export default networkConfigManager;
