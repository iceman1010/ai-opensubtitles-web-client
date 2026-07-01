import { useState, useCallback, useRef, MutableRefObject } from 'react';
import { BatchFile, BatchCreditStats, BatchScreenConfig } from '../types';
import { isSupportedFile, isSubtitleFile } from '../../../utils/fileTypeUtils';

interface UseQueueManagerOptions {
  config: BatchScreenConfig;
  setAppProcessing: (processing: boolean, task?: string) => void;
  isProcessingRef: MutableRefObject<boolean>;
  onSubtitleFileAdded?: (queue: BatchFile[]) => void;
}

export const useQueueManager = ({
  config,
  setAppProcessing,
  isProcessingRef,
  onSubtitleFileAdded,
}: UseQueueManagerOptions) => {
  const [queue, setQueue] = useState<BatchFile[]>([]);
  const queueRef = useRef<BatchFile[]>([]);
  const detectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [batchCreditStats, setBatchCreditStats] = useState<BatchCreditStats>({
    totalCreditsUsed: 0,
    creditsPerFile: new Map(),
  });

  const updateFileCredits = useCallback((fileId: string, creditsUsed: number) => {
    setQueue(prev => prev.map(f => f.id === fileId ? { ...f, creditsUsed } : f));
    setBatchCreditStats(prev => {
      const newCreditsPerFile = new Map(prev.creditsPerFile);
      newCreditsPerFile.set(fileId, creditsUsed);
      const totalCreditsUsed = Array.from(newCreditsPerFile.values()).reduce((sum, c) => sum + c, 0);
      return { totalCreditsUsed, creditsPerFile: newCreditsPerFile };
    });
  }, []);

  const resetCreditTracking = useCallback(() => {
    setBatchCreditStats({ totalCreditsUsed: 0, creditsPerFile: new Map() });
    setQueue(prev => prev.map(f => ({ ...f, creditsUsed: undefined })));
  }, []);

  const analyzeFileForCost = useCallback(async (file: File, fileId: string, fileType: 'transcription' | 'translation') => {
    try {
      if (fileType === 'transcription') {
        const { ffmpegService } = await import('../../../services/ffmpegService');
        const mediaInfo = await ffmpegService.getMediaInfo(file);
        if (mediaInfo.duration) {
          setQueue(prev => prev.map(f => f.id === fileId ? { ...f, duration: mediaInfo.duration } : f));
        }
      } else {
        const { readTextFile } = await import('../../../hooks/useFileHandler');
        const { parseSubtitleFile } = await import('../../../utils/subtitleParser');
        const textContent = await readTextFile(file);
        const subtitleInfo = parseSubtitleFile(textContent, file.name);
        if (subtitleInfo.characterCount > 0) {
          setQueue(prev => prev.map(f => f.id === fileId ? { ...f, characterCount: subtitleInfo.characterCount } : f));
        }
      }
    } catch (error) {
      const { logger } = await import('../../../utils/errorLogger');
      logger.warn('BatchScreen', `Could not analyze ${file.name} for cost estimation`, error);
    }
  }, []);

  const addFileToQueue = useCallback((file: File) => {
    if (!isSupportedFile(file.name) || isProcessingRef.current) return;

    setQueue(prev => {
      const isDuplicate = prev.some(f =>
        f.file.name === file.name && f.file.size === file.size && f.file.lastModified === file.lastModified,
      );
      if (isDuplicate) {
        setAppProcessing(true, 'Duplicate file skipped');
        setTimeout(() => setAppProcessing(false), 2000);
        return prev;
      }

      const fileType = isSubtitleFile(file.name) ? 'translation' : 'transcription';
      const fileId = `${Date.now()}-${Math.random()}`;
      const newFile: BatchFile = {
        id: fileId,
        file,
        name: file.name,
        type: fileType,
        status: 'pending',
      };

      const updatedQueue = [...prev, newFile];

      if (isSubtitleFile(file.name)) {
        if (detectionTimeoutRef.current) clearTimeout(detectionTimeoutRef.current);
        detectionTimeoutRef.current = setTimeout(() => {
          onSubtitleFileAdded?.(updatedQueue);
        }, 200);
      }

      return updatedQueue;
    });

    setQueue(prev => {
      const existing = prev.find(f => f.file === file);
      if (!existing) return prev;
      analyzeFileForCost(file, existing.id, isSubtitleFile(file.name) ? 'translation' : 'transcription');
      return prev;
    });
  }, [setAppProcessing, onSubtitleFileAdded, analyzeFileForCost]);

  const handleSingleFileSelect = useCallback((file: File) => addFileToQueue(file), [addFileToQueue]);

  const handleMultipleFileSelect = useCallback((files: File[]) => {
    for (const file of files) addFileToQueue(file);
  }, [addFileToQueue]);

  const removeFromQueue = useCallback((fileId: string) => {
    setQueue(prev => prev.filter(file => file.id !== fileId));
  }, []);

  const clearQueue = useCallback(() => {
    if (!isProcessingRef.current) setQueue([]);
  }, [isProcessingRef]);

  const moveFileUp = useCallback((index: number) => {
    if (index > 0 && !isProcessingRef.current) {
      setQueue(prev => {
        const newQueue = [...prev];
        [newQueue[index - 1], newQueue[index]] = [newQueue[index], newQueue[index - 1]];
        return newQueue;
      });
    }
  }, [isProcessingRef]);

  const moveFileDown = useCallback((index: number) => {
    if (index < queue.length - 1 && !isProcessingRef.current) {
      setQueue(prev => {
        const newQueue = [...prev];
        [newQueue[index], newQueue[index + 1]] = [newQueue[index + 1], newQueue[index]];
        return newQueue;
      });
    }
  }, [queue.length, isProcessingRef]);

  const setDetectedLanguageForFile = useCallback((
    fileId: string,
    detectedLanguage: BatchFile['detectedLanguage'],
    transcriptionModel: string,
    translationModel: string,
    contextTranscriptionInfo: any,
    contextTranslationInfo: any,
    autoSelectSourceLanguage: (code: string | null, langs: any[]) => string | undefined,
    getLanguagesForModel: (langs: any, id: string) => any[],
  ) => {
    setQueue(prev => prev.map(file => {
      if (file.id !== fileId) return file;
      let selectedSourceLanguage = file.selectedSourceLanguage;
      const translationModelToUse = translationModel ||
        (contextTranslationInfo?.apis?.length ? contextTranslationInfo.apis[0] : '');
      const transcriptionModelToUse = transcriptionModel ||
        (contextTranscriptionInfo?.apis?.length ? contextTranscriptionInfo.apis[0] : '');

      if (file.type === 'translation' && contextTranslationInfo && translationModelToUse) {
        const apiLanguages = contextTranslationInfo.languages?.[translationModelToUse];
        if (apiLanguages) {
          selectedSourceLanguage = autoSelectSourceLanguage(detectedLanguage?.ISO_639_1 || null, apiLanguages);
        }
      } else if (file.type === 'transcription' && contextTranscriptionInfo && transcriptionModelToUse) {
        const apiLanguages = getLanguagesForModel(contextTranscriptionInfo.languages, transcriptionModelToUse);
        if (apiLanguages.length > 0) {
          selectedSourceLanguage = autoSelectSourceLanguage(detectedLanguage?.ISO_639_1 || null, apiLanguages);
        }
      }
      return { ...file, status: 'pending' as const, detectedLanguage, selectedSourceLanguage };
    }));
  }, []);

  const handleSourceLanguageChange = useCallback((fileId: string, selectedLanguage: string) => {
    setQueue(prev => prev.map(file =>
      file.id === fileId ? { ...file, selectedSourceLanguage: selectedLanguage } : file,
    ));
  }, []);

  return {
    queue,
    setQueue,
    queueRef,
    detectionTimeoutRef,
    addFileToQueue,
    handleSingleFileSelect,
    handleMultipleFileSelect,
    removeFromQueue,
    clearQueue,
    moveFileUp,
    moveFileDown,
    batchCreditStats,
    updateFileCredits,
    resetCreditTracking,
    setDetectedLanguageForFile,
    handleSourceLanguageChange,
    analyzeFileForCost,
  };
};
