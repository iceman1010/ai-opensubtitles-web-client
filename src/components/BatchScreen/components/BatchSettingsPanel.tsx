import React from 'react';
import { BatchSettings, UiState, LanguageInfo } from '../types';
import * as fileFormatsConfig from '../../../config/fileFormats.json';

interface BatchSettingsPanelProps {
  batchSettings: BatchSettings;
  onChange: (settings: BatchSettings) => void;
  uiState: UiState;
  isProcessing: boolean;
  enableChaining: boolean;
  transcriptionInfo: any;
  translationInfo: any;
  availableTranslationLanguages: LanguageInfo[];
  isLoadingLanguages: boolean;
  onTranscriptionModelChange: (model: string) => void;
  onTranslationModelChange: (model: string) => void;
}

export const BatchSettingsPanel: React.FC<BatchSettingsPanelProps> = ({
  batchSettings,
  onChange,
  uiState,
  isProcessing,
  enableChaining,
  transcriptionInfo,
  translationInfo,
  availableTranslationLanguages,
  isLoadingLanguages,
  onTranscriptionModelChange,
  onTranslationModelChange,
}) => {
  const setBatchSettings = onChange;

  return (
    <div className="options-container batch-settings-panel">
      {uiState.chainingEnabled && (
        <div style={{ width: '100%', paddingBottom: '16px', marginBottom: '4px', borderBottom: '1px solid var(--border-color)' }}>
          <h4 style={{ margin: '0 0 8px 0' }}><i className="fas fa-route"></i> Processing Workflow</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px',
              border: `2px solid ${batchSettings.workflowMode === 'transcribe-only' ? 'var(--accent-color)' : 'var(--border-color)'}`,
              borderRadius: '8px', cursor: isProcessing ? 'not-allowed' : 'pointer',
              backgroundColor: batchSettings.workflowMode === 'transcribe-only' ? 'rgba(52, 152, 219, 0.1)' : 'transparent',
            }}>
              <input type="radio" name="workflowMode" value="transcribe-only"
                checked={batchSettings.workflowMode === 'transcribe-only'}
                onChange={() => setBatchSettings({ ...batchSettings, workflowMode: 'transcribe-only' })}
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
                onChange={() => setBatchSettings({ ...batchSettings, workflowMode: 'transcribe-and-translate' })}
                disabled={isProcessing} style={{ marginTop: '3px' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}><i className="fas fa-language"></i> Auto-translate after transcription</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Produces subtitles in target language (2-step process)</div>
              </div>
            </label>
          </div>

          <div style={{ padding: '10px 15px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px' }}>
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
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
              <i className="fas fa-info-circle"></i> {enableChaining ? 'Two-step processing uses credits for both operations' : 'Single-step processing: converts speech to text in original language'}
            </div>
          </div>
        </div>
      )}

      <div className="form-group" style={{ opacity: uiState.transcriptionEnabled ? 1 : 0.5 }}>
        <label>Transcription Model:</label>
        {!uiState.transcriptionEnabled && (
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0 0 6px 0' }}>No audio/video files in queue</p>
        )}
        <select
          value={batchSettings.transcriptionModel}
          onChange={(e) => onTranscriptionModelChange(e.target.value)}
          disabled={isProcessing || !uiState.transcriptionEnabled}
          style={{ width: '100%' }}
        >
          {!transcriptionInfo?.apis?.length ? (
            <option value="">Loading models...</option>
          ) : (
            transcriptionInfo.apis.map((api: string) => (
              <option key={api} value={api}>{api}</option>
            ))
          )}
        </select>
      </div>

      <div className="form-group" style={{ opacity: uiState.translationEnabled ? 1 : 0.5 }}>
        <label>Translation Model:</label>
        {!uiState.translationEnabled && (
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0 0 6px 0' }}>
            Select "Auto-translate" workflow or add subtitle files to queue
          </p>
        )}
        <select
          value={batchSettings.translationModel}
          onChange={(e) => onTranslationModelChange(e.target.value)}
          disabled={isProcessing || !uiState.translationEnabled}
          style={{ width: '100%' }}
        >
          {!translationInfo?.apis?.length ? (
            <option value="">Loading models...</option>
          ) : (
            translationInfo.apis.map((api: string) => (
              <option key={api} value={api}>{api}</option>
            ))
          )}
        </select>
      </div>

      <div className="form-group" style={{ opacity: uiState.translationEnabled ? 1 : 0.5 }}>
        <label>Target Language:</label>
        <select
          value={batchSettings.targetLanguage}
          onChange={(e) => setBatchSettings({ ...batchSettings, targetLanguage: e.target.value })}
          disabled={isProcessing || !uiState.translationEnabled}
          style={{ width: '100%' }}
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

      <div className="form-group">
        <label>Output Format:</label>
        <select
          value={batchSettings.outputFormat}
          onChange={(e) => setBatchSettings({ ...batchSettings, outputFormat: e.target.value })}
          disabled={isProcessing}
          style={{ width: '100%' }}
        >
          {fileFormatsConfig.subtitle.map(format => (
            <option key={format} value={format}>{format.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div className="form-group" style={{ alignSelf: 'flex-end' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0', cursor: isProcessing ? 'not-allowed' : 'pointer' }}>
          <input
            type="checkbox"
            checked={batchSettings.abortOnError}
            onChange={(e) => setBatchSettings({ ...batchSettings, abortOnError: e.target.checked })}
            disabled={isProcessing}
          />
          Abort batch processing on first error
        </label>
      </div>
    </div>
  );
};
