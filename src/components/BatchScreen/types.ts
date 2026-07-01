import { LanguageInfo, DetectedLanguage, ServicesInfo } from '../../services/api';

export type { LanguageInfo, DetectedLanguage, ServicesInfo };

export interface BatchFile {
  id: string;
  file: File;
  name: string;
  type: 'transcription' | 'translation';
  status: 'pending' | 'detecting' | 'processing' | 'completed' | 'error' | 'skipped';
  detectedLanguage?: DetectedLanguage;
  selectedSourceLanguage?: string;
  progress?: number;
  error?: string;
  outputContent?: string;
  outputFileName?: string;
  creditsUsed?: number;
  duration?: number;
  characterCount?: number;
}

export type WorkflowMode = 'transcribe-only' | 'transcribe-and-translate';

export interface BatchSettings {
  transcriptionModel: string;
  translationModel: string;
  targetLanguage: string;
  outputFormat: string;
  workflowMode: WorkflowMode;
  abortOnError: boolean;
}

export interface BatchCreditStats {
  totalCreditsUsed: number;
  creditsPerFile: Map<string, number>;
}

export interface BatchStats {
  startTime: Date | null;
  endTime: Date | null;
  totalFilesProcessed: number;
  successfulFiles: number;
}

export interface BatchScreenConfig {
  username?: string;
  debugMode?: boolean;
  debugLevel?: number;
  audio_language_detection_time?: number;
  pollingIntervalSeconds?: number;
  pollingTimeoutSeconds?: number;
  defaultFilenameFormat?: string;
}

export interface BatchScreenProps {
  config: BatchScreenConfig;
  setAppProcessing: (processing: boolean, task?: string) => void;
  onProcessingStateChange?: (isProcessing: boolean) => void;
  onEstimatedCostChange?: (cost: number | null) => void;
}

export interface QueueAnalysis {
  hasTranscriptionFiles: boolean;
  hasTranslationFiles: boolean;
}

export interface UiState {
  transcriptionEnabled: boolean;
  translationEnabled: boolean;
  chainingEnabled: boolean;
  shouldDisableChaining: boolean;
}
