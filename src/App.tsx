import React, { useState, useEffect, useCallback } from 'react';
import Login from './components/Login';
import Credits from './components/Credits';
import MainScreen from './components/MainScreen';
import BatchScreen from './components/BatchScreen';
import RecentMedia from './components/RecentMedia';
import Search from './components/Search';
import { APIProvider, useAPI } from './contexts/APIContext';
import { storageService, AppConfig } from './services/storageService';
import { activityTracker } from './utils/activityTracker';
import { logger } from './utils/errorLogger';
import appConfig from './config/appConfig.json';

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

  const hasCredentials = config?.username && config?.password && config?.apiKey;

  return (
    <APIProvider>
      <AppContent
        config={config}
        setConfig={setConfig}
        hasCredentials={!!hasCredentials}
      />
    </APIProvider>
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
    credits,
    error: apiError,
    login,
    logout,
    autoLogin,
    updateCredits,
    updateConfig,
  } = useAPI();

  const [currentScreen, setCurrentScreen] = useState<'login' | 'main' | 'batch' | 'recent-media' | 'search' | 'credits'>('main');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTask, setCurrentTask] = useState<string | undefined>(undefined);
  const [isApiActive, setIsApiActive] = useState(false);

  // Auto-login on mount
  useEffect(() => {
    if (hasCredentials) {
      autoLogin();
    }
  }, [hasCredentials, autoLogin]);

  // Route to login if no credentials
  useEffect(() => {
    if (!hasCredentials) {
      setCurrentScreen('login');
    } else if (currentScreen === 'login' && isAuthenticated) {
      setCurrentScreen('main');
    }
  }, [hasCredentials, isAuthenticated, currentScreen]);

  // Track API activity for logo glow
  useEffect(() => {
    const cleanup = activityTracker.addListener({
      onActivityStart: () => setIsApiActive(true),
      onActivityEnd: () => setIsApiActive(false)
    });
    if (activityTracker.isActive()) setIsApiActive(true);
    return cleanup;
  }, []);

  const setAppProcessing = (processing: boolean, task?: string) => {
    setIsProcessing(processing);
    setCurrentTask(processing ? task : undefined);
  };

  const handleLogin = async (username: string, password: string, apiKey: string): Promise<boolean> => {
    try {
      setAppProcessing(true, 'Validating credentials...');
      const success = await login(username, password, apiKey);
      if (success) {
        setConfig(storageService.getConfig());
        setCurrentScreen('main');
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

  const handleScreenChange = (screen: typeof currentScreen) => {
    setCurrentScreen(screen);
    setTimeout(() => {
      const el = document.querySelector('.main-content');
      if (el) el.scrollTop = 0;
    }, 0);
  };

  const handleDarkModeToggle = () => {
    const newDarkMode = !config?.darkMode;
    updateConfig({ darkMode: newDarkMode });
    setConfig(storageService.getConfig());
  };

  return (
    <div className="app">
      {currentScreen !== 'login' && (
        <div className="sidebar">
          <h2>{appConfig.name}</h2>
          <nav>
            <ul>
              <li>
                <button
                  className={currentScreen === 'main' ? 'active' : ''}
                  onClick={() => handleScreenChange('main')}
                >
                  <i className="fas fa-file-audio"></i>
                  <span>Single File</span>
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'batch' ? 'active' : ''}
                  onClick={() => handleScreenChange('batch')}
                >
                  <i className="fas fa-layer-group"></i>
                  <span>Batch</span>
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'recent-media' ? 'active' : ''}
                  onClick={() => handleScreenChange('recent-media')}
                >
                  <i className="fas fa-history"></i>
                  <span>Recent Media</span>
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'search' ? 'active' : ''}
                  onClick={() => handleScreenChange('search')}
                >
                  <i className="fas fa-search"></i>
                  <span>Search</span>
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'credits' ? 'active' : ''}
                  onClick={() => handleScreenChange('credits')}
                >
                  <i className="fas fa-coins"></i>
                  <span>Credits</span>
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
            Web v1.0.0
          </div>
        </div>
      )}

      <div className="main-content">
        {currentScreen === 'login' && (
          <Login onLogin={handleLogin} setAppProcessing={setAppProcessing} loginError={apiError} />
        )}
        {currentScreen === 'main' && config && (
          <MainScreen
            config={config}
            setAppProcessing={setAppProcessing}
            onNavigateToCredits={() => handleScreenChange('credits')}
            onCreditsUpdate={handleCreditsUpdate}
            onProcessingStateChange={(p) => setIsProcessing(p)}
          />
        )}
        {currentScreen === 'batch' && config && (
          <BatchScreen
            config={config}
            setAppProcessing={setAppProcessing}
            onProcessingStateChange={(p) => setIsProcessing(p)}
          />
        )}
        {currentScreen === 'recent-media' && config && (
          <RecentMedia
            setAppProcessing={setAppProcessing}
            isVisible={true}
          />
        )}
        {currentScreen === 'search' && config && (
          <Search
            setAppProcessing={setAppProcessing}
          />
        )}
        {currentScreen === 'credits' && config && (
          <Credits
            config={config}
            setAppProcessing={setAppProcessing}
            isVisible={true}
          />
        )}
      </div>

      {/* Floating Credits Display */}
      {credits && currentScreen !== 'login' && (
        <div
          onClick={() => setCurrentScreen('credits')}
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
        </div>
      )}

      {/* Status Bar */}
      <div className="status-bar">
        {isProcessing && currentTask ? (
          <span><i className="fas fa-spinner fa-spin" style={{ marginRight: '6px' }}></i>{currentTask}</span>
        ) : (
          <span>Ready</span>
        )}
      </div>
    </div>
  );
}

export default App;
