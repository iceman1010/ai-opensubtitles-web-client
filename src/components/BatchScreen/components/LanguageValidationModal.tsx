import React from 'react';
import { BatchFile } from '../types';

interface LanguageValidationModalProps {
  visible: boolean;
  missingLanguageFiles: BatchFile[];
  onClose: () => void;
}

export const LanguageValidationModal: React.FC<LanguageValidationModalProps> = ({
  visible,
  missingLanguageFiles,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', padding: '24px',
        maxWidth: '600px', width: '90%', maxHeight: '80vh', overflow: 'auto',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)', border: '1px solid var(--border-color)',
      }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '18px', fontWeight: '600' }}>
          Source Language Selection Required
        </h3>
        <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
          The following audio/video files need a source language selected before batch processing can start.
          Please select the source language for each file using the dropdown menus in the file list.
        </p>
        <div style={{
          maxHeight: '300px', overflow: 'auto',
          border: '1px solid var(--border-color)', borderRadius: '4px',
          padding: '12px', backgroundColor: 'var(--bg-primary)', marginBottom: '20px',
        }}>
          {missingLanguageFiles.map(file => (
            <div key={file.id} style={{
              padding: '8px 12px', margin: '4px 0',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--danger-color)', borderRadius: '4px', fontSize: '14px',
            }}>
              <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{file.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Type: {file.type}
                {file.detectedLanguage && ` | Detected: ${file.detectedLanguage.native || file.detectedLanguage.name}`}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            className="btn-primary"
            style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '500' }}
          >
            OK, I'll Select Languages
          </button>
        </div>
      </div>
    </div>
  );
};
