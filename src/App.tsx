import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Login from './components/Login';
import Credits from './components/Credits';
import MainScreen from './components/MainScreen';
import BatchScreen from './components/BatchScreen';
import RecentMedia from './components/RecentMedia';
import Search from './components/Search';
import Info from './components/Info';
import Preferences from './components/Preferences';
import Help from './components/Help';
import SEO from './components/SEO';
import ProtectedRoute from './components/ProtectedRoute';
import { APIProvider, useAPI } from './contexts/APIContext';
import { storageService, AppConfig } from './services/storageService';
import { activityTracker } from './utils/activityTracker';
import { setupNetworkListeners, isOnline } from './utils/networkUtils';
import { logger } from './utils/errorLogger';
import appConfig from './config/appConfig.json';
import packageJson from '../package.json';

// Auto-detect base path from the built script's resolved URL.
// In production at /ai-web/, the script resolves to /ai-web/assets/index-xxx.js → basename "/ai-web".
// In dev or root deployment, falls back to "".
function getBasePath(): string {
  const script = document.querySelector('script[src*="assets/"]') as HTMLScriptElement | null;
  if (script) {
    try {
      const url = new URL(script.src);
      return url.pathname.replace(/\/assets\/.*$/, '') || '';
    } catch { /* fall through */ }
  }
  return '';
}

const basePath = getBasePath();

function getEndpointDisplay(context: string): string {
  if (!context) return 'API';
  const lowercased = context.toLowerCase();
  if (lowercased.includes('transcription') || lowercased.includes('transcribe')) return 'transcription';
  if (lowercased.includes('translation') || lowercased.includes('translate')) return 'translation';
  if (lowercased.includes('login') || lowercased.includes('auth')) return 'login';
  if (lowercased.includes('credits')) return 'credits';
  if (lowercased.includes('language') || lowercased.includes('detect')) return 'language';
  if (lowercased.includes('services') || lowercased.includes('info')) return 'info';
  if (lowercased.includes('packages') || lowercased.includes('credit')) return 'packages';
  if (lowercased.includes('download')) return 'download';
  const words = context.toLowerCase().split(/[\s\-_/]+/).filter(w => w.length > 2);
  return words.length > 0 ? words[words.length - 1] : 'API';
}

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const el = document.querySelector('.main-content');
    if (el) el.scrollTop = 0;
  }, [pathname]);

  return null;
}

function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loaded = storageService.getConfig();
    setConfig(loaded);
    setIsLoading(false);

    if (loaded?.darkMode) {
      document.documentElement.classList.add('dark-mode');
    }
    if (loaded?.debugLevel !== undefined) {
      logger.setDebugLevel(loaded.debugLevel);
    }
  }, []);

  useEffect(() => {
    if (config?.darkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, [config?.darkMode]);

  if (isLoading) {
    return <div className="app"><div className="main-content"><p>Loading...</p></div></div>;
  }

  const hasCredentials = !!(config?.username && config?.password && config?.apiKey);

  return (
    <HelmetProvider>
      <Router basename={basePath}>
        <APIProvider>
          <AppContent
            config={config}
            setConfig={setConfig}
            hasCredentials={hasCredentials}
          />
        </APIProvider>
      </Router>
    </HelmetProvider>
  );
}

// ── Inner component that consumes APIContext ──
function AppContent({
  config,
  setConfig,
  hasCredentials,
}: {
  config: AppConfig | null;
  setConfig: (config: AppConfig) => void;
  hasCredentials: boolean;
}) {
  const {
    isAuthenticated,
    isAuthenticating,
    credits,
    error: apiError,
    login,
    autoLogin,
    reconnect,
    sessionExpired,
    updateCredits,
    logout,
    updateConfig,
  } = useAPI();

  const navigate = useNavigate();
  const location = useLocation();

  const [isProcessing, setIsProcessing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [currentTask, setCurrentTask] = useState<string | undefined>(undefined);
  const [isApiActive, setIsApiActive] = useState(false);
  const [currentApiContext, setCurrentApiContext] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [showConnectionChange, setShowConnectionChange] = useState(false);
  const [notification, setNotification] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [displayedNotification, setDisplayedNotification] = useState<string>('');
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [displayedTask, setDisplayedTask] = useState<string | undefined>(undefined);
  const [lastTaskUpdate, setLastTaskUpdate] = useState<number>(Date.now());
  const [lastNotificationUpdate, setLastNotificationUpdate] = useState<number>(Date.now());

  // Auto-login on mount
  useEffect(() => {
    if (hasCredentials) {
      autoLogin();
    }
  }, [hasCredentials, autoLogin]);

  // Track API activity for logo glow and status bar
  useEffect(() => {
    const cleanup = activityTracker.addListener({
      onActivityStart: (context) => {
        setIsApiActive(true);
        setCurrentApiContext(context || null);
      },
      onActivityEnd: () => {
        setIsApiActive(false);
        setCurrentApiContext(null);
      },
      onContextUpdate: (contexts) => {
        setCurrentApiContext(contexts.length > 0 ? contexts[contexts.length - 1] : null);
      }
    });
    if (activityTracker.isActive()) setIsApiActive(true);
    return cleanup;
  }, []);

  // Track network online/offline status
  useEffect(() => {
    const cleanup = setupNetworkListeners(
      () => {
        setIsOnline(true);
        setShowConnectionChange(true);
        setTimeout(() => setShowConnectionChange(false), 5000);
      },
      () => {
        setIsOnline(false);
        setShowConnectionChange(true);
      }
    );
    return cleanup;
  }, []);

  // Handle minimum display time for processing status
  useEffect(() => {
    const MIN_DISPLAY_TIME = 1500;

    if (isProcessing && currentTask) {
      setDisplayedTask(currentTask);
      setLastTaskUpdate(Date.now());
    } else if (!isProcessing && displayedTask) {
      const elapsed = Date.now() - lastTaskUpdate;
      const remaining = Math.max(0, MIN_DISPLAY_TIME - elapsed);

      if (remaining > 0) {
        const timeoutId = setTimeout(() => {
          setDisplayedTask(undefined);
        }, remaining);
        return () => clearTimeout(timeoutId);
      } else {
        setDisplayedTask(undefined);
      }
    }
  }, [isProcessing, currentTask, displayedTask, lastTaskUpdate]);

  // Handle minimum display time for notifications
  useEffect(() => {
    const MIN_DISPLAY_TIME = 2000;

    if (notification.visible && notification.message) {
      setDisplayedNotification(notification.message);
      setLastNotificationUpdate(Date.now());
    } else if (!notification.visible && displayedNotification) {
      const elapsed = Date.now() - lastNotificationUpdate;
      const remaining = Math.max(0, MIN_DISPLAY_TIME - elapsed);

      if (remaining > 0) {
        const timeoutId = setTimeout(() => {
          setDisplayedNotification('');
        }, remaining);
        return () => clearTimeout(timeoutId);
      } else {
        setDisplayedNotification('');
      }
    }
  }, [notification, displayedNotification, lastNotificationUpdate]);

  const setAppProcessing = (processing: boolean, task?: string) => {
    setIsProcessing(processing);
    setCurrentTask(processing ? task : undefined);
  };

  const handleLogin = async (username: string, password: string, apiKey: string, rememberMe: boolean = false): Promise<boolean> => {
    try {
      setAppProcessing(true, 'Validating credentials...');
      const success = await login(username, password, apiKey, rememberMe);
      if (success) {
        setConfig(storageService.getConfig());
        navigate('/'); // Navigate to main screen on success
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setAppProcessing(false);
    }
  };

  const handleCreditsUpdate = (creditsData: { used: number; remaining: number }) => {
    updateCredits(creditsData);
  };

  const handleDarkModeToggle = () => {
    const newDarkMode = !config?.darkMode;
    updateConfig({ darkMode: newDarkMode });
    setConfig(storageService.getConfig());
  };

  const isLoginPage = location.pathname === '/login';

  return (
    <div className="app">
      <ScrollToTop />
      {!isLoginPage && (
        <div className="sidebar">
          <h2>{appConfig.name}</h2>
          <nav>
            <ul>
              <li>
                <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''} end>
                  <i className="fas fa-file-audio"></i>
                  <span>Single File</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/batch" className={({ isActive }) => isActive ? 'active' : ''}>
                  <i className="fas fa-layer-group"></i>
                  <span>Batch</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/recent" className={({ isActive }) => isActive ? 'active' : ''}>
                  <i className="fas fa-history"></i>
                  <span>Recent Media</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/search" className={({ isActive }) => isActive ? 'active' : ''}>
                  <i className="fas fa-search"></i>
                  <span>Search</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/info" className={({ isActive }) => isActive ? 'active' : ''}>
                  <i className="fas fa-info-circle"></i>
                  <span>Info</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/credits" className={({ isActive }) => isActive ? 'active' : ''}>
                  <i className="fas fa-coins"></i>
                  <span>Credits</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/preferences" className={({ isActive }) => isActive ? 'active' : ''}>
                  <i className="fas fa-cog"></i>
                  <span>Preferences</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/help" className={({ isActive }) => isActive ? 'active' : ''}>
                  <i className="fas fa-question-circle"></i>
                  <span>Help</span>
                </NavLink>
              </li>
              <li>
                <button onClick={() => setShowLogoutModal(true)}>
                  <i className="fas fa-sign-out-alt"></i>
                  <span>Logout</span>
                </button>
              </li>
            </ul>
          </nav>

          {/* Dark Mode Toggle */}
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center'
          }}>
            <button
              onClick={handleDarkModeToggle}
              style={{
                background: 'transparent',
                border: '2px solid var(--sidebar-text)',
                borderRadius: '20px',
                color: 'var(--sidebar-text)',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
                minWidth: '100px',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <i className={`fas ${config?.darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
              {config?.darkMode ? 'Light' : 'Dark'}
            </button>
          </div>

          {/* Logo */}
          <div style={{
            position: 'absolute',
            bottom: '90px',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            padding: '0 10px',
            width: 'calc(100% - 40px)'
          }}>
            <img
              src="./logo.png"
              alt="Logo"
              className={isApiActive ? 'sidebar-logo-glow' : ''}
              style={{ width: '100%', maxWidth: '60px', height: 'auto', borderRadius: '50%' }}
            />
          </div>

          {/* Version */}
          <div className="sidebar-version" style={{ position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)' }}>
            Web v{packageJson.version}
          </div>
        </div>
      )}

      <div className="main-content">
        <Routes>
          <Route path="/login" element={
            <>
              <SEO title="Login" description="Login to AI OpenSubtitles to manage your subtitles." />
              <Login onLogin={handleLogin} setAppProcessing={setAppProcessing} loginError={apiError} />
            </>
          } />
          
          <Route path="/" element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <SEO title="Transcription & Translation" description="Upload and process single video or audio files." />
              {config && (
                <MainScreen
                  config={config}
                  setAppProcessing={setAppProcessing}
                  onNavigateToCredits={() => navigate('/credits')}
                  onCreditsUpdate={handleCreditsUpdate}
                  onProcessingStateChange={(p) => setIsProcessing(p)}
                  onEstimatedCostChange={setEstimatedCost}
                />
              )}
            </ProtectedRoute>
          } />

          <Route path="/batch" element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <SEO title="Batch Processing" description="Process multiple files at once." />
              {config && (
                <BatchScreen
                  config={config}
                  setAppProcessing={setAppProcessing}
                  onProcessingStateChange={(p) => setIsProcessing(p)}
                  onEstimatedCostChange={setEstimatedCost}
                />
              )}
            </ProtectedRoute>
          } />

          <Route path="/recent" element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <SEO title="Recent Media" description="View your recently processed media files." />
              {config && (
                <RecentMedia
                  setAppProcessing={setAppProcessing}
                  isVisible={true}
                />
              )}
            </ProtectedRoute>
          } />

          <Route path="/search" element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <SEO title="Search" description="Search for subtitles in the OpenSubtitles database." />
              {config && (
                <Search
                  setAppProcessing={setAppProcessing}
                />
              )}
            </ProtectedRoute>
          } />

          <Route path="/info" element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <SEO title="Info" description="AI model information and pricing details." />
              <Info setAppProcessing={setAppProcessing} />
            </ProtectedRoute>
          } />

          <Route path="/credits" element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <SEO title="Credits" description="Manage your AI OpenSubtitles credits." />
              {config && (
                <Credits
                  config={config}
                  setAppProcessing={setAppProcessing}
                  isVisible={true}
                />
              )}
            </ProtectedRoute>
          } />
          
          <Route path="/preferences" element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <SEO title="Preferences" description="Configure application settings." />
              <Preferences setAppProcessing={setAppProcessing} />
            </ProtectedRoute>
          } />

          <Route path="/help" element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <SEO title="Help" description="Help and documentation for using AI OpenSubtitles." />
              <Help />
            </ProtectedRoute>
          } />

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* Floating Credits Display */}
      {credits && !isLoginPage && (
        <div
          onClick={() => navigate('/credits')}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: 1000,
            color: 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
          }}
        >
          <i className="fas fa-coins" style={{ color: 'var(--text-primary)', marginRight: '6px' }}></i>
          Credits: <strong>{credits.remaining}</strong>
          {estimatedCost !== null && (
            <div style={{
              fontSize: '12px',
              color: estimatedCost === 0 ? 'var(--success-color)' : estimatedCost > credits.remaining ? 'var(--danger-color)' : 'var(--text-muted)',
              marginTop: '4px',
              fontWeight: estimatedCost > credits.remaining ? '600' : '400'
            }}>
              Est. cost: {estimatedCost === 0 ? 'Free' : `~${estimatedCost.toFixed(1)}`}
            </div>
          )}
        </div>
      )}

      {/* Status Bar */}
      <div className="status-bar">
        {/* Network Status */}
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: isOnline ? 'var(--success-color)' : 'var(--danger-color)',
          fontWeight: !isOnline ? 600 : 500
        }}>
          <i className={isOnline ? 'fas fa-circle' : 'fas fa-exclamation-triangle'} style={{ fontSize: '8px' }}></i>
          {showConnectionChange ? (isOnline ? 'Connected' : 'Offline') : (isOnline ? 'Online' : 'Offline')}
        </span>

        {/* API Activity Indicator */}
        {isApiActive && (
          <>
            <span className="status-separator">|</span>
            <span style={{ color: '#6f42c1', fontWeight: 500 }}>
              <i className="fas fa-sync-alt status-pulsing" style={{ marginRight: '4px' }}></i>
              {currentApiContext ? getEndpointDisplay(currentApiContext) : 'API'}
            </span>
          </>
        )}

        {/* Processing Status */}
        {displayedTask && (
          <>
            <span className="status-separator">|</span>
            <span style={{
              color: displayedTask.toLowerCase().includes('error') || displayedTask.toLowerCase().includes('failed')
                ? 'var(--danger-color)' : 'var(--accent-color)',
              fontWeight: 600
            }}>
              <i className={`fas ${displayedTask.toLowerCase().includes('error') || displayedTask.toLowerCase().includes('failed') ? 'fa-times' : 'fa-spinner fa-spin'}`} style={{ marginRight: '4px' }}></i>
              {displayedTask}
            </span>
          </>
        )}

        {/* Notification */}
        {displayedNotification && (
          <>
            <span className="status-separator">|</span>
            <span style={{ color: '#fd7e14', fontWeight: 500 }}>
              <i className="fas fa-info-circle" style={{ marginRight: '4px' }}></i>
              {displayedNotification}
            </span>
          </>
        )}

        {/* Default when nothing is happening */}
        {!isApiActive && !displayedTask && !displayedNotification && !isOnline && (
          <span style={{ color: 'var(--danger-color)' }}>Disconnected</span>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && ReactDOM.createPortal(
        <div className="logout-modal-overlay" onClick={() => setShowLogoutModal(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowLogoutModal(false); }}>
          <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to log out?</p>
            <div className="logout-modal-actions">
              <button className="btn-secondary" onClick={() => setShowLogoutModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={() => { setShowLogoutModal(false); logout(); navigate('/login'); }}>
                Logout
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Session Expired Modal */}
      {sessionExpired && ReactDOM.createPortal(
        <div className="session-expired-overlay">
          <div className="session-expired-modal">
            <i className="fas fa-exclamation-triangle session-expired-icon"></i>
            <h3>Session Expired</h3>
            <p>Your authentication token has expired.</p>
            <div className="session-expired-actions">
              <button
                className="btn-primary"
                onClick={async () => {
                  const success = await reconnect();
                  if (!success) {
                    navigate('/login');
                  }
                }}
                disabled={isAuthenticating}
              >
                {isAuthenticating ? 'Reconnecting...' : 'Reconnect'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => { logout(); navigate('/login'); }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default App;
