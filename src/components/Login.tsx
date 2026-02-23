import React, { useState } from 'react';

interface LoginProps {
  onLogin: (username: string, password: string, apiKey: string) => Promise<boolean>;
  setAppProcessing: (processing: boolean, task?: string) => void;
  loginError?: string | null;
}

function Login({ onLogin, setAppProcessing, loginError }: LoginProps) {
  const [username, setUsername] = useState(() => localStorage.getItem('lastUsername') || '');
  const [password, setPassword] = useState('');
  const [apiKey] = useState('YzhaGkIg6dMSJ47QoihkhikfRmvbJTn7');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [loginAttempted, setLoginAttempted] = useState(false);

  // Show API error (from context) if available, otherwise local error
  const displayError = loginError || localError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || isLoading || loginAttempted) return;
    
    setLoginAttempted(true);
    setIsLoading(true);
    setLocalError('');
    setAppProcessing(true, 'Logging in...');
    try {
      const success = await onLogin(username, password, apiKey);
      if (success) {
        localStorage.setItem('lastUsername', username);
      } else {
        setLocalError('Login failed. Please check your credentials.');
        setAppProcessing(true, 'Login failed');
        setTimeout(() => setAppProcessing(false), 3000);
      }
    } catch {
      setLocalError('Login failed. Please try again.');
      setAppProcessing(true, 'Login failed');
      setTimeout(() => setAppProcessing(false), 3000);
    } finally {
      setIsLoading(false);
      setTimeout(() => setLoginAttempted(false), 2000);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '5px auto 20px auto', textAlign: 'center' }}>
      <div style={{ marginBottom: '10px' }}>
        <img
          src="./logo.png"
          alt="AI.Opensubtitles.com Logo"
          style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }}
        />
      </div>

      <h1 style={{ marginBottom: '10px', fontSize: '16px' }}>Welcome to AI.Opensubtitles.com</h1>
      <p style={{ marginBottom: '20px', textAlign: 'left' }}>Please enter your OpenSubtitles.com credentials to continue.</p>

      {displayError && (
        <div className="status-message error">{displayError}</div>
      )}

      <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
        <div className="form-group">
          <label htmlFor="username">Username:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="apiKey">API Key:</label>
          <input
            type="text"
            id="apiKey"
            value={apiKey}
            disabled={true}
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              cursor: 'not-allowed'
            }}
          />
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            <i className="fas fa-lock" style={{ marginRight: '4px' }}></i>
            Pre-configured API key
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={isLoading || !username || !password}
          style={{ width: '100%' }}
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

export default Login;
