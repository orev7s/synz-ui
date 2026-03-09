import { useState, useEffect } from 'react';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { Dashboard } from './components/dashboard/Dashboard';
import { loadQuickExecuteSettings } from './stores/quickExecuteStore';

import { colors } from './config/theme';
import './styles/globals.css';

type AppView = 'loading' | 'dashboard';

function App() {
  const [view, setView] = useState<AppView>('loading');

  useEffect(() => {
    const initializeDashboard = async () => {
      const win = getCurrentWindow();
      await win.setMinSize(new LogicalSize(600, 400));
      await win.setSize(new LogicalSize(1200, 700));
      await win.setResizable(true);
      await win.center();
      setView('dashboard');
    };

    initializeDashboard();
  }, []);

  useEffect(() => {
    if (view === 'dashboard') {
      loadQuickExecuteSettings();
    }
  }, [view]);

  if (view === 'dashboard') {
    return <Dashboard />;
  }

  if (view === 'loading') {
    return (
      <div
        style={{
          height: '100%',
          background: colors.bgDark,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div
          style={{
            width: 28,
            height: 28,
            border: '2px solid #222',
            borderTopColor: colors.primary,
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
          }}
        />
      </div>
    );
  }

  return <Dashboard />;
}

export default App;