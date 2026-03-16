import React, { useState } from 'react';
import { useAPI } from '../contexts/APIContext';
import CacheManager from '../services/cache';

const DEFAULT_FILENAME_FORMAT = '{filename}.{language_code}.{type}.{extension}';

interface PreferencesProps {
  setAppProcessing: (processing: boolean, task?: string) => void;
}

function Preferences({ setAppProcessing }: PreferencesProps) {
  const { config, updateConfig } = useAPI();
  const [cacheCleared, setCacheCleared] = useState(false);

  const handleClearCache = () => {
    CacheManager.clear();
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 3000);
  };

  const sectionStyle: React.CSSProperties = {
    padding: '20px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    marginBottom: '20px',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '16px',
    paddingBottom: '8px',
    borderBottom: '1px solid var(--border-color)',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '14px',
    color: 'var(--text-primary)',
  };

  const sublabelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginTop: '2px',
  };

  const selectStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    cursor: 'pointer',
    minWidth: '120px',
  };

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: active ? 'var(--success-color)' : 'var(--border-color)',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background-color 0.2s',
    padding: 0,
    flexShrink: 0,
  });

  const toggleKnobStyle = (active: boolean): React.CSSProperties => ({
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    position: 'absolute',
    top: '3px',
    left: active ? '23px' : '3px',
    transition: 'left 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      <h1>Preferences</h1>
      <p style={{ marginBottom: '24px', color: 'var(--text-secondary)' }}>
        Configure application settings. Changes are saved automatically.
      </p>

      {/* Appearance */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <i className="fas fa-palette" style={{ marginRight: '8px' }}></i>
          Appearance
        </div>
        <div style={rowStyle}>
          <div>
            <div style={labelStyle}>Dark Mode</div>
            <div style={sublabelStyle}>Switch between light and dark theme</div>
          </div>
          <button
            style={toggleStyle(!!config?.darkMode)}
            onClick={() => {
              const newVal = !config?.darkMode;
              updateConfig({ darkMode: newVal });
              document.documentElement.classList.toggle('dark-mode', newVal);
            }}
            aria-label="Toggle dark mode"
          >
            <div style={toggleKnobStyle(!!config?.darkMode)} />
          </button>
        </div>
      </div>

      {/* Language Detection */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <i className="fas fa-language" style={{ marginRight: '8px' }}></i>
          Language Detection
        </div>
        <div style={rowStyle}>
          <div>
            <div style={labelStyle}>Auto Language Detection</div>
            <div style={sublabelStyle}>Automatically detect audio language before transcription</div>
          </div>
          <button
            style={toggleStyle(config?.autoLanguageDetection !== false)}
            onClick={() => updateConfig({ autoLanguageDetection: config?.autoLanguageDetection === false })}
            aria-label="Toggle auto language detection"
          >
            <div style={toggleKnobStyle(config?.autoLanguageDetection !== false)} />
          </button>
        </div>
        <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={labelStyle}>Audio Detection Duration</div>
              <div style={sublabelStyle}>Seconds of audio to analyze for language detection</div>
            </div>
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', minWidth: '40px', textAlign: 'right' }}>
              {config?.audio_language_detection_time ?? 240}s
            </span>
          </div>
          <input
            type="range"
            min={60}
            max={300}
            step={10}
            value={config?.audio_language_detection_time ?? 240}
            onChange={(e) => updateConfig({ audio_language_detection_time: Number(e.target.value) })}
            style={{ width: '100%', marginTop: '8px', accentColor: 'var(--button-bg)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <span>60s</span>
            <span>300s</span>
          </div>
        </div>
      </div>

      {/* Filename Format */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <i className="fas fa-file-signature" style={{ marginRight: '8px' }}></i>
          Output Filename Format
        </div>
        <div style={{ padding: '10px 0' }}>
          <div>
            <div style={labelStyle}>Default Filename Format</div>
            <div style={sublabelStyle}>
              Pattern for naming output files. Available placeholders: <code style={{ fontSize: '11px', padding: '1px 4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px' }}>{'{filename}'}</code>, <code style={{ fontSize: '11px', padding: '1px 4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px' }}>{'{language_code}'}</code>, <code style={{ fontSize: '11px', padding: '1px 4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px' }}>{'{language_name}'}</code>, <code style={{ fontSize: '11px', padding: '1px 4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px' }}>{'{type}'}</code>, <code style={{ fontSize: '11px', padding: '1px 4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px' }}>{'{format}'}</code>, <code style={{ fontSize: '11px', padding: '1px 4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px' }}>{'{timestamp}'}</code>
            </div>
          </div>

          <input
            type="text"
            id="default-filename-format"
            value={config?.defaultFilenameFormat || DEFAULT_FILENAME_FORMAT}
            onChange={(e) => updateConfig({ defaultFilenameFormat: e.target.value })}
            placeholder={DEFAULT_FILENAME_FORMAT}
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontFamily: 'monospace',
              boxSizing: 'border-box',
            }}
          />

          {/* Placeholder Buttons */}
          <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {[
              { placeholder: '{filename}', label: 'Filename' },
              { placeholder: '{language_code}', label: 'Lang Code' },
              { placeholder: '{language_name}', label: 'Lang Name' },
              { placeholder: '{type}', label: 'Type' },
              { placeholder: '{format}', label: 'Format' },
              { placeholder: '{timestamp}', label: 'Timestamp' },
            ].map(({ placeholder, label }) => (
              <button
                key={placeholder}
                type="button"
                onClick={() => {
                  const input = document.getElementById('default-filename-format') as HTMLInputElement;
                  if (input) {
                    const start = input.selectionStart || 0;
                    const end = input.selectionEnd || 0;
                    const current = config?.defaultFilenameFormat || DEFAULT_FILENAME_FORMAT;
                    const newValue = current.slice(0, start) + placeholder + current.slice(end);
                    updateConfig({ defaultFilenameFormat: newValue });
                    setTimeout(() => {
                      input.focus();
                      input.setSelectionRange(start + placeholder.length, start + placeholder.length);
                    }, 0);
                  }
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--button-bg)';
                  e.currentTarget.style.color = 'var(--button-text)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Live Preview */}
          <div style={{
            marginTop: '10px',
            padding: '8px 12px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            fontSize: '12px',
          }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '11px' }}>
              Preview:
            </div>
            <div style={{ fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: '500' }}>
              {(() => {
                const sampleData: Record<string, string> = {
                  filename: 'movie',
                  language_code: 'en',
                  language_name: 'English',
                  type: 'transcription',
                  format: 'srt',
                  extension: 'srt',
                  timestamp: '2025-09-30T14-30-15',
                };
                let preview = config?.defaultFilenameFormat || DEFAULT_FILENAME_FORMAT;
                Object.entries(sampleData).forEach(([key, value]) => {
                  preview = preview.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
                });
                return preview || 'Enter a format above';
              })()}
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', fontStyle: 'italic' }}>
            Default: {'{filename}.{language_code}.{type}.{extension}'} — Use dots as separators
          </div>
        </div>
      </div>

      {/* API & Polling */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          <i className="fas fa-server" style={{ marginRight: '8px' }}></i>
          API & Polling
        </div>
        <div style={rowStyle}>
          <div>
            <div style={labelStyle}>Polling Interval</div>
            <div style={sublabelStyle}>How often to check task status</div>
          </div>
          <select
            style={selectStyle}
            value={config?.pollingIntervalSeconds ?? 10}
            onChange={(e) => updateConfig({ pollingIntervalSeconds: Number(e.target.value) })}
          >
            <option value={5}>5 seconds</option>
            <option value={10}>10 seconds</option>
            <option value={15}>15 seconds</option>
            <option value={20}>20 seconds</option>
            <option value={30}>30 seconds</option>
            <option value={60}>60 seconds</option>
          </select>
        </div>
        <div style={rowStyle}>
          <div>
            <div style={labelStyle}>Polling Timeout</div>
            <div style={sublabelStyle}>Maximum time to wait for task completion</div>
          </div>
          <select
            style={selectStyle}
            value={config?.pollingTimeoutSeconds ?? 7200}
            onChange={(e) => updateConfig({ pollingTimeoutSeconds: Number(e.target.value) })}
          >
            <option value={300}>5 minutes</option>
            <option value={600}>10 minutes</option>
            <option value={1800}>30 minutes</option>
            <option value={3600}>1 hour</option>
            <option value={7200}>2 hours</option>
            <option value={14400}>4 hours</option>
            <option value={86400}>24 hours</option>
          </select>
        </div>
        <div style={rowStyle}>
          <div>
            <div style={labelStyle}>Cache Expiration</div>
            <div style={sublabelStyle}>How long to keep cached API responses</div>
          </div>
          <select
            style={selectStyle}
            value={config?.cacheExpirationHours ?? 24}
            onChange={(e) => updateConfig({ cacheExpirationHours: Number(e.target.value) })}
          >
            <option value={1}>1 hour</option>
            <option value={6}>6 hours</option>
            <option value={12}>12 hours</option>
            <option value={24}>24 hours</option>
            <option value={48}>48 hours</option>
            <option value={168}>1 week</option>
          </select>
        </div>
        <div style={{ ...rowStyle, borderTop: '1px solid var(--border-color)', marginTop: '4px', paddingTop: '14px' }}>
          <div>
            <div style={labelStyle}>Clear Cache</div>
            <div style={sublabelStyle}>Remove all cached data to free storage</div>
          </div>
          <button
            onClick={handleClearCache}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: '1px solid var(--danger-color)',
              backgroundColor: cacheCleared ? 'var(--success-color)' : 'transparent',
              color: cacheCleared ? '#fff' : 'var(--danger-color)',
              fontSize: '13px',
              fontWeight: '500',
              cursor: cacheCleared ? 'default' : 'pointer',
              transition: 'all 0.2s',
            }}
            disabled={cacheCleared}
          >
            {cacheCleared ? (
              <><i className="fas fa-check" style={{ marginRight: '6px' }}></i>Cleared!</>
            ) : (
              <><i className="fas fa-trash" style={{ marginRight: '6px' }}></i>Clear Now</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Preferences;
