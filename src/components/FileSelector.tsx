import React, { useState, useRef } from 'react';
import { validateFileExtension, getFileTypeDescription, getAllSupportedExtensions } from '../config/fileFormats';

interface FileSelectorProps {
  onFileSelect: (file: File) => void;
  onMultipleFileSelect?: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
}

function FileSelector({ onFileSelect, onMultipleFileSelect, multiple = false, disabled = false }: FileSelectorProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelection = (file: File) => {
    if (disabled) return;

    const validation = validateFileExtension(file.name);

    if (validation.isValid) {
      setSelectedFile(file);
      setFileError(null);
      onFileSelect(file);
    } else {
      setSelectedFile(null);
      setFileError(validation.error || 'Invalid file');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      if (multiple && onMultipleFileSelect && files.length > 1) {
        const validFiles = files.filter(f => validateFileExtension(f.name).isValid);
        if (validFiles.length > 0) {
          onMultipleFileSelect(validFiles);
        }
      } else {
        handleFileSelection(files[0]);
      }
    }
  };

  const handleBrowseClick = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (multiple && onMultipleFileSelect && files.length > 1) {
        const validFiles = Array.from(files).filter(f => validateFileExtension(f.name).isValid);
        if (validFiles.length > 0) {
          onMultipleFileSelect(validFiles);
        }
      } else {
        handleFileSelection(files[0]);
      }
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  const acceptString = getAllSupportedExtensions().map(ext => `.${ext}`).join(',');

  return (
    <div className="file-selector">
      <input
        ref={inputRef}
        type="file"
        accept={acceptString}
        multiple={multiple}
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />

      <div
        className={`file-drop-zone ${isDragOver ? 'dragover' : ''} ${disabled ? 'disabled' : ''}`}
        onDragOver={disabled ? undefined : handleDragOver}
        onDragLeave={disabled ? undefined : handleDragLeave}
        onDrop={disabled ? undefined : handleDrop}
        onClick={handleBrowseClick}
        style={{
          border: `2px dashed ${isDragOver ? 'var(--accent-color)' : 'var(--border-color)'}`,
          borderRadius: '12px',
          padding: '30px',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          backgroundColor: isDragOver ? 'rgba(52, 152, 219, 0.05)' : 'var(--bg-secondary)',
          transition: 'all 0.3s ease',
          opacity: disabled ? 0.6 : 1
        }}
      >
        <div className="drop-zone-content">
          <i className="fas fa-cloud-upload-alt" style={{ fontSize: '36px', color: 'var(--text-muted)', marginBottom: '10px', display: 'block' }}></i>
          <p style={{ margin: '4px 0', color: 'var(--text-secondary)' }}>Drag & drop {multiple ? 'files' : 'a file'} here</p>
          <p style={{ margin: '4px 0', color: 'var(--text-muted)', fontSize: '12px' }}>or click to browse</p>
          <div className="supported-formats" style={{ marginTop: '8px' }}>
            <small style={{ color: 'var(--text-muted)' }}>Supported: Video, Audio, and Subtitle files</small>
          </div>
        </div>
      </div>

      {fileError && (
        <div className="status-message error">{fileError}</div>
      )}

      {selectedFile && !fileError && (
        <div className="selected-file-info" style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <p><strong>Selected:</strong> {selectedFile.name}</p>
          <p><strong>Type:</strong> {getFileTypeDescription(selectedFile.name)}</p>
        </div>
      )}
    </div>
  );
}

export default FileSelector;
