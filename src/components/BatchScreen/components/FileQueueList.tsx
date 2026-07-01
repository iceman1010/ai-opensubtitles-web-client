import React from 'react';
import { BatchFile, BatchSettings } from '../types';
import { getMatchingSourceLanguages, getLanguagesForModel } from '../utils';
import { formatFileSize } from '../../../hooks/useFileHandler';

interface FileQueueListProps {
  queue: BatchFile[];
  currentFileIndex: number;
  isProcessing: boolean;
  isDetectingLanguages: boolean;
  onRemove: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onClear: () => void;
  onDownload: (file: BatchFile) => void;
  onSourceLanguageChange: (fileId: string, lang: string) => void;
  batchSettings: BatchSettings;
  contextTranscriptionInfo: any;
  contextTranslationInfo: any;
}

export const FileQueueList: React.FC<FileQueueListProps> = ({
  queue,
  currentFileIndex,
  isProcessing,
  isDetectingLanguages,
  onRemove,
  onMoveUp,
  onMoveDown,
  onClear,
  onDownload,
  onSourceLanguageChange,
  batchSettings,
  contextTranscriptionInfo,
  contextTranslationInfo,
}) => {
  if (queue.length === 0) return null;

  return (
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
          onClick={onClear}
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
                         'var(--text-secondary)',
                }}>{file.status}</span>
                {file.detectedLanguage && ` | Language: ${file.detectedLanguage.native || file.detectedLanguage.name}`}
                {file.progress !== undefined && file.status === 'processing' && ` | Progress: ${file.progress}%`}
                {file.creditsUsed !== undefined && file.creditsUsed > 0 && ` | Credits: ${file.creditsUsed}`}
                {' | '}{formatFileSize(file.file.size)}
              </div>

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

              {file.type === 'translation' && contextTranslationInfo && batchSettings.translationModel && (
                <div style={{ marginTop: '8px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Source Language:
                  </label>
                  <select
                    value={file.selectedSourceLanguage || ''}
                    onChange={(e) => onSourceLanguageChange(file.id, e.target.value)}
                    disabled={isProcessing}
                    style={{
                      fontSize: '11px', padding: '2px 4px',
                      border: '1px solid var(--border-color)', borderRadius: '3px',
                      backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)',
                      maxWidth: '200px',
                    }}
                  >
                    {!file.selectedSourceLanguage && <option value="">{file.detectedLanguage ? 'Select variant...' : 'Select language...'}</option>}
                    {getMatchingSourceLanguages(file.detectedLanguage?.ISO_639_1 || null, contextTranslationInfo?.languages?.[batchSettings.translationModel] || []).map(lang => (
                      <option key={lang.language_code} value={lang.language_code}>{lang.language_name}</option>
                    ))}
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
                    onChange={(e) => onSourceLanguageChange(file.id, e.target.value)}
                    disabled={isProcessing}
                    style={{
                      fontSize: '11px', padding: '2px 4px',
                      border: '1px solid var(--border-color)', borderRadius: '3px',
                      backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)',
                      maxWidth: '200px',
                    }}
                  >
                    {!file.selectedSourceLanguage && <option value="">{file.detectedLanguage ? 'Select variant...' : 'Select language...'}</option>}
                    {getMatchingSourceLanguages(file.detectedLanguage?.ISO_639_1 || null, getLanguagesForModel(contextTranscriptionInfo?.languages, batchSettings.transcriptionModel)).map(lang => (
                      <option key={lang.language_code} value={lang.language_code}>{lang.language_name}</option>
                    ))}
                  </select>
                </div>
              )}

              {file.status === 'completed' && file.outputContent && (
                <button
                  onClick={() => onDownload(file)}
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
                <button onClick={() => onMoveUp(index)} disabled={index === 0} title="Move Up"
                  style={{ padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: '3px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: index === 0 ? 'not-allowed' : 'pointer' }}>
                  <i className="fas fa-arrow-up"></i>
                </button>
                <button onClick={() => onMoveDown(index)} disabled={index === queue.length - 1} title="Move Down"
                  style={{ padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: '3px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: index === queue.length - 1 ? 'not-allowed' : 'pointer' }}>
                  <i className="fas fa-arrow-down"></i>
                </button>
                <button onClick={() => onRemove(file.id)} title="Remove"
                  style={{ padding: '4px 8px', border: '1px solid var(--danger-color)', borderRadius: '3px', backgroundColor: 'transparent', color: 'var(--danger-color)', cursor: 'pointer' }}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
