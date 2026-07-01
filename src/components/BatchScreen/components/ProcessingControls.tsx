import React from 'react';
import { BatchFile, BatchSettings } from '../types';

interface ProcessingControlsProps {
  isProcessing: boolean;
  overallProgress: number;
  estimatedCost: number | null;
  creditsUsed: number;
  currentFileIndex: number;
  queue: BatchFile[];
  batchSettings: BatchSettings;
  isAuthenticated: boolean;
  isDetectingLanguages: boolean;
  hasFilesWithoutLanguage: boolean;
  onStart: () => void;
  onStop: () => void;
  onDetectLanguages: () => void;
}

export const ProcessingControls: React.FC<ProcessingControlsProps> = ({
  isProcessing,
  overallProgress,
  estimatedCost,
  creditsUsed,
  currentFileIndex,
  queue,
  batchSettings,
  isAuthenticated,
  isDetectingLanguages,
  hasFilesWithoutLanguage,
  onStart,
  onStop,
  onDetectLanguages,
}) => {
  if (queue.length === 0) return null;

  return (
    <>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px', backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px', border: '1px solid var(--border-color)',
      }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>
            Overall Progress: {overallProgress}%
            {creditsUsed > 0 && (
              <span style={{ marginLeft: '20px', fontSize: '16px', color: 'var(--accent-color)' }}>
                Credits Used: {creditsUsed}
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
          {!isProcessing && estimatedCost !== null && (
            <div style={{ fontSize: '14px', marginTop: '4px', fontWeight: '500' }}>
              <span style={{ color: estimatedCost === 0 ? 'var(--success-color)' : 'var(--text-primary)' }}>
                Est. total cost: {estimatedCost === 0 ? 'Free' : `~${estimatedCost.toFixed(1)} credits`}
              </span>
              {batchSettings.workflowMode === 'transcribe-and-translate' && (
                <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontSize: '12px' }}>
                  (includes estimated translation)
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {!isProcessing && hasFilesWithoutLanguage && (
            <button
              onClick={onDetectLanguages}
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
            onClick={!isProcessing ? onStart : onStop}
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
    </>
  );
};
