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
    <div
      className="batch-settings-panel"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px', padding: '20px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px', border: '1px solid var(--border-color)',
      }}
    >
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
            onChange={(e) => onTranscriptionModelChange(e.target.value)}
            disabled={isProcessing || !uiState.transcriptionEnabled}
            style={{ width: '100%', padding: '5px', opacity: uiState.transcriptionEnabled ? 1 : 0.5 }}
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
      </div>

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
            onChange={(e) => onTranslationModelChange(e.target.value)}
            disabled={isProcessing || !uiState.translationEnabled}
            style={{ width: '100%', padding: '5px', opacity: uiState.translationEnabled ? 1 : 0.5 }}
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
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Target Language:</label>
          <select
            value={batchSettings.targetLanguage}
            onChange={(e) => setBatchSettings({ ...batchSettings, targetLanguage: e.target.value })}
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

      <div>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
          <i className="fas fa-file-export" style={{ fontSize: '18px' }}></i>
          <span>Output Settings</span>
        </h4>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Format:</label>
          <select
            value={batchSettings.outputFormat}
            onChange={(e) => setBatchSettings({ ...batchSettings, outputFormat: e.target.value })}
            disabled={isProcessing}
            style={{ width: '100%', padding: '5px' }}
          >
            {fileFormatsConfig.subtitle.map(format => (
              <option key={format} value={format}>{format.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

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
              onChange={(e) => setBatchSettings({ ...batchSettings, abortOnError: e.target.checked })}
              disabled={isProcessing}
            />
            Abort batch processing on first error
          </label>
        </div>
      </div>
    </div>
  );
};
