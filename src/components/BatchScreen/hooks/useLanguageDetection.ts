import { useState, useCallback, useRef, MutableRefObject } from 'react';
import { BatchFile, BatchScreenConfig } from '../types';
import { isAudioVideoFile } from '../../../utils/fileTypeUtils';

interface UseLanguageDetectionOptions {
  isAuthenticated: boolean;
  setQueue: React.Dispatch<React.SetStateAction<BatchFile[]>>;
  config: BatchScreenConfig;
  setAppProcessing: (processing: boolean, task?: string) => void;
  isProcessingRef: MutableRefObject<boolean>;
  queue: BatchFile[];
  detectLanguage: (file: File | Blob, duration?: number) => Promise<any>;
  checkLanguageDetectionStatus: (correlationId: string) => Promise<any>;
}

export const useLanguageDetection = ({
  isAuthenticated,
  setQueue,
  config,
  setAppProcessing,
  isProcessingRef,
  queue,
  detectLanguage,
  checkLanguageDetectionStatus,
}: UseLanguageDetectionOptions) => {
  const [isDetectingLanguages, setIsDetectingLanguages] = useState(false);
  const detectionInProgressRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<BatchFile[]>(queue);
  queueRef.current = queue;

  const pollLanguageDetection = useCallback(async (
    correlationId: string,
    fileId: string,
  ): Promise<any | null> => {
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
              f.id === fileId ? { ...f, status: 'pending' as const, error: result.errors?.join(', ') || 'Language detection failed' } : f,
            ));
            resolve(null);
          } else if (elapsedMs >= timeoutMs) {
            setQueue(prev => prev.map(f =>
              f.id === fileId ? { ...f, status: 'pending' as const, error: 'Language detection timed out' } : f,
            ));
            resolve(null);
          } else {
            setTimeout(poll, pollingInterval);
          }
        } catch (error) {
          setQueue(prev => prev.map(f =>
            f.id === fileId ? { ...f, status: 'pending' as const, error: `Language detection error: ${error instanceof Error ? error.message : 'Unknown'}` } : f,
          ));
          resolve(null);
        }
      };
      poll();
    });
  }, [isAuthenticated, setQueue, setAppProcessing, checkLanguageDetectionStatus, config.pollingIntervalSeconds, config.pollingTimeoutSeconds]);

  const processLanguageDetectionQueue = useCallback(async (
    currentQueue?: BatchFile[],
    setDetectedLanguageForFile?: (
      fileId: string,
      detectedLanguage: any,
      transcriptionModel: string,
      translationModel: string,
      contextTranscriptionInfo: any,
      contextTranslationInfo: any,
      autoSelectSourceLanguage: (code: string | null, langs: any[]) => string | undefined,
      getLanguagesForModel: (langs: any, id: string) => any[],
    ) => void,
    transcriptionModel?: string,
    translationModel?: string,
    contextTranscriptionInfo?: any,
    contextTranslationInfo?: any,
    autoSelectSourceLanguage?: (code: string | null, langs: any[]) => string | undefined,
    getLanguagesForModel?: (langs: any, id: string) => any[],
  ) => {
    if (isDetectingLanguages || isProcessingRef.current || !isAuthenticated) return;
    setIsDetectingLanguages(true);

    try {
      const queueToProcess = currentQueue || queueRef.current;
      const filesToDetect = queueToProcess.filter(file =>
        file.status === 'pending' && !file.detectedLanguage,
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
          f.status === 'pending' && !f.detectedLanguage && !detectionInProgressRef.current.has(f.id),
        );
        if (!file) break;

        detectionInProgressRef.current.add(file.id);
        if (!isAuthenticated) break;

        setAppProcessing(true, `Detecting language for ${file.name}...`);
        setQueue(prev => prev.map(f =>
          f.id === file.id ? { ...f, status: 'detecting' as const } : f,
        ));

        try {
          const fileStillInQueue = queueRef.current.find(f => f.id === file.id);
          if (!fileStillInQueue) continue;

          let fileToProcess: File | Blob = file.file;

          if (isAudioVideoFile(file.name)) {
            setAppProcessing(true, `Extracting audio from ${file.name} for language detection...`);
            const durationSeconds = config.audio_language_detection_time ?? 240;
            const { ffmpegService } = await import('../../../services/ffmpegService');
            fileToProcess = await ffmpegService.extractAudioFromVideo(file.file, undefined, durationSeconds);
            setAppProcessing(true, `Audio extracted, detecting language for ${file.name}...`);
          }

          const durationSeconds = config.audio_language_detection_time ?? 240;
          const result = await detectLanguage(fileToProcess, durationSeconds);

          if (result.data?.language) {
            setDetectedLanguageForFile?.(
              file.id,
              result.data.language,
              transcriptionModel || '',
              translationModel || '',
              contextTranscriptionInfo,
              contextTranslationInfo,
              autoSelectSourceLanguage!,
              getLanguagesForModel!,
            );
          } else if (result.correlation_id) {
            setAppProcessing(true, `Processing audio for ${file.name}, please wait...`);
            const detected = await pollLanguageDetection(result.correlation_id, file.id);
            if (detected) {
              setDetectedLanguageForFile?.(
                file.id,
                detected,
                transcriptionModel || '',
                translationModel || '',
                contextTranscriptionInfo,
                contextTranslationInfo,
                autoSelectSourceLanguage!,
                getLanguagesForModel!,
              );
            }
          } else if (result.status === 'ERROR') {
            setQueue(prev => prev.map(f =>
              f.id === file.id ? { ...f, status: 'pending' as const, error: result.errors?.[0] || 'Language detection failed' } : f,
            ));
          } else {
            setQueue(prev => prev.map(f =>
              f.id === file.id ? { ...f, status: 'pending' as const, error: 'Unexpected detection result' } : f,
            ));
          }
        } catch (error: any) {
          setQueue(prev => prev.map(f =>
            f.id === file.id ? { ...f, status: 'pending' as const, error: `Language detection error: ${error.message}` } : f,
          ));
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      setAppProcessing(true, 'Language detection completed for all files');
      setTimeout(() => setAppProcessing(false), 1500);
      detectionInProgressRef.current.clear();
    } catch (error) {
      const { logger } = await import('../../../utils/errorLogger');
      logger.error('BatchScreen', 'Error in language detection queue', error);
      setAppProcessing(true, 'Language detection failed');
      setTimeout(() => setAppProcessing(false), 3000);
    } finally {
      setIsDetectingLanguages(false);
    }
  }, [
    isDetectingLanguages,
    isProcessingRef,
    isAuthenticated,
    setQueue,
    setAppProcessing,
    config,
    detectLanguage,
    pollLanguageDetection,
  ]);

  return {
    isDetectingLanguages,
    detectionInProgressRef,
    processLanguageDetectionQueue,
  };
};
