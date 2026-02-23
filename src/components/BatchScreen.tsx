import React, { useState, useEffect, useCallback, useRef } from 'react';
import FileSelector from './FileSelector';
import { LanguageInfo, DetectedLanguage } from '../services/api';
import { logger } from '../utils/errorLogger';
import { useAPI } from '../contexts/APIContext';
import { generateFilename } from '../utils/filenameGenerator';
import { getProcessingType } from '../config/fileFormats';
import { ffmpegService } from '../services/ffmpegService';
import { saveTextFile, readTextFile, formatFileSize } from '../hooks/useFileHandler';
import * as fileFormatsConfig from '../config/fileFormats.json';

// ── File type helpers ──
const isVideoFile = (fileName: string): boolean => {
  const ext = fileName.toLowerCase().split('.').pop();
  return ext ? fileFormatsConfig.video.includes(ext) : false;
};

const isAudioFile = (fileName: string): boolean => {
  const ext = fileName.toLowerCase().split('.').pop();
  return ext ? fileFormatsConfig.audio.includes(ext) : false;
};

const isSubtitleFile = (fileName: string): boolean => {
  const ext = fileName.toLowerCase().split('.').pop();
  return ext ? fileFormatsConfig.subtitle.includes(ext) : false;
};

const isAudioVideoFile = (fileName: string): boolean => isVideoFile(fileName) || isAudioFile(fileName);

// Helper to safely get languages from TranscriptionInfo (which has union type for languages)
const getLanguagesForModel = (languages: LanguageInfo[] | { [apiName: string]: LanguageInfo[] } | undefined, modelId: string): LanguageInfo[] => {
  if (!languages) return [];
  if (Array.isArray(languages)) return languages;
  return (languages as { [key: string]: LanguageInfo[] })[modelId] || [];
};

const isSupportedFile = (fileName: string): boolean => isVideoFile(fileName) || isAudioFile(fileName) || isSubtitleFile(fileName);

// ── Interfaces ──
interface BatchFile {
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
}

type WorkflowMode = 'transcribe-only' | 'transcribe-and-translate';

interface BatchSettings {
  transcriptionModel: string;
  translationModel: string;
  targetLanguage: string;
  outputFormat: string;
  workflowMode: WorkflowMode;
  abortOnError: boolean;
}

interface BatchScreenProps {
  config: {
    username: string;
    debugMode?: boolean;
    debugLevel?: number;
    audio_language_detection_time?: number;
    pollingIntervalSeconds?: number;
    pollingTimeoutSeconds?: number;
    defaultFilenameFormat?: string;
  };
  setAppProcessing: (processing: boolean, task?: string) => void;
  onProcessingStateChange?: (isProcessing: boolean) => void;
}

const BatchScreen: React.FC<BatchScreenProps> = ({ config, setAppProcessing, onProcessingStateChange }) => {
  const {
    isAuthenticated,
    transcriptionInfo: contextTranscriptionInfo,
    translationInfo: contextTranslationInfo,
    detectLanguage,
    checkLanguageDetectionStatus,
    initiateTranscription,
    initiateTranslation,
    checkTranscriptionStatus,
    checkTranslationStatus,
    downloadFile,
    getTranscriptionLanguagesForApi,
    getTranslationLanguagesForApi,
    getTranslationLanguageNameSync,
    getTranscriptionLanguageNameSync,
  } = useAPI();

  // ── State ──
  const [queue, setQueue] = useState<BatchFile[]>([]);
  const [batchSettings, setBatchSettings] = useState<BatchSettings>({
    transcriptionModel: '',
    translationModel: '',
    targetLanguage: '',
    outputFormat: fileFormatsConfig.subtitle[0] || 'srt',
    workflowMode: 'transcribe-only',
    abortOnError: true,
  });

  const enableChaining = batchSettings.workflowMode === 'transcribe-and-translate';

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(-1);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isDetectingLanguages, setIsDetectingLanguages] = useState(false);
  const [availableTranslationLanguages, setAvailableTranslationLanguages] = useState<LanguageInfo[]>([]);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(false);
  const [languagesLoaded, setLanguagesLoaded] = useState(false);
  const [showCompletionSummary, setShowCompletionSummary] = useState(false);
  const [showLanguageValidationModal, setShowLanguageValidationModal] = useState(false);

  const [batchCreditStats, setBatchCreditStats] = useState({
    totalCreditsUsed: 0,
    creditsPerFile: new Map<string, number>()
  });

  const [batchStats, setBatchStats] = useState<{
    startTime: Date | null;
    endTime: Date | null;
    totalFilesProcessed: number;
    successfulFiles: number;
  }>({
    startTime: null,
    endTime: null,
    totalFilesProcessed: 0,
    successfulFiles: 0,
  });

  const processingRef = useRef(false);
  const shouldStopRef = useRef(false);
  const queueRef = useRef<BatchFile[]>([]);
  const detectionInProgressRef = useRef<Set<string>>(new Set());
  const detectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep queueRef in sync
  useEffect(() => { queueRef.current = queue; }, [queue]);

  // Report processing state
  useEffect(() => { onProcessingStateChange?.(isProcessing); }, [isProcessing, onProcessingStateChange]);

  // beforeunload warning during processing
  useEffect(() => {
    if (!isProcessing) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isProcessing]);

  // ── Initialize models from API context ──
  useEffect(() => {
    if (!languagesLoaded && contextTranscriptionInfo && contextTranscriptionInfo.apis.length > 0) {
      const defaultModel = contextTranscriptionInfo.apis[0];
      setBatchSettings(prev => ({ ...prev, transcriptionModel: defaultModel }));
    }
  }, [contextTranscriptionInfo, languagesLoaded]);

  useEffect(() => {
    if (!languagesLoaded && contextTranslationInfo && contextTranslationInfo.apis.length > 0) {
      const defaultModel = contextTranslationInfo.apis[0];
      setBatchSettings(prev => ({ ...prev, translationModel: defaultModel }));
      loadLanguagesForTranslationModel(defaultModel, contextTranslationInfo);
    }
  }, [contextTranslationInfo, languagesLoaded]);

  // Auto-reset workflow mode when only translation files present
  const queueAnalysis = {
    hasTranscriptionFiles: queue.some(f => f.type === 'transcription'),
    hasTranslationFiles: queue.some(f => f.type === 'translation'),
  };

  const uiState = {
    transcriptionEnabled: queueAnalysis.hasTranscriptionFiles,
    translationEnabled: queueAnalysis.hasTranslationFiles || (enableChaining && queueAnalysis.hasTranscriptionFiles),
    chainingEnabled: queueAnalysis.hasTranscriptionFiles,
    shouldDisableChaining: queueAnalysis.hasTranslationFiles && !queueAnalysis.hasTranscriptionFiles,
  };

  useEffect(() => {
    if (uiState.shouldDisableChaining && enableChaining) {
      setBatchSettings(prev => ({ ...prev, workflowMode: 'transcribe-only' }));
    }
  }, [uiState.shouldDisableChaining, enableChaining]);

  // ── Language loading ──
  const loadLanguagesForTranslationModel = async (modelId: string, translationData?: any) => {
    setIsLoadingLanguages(true);
    try {
      const dataToUse = translationData || contextTranslationInfo;
      if (dataToUse?.languages?.[modelId]) {
        const modelLanguages = dataToUse.languages[modelId];
        setAvailableTranslationLanguages(Array.isArray(modelLanguages) ? modelLanguages : []);
        const currentTargetLang = batchSettings.targetLanguage;
        const isCurrentAvailable = Array.isArray(modelLanguages) &&
          modelLanguages.some((lang: LanguageInfo) => lang.language_code === currentTargetLang);
        if (!isCurrentAvailable && Array.isArray(modelLanguages) && modelLanguages.length > 0) {
          const defaultLang = modelLanguages.find((lang: LanguageInfo) => lang.language_code === 'en') || modelLanguages[0];
          setBatchSettings(prev => ({ ...prev, targetLanguage: defaultLang.language_code }));
        }
      } else {
        const result = await getTranslationLanguagesForApi(modelId);
        if (result?.success && result.data) {
          const languagesArray = Array.isArray(result.data) ? result.data : [];
          setAvailableTranslationLanguages(languagesArray);
          if (languagesArray.length > 0) {
            const defaultLang = languagesArray.find(lang => lang.language_code === 'en') || languagesArray[0];
            setBatchSettings(prev => ({ ...prev, targetLanguage: defaultLang.language_code }));
          }
        }
      }
    } catch (error) {
      logger.error('BatchScreen', 'Exception loading translation languages', error);
    } finally {
      setIsLoadingLanguages(false);
      setLanguagesLoaded(true);
    }
  };

  // ── Model change handlers ──
  const handleTranscriptionModelChange = (newModel: string) => {
    setBatchSettings(prev => ({ ...prev, transcriptionModel: newModel }));
    updateSourceLanguageSelectionsForTranscriptionModel(newModel);
  };

  const handleTranslationModelChange = (newModel: string) => {
    setBatchSettings(prev => ({ ...prev, translationModel: newModel }));
    loadLanguagesForTranslationModel(newModel);
    updateSourceLanguageSelectionsForModel(newModel);
  };

  // ── Source language helpers ──
  const getMatchingSourceLanguages = (detectedCode: string | null, apiLanguages: LanguageInfo[]): LanguageInfo[] => {
    if (!apiLanguages) return [];
    let matching: LanguageInfo[];
    if (!detectedCode) {
      matching = [...apiLanguages];
    } else {
      matching = apiLanguages.filter(lang =>
        lang.language_code.toLowerCase().startsWith(detectedCode.toLowerCase())
      );
    }
    const seen = new Set<string>();
    const unique = matching.filter(lang => {
      const key = lang.language_name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return unique.sort((a, b) => a.language_name.localeCompare(b.language_name));
  };

  const autoSelectSourceLanguage = (detectedCode: string | null, apiLanguages: LanguageInfo[]): string | undefined => {
    const matching = getMatchingSourceLanguages(detectedCode, apiLanguages);
    if (matching.length === 1) return matching[0].language_code;
    if (detectedCode && matching.length > 0) return matching[0].language_code;
    return undefined;
  };

  const updateSourceLanguageSelectionsForModel = (newModel: string) => {
    const apiLanguages = contextTranslationInfo?.languages?.[newModel];
    if (!apiLanguages) return;
    setQueue(prev => prev.map(file => {
      if (file.type === 'translation') {
        const detectedCode = file.detectedLanguage?.ISO_639_1 || null;
        return { ...file, selectedSourceLanguage: autoSelectSourceLanguage(detectedCode, apiLanguages) };
      }
      return file;
    }));
  };

  const updateSourceLanguageSelectionsForTranscriptionModel = (newModel: string) => {
    const apiLanguages = getLanguagesForModel(contextTranscriptionInfo?.languages, newModel);
    if (apiLanguages.length === 0) return;
    setQueue(prev => prev.map(file => {
      if (file.type === 'transcription') {
        const detectedCode = file.detectedLanguage?.ISO_639_1 || null;
        return { ...file, selectedSourceLanguage: autoSelectSourceLanguage(detectedCode, apiLanguages) };
      }
      return file;
    }));
  };

  const handleSourceLanguageChange = (fileId: string, selectedLanguage: string) => {
    setQueue(prev => prev.map(file =>
      file.id === fileId ? { ...file, selectedSourceLanguage: selectedLanguage } : file
    ));
  };

  const setDetectedLanguageForFile = (fileId: string, detectedLanguage: DetectedLanguage) => {
    setQueue(prev => prev.map(file => {
      if (file.id !== fileId) return file;
      let selectedSourceLanguage = file.selectedSourceLanguage;
      const translationModelToUse = batchSettings.translationModel ||
        (contextTranslationInfo?.apis?.length ? contextTranslationInfo.apis[0] : '');
      const transcriptionModelToUse = batchSettings.transcriptionModel ||
        (contextTranscriptionInfo?.apis?.length ? contextTranscriptionInfo.apis[0] : '');

      if (file.type === 'translation' && contextTranslationInfo && translationModelToUse) {
        const apiLanguages = contextTranslationInfo.languages?.[translationModelToUse];
        if (apiLanguages) {
          selectedSourceLanguage = autoSelectSourceLanguage(detectedLanguage.ISO_639_1, apiLanguages);
        }
      } else if (file.type === 'transcription' && contextTranscriptionInfo && transcriptionModelToUse) {
        const apiLanguages = getLanguagesForModel(contextTranscriptionInfo.languages, transcriptionModelToUse);
        if (apiLanguages.length > 0) {
          selectedSourceLanguage = autoSelectSourceLanguage(detectedLanguage.ISO_639_1, apiLanguages);
        }
      }
      return { ...file, status: 'pending' as const, detectedLanguage, selectedSourceLanguage };
    }));
  };

  // ── Language detection ──
  const pollLanguageDetection = async (correlationId: string, fileId: string): Promise<DetectedLanguage | null> => {
    const startTime = Date.now();
    const pollingInterval = (config.pollingIntervalSeconds || 10) * 1000;
    const timeoutMs = (config.pollingTimeoutSeconds || 7200) * 1000;

    return new Promise((resolve) => {
      const poll = async () => {
        try {
          const elapsedMs = Date.now() - startTime;
          if (!isAuthenticated) { resolve(null); return; }
          setAppProcessing(true, `Language detection in progress... (${Math.floor(elapsedMs / 1000)}s elapsed)`);

          const result = await checkLanguageDetectionStatus(correlationId);
          if (result.status === 'COMPLETED' && result.data?.language) {
            resolve(result.data.language);
          } else if (result.status === 'ERROR' || result.status === 'TIMEOUT') {
            setQueue(prev => prev.map(f =>
              f.id === fileId ? { ...f, status: 'pending' as const, error: result.errors?.join(', ') || 'Language detection failed' } : f
            ));
            resolve(null);
          } else if (elapsedMs >= timeoutMs) {
            setQueue(prev => prev.map(f =>
              f.id === fileId ? { ...f, status: 'pending' as const, error: 'Language detection timed out' } : f
            ));
            resolve(null);
          } else {
            setTimeout(poll, pollingInterval);
          }
        } catch (error) {
          setQueue(prev => prev.map(f =>
            f.id === fileId ? { ...f, status: 'pending' as const, error: `Language detection error: ${error instanceof Error ? error.message : 'Unknown'}` } : f
          ));
          resolve(null);
        }
      };
      poll();
    });
  };

  const processLanguageDetectionQueue = useCallback(async (currentQueue?: BatchFile[], isManualDetection: boolean = false) => {
    if (isDetectingLanguages || isProcessing || !isAuthenticated) return;
    setIsDetectingLanguages(true);

    try {
      const queueToProcess = currentQueue || queue;
      const filesToDetect = queueToProcess.filter(file =>
        file.status === 'pending' && !file.detectedLanguage
      );

      if (filesToDetect.length === 0) {
        setAppProcessing(true, 'All files already have language detection complete');
        setTimeout(() => setAppProcessing(false), 2000);
        setIsDetectingLanguages(false);
        return;
      }

      setAppProcessing(true, 'Detecting languages...');

      while (true) {
        const currentQ = queueRef.current;
        const file = currentQ.find(f =>
          f.status === 'pending' && !f.detectedLanguage && !detectionInProgressRef.current.has(f.id)
        );
        if (!file) break;

        detectionInProgressRef.current.add(file.id);
        if (!isAuthenticated) break;

        setAppProcessing(true, `Detecting language for ${file.name}...`);
        setQueue(prev => prev.map(f =>
          f.id === file.id ? { ...f, status: 'detecting' as const } : f
        ));

        try {
          const fileStillInQueue = queueRef.current.find(f => f.id === file.id);
          if (!fileStillInQueue) continue;

          let fileToProcess: File | Blob = file.file;

          // Extract audio for A/V files
          if (isAudioVideoFile(file.name)) {
            setAppProcessing(true, `Extracting audio from ${file.name} for language detection...`);
            const durationSeconds = config.audio_language_detection_time ?? 240;
            fileToProcess = await ffmpegService.extractAudioFromVideo(file.file, undefined, durationSeconds);
            setAppProcessing(true, `Audio extracted, detecting language for ${file.name}...`);
          }

          const durationSeconds = config.audio_language_detection_time ?? 240;
          const result = await detectLanguage(fileToProcess, durationSeconds);

          if (result.data?.language) {
            setDetectedLanguageForFile(file.id, result.data.language);
          } else if (result.correlation_id) {
            setAppProcessing(true, `Processing audio for ${file.name}, please wait...`);
            const detected = await pollLanguageDetection(result.correlation_id, file.id);
            if (detected) setDetectedLanguageForFile(file.id, detected);
          } else if (result.status === 'ERROR') {
            setQueue(prev => prev.map(f =>
              f.id === file.id ? { ...f, status: 'pending' as const, error: result.errors?.[0] || 'Language detection failed' } : f
            ));
          } else {
            setQueue(prev => prev.map(f =>
              f.id === file.id ? { ...f, status: 'pending' as const, error: 'Unexpected detection result' } : f
            ));
          }
        } catch (error: any) {
          setQueue(prev => prev.map(f =>
            f.id === file.id ? { ...f, status: 'pending' as const, error: `Language detection error: ${error.message}` } : f
          ));
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      setAppProcessing(true, 'Language detection completed for all files');
      setTimeout(() => setAppProcessing(false), 1500);
      detectionInProgressRef.current.clear();
    } catch (error) {
      logger.error('BatchScreen', 'Error in language detection queue', error);
      setAppProcessing(true, 'Language detection failed');
      setTimeout(() => setAppProcessing(false), 3000);
    } finally {
      setIsDetectingLanguages(false);
    }
  }, [queue, isDetectingLanguages, isProcessing, isAuthenticated]);

  // ── File management ──
  const addFileToQueue = (file: File) => {
    if (!isSupportedFile(file.name)) return;

    // Duplicate check via name + size + lastModified
    const isDuplicate = queue.some(f =>
      f.file.name === file.name && f.file.size === file.size && f.file.lastModified === file.lastModified
    );
    if (isDuplicate) {
      setAppProcessing(true, 'Duplicate file skipped');
      setTimeout(() => setAppProcessing(false), 2000);
      return;
    }

    const fileType = isSubtitleFile(file.name) ? 'translation' : 'transcription';
    const newFile: BatchFile = {
      id: `${Date.now()}-${Math.random()}`,
      file,
      name: file.name,
      type: fileType,
      status: 'pending',
    };

    setQueue(prev => {
      const updatedQueue = [...prev, newFile];
      // Trigger language detection for subtitle files (auto)
      if (isSubtitleFile(file.name)) {
        if (detectionTimeoutRef.current) clearTimeout(detectionTimeoutRef.current);
        detectionTimeoutRef.current = setTimeout(() => {
          setTimeout(() => processLanguageDetectionQueue(updatedQueue), 0);
        }, 200);
      }
      return updatedQueue;
    });
  };

  const handleSingleFileSelect = (file: File) => addFileToQueue(file);

  const handleMultipleFileSelect = (files: File[]) => {
    for (const file of files) addFileToQueue(file);
  };

  const removeFromQueue = (fileId: string) => {
    setQueue(prev => prev.filter(file => file.id !== fileId));
  };

  const clearQueue = () => {
    if (!isProcessing) setQueue([]);
  };

  const moveFileUp = (index: number) => {
    if (index > 0 && !isProcessing) {
      setQueue(prev => {
        const newQueue = [...prev];
        [newQueue[index - 1], newQueue[index]] = [newQueue[index], newQueue[index - 1]];
        return newQueue;
      });
    }
  };

  const moveFileDown = (index: number) => {
    if (index < queue.length - 1 && !isProcessing) {
      setQueue(prev => {
        const newQueue = [...prev];
        [newQueue[index], newQueue[index + 1]] = [newQueue[index + 1], newQueue[index]];
        return newQueue;
      });
    }
  };

  // ── Credit tracking ──
  const updateFileCredits = (fileId: string, creditsUsed: number) => {
    setQueue(prev => prev.map(f => f.id === fileId ? { ...f, creditsUsed } : f));
    setBatchCreditStats(prev => {
      const newCreditsPerFile = new Map(prev.creditsPerFile);
      newCreditsPerFile.set(fileId, creditsUsed);
      const totalCreditsUsed = Array.from(newCreditsPerFile.values()).reduce((sum, c) => sum + c, 0);
      return { totalCreditsUsed, creditsPerFile: newCreditsPerFile };
    });
  };

  const resetCreditTracking = () => {
    setBatchCreditStats({ totalCreditsUsed: 0, creditsPerFile: new Map() });
    setQueue(prev => prev.map(f => ({ ...f, creditsUsed: undefined })));
  };

  // ── Language validation ──
  const validateLanguageSelection = (): { isValid: boolean; missingLanguageFiles: BatchFile[] } => {
    const missingLanguageFiles = queue.filter(file =>
      isAudioVideoFile(file.name) && file.status === 'pending' && !file.selectedSourceLanguage
    );
    return { isValid: missingLanguageFiles.length === 0, missingLanguageFiles };
  };

  // ── Generate output filename (web version, no filesystem) ──
  const generateOutputFileName = (originalFileName: string, type: 'transcription' | 'translation', targetLanguage?: string): string => {
    const languageCode = targetLanguage || batchSettings.targetLanguage;
    const format = batchSettings.outputFormat;
    let languageName = languageCode;

    if (type === 'translation' && batchSettings.translationModel) {
      languageName = getTranslationLanguageNameSync(batchSettings.translationModel, languageCode) || languageCode;
    } else if (type === 'transcription' && batchSettings.transcriptionModel) {
      languageName = getTranscriptionLanguageNameSync(batchSettings.transcriptionModel, languageCode) || languageCode;
    }

    const filenamePattern = config.defaultFilenameFormat || '{filename}.{language_code}.{type}.{extension}';
    return generateFilename(filenamePattern, originalFileName, languageCode, languageName, type, format);
  };

  // ── Polling for task completion ──
  const pollForCompletion = async (correlationId: string, type: 'transcription' | 'translation', file: BatchFile): Promise<any> => {
    const startTime = Date.now();
    const pollingInterval = (config.pollingIntervalSeconds || 10) * 1000;
    const timeoutMs = (config.pollingTimeoutSeconds || 7200) * 1000;

    return new Promise((resolve, reject) => {
      const poll = async () => {
        if (shouldStopRef.current) { reject(new Error('Processing stopped by user')); return; }

        const elapsedMs = Date.now() - startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);

        try {
          const result = type === 'transcription'
            ? await checkTranscriptionStatus(correlationId)
            : await checkTranslationStatus(correlationId);

          setAppProcessing(true, `${type.charAt(0).toUpperCase() + type.slice(1)} in progress... (${elapsedSeconds}s elapsed)`);

          if (result.status === 'COMPLETED') {
            if (result.data && typeof result.data.total_price === 'number' && result.data.total_price > 0) {
              if (type === 'translation' && enableChaining) {
                const existing = batchCreditStats.creditsPerFile.get(file.id) || 0;
                updateFileCredits(file.id, existing + result.data.total_price);
              } else {
                updateFileCredits(file.id, result.data.total_price);
              }
            }
            resolve(result);
          } else if (result.status === 'ERROR') {
            reject(new Error(result.errors?.join(', ') || `${type} failed`));
          } else if (result.status === 'TIMEOUT' || elapsedMs >= timeoutMs) {
            reject(new Error(`${type} timed out`));
          } else {
            const progressBase = type === 'transcription' ? 25 : 50;
            const timeRatio = Math.min(elapsedMs / (5 * 60 * 1000), 1);
            const progressIncrement = timeRatio * 30;
            setQueue(prev => prev.map(f =>
              f.id === file.id ? { ...f, progress: Math.min(90, progressBase + progressIncrement) } : f
            ));
            setTimeout(poll, pollingInterval);
          }
        } catch (error) {
          reject(error);
        }
      };
      poll();
    });
  };

  // ── Process individual files ──
  const processTranscriptionFile = async (file: BatchFile) => {
    let fileToProcess: File | Blob = file.file;

    // Extract/convert audio if needed
    setQueue(prev => prev.map(f =>
      f.id === file.id ? { ...f, progress: 5 } : f
    ));

    if (isVideoFile(file.name)) {
      setAppProcessing(true, `Extracting audio from video for ${file.name}...`);
      fileToProcess = await ffmpegService.extractAudioFromVideo(file.file);
    } else if (isAudioFile(file.name)) {
      const ext = file.name.toLowerCase().split('.').pop();
      const directFormats = ['mp3', 'wav', 'flac', 'm4a'];
      if (ext && !directFormats.includes(ext)) {
        setAppProcessing(true, `Converting audio format for ${file.name}...`);
        fileToProcess = await ffmpegService.convertAudioToMp3(file.file);
      }
    }

    // Initiate transcription
    setQueue(prev => prev.map(f =>
      f.id === file.id ? { ...f, progress: 10 } : f
    ));
    setAppProcessing(true, `Initiating transcription for ${file.name}...`);

    const initResult = await initiateTranscription(fileToProcess, {
      language: file.selectedSourceLanguage || file.detectedLanguage?.ISO_639_1 || 'auto',
      api: batchSettings.transcriptionModel,
      returnContent: true,
    });

    if (initResult.status === 'ERROR') {
      throw new Error(initResult.errors?.join(', ') || 'Transcription initiation failed');
    }

    let transcriptionResult: any;
    if (initResult.status === 'COMPLETED' && initResult.data) {
      if (typeof initResult.data.total_price === 'number' && initResult.data.total_price > 0) {
        updateFileCredits(file.id, initResult.data.total_price);
      }
      transcriptionResult = initResult;
    } else if (initResult.correlation_id) {
      setQueue(prev => prev.map(f => f.id === file.id ? { ...f, progress: 25 } : f));
      transcriptionResult = await pollForCompletion(initResult.correlation_id, 'transcription', file);
    } else {
      throw new Error('No correlation ID received for transcription');
    }

    // Get output content — download from URL if provided
    let outputContent = transcriptionResult.data?.return_content;
    if (!outputContent && transcriptionResult.data?.url) {
      const dl = await downloadFile(transcriptionResult.data.url);
      if (dl.success && dl.content) outputContent = dl.content;
    }

    // Chained translation
    if (enableChaining && outputContent) {
      setQueue(prev => prev.map(f => f.id === file.id ? { ...f, progress: 60 } : f));
      setAppProcessing(true, `Starting translation chain for ${file.name}...`);

      const subtitleBlob = new Blob([outputContent], { type: 'text/plain' });

      const translationInitResult = await initiateTranslation(subtitleBlob, {
        translateFrom: file.selectedSourceLanguage || file.detectedLanguage?.ISO_639_1 || 'auto',
        translateTo: batchSettings.targetLanguage,
        api: batchSettings.translationModel,
        returnContent: true,
      });

      if (translationInitResult.status === 'ERROR') {
        throw new Error(translationInitResult.errors?.join(', ') || 'Translation initiation failed');
      }

      let translationResult: any;
      if (translationInitResult.status === 'COMPLETED' && translationInitResult.data) {
        if (typeof translationInitResult.data.total_price === 'number' && translationInitResult.data.total_price > 0) {
          const existing = batchCreditStats.creditsPerFile.get(file.id) || 0;
          updateFileCredits(file.id, existing + translationInitResult.data.total_price);
        }
        translationResult = translationInitResult;
      } else if (translationInitResult.correlation_id) {
        setQueue(prev => prev.map(f => f.id === file.id ? { ...f, progress: 80 } : f));
        translationResult = await pollForCompletion(translationInitResult.correlation_id, 'translation', file);
      } else {
        throw new Error('No correlation ID received for translation');
      }

      outputContent = translationResult.data?.return_content;
      if (!outputContent && translationResult.data?.url) {
        const dl = await downloadFile(translationResult.data.url);
        if (dl.success && dl.content) outputContent = dl.content;
      }
    }

    // Store output
    if (outputContent) {
      const type = enableChaining ? 'translation' : 'transcription';
      const targetLang = enableChaining ? batchSettings.targetLanguage : (file.selectedSourceLanguage || file.detectedLanguage?.ISO_639_1);
      const outputFileName = generateOutputFileName(file.name, type, targetLang);

      setQueue(prev => prev.map(f =>
        f.id === file.id ? { ...f, outputContent, outputFileName, progress: 100 } : f
      ));
    }
  };

  const processTranslationFile = async (file: BatchFile) => {
    setQueue(prev => prev.map(f =>
      f.id === file.id ? { ...f, progress: 10 } : f
    ));
    setAppProcessing(true, `Initiating translation for ${file.name}...`);

    const initResult = await initiateTranslation(file.file, {
      translateFrom: file.selectedSourceLanguage || file.detectedLanguage?.ISO_639_1 || 'auto',
      translateTo: batchSettings.targetLanguage,
      api: batchSettings.translationModel,
      returnContent: true,
    });

    if (initResult.status === 'ERROR') {
      throw new Error(initResult.errors?.join(', ') || 'Translation initiation failed');
    }

    let translationResult: any;
    if (initResult.status === 'COMPLETED' && initResult.data) {
      if (typeof initResult.data.total_price === 'number' && initResult.data.total_price > 0) {
        updateFileCredits(file.id, initResult.data.total_price);
      }
      translationResult = initResult;
    } else if (initResult.correlation_id) {
      setQueue(prev => prev.map(f => f.id === file.id ? { ...f, progress: 50 } : f));
      translationResult = await pollForCompletion(initResult.correlation_id, 'translation', file);
    } else {
      throw new Error('No correlation ID received for translation');
    }

    let outputContent = translationResult.data?.return_content;
    if (!outputContent && translationResult.data?.url) {
      const dl = await downloadFile(translationResult.data.url);
      if (dl.success && dl.content) outputContent = dl.content;
    }

    if (outputContent) {
      const outputFileName = generateOutputFileName(file.name, 'translation', batchSettings.targetLanguage);
      setQueue(prev => prev.map(f =>
        f.id === file.id ? { ...f, outputContent, outputFileName, progress: 100 } : f
      ));
    }
  };

  const processFile = async (file: BatchFile, index: number) => {
    try {
      setAppProcessing(true, `Processing file ${index + 1}/${queue.length}: ${file.name}`);
      setQueue(prev => prev.map(f =>
        f.id === file.id ? { ...f, status: 'processing' as const, progress: 0 } : f
      ));

      if (file.type === 'transcription') {
        await processTranscriptionFile(file);
      } else {
        await processTranslationFile(file);
      }

      setQueue(prev => prev.map(f =>
        f.id === file.id ? { ...f, status: 'completed' as const, progress: 100 } : f
      ));
    } catch (error: any) {
      logger.error('BatchScreen', `Failed to process file: ${file.name}`, error);
      setQueue(prev => prev.map(f =>
        f.id === file.id ? { ...f, status: 'error' as const, error: error.message || 'Processing failed' } : f
      ));
      if (batchSettings.abortOnError) throw error;
    }
  };

  // ── Batch processing ──
  const startBatchProcessing = async () => {
    if (queue.length === 0 || !isAuthenticated) return;

    const validation = validateLanguageSelection();
    if (!validation.isValid) {
      setShowLanguageValidationModal(true);
      return;
    }

    setIsProcessing(true);
    setCurrentFileIndex(0);
    setOverallProgress(0);
    processingRef.current = true;
    shouldStopRef.current = false;
    resetCreditTracking();
    setBatchStats({ startTime: new Date(), endTime: null, totalFilesProcessed: queue.length, successfulFiles: 0 });
    setAppProcessing(true, `Starting batch processing of ${queue.length} files...`);

    const originalQueue = [...queue];
    const totalFiles = originalQueue.length;

    try {
      for (let i = 0; i < originalQueue.length; i++) {
        if (shouldStopRef.current) break;
        setCurrentFileIndex(i);
        await processFile(originalQueue[i], i);
        const progress = Math.round(((i + 1) / totalFiles) * 100);
        setOverallProgress(progress);
        setAppProcessing(true, `Batch processing: ${i + 1}/${totalFiles} files completed (${progress}%)`);
      }

      setBatchStats(prev => ({
        ...prev,
        endTime: new Date(),
        successfulFiles: queueRef.current.filter(f => f.status === 'completed').length,
      }));

      setAppProcessing(true, 'Batch processing completed!');
      setShowCompletionSummary(true);
      setTimeout(() => setAppProcessing(false), 3000);
    } catch (error) {
      logger.error('BatchScreen', 'Batch processing failed', error);
      setBatchStats(prev => ({
        ...prev,
        endTime: new Date(),
        successfulFiles: queueRef.current.filter(f => f.status === 'completed').length,
      }));
      setAppProcessing(true, 'Batch processing stopped due to error');
      setShowCompletionSummary(true);
      setTimeout(() => setAppProcessing(false), 3000);
    } finally {
      setIsProcessing(false);
      setCurrentFileIndex(-1);
      processingRef.current = false;
    }
  };

  const stopBatchProcessing = () => {
    shouldStopRef.current = true;
    setIsProcessing(false);
    setCurrentFileIndex(-1);
    processingRef.current = false;
  };

  // ── Download helpers ──
  const downloadSingleFile = (file: BatchFile) => {
    if (file.outputContent && file.outputFileName) {
      saveTextFile(file.outputContent, file.outputFileName);
    }
  };

  const downloadAllFiles = async () => {
    const completed = queue.filter(f => f.status === 'completed' && f.outputContent && f.outputFileName);
    for (let i = 0; i < completed.length; i++) {
      downloadSingleFile(completed[i]);
      if (i < completed.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (detectionTimeoutRef.current) clearTimeout(detectionTimeoutRef.current);
    };
  }, []);

  // ── Render ──
  const completedFiles = queue.filter(f => f.status === 'completed' && f.outputContent);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px', position: 'relative' }}>
      <h1>Batch Processing</h1>
      <p>Select multiple files to transcribe or translate:</p>

      <FileSelector
        onFileSelect={handleSingleFileSelect}
        onMultipleFileSelect={handleMultipleFileSelect}
        multiple={true}
        disabled={isProcessing}
      />

      {/* Queue Display */}
      {queue.length > 0 && (
        <div style={{
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          padding: '15px',
          backgroundColor: 'var(--bg-secondary)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
            <h3>File Queue ({queue.length} files)</h3>
            {isDetectingLanguages && (
              <p style={{ color: 'var(--accent-color)', fontSize: '14px', fontStyle: 'italic' }}>
                Detecting languages sequentially... ({queue.filter(f => f.status === 'detecting').length} in progress)
              </p>
            )}
            <button
              onClick={clearQueue}
              disabled={isProcessing}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--danger-color)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
              }}
            >
              Clear Queue
            </button>
          </div>

          <div style={{
            maxHeight: '300px',
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            backgroundColor: 'var(--bg-secondary)',
          }}>
            {queue.map((file, index) => (
              <div key={file.id} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px',
                borderBottom: index < queue.length - 1 ? '1px solid var(--border-color)' : 'none',
                backgroundColor: index === currentFileIndex && isProcessing ? 'rgba(52, 152, 219, 0.1)' : 'transparent',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', wordBreak: 'break-all' }}>
                    {file.name}
                    <span style={{
                      marginLeft: '8px',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontWeight: 'normal',
                      backgroundColor: file.type === 'transcription' ? 'rgba(52, 152, 219, 0.15)' : 'rgba(155, 89, 182, 0.15)',
                      color: file.type === 'transcription' ? 'var(--accent-color)' : '#9b59b6',
                    }}>
                      {file.type}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Status: <span style={{
                      color: file.status === 'completed' ? 'var(--success-color)' :
                             file.status === 'error' ? 'var(--danger-color)' :
                             file.status === 'processing' || file.status === 'detecting' ? 'var(--accent-color)' :
                             'var(--text-secondary)'
                    }}>{file.status}</span>
                    {file.detectedLanguage && ` | Language: ${file.detectedLanguage.native || file.detectedLanguage.name}`}
                    {file.progress !== undefined && file.status === 'processing' && ` | Progress: ${file.progress}%`}
                    {file.creditsUsed !== undefined && file.creditsUsed > 0 && ` | Credits: ${file.creditsUsed}`}
                    {' | '}{formatFileSize(file.file.size)}
                  </div>

                  {/* Per-file progress bar */}
                  {file.status === 'processing' && file.progress !== undefined && (
                    <div style={{
                      marginTop: '6px',
                      height: '4px',
                      backgroundColor: 'var(--bg-primary)',
                      borderRadius: '2px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${file.progress}%`,
                        height: '100%',
                        backgroundColor: 'var(--accent-color)',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  )}

                  {/* Source Language Selector */}
                  {file.type === 'translation' && contextTranslationInfo && batchSettings.translationModel && (
                    <div style={{ marginTop: '8px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Source Language:
                      </label>
                      <select
                        value={file.selectedSourceLanguage || ''}
                        onChange={(e) => handleSourceLanguageChange(file.id, e.target.value)}
                        disabled={isProcessing}
                        style={{
                          fontSize: '11px', padding: '2px 4px',
                          border: '1px solid var(--border-color)', borderRadius: '3px',
                          backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)',
                          maxWidth: '200px',
                        }}
                      >
                        {!file.selectedSourceLanguage && <option value="">{file.detectedLanguage ? 'Select variant...' : 'Select language...'}</option>}
                        {(() => {
                          const apiLanguages = contextTranslationInfo?.languages?.[batchSettings.translationModel] || [];
                          return getMatchingSourceLanguages(file.detectedLanguage?.ISO_639_1 || null, apiLanguages).map(lang => (
                            <option key={lang.language_code} value={lang.language_code}>{lang.language_name}</option>
                          ));
                        })()}
                      </select>
                    </div>
                  )}

                  {file.type === 'transcription' && contextTranscriptionInfo && batchSettings.transcriptionModel && (
                    <div style={{ marginTop: '8px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Source Language:
                      </label>
                      <select
                        value={file.selectedSourceLanguage || ''}
                        onChange={(e) => handleSourceLanguageChange(file.id, e.target.value)}
                        disabled={isProcessing}
                        style={{
                          fontSize: '11px', padding: '2px 4px',
                          border: '1px solid var(--border-color)', borderRadius: '3px',
                          backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)',
                          maxWidth: '200px',
                        }}
                      >
                        {!file.selectedSourceLanguage && <option value="">{file.detectedLanguage ? 'Select variant...' : 'Select language...'}</option>}
                        {(() => {
                          const apiLanguages = getLanguagesForModel(contextTranscriptionInfo?.languages, batchSettings.transcriptionModel);
                          return getMatchingSourceLanguages(file.detectedLanguage?.ISO_639_1 || null, apiLanguages).map(lang => (
                            <option key={lang.language_code} value={lang.language_code}>{lang.language_name}</option>
                          ));
                        })()}
                      </select>
                    </div>
                  )}

                  {/* Download button for completed files */}
                  {file.status === 'completed' && file.outputContent && (
                    <button
                      onClick={() => downloadSingleFile(file)}
                      style={{
                        marginTop: '6px', padding: '4px 10px', fontSize: '11px',
                        backgroundColor: 'var(--success-color)', color: 'white',
                        border: 'none', borderRadius: '3px', cursor: 'pointer',
                      }}
                    >
                      <i className="fas fa-download" style={{ marginRight: '4px' }}></i>
                      Download {file.outputFileName}
                    </button>
                  )}

                  {file.error && <div style={{ fontSize: '12px', color: 'var(--danger-color)', marginTop: '4px' }}>Error: {file.error}</div>}
                </div>

                {!isProcessing && (
                  <div style={{ display: 'flex', gap: '5px', marginLeft: '10px' }}>
                    <button onClick={() => moveFileUp(index)} disabled={index === 0} title="Move Up"
                      style={{ padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: '3px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: index === 0 ? 'not-allowed' : 'pointer' }}>
                      <i className="fas fa-arrow-up"></i>
                    </button>
                    <button onClick={() => moveFileDown(index)} disabled={index === queue.length - 1} title="Move Down"
                      style={{ padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: '3px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: index === queue.length - 1 ? 'not-allowed' : 'pointer' }}>
                      <i className="fas fa-arrow-down"></i>
                    </button>
                    <button onClick={() => removeFromQueue(file.id)} title="Remove"
                      style={{ padding: '4px 8px', border: '1px solid var(--danger-color)', borderRadius: '3px', backgroundColor: 'transparent', color: 'var(--danger-color)', cursor: 'pointer' }}>
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Welcome message */}
      {queue.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          backgroundColor: 'var(--bg-secondary)', borderRadius: '12px',
          border: '2px dashed var(--border-color)', margin: '20px 0',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>
            <i className="fas fa-layer-group" style={{ color: 'var(--text-muted)' }}></i>
          </div>
          <div style={{ fontSize: '28px', color: 'var(--text-muted)', marginBottom: '15px', fontWeight: '500' }}>
            Batch Processing Power
          </div>
          <div style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '25px', lineHeight: '1.5' }}>
            Process multiple files automatically with advanced workflow control
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            <div style={{ marginBottom: '8px' }}><strong>Bulk Transcription:</strong> Convert multiple audio/video files to text</div>
            <div style={{ marginBottom: '8px' }}><strong>Bulk Translation:</strong> Translate multiple subtitle files</div>
            <div><strong>Smart Chaining:</strong> Auto-transcribe then translate in sequence</div>
          </div>
          <div style={{
            fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic',
            borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '20px',
          }}>
            Use the file selector above or drag & drop multiple files to get started
          </div>
        </div>
      )}

      {/* Settings Panel */}
      <div
        className="batch-settings-panel"
        style={{
          display: queue.length > 0 ? 'grid' : 'none',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px', padding: '20px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px', border: '1px solid var(--border-color)',
        }}
      >
        {/* Workflow Selection */}
        {uiState.chainingEnabled && (
          <div style={{ gridColumn: '1 / -1', marginBottom: '10px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
            <h4><i className="fas fa-route"></i> Processing Workflow</h4>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
              Choose how to process audio/video files:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px',
                border: `2px solid ${batchSettings.workflowMode === 'transcribe-only' ? 'var(--accent-color)' : 'var(--border-color)'}`,
                borderRadius: '8px', cursor: isProcessing ? 'not-allowed' : 'pointer',
                backgroundColor: batchSettings.workflowMode === 'transcribe-only' ? 'rgba(52, 152, 219, 0.1)' : 'transparent',
              }}>
                <input type="radio" name="workflowMode" value="transcribe-only"
                  checked={batchSettings.workflowMode === 'transcribe-only'}
                  onChange={(e) => setBatchSettings(prev => ({ ...prev, workflowMode: e.target.value as WorkflowMode }))}
                  disabled={isProcessing} style={{ marginTop: '3px' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}><i className="fas fa-file-audio"></i> Transcribe only</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Produces subtitles in original language</div>
                </div>
              </label>
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px',
                border: `2px solid ${batchSettings.workflowMode === 'transcribe-and-translate' ? 'var(--accent-color)' : 'var(--border-color)'}`,
                borderRadius: '8px', cursor: isProcessing ? 'not-allowed' : 'pointer',
                backgroundColor: batchSettings.workflowMode === 'transcribe-and-translate' ? 'rgba(52, 152, 219, 0.1)' : 'transparent',
              }}>
                <input type="radio" name="workflowMode" value="transcribe-and-translate"
                  checked={batchSettings.workflowMode === 'transcribe-and-translate'}
                  onChange={(e) => setBatchSettings(prev => ({ ...prev, workflowMode: e.target.value as WorkflowMode }))}
                  disabled={isProcessing} style={{ marginTop: '3px' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}><i className="fas fa-language"></i> Auto-translate after transcription</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Produces subtitles in target language (2-step process)</div>
                </div>
              </label>
            </div>

            {/* Workflow Diagram */}
            <div style={{ padding: '15px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '24px', marginBottom: '5px' }}><i className="fas fa-film"></i></div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Audio/Video</div></div>
                <i className="fas fa-arrow-right" style={{ color: 'var(--accent-color)' }}></i>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '24px', marginBottom: '5px' }}><i className="fas fa-microphone"></i></div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Transcribe</div></div>
                {enableChaining && (<>
                  <i className="fas fa-arrow-right" style={{ color: 'var(--accent-color)' }}></i>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: '24px', marginBottom: '5px' }}><i className="fas fa-language"></i></div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Translate</div></div>
                </>)}
                <i className="fas fa-arrow-right" style={{ color: 'var(--accent-color)' }}></i>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: '24px', marginBottom: '5px' }}><i className="fas fa-file-alt"></i></div><div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Output {batchSettings.outputFormat.toUpperCase()}</div></div>
              </div>
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                <i className="fas fa-info-circle"></i> {enableChaining ? 'Two-step processing uses credits for both operations' : 'Single-step processing: converts speech to text in original language'}
              </div>
            </div>
          </div>
        )}

        {/* Transcription Settings */}
        <div>
          <h4 style={{ opacity: uiState.transcriptionEnabled ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
            <i className="fas fa-microphone" style={{ fontSize: '18px' }}></i>
            <span>Transcription Settings</span>
          </h4>
          {!uiState.transcriptionEnabled && (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0 0 10px 0' }}>No audio/video files in queue</p>
          )}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Model:</label>
            <select
              value={batchSettings.transcriptionModel}
              onChange={(e) => handleTranscriptionModelChange(e.target.value)}
              disabled={isProcessing || !uiState.transcriptionEnabled}
              style={{ width: '100%', padding: '5px', opacity: uiState.transcriptionEnabled ? 1 : 0.5 }}
            >
              {!contextTranscriptionInfo?.apis?.length ? (
                <option value="">Loading models...</option>
              ) : (
                contextTranscriptionInfo.apis.map((api: string) => (
                  <option key={api} value={api}>{api}</option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Translation Settings */}
        <div>
          <h4 style={{ opacity: uiState.translationEnabled ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
            <i className="fas fa-language" style={{ fontSize: '18px' }}></i>
            <span>Translation Settings</span>
          </h4>
          {!uiState.translationEnabled && (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0 0 10px 0' }}>
              Select "Auto-translate" workflow or add subtitle files to queue
            </p>
          )}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Model:</label>
            <select
              value={batchSettings.translationModel}
              onChange={(e) => handleTranslationModelChange(e.target.value)}
              disabled={isProcessing || !uiState.translationEnabled}
              style={{ width: '100%', padding: '5px', opacity: uiState.translationEnabled ? 1 : 0.5 }}
            >
              {!contextTranslationInfo?.apis?.length ? (
                <option value="">Loading models...</option>
              ) : (
                contextTranslationInfo.apis.map((api: string) => (
                  <option key={api} value={api}>{api}</option>
                ))
              )}
            </select>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Target Language:</label>
            <select
              value={batchSettings.targetLanguage}
              onChange={(e) => setBatchSettings(prev => ({ ...prev, targetLanguage: e.target.value }))}
              disabled={isProcessing || !uiState.translationEnabled}
              style={{ width: '100%', padding: '5px', opacity: uiState.translationEnabled ? 1 : 0.5 }}
            >
              {isLoadingLanguages ? (
                <option value="">Loading languages...</option>
              ) : (
                availableTranslationLanguages
                  .filter((lang, idx, arr) => arr.findIndex(l => l.language_code === lang.language_code) === idx)
                  .map(lang => (
                    <option key={lang.language_code} value={lang.language_code}>{lang.language_name} ({lang.language_code})</option>
                  ))
              )}
            </select>
          </div>
        </div>

        {/* Output Settings */}
        <div>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
            <i className="fas fa-file-export" style={{ fontSize: '18px' }}></i>
            <span>Output Settings</span>
          </h4>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Format:</label>
            <select
              value={batchSettings.outputFormat}
              onChange={(e) => setBatchSettings(prev => ({ ...prev, outputFormat: e.target.value }))}
              disabled={isProcessing}
              style={{ width: '100%', padding: '5px' }}
            >
              {fileFormatsConfig.subtitle.map(format => (
                <option key={format} value={format}>{format.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Processing Options */}
        <div>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
            <i className="fas fa-cog" style={{ fontSize: '18px' }}></i>
            <span>Processing Options</span>
          </h4>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={batchSettings.abortOnError}
                onChange={(e) => setBatchSettings(prev => ({ ...prev, abortOnError: e.target.checked }))}
                disabled={isProcessing}
              />
              Abort batch processing on first error
            </label>
          </div>
        </div>
      </div>

      {/* Processing Controls */}
      {queue.length > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px', backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px', border: '1px solid var(--border-color)',
        }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>
              Overall Progress: {overallProgress}%
              {batchCreditStats.totalCreditsUsed > 0 && (
                <span style={{ marginLeft: '20px', fontSize: '16px', color: 'var(--accent-color)' }}>
                  Credits Used: {batchCreditStats.totalCreditsUsed}
                </span>
              )}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              {isProcessing ? (
                currentFileIndex >= 0 ?
                  `Processing: ${queue[currentFileIndex]?.name} (${currentFileIndex + 1}/${queue.length})` :
                  'Starting batch processing...'
              ) : (
                `Ready to process ${queue.length} files`
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Language Detection Button */}
            {!isProcessing && queue.some(file => !file.detectedLanguage) && (
              <button
                onClick={() => processLanguageDetectionQueue(undefined, true)}
                disabled={isDetectingLanguages || !isAuthenticated}
                style={{
                  padding: '10px 20px',
                  backgroundColor: isDetectingLanguages ? 'var(--text-muted)' : '#17a2b8',
                  color: 'white', border: 'none', borderRadius: '4px',
                  cursor: isDetectingLanguages || !isAuthenticated ? 'not-allowed' : 'pointer',
                  fontSize: '16px', minWidth: '160px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                {isDetectingLanguages ? (
                  <><i className="fas fa-spinner fa-spin"></i> Detecting...</>
                ) : (
                  'Detect Languages'
                )}
              </button>
            )}

            <button
              onClick={!isProcessing ? startBatchProcessing : stopBatchProcessing}
              disabled={!isProcessing && (queue.length === 0 || (!batchSettings.transcriptionModel && !batchSettings.translationModel))}
              style={{
                padding: '10px 20px',
                backgroundColor: isProcessing ? 'var(--danger-color)' : 'var(--success-color)',
                color: 'white', border: 'none', borderRadius: '4px',
                cursor: (!isProcessing && (queue.length === 0 || (!batchSettings.transcriptionModel && !batchSettings.translationModel))) ? 'not-allowed' : 'pointer',
                fontSize: '16px', minWidth: '180px',
              }}
            >
              {isProcessing ? 'Stop Batch Processing' : 'Start Batch Processing'}
            </button>
          </div>
        </div>
      )}

      {/* Overall Progress Bar */}
      {isProcessing && (
        <div style={{
          width: '100%', height: '10px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '5px', overflow: 'hidden',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{
            width: `${overallProgress}%`, height: '100%',
            backgroundColor: 'var(--accent-color)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      {/* Language Validation Modal */}
      {showLanguageValidationModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowLanguageValidationModal(false)}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', padding: '24px',
            maxWidth: '600px', width: '90%', maxHeight: '80vh', overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)', border: '1px solid var(--border-color)',
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '18px', fontWeight: '600' }}>
              Source Language Selection Required
            </h3>
            <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
              The following audio/video files need a source language selected before batch processing can start.
              Please select the source language for each file using the dropdown menus in the file list.
            </p>
            <div style={{
              maxHeight: '300px', overflow: 'auto',
              border: '1px solid var(--border-color)', borderRadius: '4px',
              padding: '12px', backgroundColor: 'var(--bg-primary)', marginBottom: '20px',
            }}>
              {validateLanguageSelection().missingLanguageFiles.map(file => (
                <div key={file.id} style={{
                  padding: '8px 12px', margin: '4px 0',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--danger-color)', borderRadius: '4px', fontSize: '14px',
                }}>
                  <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{file.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Type: {file.type}
                    {file.detectedLanguage && ` | Detected: ${file.detectedLanguage.native || file.detectedLanguage.name}`}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowLanguageValidationModal(false)}
                className="btn-primary"
                style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '500' }}
              >
                OK, I'll Select Languages
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Summary Modal */}
      {showCompletionSummary && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', padding: '24px',
            maxWidth: '600px', maxHeight: '80vh', overflow: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)',
          }}>
            <h2 style={{
              margin: '0 0 20px 0', color: 'var(--text-primary)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <i className="fas fa-trophy" style={{ fontSize: '24px', color: '#FFD700' }}></i>
              Batch Processing Complete
            </h2>

            {/* Stats Grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px',
              marginBottom: '20px', padding: '16px',
              backgroundColor: 'var(--bg-primary)', borderRadius: '6px',
            }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--success-color)' }}>{batchStats.successfulFiles}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Files Processed</div>
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-color)' }}>{batchCreditStats.totalCreditsUsed}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Credits Used</div>
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff6b35' }}>
                  {batchStats.startTime && batchStats.endTime ?
                    Math.round((batchStats.endTime.getTime() - batchStats.startTime.getTime()) / 1000) : 0}s
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Duration</div>
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6f42c1' }}>{completedFiles.length}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Output Files</div>
              </div>
            </div>

            {/* Per-file download buttons */}
            {completedFiles.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--text-primary)' }}>Output Files:</h3>
                <div style={{
                  maxHeight: '200px', overflow: 'auto',
                  border: '1px solid var(--border-color)', borderRadius: '4px',
                  backgroundColor: 'var(--bg-primary)',
                }}>
                  {completedFiles.map((file, index) => (
                    <div key={file.id} style={{
                      padding: '8px 12px',
                      borderBottom: index < completedFiles.length - 1 ? '1px solid var(--border-color)' : 'none',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: '13px', fontFamily: 'monospace', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                        {file.outputFileName}
                      </span>
                      <button
                        onClick={() => downloadSingleFile(file)}
                        style={{
                          padding: '4px 10px', fontSize: '12px', marginLeft: '10px',
                          backgroundColor: 'var(--success-color)', color: 'white',
                          border: 'none', borderRadius: '3px', cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        <i className="fas fa-download" style={{ marginRight: '4px' }}></i>Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              {completedFiles.length > 1 && (
                <button
                  onClick={downloadAllFiles}
                  style={{
                    padding: '12px 24px', backgroundColor: 'var(--success-color)',
                    color: 'white', border: 'none', borderRadius: '4px',
                    cursor: 'pointer', fontSize: '14px', fontWeight: '500',
                  }}
                >
                  <i className="fas fa-download" style={{ marginRight: '6px' }}></i>Download All
                </button>
              )}
              <button
                onClick={() => setShowCompletionSummary(false)}
                className="btn-primary"
                style={{ padding: '12px 24px', fontSize: '14px', fontWeight: '500' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 1024px) {
          .batch-settings-panel {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default BatchScreen;
