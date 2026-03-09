import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { QuickExecuteWindow } from './components/dashboard/QuickExecute/QuickExecuteWindow';
import { DetachedWindow } from './components/dashboard/DetachedWindow';

function blockDevTools() {
  document.addEventListener('keydown', (e) => {
    const blocked =
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
      (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) ||
      (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) ||
      (e.ctrlKey && (e.key === 'u' || e.key === 'U')) ||
      (e.ctrlKey && (e.key === 'p' || e.key === 'P')) ||
      (e.ctrlKey && (e.key === 's' || e.key === 'S')) ||
      (e.ctrlKey && (e.key === 'g' || e.key === 'G'));

    if (blocked) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return false;
    }
  }, { capture: true });
}

blockDevTools();

const params = new URLSearchParams(window.location.search);
const windowType = params.get('window');

function RootComponent() {
  if (windowType === 'quick-execute') {
    return <QuickExecuteWindow />;
  }

  if (windowType === 'detached') {
    const tabId = params.get('tabId') || '';
    const tabType = (params.get('tabType') || 'editor') as 'editor' | 'explorer' | 'scripthub' | 'settings';
    const tabTitle = params.get('tabTitle') || 'Detached';
    const fileId = params.get('fileId') || undefined;
    const sourcePaneId = params.get('sourcePaneId') || '';
    const contentKey = params.get('contentKey') || undefined;

    return (
      <DetachedWindow
        tabId={tabId}
        tabType={tabType}
        tabTitle={tabTitle}
        fileId={fileId}
        sourcePaneId={sourcePaneId}
        contentKey={contentKey}
      />
    );
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>,
);
