import React, { useState, useRef } from 'react';
import { useAPI } from '../contexts/APIContext';
import { SubtitleLanguage } from '../services/api';

interface FileSearchFormProps {
  onSearch: (moviehash: string, language: string, fileName: string) => void;
  isLoading: boolean;
  languageOptions: SubtitleLanguage[];
  languagesLoading: boolean;
  defaultLanguage: string;
}

interface FileInfo {
  name: string;
  size: number;
  hash: string | null;
}

/**
 * OpenSubtitles movie hash algorithm (browser implementation).
 * Reads the first and last 64KB of the file and sums them as 64-bit little-endian words,
 * then adds the file size.
 */
async function calculateMovieHashBrowser(file: File): Promise<string> {
  const CHUNK_SIZE = 65536; // 64KB

  if (file.size < CHUNK_SIZE) {
    throw new Error('File is too small for hash calculation (minimum 64KB)');
  }

  const readChunk = (start: number, end: number): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file.slice(start, end));
    });
  };

  const headBuffer = await readChunk(0, CHUNK_SIZE);
  const tailBuffer = await readChunk(Math.max(0, file.size - CHUNK_SIZE), file.size);

  // Sum as 64-bit little-endian words using two 32-bit halves
  let lo = 0;
  let hi = 0;

  const addWord = (view: DataView, offset: number) => {
    const wordLo = view.getUint32(offset, true);
    const wordHi = view.getUint32(offset + 4, true);
    lo += wordLo;
    hi += wordHi;
    // Carry from lo to hi
    if (lo > 0xFFFFFFFF) {
      hi += 1;
      lo &= 0xFFFFFFFF;
    }
    hi &= 0xFFFFFFFF;
  };

  const headView = new DataView(headBuffer);
  for (let i = 0; i < CHUNK_SIZE; i += 8) {
    addWord(headView, i);
  }

  const tailView = new DataView(tailBuffer);
  for (let i = 0; i < CHUNK_SIZE; i += 8) {
    addWord(tailView, i);
  }

  // Add file size
  lo += (file.size & 0xFFFFFFFF);
  if (lo > 0xFFFFFFFF) {
    hi += 1;
    lo &= 0xFFFFFFFF;
  }
  // Upper 32 bits of file size (for files > 4GB)
  hi += Math.floor(file.size / 0x100000000);
  hi &= 0xFFFFFFFF;

  // Format as 16-char hex string (big-endian output: hi then lo)
  const hiHex = hi.toString(16).padStart(8, '0');
  const loHex = lo.toString(16).padStart(8, '0');
  return hiHex + loHex;
}

function FileSearchForm({ onSearch, isLoading, languageOptions, languagesLoading, defaultLanguage }: FileSearchFormProps) {
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [isCalculatingHash, setIsCalculatingHash] = useState(false);
  const [language, setLanguage] = useState(defaultLanguage || '');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { updateConfig } = useAPI();

  const videoExtensions = [
    'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg',
    'ogv', '3gp', 'ts', 'vob', 'divx', 'xvid', 'rm', 'rmvb', 'asf', 'mts', 'm2ts'
  ];

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const isVideoFile = (filename: string): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? videoExtensions.includes(ext) : false;
  };

  const handleFileSelect = async (file: File) => {
    setError(null);

    if (!isVideoFile(file.name)) {
      setError(`Invalid file type. Please select a video file (${videoExtensions.slice(0, 5).join(', ')}, etc.)`);
      return;
    }

    try {
      setIsCalculatingHash(true);

      const hash = await calculateMovieHashBrowser(file);

      setSelectedFile({
        name: file.name,
        size: file.size,
        hash: hash,
      });
    } catch (error: any) {
      console.error('Error processing file:', error);
      setError(error?.message || 'Failed to process file');
      setSelectedFile(null);
    } finally {
      setIsCalculatingHash(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleClear = () => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile?.hash) {
      onSearch(selectedFile.hash, language, selectedFile.name);
    }
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    updateConfig({ lastUsedLanguage: newLanguage });
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '20px',
      border: '1px solid var(--border-color)',
    }}>
      <form onSubmit={handleSubmit}>
        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? 'var(--primary-color)' : 'var(--border-color)'}`,
            borderRadius: '8px',
            padding: '40px 20px',
            textAlign: 'center',
            background: isDragging ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
            marginBottom: '20px',
          }}
          onClick={handleBrowseClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={videoExtensions.map(ext => `.${ext}`).join(',')}
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />

          {isCalculatingHash ? (
            <div>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '48px', color: 'var(--primary-color)', marginBottom: '16px' }}></i>
              <p style={{ margin: '0', fontSize: '16px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                Calculating file hash...
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Please wait
              </p>
            </div>
          ) : selectedFile ? (
            <div>
              <i className="fas fa-file-video" style={{ fontSize: '48px', color: 'var(--success-color)', marginBottom: '16px' }}></i>
              <p style={{ margin: '0', fontSize: '16px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                {selectedFile.name}
              </p>
              <p style={{ margin: '8px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Size: {formatFileSize(selectedFile.size)}
              </p>
              <p style={{ margin: '8px 0', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                Hash: {selectedFile.hash}
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                <i className="fas fa-times"></i> Clear & Select Another File
              </button>
            </div>
          ) : (
            <div>
              <i className="fas fa-cloud-upload-alt" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '16px' }}></i>
              <p style={{ margin: '0', fontSize: '16px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                Drag & Drop Video File Here
              </p>
              <p style={{ margin: '8px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                or click to browse
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Supported: MP4, MKV, AVI, MOV, WMV, and more
              </p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '12px 16px',
            marginBottom: '20px',
            background: 'var(--error-bg, #fee)',
            border: '1px solid var(--error-border, #fcc)',
            borderRadius: '6px',
            color: 'var(--error-text, #c33)',
            fontSize: '14px',
          }}>
            <i className="fas fa-exclamation-triangle"></i> {error}
          </div>
        )}

        {/* Search Controls */}
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 'bold',
              marginBottom: '6px',
              color: 'var(--text-secondary)',
            }}>
              Subtitle Language (optional)
            </label>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={isLoading || languagesLoading}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            >
              {languagesLoading ? (
                <option value="">Loading languages...</option>
              ) : (
                <>
                  <option value="">All Languages</option>
                  {languageOptions.map(lang => (
                    <option key={lang.language_code} value={lang.language_code}>
                      {lang.language_name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div style={{ flexShrink: 0, alignSelf: 'flex-end' }}>
            <button
              type="submit"
              disabled={isLoading || !selectedFile?.hash}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 'bold',
                background: selectedFile?.hash ? 'var(--primary-color)' : 'var(--bg-disabled)',
                color: selectedFile?.hash ? 'var(--button-text)' : 'var(--text-disabled)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                cursor: selectedFile?.hash ? 'pointer' : 'not-allowed',
                minWidth: '140px',
              }}
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Searching...
                </>
              ) : (
                <>
                  <i className="fas fa-search"></i> Find Subtitles
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info Box */}
        {selectedFile && !error && (
          <div style={{
            marginTop: '20px',
            padding: '12px 16px',
            background: 'var(--info-bg, #e7f3ff)',
            border: '1px solid var(--info-border, #b3d9ff)',
            borderRadius: '6px',
            fontSize: '13px',
            color: 'var(--info-text, #014361)',
          }}>
            <i className="fas fa-info-circle"></i> <strong>File-based search</strong> uses a unique fingerprint of your video file to find exact subtitle matches, even if the filename has been changed. Leave language as "All Languages" to see subtitles in all available languages.
          </div>
        )}
      </form>
    </div>
  );
}

export default FileSearchForm;
