import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import FileSelector from '../FileSelector';
import { LanguageInfo, ServicesInfo } from '../../services/api';
import { logger } from '../../utils/errorLogger';
import { useAPI } from '../../contexts/APIContext';
import { saveTextFile } from '../../hooks/useFileHandler';
import * as fileFormatsConfig from '../../config/fileFormats.json';
import SubtitlePreviewModal from '../SubtitlePreviewModal';
import { BatchScreenProps, BatchFile, BatchSettings } from './types';
import { getLanguagesForModel, autoSelectSourceLanguage, computeEstimatedCost, computeQueueAnalysis, computeUiState, generateOutputFileName, validateLanguageSelection, findModelPrice } from './utils';
import { useQueueManager } from './hooks/useQueueManager';
import { useLanguageDetection } from './hooks/useLanguageDetection';
import { useBatchProcessor } from './hooks/useBatchProcessor';
import { FileQueueList } from './components/FileQueueList';
import { BatchSettingsPanel } from './components/BatchSettingsPanel';
import { ProcessingControls } from './components/ProcessingControls';
import { LanguageValidationModal } from './components/LanguageValidationModal';
import { CompletionSummary } from './components/CompletionSummary';

const BatchScreen: React.FC<BatchScreenProps> = ({ config, setAppProcessing, onProcessingStateChange, onEstimatedCostChange }) => {
  const api = useAPI();

  const isProcessingRef = useRef(false);

  const [batchSettings, setBatchSettings] = useState<BatchSettings>({
    transcriptionModel: '',
    translationModel: '',
    targetLanguage: '',
    outputFormat: fileFormatsConfig.subtitle[0] || 'srt',
    workflowMode: 'transcribe-only',
    abortOnError: true,
  });

  const [availableTranslationLanguages, setAvailableTranslationLanguages] = useState<LanguageInfo[]>([]);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(false);
  const [languagesLoaded, setLanguagesLoaded] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [servicesInfo, setServicesInfo] = useState<ServicesInfo | null>(null);

  const queueManager = useQueueManager({
    config,
    setAppProcessing,
    isProcessingRef,
    onSubtitleFileAdded: (updatedQueue) => {
      langDetection.processLanguageDetectionQueue(
        updatedQueue,
        queueManager.setDetectedLanguageForFile,
        batchSettings.transcriptionModel,
        batchSettings.translationModel,
        api.transcriptionInfo,
        api.translationInfo,
        autoSelectSourceLanguage,
        getLanguagesForModel,
      );
    },
  });

  const langDetection = useLanguageDetection({
    isAuthenticated: api.isAuthenticated,
    setQueue: queueManager.setQueue,
    config,
    setAppProcessing,
    isProcessingRef,
    queue: queueManager.queue,
    detectLanguage: api.detectLanguage,
    checkLanguageDetectionStatus: api.checkLanguageDetectionStatus,
  });

  const processor = useBatchProcessor({
    config,
    setAppProcessing,
    api: {
      initiateTranscription: api.initiateTranscription,
      checkTranscriptionStatus: api.checkTranscriptionStatus,
      initiateTranslation: api.initiateTranslation,
      checkTranslationStatus: api.checkTranslationStatus,
      downloadFile: api.downloadFile,
    },
  });

  const { setQueue } = queueManager;

  useEffect(() => { isProcessingRef.current = processor.isProcessing; }, [processor.isProcessing]);
  useEffect(() => { processor.updateBatchSettingsRef(batchSettings); }, [processor, batchSettings]);
  useEffect(() => { onProcessingStateChange?.(processor.isProcessing); }, [processor.isProcessing, onProcessingStateChange]);

  const enableChaining = batchSettings.workflowMode === 'transcribe-and-translate';

  const queueAnalysis = useMemo(() => computeQueueAnalysis(queueManager.queue), [queueManager.queue]);

  const uiState = useMemo(() => computeUiState(queueAnalysis, enableChaining), [queueAnalysis, enableChaining]);

  const estimatedCost = useMemo(() => computeEstimatedCost(
    servicesInfo, queueManager.queue, processor.isProcessing,
    batchSettings.transcriptionModel, batchSettings.translationModel,
    batchSettings.workflowMode, findModelPrice,
  ), [servicesInfo, queueManager.queue, processor.isProcessing, batchSettings.transcriptionModel, batchSettings.translationModel, batchSettings.workflowMode]);

  useEffect(() => {
    onEstimatedCostChange?.(estimatedCost);
    return () => { onEstimatedCostChange?.(null); };
  }, [estimatedCost, onEstimatedCostChange]);

  useEffect(() => {
    if (api.isAuthenticated) {
      api.getServicesInfo().then(result => {
        if (result.success && result.data) setServicesInfo(result.data);
      });
    }
  }, [api.isAuthenticated, api.getServicesInfo]);

  useEffect(() => {
    if (!languagesLoaded && api.transcriptionInfo && api.transcriptionInfo.apis.length > 0) {
      const defaultModel = api.transcriptionInfo.apis[0];
      setBatchSettings(prev => ({ ...prev, transcriptionModel: defaultModel }));
    }
  }, [api.transcriptionInfo, languagesLoaded]);

  useEffect(() => {
    if (!languagesLoaded && api.translationInfo && api.translationInfo.apis.length > 0) {
      const defaultModel = api.translationInfo.apis[0];
      setBatchSettings(prev => ({ ...prev, translationModel: defaultModel }));
      loadLanguagesForTranslationModel(defaultModel, api.translationInfo);
    }
  }, [api.translationInfo, languagesLoaded]);

  useEffect(() => {
    if (uiState.shouldDisableChaining && enableChaining) {
      setBatchSettings(prev => ({ ...prev, workflowMode: 'transcribe-only' }));
    }
  }, [uiState.shouldDisableChaining, enableChaining]);

  const loadLanguagesForTranslationModel = async (modelId: string, translationData?: any) => {
    setIsLoadingLanguages(true);
    try {
      const dataToUse = translationData || api.translationInfo;
      if (dataToUse?.languages?.[modelId]) {
        const modelLanguages = dataToUse.languages[modelId];
        setAvailableTranslationLanguages(Array.isArray(modelLanguages) ? modelLanguages : []);
        setBatchSettings(prev => {
          const currentTargetLang = prev.targetLanguage;
          const isCurrentAvailable = Array.isArray(modelLanguages) &&
            modelLanguages.some((lang: LanguageInfo) => lang.language_code === currentTargetLang);
          if (!isCurrentAvailable && Array.isArray(modelLanguages) && modelLanguages.length > 0) {
            const defaultLang = modelLanguages.find((lang: LanguageInfo) => lang.language_code === 'en') || modelLanguages[0];
            return { ...prev, targetLanguage: defaultLang.language_code };
          }
          return prev;
        });
      } else {
        const result = await api.getTranslationLanguagesForApi(modelId);
        if (result?.success && result.data) {
          const languagesArray = Array.isArray(result.data) ? result.data : [];
          setAvailableTranslationLanguages(languagesArray);
          if (languagesArray.length > 0) {
            const defaultLang = languagesArray.find((lang: LanguageInfo) => lang.language_code === 'en') || languagesArray[0];
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

  const handleTranscriptionModelChange = (newModel: string) => {
    setBatchSettings(prev => ({ ...prev, transcriptionModel: newModel }));
    setQueue(prev => prev.map(file => {
      if (file.type === 'transcription') {
        const detectedCode = file.detectedLanguage?.ISO_639_1 || null;
        const apiLangs = getLanguagesForModel(api.transcriptionInfo?.languages, newModel);
        return { ...file, selectedSourceLanguage: autoSelectSourceLanguage(detectedCode, apiLangs) };
      }
      return file;
    }));
  };

  const handleTranslationModelChange = (newModel: string) => {
    setBatchSettings(prev => ({ ...prev, translationModel: newModel }));
    loadLanguagesForTranslationModel(newModel);
    setQueue(prev => prev.map(file => {
      if (file.type === 'translation') {
        const detectedCode = file.detectedLanguage?.ISO_639_1 || null;
        const apiLangs = api.translationInfo?.languages?.[newModel];
        return { ...file, selectedSourceLanguage: autoSelectSourceLanguage(detectedCode, apiLangs || []) };
      }
      return file;
    }));
  };

  const completedFiles = useMemo(() =>
    queueManager.queue.filter(f => f.status === 'completed' && f.outputContent),
  [queueManager.queue]);

  const handlePreviewFile = useCallback((file: BatchFile) => {
    if (file.outputContent && file.outputFileName) {
      setPreviewContent(file.outputContent);
      setPreviewFileName(file.outputFileName);
    }
  }, []);

  const handlePreviewClose = useCallback(() => {
    setPreviewContent(null);
    setPreviewFileName('');
  }, []);

  const handlePreviewDownload = useCallback(() => {
    if (previewContent && previewFileName) {
      saveTextFile(previewContent, previewFileName);
    }
  }, [previewContent, previewFileName]);

  const downloadSingleFile = useCallback(async (file: BatchFile) => {
    if (file.outputContent && file.outputFileName) {
      saveTextFile(file.outputContent, file.outputFileName);
    }
  }, []);

  const downloadAllFiles = useCallback(async () => {
    const completed = queueManager.queue.filter(f => f.status === 'completed' && f.outputContent && f.outputFileName);
    for (let i = 0; i < completed.length; i++) {
      downloadSingleFile(completed[i]);
      if (i < completed.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }, [queueManager.queue, downloadSingleFile]);

  const handleDetectLanguages = useCallback(() => {
    langDetection.processLanguageDetectionQueue(
      undefined,
      queueManager.setDetectedLanguageForFile,
      batchSettings.transcriptionModel,
      batchSettings.translationModel,
      api.transcriptionInfo,
      api.translationInfo,
      autoSelectSourceLanguage,
      getLanguagesForModel,
    );
  }, [langDetection, queueManager.setDetectedLanguageForFile, batchSettings.transcriptionModel, batchSettings.translationModel, api.transcriptionInfo, api.translationInfo]);

  const handleStartProcessing = useCallback(() => {
    processor.startBatchProcessing(
      queueManager.queue,
      validateLanguageSelection,
      queueManager.updateFileCredits,
      queueManager.resetCreditTracking,
      queueManager.setQueue,
      generateOutputFileName,
      (model, code) => api.getTranslationLanguageNameSync(model, code) ?? undefined,
      (model, code) => api.getTranscriptionLanguageNameSync(model, code) ?? undefined,
    );
  }, [processor, queueManager.queue, queueManager.updateFileCredits, queueManager.resetCreditTracking, queueManager.setQueue, api.getTranslationLanguageNameSync, api.getTranscriptionLanguageNameSync]);

  useEffect(() => {
    return () => {
      if (queueManager.detectionTimeoutRef.current) clearTimeout(queueManager.detectionTimeoutRef.current);
    };
  }, [queueManager.detectionTimeoutRef]);

  const hasFilesWithoutLanguage = queueManager.queue.some(file => !file.detectedLanguage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px', position: 'relative' }}>
      <h1>Batch Processing</h1>
      <p>Select multiple files to transcribe or translate:</p>

      <FileSelector
        onFileSelect={queueManager.handleSingleFileSelect}
        onMultipleFileSelect={queueManager.handleMultipleFileSelect}
        multiple={true}
        disabled={processor.isProcessing}
      />

      {queueManager.queue.length === 0 && (
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

      <FileQueueList
        queue={queueManager.queue}
        currentFileIndex={processor.currentFileIndex}
        isProcessing={processor.isProcessing}
        isDetectingLanguages={langDetection.isDetectingLanguages}
        onRemove={queueManager.removeFromQueue}
        onMoveUp={queueManager.moveFileUp}
        onMoveDown={queueManager.moveFileDown}
        onClear={queueManager.clearQueue}
        onDownload={downloadSingleFile}
        onSourceLanguageChange={queueManager.handleSourceLanguageChange}
        batchSettings={batchSettings}
        contextTranscriptionInfo={api.transcriptionInfo}
        contextTranslationInfo={api.translationInfo}
      />

      {queueManager.queue.length > 0 && (
        <BatchSettingsPanel
          batchSettings={batchSettings}
          onChange={setBatchSettings}
          uiState={uiState}
          isProcessing={processor.isProcessing}
          enableChaining={enableChaining}
          transcriptionInfo={api.transcriptionInfo}
          translationInfo={api.translationInfo}
          availableTranslationLanguages={availableTranslationLanguages}
          isLoadingLanguages={isLoadingLanguages}
          onTranscriptionModelChange={handleTranscriptionModelChange}
          onTranslationModelChange={handleTranslationModelChange}
        />
      )}

      <ProcessingControls
        isProcessing={processor.isProcessing}
        overallProgress={processor.overallProgress}
        estimatedCost={estimatedCost}
        creditsUsed={queueManager.batchCreditStats.totalCreditsUsed}
        currentFileIndex={processor.currentFileIndex}
        queue={queueManager.queue}
        batchSettings={batchSettings}
        isAuthenticated={api.isAuthenticated}
        isDetectingLanguages={langDetection.isDetectingLanguages}
        hasFilesWithoutLanguage={hasFilesWithoutLanguage}
        onStart={handleStartProcessing}
        onStop={processor.stopBatchProcessing}
        onDetectLanguages={handleDetectLanguages}
      />

      <LanguageValidationModal
        visible={processor.showLanguageValidationModal}
        missingLanguageFiles={validateLanguageSelection(queueManager.queue).missingLanguageFiles}
        onClose={() => processor.setShowLanguageValidationModal(false)}
      />

      <CompletionSummary
        visible={processor.showCompletionSummary}
        batchStats={processor.batchStats}
        batchCreditStats={queueManager.batchCreditStats}
        completedFiles={completedFiles}
        onDownload={downloadSingleFile}
        onDownloadAll={downloadAllFiles}
        onPreview={handlePreviewFile}
        onClose={() => processor.setShowCompletionSummary(false)}
      />

      <SubtitlePreviewModal
        isOpen={previewContent !== null}
        onClose={handlePreviewClose}
        content={previewContent || ''}
        fileName={previewFileName}
        onDownload={handlePreviewDownload}
      />

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
