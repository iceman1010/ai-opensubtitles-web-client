import React, { useEffect, useCallback, useState } from 'react';
import ReactDOM from 'react-dom';
import { CommitEntry, fetchChangelog, clearChangelogCache } from '../services/githubApi';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function CommitItem({ commit }: { commit: CommitEntry }) {
  return (
    <a
      href={commit.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        gap: '12px',
        padding: '12px 16px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'background-color 0.15s ease',
        borderBottom: '1px solid var(--border-color)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <img
        src={commit.avatarUrl}
        alt={commit.author}
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          flexShrink: 0,
          backgroundColor: 'var(--bg-tertiary)',
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).src = `https://github.com/ghost.png`;
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: 'var(--text-primary)',
          fontSize: '14px',
          lineHeight: '1.4',
          wordBreak: 'break-word',
        }}>
          {commit.message}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '6px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
        }}>
          <span>{commit.author}</span>
          <span style={{ color: 'var(--border-color)' }}>·</span>
          <span>{formatDate(commit.date)}</span>
          <span style={{ color: 'var(--border-color)' }}>·</span>
          <span>{formatTime(commit.date)}</span>
        </div>
      </div>
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: '11px',
          color: 'var(--text-tertiary)',
          backgroundColor: 'var(--bg-tertiary)',
          padding: '2px 6px',
          borderRadius: '4px',
          flexShrink: 0,
          alignSelf: 'flex-start',
        }}
      >
        {commit.shortSha}
      </span>
    </a>
  );
}

function DateSeparator({ date }: { date: Date }) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let label = formatDate(date);
  if (isSameDay(date, today)) {
    label = 'Today';
  } else if (isSameDay(date, yesterday)) {
    label = 'Yesterday';
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        backgroundColor: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 1,
      }}
    >
      <span
        style={{
          fontSize: '12px',
          fontWeight: '600',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChangelog = useCallback(async (forceRefresh: boolean = false) => {
    if (forceRefresh) {
      clearChangelogCache();
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchChangelog(25);
      setCommits(data);
    } catch (err) {
      setError('Failed to load changelog. Please try again.');
      console.error('Changelog error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && commits.length === 0) {
      loadChangelog();
    }
  }, [isOpen, commits.length, loadChangelog]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const groupedCommits: { date: Date; commits: CommitEntry[] }[] = [];
  let currentGroup: { date: Date; commits: CommitEntry[] } | null = null;

  for (const commit of commits) {
    if (!currentGroup || !isSameDay(currentGroup.date, commit.date)) {
      currentGroup = { date: commit.date, commits: [] };
      groupedCommits.push(currentGroup);
    }
    currentGroup.commits.push(commit);
  }

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '12px',
          width: '90vw',
          maxWidth: '700px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-color)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <i className="fas fa-history" style={{ color: 'var(--primary-color)' }}></i>
            Changelog
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => loadChangelog(true)}
              disabled={isLoading}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                padding: '6px 10px',
                borderRadius: '4px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                opacity: isLoading ? 0.5 : 1,
              }}
              title="Refresh"
            >
              <i className={`fas fa-sync-alt${isLoading ? ' fa-spin' : ''}`}></i>
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px 8px',
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
          }}
        >
          {isLoading && commits.length === 0 ? (
            <div
              style={{
                padding: '60px 20px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px' }}></i>
              <p style={{ marginTop: '12px' }}>Loading changelog...</p>
            </div>
          ) : error ? (
            <div
              style={{
                padding: '60px 20px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              <i className="fas fa-exclamation-circle" style={{ fontSize: '24px', color: 'var(--danger-color)' }}></i>
              <p style={{ marginTop: '12px' }}>{error}</p>
              <button
                onClick={() => loadChangelog(true)}
                style={{
                  marginTop: '16px',
                  padding: '8px 16px',
                  backgroundColor: 'var(--primary-color)',
                  color: 'var(--button-text)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Try Again
              </button>
            </div>
          ) : (
            groupedCommits.map((group, groupIndex) => (
              <div key={groupIndex}>
                <DateSeparator date={group.date} />
                {group.commits.map((commit) => (
                  <CommitItem key={commit.sha} commit={commit} />
                ))}
              </div>
            ))
          )}
        </div>

        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          <a
            href="https://github.com/iceman1010/ai-opensubtitles-web-client/commits"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            View full history on GitHub
            <i className="fas fa-external-link-alt" style={{ fontSize: '10px' }}></i>
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ChangelogModal;
