import { useState, useCallback, useRef, useEffect } from 'react';
import { BatchFile, BatchSettings, BatchScreenConfig, BatchStats } from '../types';
import { isVideoFile, isAudioFile } from '../../../utils/fileTypeUtils';

interface BatchProcessorApi {
  initiateTranscription: (file: File | Blob, options: any) => Promise<any>;
  checkTranscriptionStatus: (correlationId: string) => Promise<any>;
  initiateTranslation: (file: File | Blob, options: any) => Promise<any>;
  checkTranslationStatus: (correlationId: string) => Promise<any>;
  downloadFile: (url: string) => Promise<any>;
}

interface UseBatchProcessorOptions {
  config: BatchScreenConfig;
  setAppProcessing: (processing: boolean, task?: string) => void;
  api: BatchProcessorApi;
}

export const useBatchProcessor = ({
  config,
  setAppProcessing,
  api,
}: UseBatchProcessorOptions) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(-1);
  const [overallProgress, setOverallProgress] = useState(0);
  const [showCompletionSummary, setShowCompletionSummary] = useState(false);
  const [showLanguageValidationModal, setShowLanguageValidationModal] = useState(false);
  const [batchStats, setBatchStats] = useState<BatchStats>({
    startTime: null,
    endTime: null,
    totalFilesProcessed: 0,
    successfulFiles: 0,
  });

  const processingRef = useRef(false);
  const shouldStopRef = useRef(false);
  const batchSettingsRef = useRef<BatchSettings | null>(null);
  const pollingIntervalMs = (config.pollingIntervalSeconds || 10) * 1000;
  const pollingTimeoutMs = (config.pollingTimeoutSeconds || 7200) * 1000;

  useEffect(() => {
    if (!isProcessing) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isProcessing]);

  const pollForCompletion = useCallback(async (
    correlationId: string,
    type: 'transcription' | 'translation',
    fileId: string,
    onUpdateProgress: (progress: number) => void,
  ): Promise<any> => {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const poll = async () => {
        if (shouldStopRef.current) { reject(new Error('Processing stopped by user')); return; }

        const elapsedMs = Date.now() - startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);

        try {
          const result = type === 'transcription'
            ? await api.checkTranscriptionStatus(correlationId)
            : await api.checkTranslationStatus(correlationId);

          setAppProcessing(true, `${type.charAt(0).toUpperCase() + type.slice(1)} in progress... (${elapsedSeconds}s elapsed)`);

          if (result.status === 'COMPLETED') {
            resolve(result);
          } else if (result.status === 'ERROR') {
            reject(new Error(result.errors?.join(', ') || `${type} failed`));
          } else if (result.status === 'TIMEOUT' || elapsedMs >= pollingTimeoutMs) {
            reject(new Error(`${type} timed out`));
          } else {
            const progressBase = type === 'transcription' ? 25 : 50;
            const timeRatio = Math.min(elapsedMs / (5 * 60 * 1000), 1);
            const progressIncrement = timeRatio * 30;
            onUpdateProgress(Math.min(90, progressBase + progressIncrement));
            setTimeout(poll, pollingIntervalMs);
          }
        } catch (error) {
          reject(error);
        }
      };
      poll();
    });
  }, [api, setAppProcessing, pollingIntervalMs, pollingTimeoutMs]);

  const processFile = useCallback(async (
    file: BatchFile,
    index: number,
    total: number,
    updateFileCredits: (fileId: string, credits: number) => void,
    generateOutputFileNameFn: (
      originalFileName: string,
      type: 'transcription' | 'translation',
      targetLanguage: string,
      outputFormat: string,
      translationModel: string,
      transcriptionModel: string,
      getTranslationLanguageNameSync: (model: string, code: string) => string | undefined,
      getTranscriptionLanguageNameSync: (model: string, code: string) => string | undefined,
      defaultFilenameFormat?: string,
    ) => string,
    getTranslationLanguageNameSync: (model: string, code: string) => string | undefined,
    getTranscriptionLanguageNameSync: (model: string, code: string) => string | undefined,
  ) => {
    const settings = batchSettingsRef.current;
    if (!settings) return;

    try {
      setAppProcessing(true, `Processing file ${index + 1}/${total}: ${file.name}`);

      let outputContent: string | undefined;
      if (file.type === 'transcription') {
        outputContent = await processTranscriptionFile(
          file, settings, updateFileCredits, generateOutputFileNameFn,
          getTranslationLanguageNameSync, getTranscriptionLanguageNameSync,
        );
      } else {
        outputContent = await processTranslationFile(
          file, settings, updateFileCredits, generateOutputFileNameFn,
          getTranslationLanguageNameSync, getTranscriptionLanguageNameSync,
        );
      }
      return outputContent;
    } catch (error: any) {
      const { logger } = await import('../../../utils/errorLogger');
      logger.error('BatchScreen', `Failed to process file: ${file.name}`, error);
      if (settings.abortOnError) throw error;
    }
  }, [setAppProcessing, api.downloadFile, config.defaultFilenameFormat, pollForCompletion]);

  const processTranscriptionFile = async (
    file: BatchFile,
    settings: BatchSettings,
    updateFileCredits: (fileId: string, credits: number) => void,
    generateOutputFileNameFn: (
      originalFileName: string,
      type: 'transcription' | 'translation',
      targetLanguage: string,
      outputFormat: string,
      translationModel: string,
      transcriptionModel: string,
      getTranslationLanguageNameSync: (model: string, code: string) => string | undefined,
      getTranscriptionLanguageNameSync: (model: string, code: string) => string | undefined,
      defaultFilenameFormat?: string,
    ) => string,
    getTranslationLanguageNameSync: (model: string, code: string) => string | undefined,
    getTranscriptionLanguageNameSync: (model: string, code: string) => string | undefined,
  ) => {
    let fileToProcess: File | Blob = file.file;
    const updateProgress = (pct: number) => {
      // progress updates are handled via setQueue in the main component
    };

    if (isVideoFile(file.name)) {
      setAppProcessing(true, `Extracting audio from video for ${file.name}...`);
      const { ffmpegService } = await import('../../../services/ffmpegService');
      fileToProcess = await ffmpegService.extractAudioFromVideo(file.file);
    } else if (isAudioFile(file.name)) {
      const ext = file.name.toLowerCase().split('.').pop();
      const directFormats = ['mp3', 'wav', 'flac', 'm4a'];
      if (ext && !directFormats.includes(ext)) {
        setAppProcessing(true, `Converting audio format for ${file.name}...`);
        const { ffmpegService } = await import('../../../services/ffmpegService');
        fileToProcess = await ffmpegService.convertAudioToMp3(file.file);
      }
    }

    setAppProcessing(true, `Initiating transcription for ${file.name}...`);

    const initResult = await api.initiateTranscription(fileToProcess, {
      language: file.selectedSourceLanguage || file.detectedLanguage?.ISO_639_1 || 'auto',
      api: settings.transcriptionModel,
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
      transcriptionResult = await pollForCompletion(initResult.correlation_id, 'transcription', file.id, updateProgress);
    } else {
      throw new Error('No correlation ID received for transcription');
    }

    let outputContent = transcriptionResult.data?.return_content;
    if (!outputContent && transcriptionResult.data?.url) {
      const dl = await api.downloadFile(transcriptionResult.data.url);
      if (dl.success && dl.content) outputContent = dl.content;
    }

    const enableChaining = settings.workflowMode === 'transcribe-and-translate';
    if (enableChaining && outputContent) {
      setAppProcessing(true, `Starting translation chain for ${file.name}...`);

      const subtitleBlob = new Blob([outputContent], { type: 'text/plain' });

      const translationInitResult = await api.initiateTranslation(subtitleBlob, {
        translateFrom: file.selectedSourceLanguage || file.detectedLanguage?.ISO_639_1 || 'auto',
        translateTo: settings.targetLanguage,
        api: settings.translationModel,
        returnContent: true,
      });

      if (translationInitResult.status === 'ERROR') {
        throw new Error(translationInitResult.errors?.join(', ') || 'Translation initiation failed');
      }

      let translationResult: any;
      if (translationInitResult.status === 'COMPLETED' && translationInitResult.data) {
        if (typeof translationInitResult.data.total_price === 'number' && translationInitResult.data.total_price > 0) {
          updateFileCredits(file.id, translationInitResult.data.total_price);
        }
        translationResult = translationInitResult;
      } else if (translationInitResult.correlation_id) {
        translationResult = await pollForCompletion(translationInitResult.correlation_id, 'translation', file.id, updateProgress);
      } else {
        throw new Error('No correlation ID received for translation');
      }

      outputContent = translationResult.data?.return_content;
      if (!outputContent && translationResult.data?.url) {
        const dl = await api.downloadFile(translationResult.data.url);
        if (dl.success && dl.content) outputContent = dl.content;
      }
    }

    return outputContent;
  };

  const processTranslationFile = async (
    file: BatchFile,
    settings: BatchSettings,
    updateFileCredits: (fileId: string, credits: number) => void,
    generateOutputFileNameFn: (
      originalFileName: string,
      type: 'transcription' | 'translation',
      targetLanguage: string,
      outputFormat: string,
      translationModel: string,
      transcriptionModel: string,
      getTranslationLanguageNameSync: (model: string, code: string) => string | undefined,
      getTranscriptionLanguageNameSync: (model: string, code: string) => string | undefined,
      defaultFilenameFormat?: string,
    ) => string,
    getTranslationLanguageNameSync: (model: string, code: string) => string | undefined,
    getTranscriptionLanguageNameSync: (model: string, code: string) => string | undefined,
  ) => {
    setAppProcessing(true, `Initiating translation for ${file.name}...`);

    const initResult = await api.initiateTranslation(file.file, {
      translateFrom: file.selectedSourceLanguage || file.detectedLanguage?.ISO_639_1 || 'auto',
      translateTo: settings.targetLanguage,
      api: settings.translationModel,
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
      translationResult = await pollForCompletion(
        initResult.correlation_id, 'translation', file.id,
        () => {},
      );
    } else {
      throw new Error('No correlation ID received for translation');
    }

    let outputContent = translationResult.data?.return_content;
    if (!outputContent && translationResult.data?.url) {
      const dl = await api.downloadFile(translationResult.data.url);
      if (dl.success && dl.content) outputContent = dl.content;
    }

    return outputContent;
  };

  const updateBatchSettingsRef = useCallback((settings: BatchSettings) => {
    batchSettingsRef.current = settings;
  }, []);

  const startBatchProcessing = useCallback(async (
    files: BatchFile[],
    validateLanguageSelectionFn: (queue: BatchFile[]) => { isValid: boolean; missingLanguageFiles: BatchFile[] },
    updateFileCredits: (fileId: string, credits: number) => void,
    resetCreditTracking: () => void,
    setQueue: React.Dispatch<React.SetStateAction<BatchFile[]>>,
    generateOutputFileNameFn: (
      originalFileName: string,
      type: 'transcription' | 'translation',
      targetLanguage: string,
      outputFormat: string,
      translationModel: string,
      transcriptionModel: string,
      getTranslationLanguageNameSync: (model: string, code: string) => string | undefined,
      getTranscriptionLanguageNameSync: (model: string, code: string) => string | undefined,
      defaultFilenameFormat?: string,
    ) => string,
    getTranslationLanguageNameSync: (model: string, code: string) => string | undefined,
    getTranscriptionLanguageNameSync: (model: string, code: string) => string | undefined,
  ) => {
    if (files.length === 0) return;

    const validation = validateLanguageSelectionFn(files);
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
    setBatchStats({ startTime: new Date(), endTime: null, totalFilesProcessed: files.length, successfulFiles: 0 });
    setAppProcessing(true, `Starting batch processing of ${files.length} files...`);

    const originalQueue = [...files];
    const totalFiles = originalQueue.length;
    let successCount = 0;

    try {
      for (let i = 0; i < originalQueue.length; i++) {
        if (shouldStopRef.current) break;
        setCurrentFileIndex(i);

        const file = originalQueue[i];
        setQueue(prev => prev.map(f =>
          f.id === file.id ? { ...f, status: 'processing' as const, progress: 0 } : f,
        ));

        try {
          const outputContent = await processFile(
            file, i, totalFiles, updateFileCredits,
            generateOutputFileNameFn,
            getTranslationLanguageNameSync,
            getTranscriptionLanguageNameSync,
          );

          if (outputContent) {
            const settings = batchSettingsRef.current!;
            const enableChaining = settings.workflowMode === 'transcribe-and-translate';
            const type = enableChaining ? 'translation' : 'transcription';
            const targetLang = enableChaining
              ? settings.targetLanguage
              : (file.selectedSourceLanguage || file.detectedLanguage?.ISO_639_1 || settings.targetLanguage);
            const outputFileName = generateOutputFileNameFn(
              file.name,
              type,
              targetLang,
              settings.outputFormat,
              settings.translationModel,
              settings.transcriptionModel,
              getTranslationLanguageNameSync,
              getTranscriptionLanguageNameSync,
              config.defaultFilenameFormat,
            );

            setQueue(prev => prev.map(f =>
              f.id === file.id ? { ...f, status: 'completed' as const, progress: 100, outputContent, outputFileName } : f,
            ));
            successCount++;
          }
        } catch (error: any) {
          const { logger } = await import('../../../utils/errorLogger');
          logger.error('BatchScreen', `Failed to process file: ${file.name}`, error);
          setQueue(prev => prev.map(f =>
            f.id === file.id ? { ...f, status: 'error' as const, error: error.message || 'Processing failed' } : f,
          ));
          if (batchSettingsRef.current?.abortOnError) throw error;
        }

        const progress = Math.round(((i + 1) / totalFiles) * 100);
        setOverallProgress(progress);
        setAppProcessing(true, `Batch processing: ${i + 1}/${totalFiles} files completed (${progress}%)`);
      }
    } catch (error) {
      const { logger } = await import('../../../utils/errorLogger');
      logger.error('BatchScreen', 'Batch processing failed', error);
    } finally {
      setBatchStats(prev => ({ ...prev, endTime: new Date(), successfulFiles: successCount }));
      setAppProcessing(true, 'Batch processing completed!');
      setShowCompletionSummary(true);
      setIsProcessing(false);
      setCurrentFileIndex(-1);
      processingRef.current = false;
      setTimeout(() => setAppProcessing(false), 3000);
    }
  }, [setAppProcessing, processFile, config.defaultFilenameFormat]);

  const stopBatchProcessing = useCallback(() => {
    shouldStopRef.current = true;
    setIsProcessing(false);
    setCurrentFileIndex(-1);
    processingRef.current = false;
  }, []);

  return {
    isProcessing,
    currentFileIndex,
    overallProgress,
    showCompletionSummary,
    showLanguageValidationModal,
    batchStats,
    setShowCompletionSummary,
    setShowLanguageValidationModal,
    updateBatchSettingsRef,
    startBatchProcessing,
    stopBatchProcessing,
  };
};
