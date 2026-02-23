import React, { useState, useEffect, useRef, useCallback } from 'react';
import FileSelector from './FileSelector';
import { getProcessingType } from '../config/fileFormats';
import { LanguageInfo, TranscriptionInfo, TranslationInfo, DetectedLanguage, LanguageDetectionResult, APIResponse } from '../services/api';
import { logger } from '../utils/errorLogger';
import { parseSubtitleFile, formatDuration, formatCharacterCount, ParsedSubtitle } from '../utils/subtitleParser';
import ImprovedTranscriptionOptions from './ImprovedTranscriptionOptions';
import ImprovedTranslationOptions from './ImprovedTranslationOptions';
import { useAPI } from '../contexts/APIContext';
import { generateFilename } from '../utils/filenameGenerator';
import { ffmpegService, MediaInfo } from '../services/ffmpegService';
import { readTextFile, saveTextFile, formatFileSize } from '../hooks/useFileHandler';
import appConfig from '../config/appConfig.json';
import * as fileFormatsConfig from '../config/fileFormats.json';

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

const isAudioVideoFile = (fileName: string): boolean => {
  return isVideoFile(fileName) || isAudioFile(fileName);
};

interface MainScreenProps {
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
  onNavigateToCredits?: () => void;
  onCreditsUpdate?: (credits: { used: number; remaining: number }) => void;
  onProcessingStateChange?: (isProcessing: boolean) => void;
}

function MainScreen({ config, setAppProcessing, onNavigateToCredits, onCreditsUpdate, onProcessingStateChange }: MainScreenProps) {
  const {
    isAuthenticated,
    credits,
    transcriptionInfo: contextTranscriptionInfo,
    translationInfo,
    refreshCredits,
    updateCredits,
    getTranslationLanguagesForApi,
    getTranscriptionLanguagesForApi,
    getTranslationLanguageNameSync,
    getTranscriptionLanguageNameSync,
    getTranslationApisForLanguage,
    detectLanguage,
    checkLanguageDetectionStatus,
    initiateTranscription,
    initiateTranslation,
    checkTranscriptionStatus,
    checkTranslationStatus,
    downloadFile
  } = useAPI();

  // File is a browser File object, not a path string
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'transcription' | 'translation' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [translationOptions, setTranslationOptions] = useState({
    sourceLanguage: 'auto',
    destinationLanguage: '',
    model: '',
    format: fileFormatsConfig.subtitle[0] || 'srt'
  });
  const [transcriptionOptions, setTranscriptionOptions] = useState({
    language: '',
    model: '',
    format: fileFormatsConfig.subtitle[0] || 'srt'
  });
  const [availableTranslationLanguages, setAvailableTranslationLanguages] = useState<LanguageInfo[]>([]);
  const [availableTranslationApis, setAvailableTranslationApis] = useState<string[]>([]);
  const [availableTranscriptionLanguages, setAvailableTranscriptionLanguages] = useState<LanguageInfo[]>([]);
  const [isLoadingDynamicOptions, setIsLoadingDynamicOptions] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<DetectedLanguage | null>(null);
  const [isDetectingLanguage, setIsDetectingLanguage] = useState(false);
  const [languageDetectionCorrelationId, setLanguageDetectionCorrelationId] = useState<string | null>(null);
  const [showLanguageDetectionResult, setShowLanguageDetectionResult] = useState(false);
  const [compatibleModels, setCompatibleModels] = useState<{
    translation: string[];
    transcription: string[];
  }>({ translation: [], transcription: [] });
  const [creditsAnimating, setCreditsAnimating] = useState(false);
  const [fileInfo, setFileInfo] = useState<{
    duration?: number;
    hasAudio?: boolean;
    hasVideo?: boolean;
    format?: string;
    subtitleInfo?: ParsedSubtitle;
  } | null>(null);
  const [isLoadingFileInfo, setIsLoadingFileInfo] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [ffmpegProgress, setFfmpegProgress] = useState<number | null>(null);
  const languageDetectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLanguageDetectionTimeout = () => {
    if (languageDetectionTimeoutRef.current) {
      clearTimeout(languageDetectionTimeoutRef.current);
      languageDetectionTimeoutRef.current = null;
    }
  };

  const clearPollingTimeout = () => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  };

  const handleStopProcess = () => {
    logger.info('MainScreen', 'User requested to stop process');
    clearPollingTimeout();
    setIsProcessing(false);
    setAppProcessing(false);
    setStatusMessage({ type: 'info', message: 'Process cancelled by user' });
  };

  useEffect(() => {
    onProcessingStateChange?.(isProcessing);
  }, [isProcessing, onProcessingStateChange]);

  // Initialize transcription options from context
  useEffect(() => {
    if (contextTranscriptionInfo) {
      if (contextTranscriptionInfo.apis.length > 0) {
        const defaultModel = contextTranscriptionInfo.apis[0];
        setTranscriptionOptions(prev => ({ ...prev, model: defaultModel }));
        loadTranscriptionLanguages(defaultModel);
      }
    }
  }, [contextTranscriptionInfo]);

  useEffect(() => {
    if (translationInfo) {
      setAvailableTranslationApis(translationInfo.apis);
      if (translationInfo.apis.length > 0) {
        const defaultModel = translationInfo.apis[0];
        setTranslationOptions(prev => ({ ...prev, model: defaultModel }));
        loadLanguagesForTranslationModel(defaultModel, translationInfo);
      }
    }
  }, [translationInfo]);

  const loadTranscriptionLanguages = async (model: string) => {
    if (!contextTranscriptionInfo) return;
    try {
      let languages: LanguageInfo[] = [];
      if (Array.isArray(contextTranscriptionInfo.languages)) {
        languages = contextTranscriptionInfo.languages;
      } else if (typeof contextTranscriptionInfo.languages === 'object' && contextTranscriptionInfo.languages[model]) {
        languages = contextTranscriptionInfo.languages[model];
      }
      setAvailableTranscriptionLanguages(languages);
      if (languages.length > 0) {
        const defaultLang = languages.find(lang => lang.language_code === 'en') || languages[0];
        setTranscriptionOptions(prev => ({ ...prev, language: defaultLang.language_code }));
      }
    } catch (error) {
      logger.error('MainScreen', 'Failed to load transcription languages:', error);
    }
  };

  // ── Detect language ──
  const detectLanguageForFile = async () => {
    if (!selectedFile || isDetectingLanguage) return;

    setIsDetectingLanguage(true);
    setDetectedLanguage(null);
    setShowLanguageDetectionResult(false);
    setCompatibleModels({ translation: [], transcription: [] });

    languageDetectionTimeoutRef.current = setTimeout(() => {
      setStatusMessage({ type: 'error', message: 'Language detection timed out. Please try again.' });
      setIsDetectingLanguage(false);
      setAppProcessing(false);
      setLanguageDetectionCorrelationId(null);
      clearLanguageDetectionTimeout();
    }, 60000);

    try {
      let fileToProcess: File | Blob = selectedFile;
      const fileName = selectedFile.name;
      const isAV = isAudioVideoFile(fileName);

      if (isAV) {
        setStatusMessage({ type: 'info', message: 'Extracting audio for language detection...' });
        setAppProcessing(true, 'Extracting audio for language detection...');

        const durationSeconds = config.audio_language_detection_time ?? 240;
        fileToProcess = await ffmpegService.extractAudioFromVideo(
          selectedFile,
          (p) => setFfmpegProgress(p),
          durationSeconds
        );
        setFfmpegProgress(null);
        setStatusMessage({ type: 'info', message: 'Audio extracted, detecting language...' });
        setAppProcessing(true, 'Detecting language...');
      } else {
        setAppProcessing(true, 'Detecting language...');
      }

      const durationSeconds = config.audio_language_detection_time ?? 240;
      const result = await detectLanguage(fileToProcess, durationSeconds);

      if (result.data?.language) {
        await handleDetectedLanguage(result.data.language);
      } else if (result.correlation_id) {
        setLanguageDetectionCorrelationId(result.correlation_id);
        setStatusMessage({ type: 'info', message: 'Processing audio file for language detection...' });
        setAppProcessing(true, 'Processing audio for language detection...');
        pollLanguageDetection(result.correlation_id);
      } else if (result.status === 'ERROR') {
        throw new Error(result.errors?.join(', ') || 'Language detection failed');
      } else {
        throw new Error('Unexpected response from language detection');
      }
    } catch (error) {
      logger.error('MainScreen', 'Language detection failed', error);
      setStatusMessage({
        type: 'error',
        message: `Language detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      setIsDetectingLanguage(false);
      setAppProcessing(false);
    } finally {
      clearLanguageDetectionTimeout();
    }
  };

  const pollLanguageDetection = async (correlationId: string) => {
    const startTime = Date.now();
    const pollingInterval = (config.pollingIntervalSeconds || 10) * 1000;
    const timeoutMs = (config.pollingTimeoutSeconds || 7200) * 1000;

    const poll = async () => {
      try {
        const elapsedMs = Date.now() - startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        setStatusMessage({ type: 'info', message: `Processing audio for language detection... (${elapsedSeconds}s elapsed)` });
        setAppProcessing(true, `Processing audio for language detection... (${elapsedSeconds}s elapsed)`);

        const result = await checkLanguageDetectionStatus(correlationId);

        if (result.status === 'COMPLETED' && result.data?.language) {
          await handleDetectedLanguage(result.data.language);
          setLanguageDetectionCorrelationId(null);
        } else if (result.status === 'ERROR') {
          throw new Error(result.errors?.join(', ') || 'Language detection failed');
        } else if (result.status === 'TIMEOUT') {
          throw new Error('Language detection timed out');
        } else if (elapsedMs >= timeoutMs) {
          throw new Error(`Language detection timed out after ${Math.floor(timeoutMs / 60000)} minutes`);
        } else {
          setTimeout(poll, pollingInterval);
        }
      } catch (error) {
        logger.error('MainScreen', 'Language detection polling failed', error);
        setStatusMessage({
          type: 'error',
          message: `Language detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        setIsDetectingLanguage(false);
        setLanguageDetectionCorrelationId(null);
        setAppProcessing(false);
        clearLanguageDetectionTimeout();
      }
    };

    poll();
  };

  const handleDetectedLanguage = async (language: DetectedLanguage) => {
    setDetectedLanguage(language);
    setShowLanguageDetectionResult(true);
    setIsDetectingLanguage(false);
    clearLanguageDetectionTimeout();

    setStatusMessage({ type: 'success', message: `Language detected: ${language.name} (${language.native})` });
    setAppProcessing(true, 'Finding compatible AI models...');

    await findCompatibleModels(language.ISO_639_1);
    setAppProcessing(false);

    if (fileType === 'translation' && translationOptions.sourceLanguage === 'auto') {
      setTranslationOptions(prev => ({ ...prev, sourceLanguage: language.ISO_639_1 }));
    } else if (fileType === 'transcription' && !transcriptionOptions.language) {
      setTranscriptionOptions(prev => ({ ...prev, language: language.ISO_639_1 }));
    }
  };

  const findCompatibleModels = async (languageCode: string) => {
    const compatible: { translation: string[]; transcription: string[] } = { translation: [], transcription: [] };

    const fileName = selectedFile?.name || '';
    const isSub = isSubtitleFile(fileName);
    const isAV = isAudioVideoFile(fileName);

    if (isSub && translationInfo?.apis) {
      for (const apiName of translationInfo.apis) {
        try {
          const result = await getTranslationLanguagesForApi(apiName);
          if (result.success && result.data) {
            const apiLanguages = result.data;
            if (Array.isArray(apiLanguages)) {
              const hasLanguage = apiLanguages.some(lang => {
                const apiLangCode = lang.language_code.toLowerCase();
                const detectedCode = languageCode.toLowerCase();
                if (apiLangCode === detectedCode) return true;
                if (apiLangCode.startsWith(detectedCode + '-') || apiLangCode.startsWith(detectedCode + '_')) return true;
                const baseApiCode = apiLangCode.split(/[-_]/)[0];
                return baseApiCode === detectedCode;
              });
              if (hasLanguage) compatible.translation.push(apiName);
            }
          }
        } catch {
          // skip
        }
      }
    }

    if (isAV && contextTranscriptionInfo?.apis) {
      for (const apiName of contextTranscriptionInfo.apis) {
        try {
          const result = await getTranscriptionLanguagesForApi(apiName);
          if (result.success && result.data) {
            const apiLanguages = result.data;
            if (Array.isArray(apiLanguages)) {
              const hasMatch = apiLanguages.some(lang => {
                const apiLangCode = lang.language_code.toLowerCase();
                const detectedCode = languageCode.toLowerCase();
                if (apiLangCode === detectedCode) return true;
                if (apiLangCode.startsWith(detectedCode + '-') || apiLangCode.startsWith(detectedCode + '_')) return true;
                return apiLangCode.split(/[-_]/)[0] === detectedCode;
              });
              if (hasMatch) compatible.transcription.push(apiName);
            }
          }
        } catch {
          // skip
        }
      }
    }

    setCompatibleModels(compatible);
  };

  const triggerCreditsAnimation = () => {
    setCreditsAnimating(true);
    setTimeout(() => setCreditsAnimating(false), 1000);
  };

  const loadLanguagesForTranslationModel = async (modelId: string, translationData?: TranslationInfo) => {
    setIsLoadingDynamicOptions(true);
    try {
      const dataToUse = translationData || translationInfo;
      if (dataToUse?.languages?.[modelId]) {
        setAvailableTranslationLanguages(dataToUse.languages[modelId]);
        setIsLoadingDynamicOptions(false);
        return;
      }

      const result = await getTranslationLanguagesForApi(modelId);
      if (result.success && result.data) {
        const languagesArray = Array.isArray(result.data) ? result.data : [];
        if (languagesArray.length > 0) {
          setAvailableTranslationLanguages(languagesArray);
        }
      }
    } catch (error) {
      logger.error('MainScreen', 'Exception loading languages for model', error);
    } finally {
      setIsLoadingDynamicOptions(false);
    }
  };

  const loadModelsForTranslationLanguage = async (sourceLanguage: string, targetLanguage: string) => {
    setIsLoadingDynamicOptions(true);
    try {
      const result = await getTranslationApisForLanguage(sourceLanguage, targetLanguage);
      if (result.success && result.data) {
        setAvailableTranslationApis(result.data);
        if (!result.data.includes(translationOptions.model) && result.data.length > 0) {
          setTranslationOptions(prev => ({ ...prev, model: result.data![0] }));
        }
      }
    } catch (error) {
      logger.error('MainScreen', 'Failed to load models for language pair:', error);
    } finally {
      setIsLoadingDynamicOptions(false);
    }
  };

  const handleTranslationModelChange = (newModel: string) => {
    setTranslationOptions(prev => ({ ...prev, model: newModel }));
    loadLanguagesForTranslationModel(newModel);
  };

  const handleTranslationLanguageChange = (field: 'sourceLanguage' | 'destinationLanguage', newLanguage: string) => {
    const updatedOptions = { ...translationOptions, [field]: newLanguage };
    setTranslationOptions(updatedOptions);
    if (updatedOptions.sourceLanguage && updatedOptions.destinationLanguage) {
      loadModelsForTranslationLanguage(updatedOptions.sourceLanguage, updatedOptions.destinationLanguage);
    }
  };

  // ── Analyze selected file using browser APIs ──
  const analyzeSelectedFile = async (file: File) => {
    setIsLoadingFileInfo(true);
    setFileInfo(null);

    try {
      const processingType = getProcessingType(file.name);

      if (processingType === 'transcription') {
        try {
          const sizeCheck = ffmpegService.checkFileSize(file);
          if (!sizeCheck.ok) {
            setStatusMessage({ type: 'error', message: sizeCheck.error! });
            setFileType(null);
            return;
          }
          if (sizeCheck.warning) {
            setStatusMessage({ type: 'info', message: sizeCheck.warning });
          }

          const mediaInfo = await ffmpegService.getMediaInfo(file);
          if (!mediaInfo.hasAudio && !mediaInfo.hasVideo) {
            throw new Error('File does not contain audio or video streams');
          }
          setFileInfo({
            duration: mediaInfo.duration,
            hasAudio: mediaInfo.hasAudio,
            hasVideo: mediaInfo.hasVideo,
            format: mediaInfo.format
          });
        } catch (mediaError: any) {
          logger.error('MainScreen', `Invalid media file: ${file.name}`, mediaError);
          setStatusMessage({ type: 'error', message: `Invalid media file: ${mediaError.message || 'Unknown error'}` });
          setFileType(null);
          return;
        }
      } else if (processingType === 'translation') {
        try {
          const textContent = await readTextFile(file);
          const subtitleInfo = parseSubtitleFile(textContent, file.name);
          if (subtitleInfo.characterCount === 0) {
            throw new Error('Subtitle file appears to be empty or contains no readable text');
          }
          setFileInfo({ subtitleInfo });
        } catch (subtitleError: any) {
          logger.error('MainScreen', 'Invalid subtitle file:', subtitleError);
          setStatusMessage({ type: 'error', message: `Invalid subtitle file: ${subtitleError.message || 'Unknown error'}` });
          setFileType(null);
          return;
        }
      }
    } catch (error: any) {
      logger.error('MainScreen', 'Failed to analyze file:', error);
      setStatusMessage({ type: 'error', message: error.message || 'Failed to analyze file.' });
      setFileType(null);
    } finally {
      setIsLoadingFileInfo(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    const processingType = getProcessingType(file.name);
    setFileType(processingType === 'unknown' ? null : processingType);
    setStatusMessage(null);

    setDetectedLanguage(null);
    setShowLanguageDetectionResult(false);
    setCompatibleModels({ translation: [], transcription: [] });
    setIsDetectingLanguage(false);
    clearLanguageDetectionTimeout();

    if (isDetectingLanguage) {
      setAppProcessing(false);
    }

    if (processingType !== 'unknown') {
      analyzeSelectedFile(file);
    }
  };

  // ── Process file (transcription or translation) ──
  const handleProcess = async () => {
    if (!selectedFile || !fileType) return;

    if (credits && credits.remaining === 0) {
      setShowCreditModal(true);
      return;
    }

    setIsProcessing(true);
    setAppProcessing(true, fileType === 'transcription' ? 'Transcribing...' : 'Translating...');
    setStatusMessage({ type: 'info', message: 'Processing file...' });

    let isPollingMode = false;

    try {
      let fileToProcess: File | Blob = selectedFile;

      if (fileType === 'transcription') {
        // Check if video → extract audio; or non-mp3 audio → convert
        if (isVideoFile(selectedFile.name)) {
          setStatusMessage({ type: 'info', message: 'Extracting audio from video...' });
          setAppProcessing(true, 'Extracting audio from video...');
          fileToProcess = await ffmpegService.extractAudioFromVideo(
            selectedFile,
            (p) => setFfmpegProgress(p)
          );
          setFfmpegProgress(null);
          setStatusMessage({ type: 'info', message: 'Audio extraction completed. Starting transcription...' });
        } else if (isAudioFile(selectedFile.name)) {
          const ext = selectedFile.name.toLowerCase().split('.').pop();
          const directFormats = ['mp3', 'wav', 'flac', 'm4a'];
          if (ext && !directFormats.includes(ext)) {
            setStatusMessage({ type: 'info', message: 'Converting audio format...' });
            setAppProcessing(true, 'Converting audio...');
            fileToProcess = await ffmpegService.convertAudioToMp3(
              selectedFile,
              (p) => setFfmpegProgress(p)
            );
            setFfmpegProgress(null);
            setStatusMessage({ type: 'info', message: 'Audio conversion completed. Starting transcription...' });
          }
        }
      }

      let result;

      if (fileType === 'transcription') {
        if (!transcriptionOptions.language || !transcriptionOptions.model) {
          throw new Error('Please select both language and model for transcription');
        }
        result = await initiateTranscription(fileToProcess, {
          language: transcriptionOptions.language,
          api: transcriptionOptions.model,
          returnContent: true
        });
      } else {
        setStatusMessage({ type: 'info', message: 'Starting translation...' });
        if (!translationOptions.sourceLanguage || !translationOptions.destinationLanguage || !translationOptions.model) {
          throw new Error('Please select source language, destination language, and model for translation');
        }
        result = await initiateTranslation(fileToProcess, {
          translateFrom: translationOptions.sourceLanguage,
          translateTo: translationOptions.destinationLanguage,
          api: translationOptions.model,
          returnContent: true
        });
      }

      if (result.status === 'ERROR') {
        const errorMessages = result.errors?.map((e: any) =>
          typeof e === 'string' ? e : e.message || e.toString()
        ).join(', ') || `${fileType} failed`;
        throw new Error(errorMessages);
      }

      if (result.status === 'COMPLETED' && result.data) {
        handleCompletedResult(result);
      } else if (result.correlation_id) {
        setStatusMessage({ type: 'info', message: 'Task created, waiting for completion...' });
        isPollingMode = true;
        await pollForCompletion(result.correlation_id, fileType);
        return;
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (error: any) {
      logger.error('MainScreen', `${fileType} error:`, error);
      setStatusMessage({
        type: 'error',
        message: `${fileType === 'transcription' ? 'Transcription' : 'Translation'} failed: ${error.message || 'Processing failed'}`
      });
    } finally {
      if (!isPollingMode) {
        setIsProcessing(false);
        setAppProcessing(false);
      }
    }
  };

  const handleCompletedResult = async (result: any) => {
    let message = `${fileType === 'transcription' ? 'Transcription' : 'Translation'} completed successfully!`;
    if (typeof result.data.total_price === 'number' && result.data.total_price > 0) {
      message += ` (${result.data.total_price} credits used)`;
    }
    setStatusMessage({ type: 'success', message });

    if (typeof result.data.credits_left === 'number') {
      const usedCredits = result.data.total_price || 0;
      onCreditsUpdate?.({ used: usedCredits, remaining: result.data.credits_left });
      triggerCreditsAnimation();
    }

    if (result.data.url) {
      const downloadResult = await downloadFile(result.data.url);
      if (downloadResult.success && downloadResult.content) {
        setPreviewContent(downloadResult.content);
        setShowPreview(true);
      }
    }
  };

  const pollForCompletion = async (correlationId: string, type: 'transcription' | 'translation') => {
    const startTime = Date.now();
    const pollingInterval = (config.pollingIntervalSeconds || 10) * 1000;
    const timeoutMs = (config.pollingTimeoutSeconds || 7200) * 1000;

    const poll = async (): Promise<void> => {
      try {
        const elapsedMs = Date.now() - startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        setStatusMessage({
          type: 'info',
          message: `${type === 'transcription' ? 'Transcription' : 'Translation'} in progress... (${elapsedSeconds}s elapsed)`
        });

        const result = type === 'transcription'
          ? await checkTranscriptionStatus(correlationId)
          : await checkTranslationStatus(correlationId);

        if (result.status === 'COMPLETED' && result.data) {
          await handleCompletedResult(result);
          clearPollingTimeout();
          setIsProcessing(false);
          setAppProcessing(false);
          return;
        } else if (result.status === 'ERROR') {
          throw new Error(result.errors?.join(', ') || `${type} failed`);
        } else if (result.status === 'PENDING' || result.status === 'CREATED') {
          if (elapsedMs >= timeoutMs) {
            throw new Error(`${type} timed out after ${Math.floor(timeoutMs / 60000)} minutes`);
          }
          pollingTimeoutRef.current = setTimeout(poll, pollingInterval);
        }
      } catch (error: any) {
        clearPollingTimeout();
        setStatusMessage({
          type: 'error',
          message: `${type === 'transcription' ? 'Transcription' : 'Translation'} failed: ${error.message || 'Unknown error'}`
        });
        setIsProcessing(false);
        setAppProcessing(false);
      }
    };

    poll();
  };

  // ── Save result file via browser download ──
  const handleSaveFile = (content: string) => {
    if (!selectedFile || !fileType) return;

    let languageCode = '';
    let languageName = '';
    let format = '';

    if (fileType === 'translation') {
      languageCode = translationOptions.destinationLanguage;
      format = translationOptions.format;
      const syncName = getTranslationLanguageNameSync(translationOptions.model, languageCode);
      languageName = syncName || languageCode;
    } else {
      languageCode = transcriptionOptions.language;
      format = transcriptionOptions.format;
      const syncName = getTranscriptionLanguageNameSync(transcriptionOptions.model, languageCode);
      languageName = syncName || languageCode;
    }

    const filenamePattern = config.defaultFilenameFormat || '{filename}.{language_code}.{type}.{extension}';
    const newFileName = generateFilename(
      filenamePattern,
      selectedFile.name,
      languageCode,
      languageName,
      fileType,
      format
    );

    saveTextFile(content, newFileName);
    setStatusMessage({ type: 'success', message: `File downloaded: ${newFileName}` });
    setShowPreview(false);
  };

  return (
    <div className="main-screen" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: '20px',
      position: 'relative'
    }}>
      <h1>{appConfig.name}</h1>
      <p>Select a file to transcribe or translate:</p>

      <FileSelector
        onFileSelect={handleFileSelect}
        disabled={isProcessing || isDetectingLanguage}
      />

      {/* Welcome message when no file is selected */}
      {!selectedFile && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '2px dashed var(--border-color)',
          margin: '20px 0'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>
            <i className="fas fa-file-audio" style={{ color: 'var(--text-muted)' }}></i>
          </div>
          <div style={{ fontSize: '28px', color: 'var(--text-muted)', marginBottom: '15px', fontWeight: '500' }}>
            Ready to Process Your Media
          </div>
          <div style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '25px', lineHeight: '1.5' }}>
            Select an audio, video, or subtitle file to get started
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            <div style={{ marginBottom: '8px' }}><strong>Transcription:</strong> Convert audio/video to text</div>
            <div><strong>Translation:</strong> Translate existing subtitles</div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border-light)', paddingTop: '20px', marginTop: '20px' }}>
            Supported formats: MP4, MP3, WAV, SRT, VTT, and more
          </div>
        </div>
      )}

      {selectedFile && fileType && (
        <div className="file-info">
          <h3>Selected File:</h3>
          <p style={{ wordBreak: 'break-all', marginBottom: '8px' }}>
            {selectedFile.name} ({formatFileSize(selectedFile.size)})
          </p>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <strong>Type:</strong> {fileType === 'transcription' ? 'Audio/Video (Transcription)' : 'Subtitle (Translation)'}
            </div>

            {isLoadingFileInfo ? (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Analyzing file...</div>
            ) : fileInfo ? (
              <>
                {fileInfo.duration !== undefined && (
                  <div><strong>Duration:</strong> {formatDuration(fileInfo.duration)}</div>
                )}
                {fileInfo.format && (
                  <div><strong>Format:</strong> {fileInfo.format.toUpperCase()}</div>
                )}
                {fileInfo.hasAudio !== undefined && (
                  <div>
                    <strong>Audio:</strong> <i className={`fas ${fileInfo.hasAudio ? 'fa-check' : 'fa-times'}`} style={{ color: fileInfo.hasAudio ? 'var(--success-color)' : 'var(--danger-color)' }}></i>
                    {fileInfo.hasVideo !== undefined && (
                      <span style={{ marginLeft: '10px' }}>
                        <strong>Video:</strong> <i className={`fas ${fileInfo.hasVideo ? 'fa-check' : 'fa-times'}`} style={{ color: fileInfo.hasVideo ? 'var(--success-color)' : 'var(--danger-color)' }}></i>
                      </span>
                    )}
                  </div>
                )}
                {fileInfo.subtitleInfo && (
                  <>
                    <div><strong>Characters:</strong> {formatCharacterCount(fileInfo.subtitleInfo.characterCount)}</div>
                    <div><strong>Words:</strong> {formatCharacterCount(fileInfo.subtitleInfo.wordCount)}</div>
                    <div><strong>Subtitle Lines:</strong> {formatCharacterCount(fileInfo.subtitleInfo.lineCount)}</div>
                  </>
                )}
              </>
            ) : null}
          </div>

          {fileType === 'translation' && fileInfo?.subtitleInfo && (
            <div style={{ marginTop: '12px', padding: '8px 12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', fontSize: '14px' }}>
              <strong>Estimated Cost:</strong> ~{Math.ceil(fileInfo.subtitleInfo.characterCount / 500)} credits
              <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                (based on {fileInfo.subtitleInfo.characterCount} characters)
              </span>
            </div>
          )}

          {fileType === 'transcription' && fileInfo?.duration && (
            <div style={{ marginTop: '12px', padding: '8px 12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', fontSize: '14px' }}>
              <strong>Processing Time:</strong> ~{Math.ceil(fileInfo.duration / 60)} minutes of audio
              <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>(cost varies by selected AI model)</span>
            </div>
          )}
        </div>
      )}

      {/* Language Detection */}
      {selectedFile && (
        <div style={{ padding: '15px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
            <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Language Detection</h4>
            <button
              onClick={detectLanguageForFile}
              disabled={isDetectingLanguage || isProcessing}
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              {isDetectingLanguage ? 'Detecting...' : 'Detect Language'}
            </button>
          </div>
          <p style={{ margin: '0 0 15px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
            Click "Detect Language" to automatically identify the source language.
          </p>

          {showLanguageDetectionResult && detectedLanguage && (
            <div style={{ padding: '12px', backgroundColor: 'rgba(40, 167, 69, 0.1)', border: '1px solid rgba(40, 167, 69, 0.3)', borderRadius: '4px' }}>
              <h5 style={{ margin: '0 0 10px 0', color: 'var(--success-color)' }}>
                Language Detected: {detectedLanguage.name}
              </h5>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '15px', fontSize: '14px' }}>
                <div><strong>Native Name:</strong> {detectedLanguage.native}</div>
                <div><strong>ISO Code:</strong> {detectedLanguage.ISO_639_1}</div>
              </div>

              {isSubtitleFile(selectedFile.name) && (
                <div style={{ marginBottom: '15px' }}>
                  <h6 style={{ margin: '0 0 8px 0' }}>Compatible Translation Models ({compatibleModels.translation.length})</h6>
                  {compatibleModels.translation.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                      {compatibleModels.translation.map(m => <li key={m}>{m}</li>)}
                    </ul>
                  ) : (
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No translation models support this language</p>
                  )}
                </div>
              )}

              {isAudioVideoFile(selectedFile.name) && (
                <div style={{ marginBottom: '15px' }}>
                  <h6 style={{ margin: '0 0 8px 0' }}>Compatible Transcription Models ({compatibleModels.transcription.length})</h6>
                  {compatibleModels.transcription.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                      {compatibleModels.transcription.map(m => <li key={m}>{m}</li>)}
                    </ul>
                  ) : (
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No transcription models support this language</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Options */}
      {fileType && (
        <div className="options-section">
          {isLoadingOptions ? (
            <div className="options-container"><p>Loading options...</p></div>
          ) : fileType === 'transcription' ? (
            <ImprovedTranscriptionOptions
              options={transcriptionOptions}
              setOptions={setTranscriptionOptions}
              transcriptionInfo={contextTranscriptionInfo}
              disabled={isProcessing || isDetectingLanguage}
            />
          ) : (
            <ImprovedTranslationOptions
              options={translationOptions}
              translationInfo={translationInfo}
              onModelChange={handleTranslationModelChange}
              onLanguageChange={handleTranslationLanguageChange}
              onFormatChange={(format) => setTranslationOptions(prev => ({ ...prev, format }))}
              disabled={isProcessing || isDetectingLanguage}
            />
          )}
        </div>
      )}

      {statusMessage && (
        <div className={`status-message ${statusMessage.type}`}>
          {statusMessage.message}
        </div>
      )}

      {/* FFmpeg progress bar */}
      {ffmpegProgress !== null && (
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${ffmpegProgress}%` }}></div>
        </div>
      )}

      {selectedFile && fileType && (
        <div className="action-section">
          <button
            className={`btn-primary ${isProcessing ? 'btn-danger' : ''}`}
            onClick={isProcessing ? handleStopProcess : handleProcess}
            disabled={isDetectingLanguage}
            style={isProcessing ? { backgroundColor: 'var(--danger-color)' } : undefined}
          >
            {isDetectingLanguage
              ? 'Detecting Language...'
              : isProcessing
                ? `Stop ${fileType === 'transcription' ? 'Transcription' : 'Translation'}`
                : `Start ${fileType === 'transcription' ? 'Transcription' : 'Translation'}`}
          </button>
        </div>
      )}

      {showPreview && (
        <PreviewDialog
          content={previewContent}
          onClose={() => setShowPreview(false)}
          onSave={handleSaveFile}
        />
      )}

      {/* Credit Warning Modal */}
      {showCreditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--bg-primary)', maxWidth: '500px', width: '90%', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '24px', backgroundColor: 'var(--danger-color)', color: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}><i className="fas fa-exclamation-triangle"></i></div>
              <h2 style={{ margin: 0 }}>Insufficient Credits</h2>
            </div>
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ fontSize: '16px', lineHeight: '1.5', marginBottom: '20px' }}>
                You don't have enough credits to process this file.
              </p>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                <strong style={{ color: 'var(--danger-color)', fontSize: '18px' }}>
                  Current Balance: {credits?.remaining || 0} credits
                </strong>
              </div>
            </div>
            <div style={{ padding: '16px 24px', backgroundColor: 'var(--bg-secondary)', display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => setShowCreditModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => { setShowCreditModal(false); onNavigateToCredits?.(); }} className="btn-primary">Buy Credits</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewDialog({ content, onClose, onSave }: { content: string; onClose: () => void; onSave: (content: string) => void }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'var(--bg-primary)', padding: '20px', borderRadius: '8px', maxWidth: '80%', maxHeight: '80%', overflow: 'auto', minWidth: '500px', minHeight: '400px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Result Preview</h3>
          <button onClick={onClose} style={{ fontSize: '18px', padding: '5px 10px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <textarea
          value={content}
          readOnly
          style={{ width: '100%', height: '300px', fontFamily: 'monospace', fontSize: '12px', border: '1px solid var(--border-color)', padding: '10px', resize: 'vertical', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        />

        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
          <button onClick={() => onSave(content)} className="btn-primary" style={{ backgroundColor: 'var(--success-color)' }}>
            Save to File
          </button>
          <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
}

export default MainScreen;
