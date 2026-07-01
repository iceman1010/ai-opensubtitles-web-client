import React from 'react';
import { BatchFile, BatchStats, BatchCreditStats } from '../types';

interface CompletionSummaryProps {
  visible: boolean;
  batchStats: BatchStats;
  batchCreditStats: BatchCreditStats;
  completedFiles: BatchFile[];
  onDownload: (file: BatchFile) => void;
  onDownloadAll: () => void;
  onPreview: (file: BatchFile) => void;
  onClose: () => void;
}

export const CompletionSummary: React.FC<CompletionSummaryProps> = ({
  visible,
  batchStats,
  batchCreditStats,
  completedFiles,
  onDownload,
  onDownloadAll,
  onPreview,
  onClose,
}) => {
  if (!visible) return null;

  return (
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
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{ fontSize: '13px', fontFamily: 'monospace', color: 'var(--text-primary)', wordBreak: 'break-all', flex: 1, minWidth: 0 }}>
                    {file.outputFileName}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <div
                      onClick={() => onPreview(file)}
                      title="Preview subtitle"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '4px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary-color)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      <i className="fas fa-eye"></i>
                    </div>
                    <div
                      onClick={() => onDownload(file)}
                      title="Download file"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--primary-color)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '4px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(52, 73, 94, 0.7)';
                        const icon = e.currentTarget.querySelector('i');
                        if (icon) {
                          icon.style.transform = 'scale(1.3)';
                          const isDarkMode = document.documentElement.classList.contains('dark-mode');
                          icon.style.textShadow = isDarkMode
                            ? '0 0 8px rgba(255, 255, 0, 0.6)'
                            : '0 0 8px rgba(0, 150, 255, 0.8)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        const icon = e.currentTarget.querySelector('i');
                        if (icon) {
                          icon.style.transform = 'scale(1)';
                          icon.style.textShadow = 'none';
                        }
                      }}
                    >
                      <i className="fas fa-download"></i>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          {completedFiles.length > 1 && (
            <button
              onClick={onDownloadAll}
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
            onClick={onClose}
            className="btn-primary"
            style={{ padding: '12px 24px', fontSize: '14px', fontWeight: '500' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
