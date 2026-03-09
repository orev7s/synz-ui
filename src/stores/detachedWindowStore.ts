import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';

export interface DetachedTab {
  id: string;
  windowLabel: string;
  tabId: string;
  tabType: 'editor' | 'explorer' | 'scripthub' | 'settings';
  tabTitle: string;
  fileId?: string;
  content?: string;
  sourcePaneId: string;
}

interface DetachedWindowState {
  detachedTabs: DetachedTab[];
}

let state: DetachedWindowState = {
  detachedTabs: [],
};

const listeners = new Set<() => void>();
let windowCounter = 0;
const reattachCallbacks = new Map<string, (tab: DetachedTab) => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function getDetachedWindowState(): DetachedWindowState {
  return state;
}

export function subscribeDetachedWindows(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDetachedTabs(): DetachedTab[] {
  return state.detachedTabs;
}

export function isTabDetached(tabId: string): boolean {
  return state.detachedTabs.some((t) => t.tabId === tabId);
}

export function onTabReattach(windowLabel: string, callback: (tab: DetachedTab) => void): void {
  reattachCallbacks.set(windowLabel, callback);
}

export async function detachTab(
  tabId: string,
  tabType: 'editor' | 'explorer' | 'scripthub' | 'settings',
  tabTitle: string,
  sourcePaneId: string,
  x: number,
  y: number,
  fileId?: string,
  content?: string,
  onReattach?: (tab: DetachedTab) => void
): Promise<string | null> {
  const windowLabel = `detached-${++windowCounter}-${Date.now()}`;

  const contentKey = `detached_content_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  if (content) {
    try {
      localStorage.setItem(contentKey, content);
    } catch {}
  }

  const params = new URLSearchParams({
    window: 'detached',
    tabId,
    tabType,
    tabTitle,
    sourcePaneId,
    contentKey,
  });

  if (fileId) params.set('fileId', fileId);

  const detachedTab: DetachedTab = {
    id: `${tabId}-${Date.now()}`,
    windowLabel,
    tabId,
    tabType,
    tabTitle,
    fileId,
    content,
    sourcePaneId,
  };

  if (onReattach) {
    reattachCallbacks.set(windowLabel, onReattach);
  }

  try {
    const win = new WebviewWindow(windowLabel, {
      url: `index.html?${params.toString()}`,
      title: tabTitle,
      width: tabType === 'explorer' ? 900 : 700,
      height: tabType === 'explorer' ? 600 : 450,
      x: Math.max(0, Math.round(x)),
      y: Math.max(0, Math.round(y)),
      resizable: true,
      decorations: false,
      transparent: true,
      visible: true,
      alwaysOnTop: true,
      focus: true,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Window creation timeout'));
      }, 5000);

      win.once('tauri://created', () => {
        clearTimeout(timeout);
        resolve();
      });

      win.once('tauri://error', (e) => {
        clearTimeout(timeout);
        reject(e);
      });
    });

    state = {
      ...state,
      detachedTabs: [...state.detachedTabs, detachedTab],
    };
    notify();

    return windowLabel;
  } catch (e) {
    console.error('Failed to create detached window:', e);
    reattachCallbacks.delete(windowLabel);
    return null;
  }
}

export async function reattachTab(windowLabel: string): Promise<DetachedTab | null> {
  const tab = state.detachedTabs.find((t) => t.windowLabel === windowLabel);
  if (!tab) return null;

  state = {
    ...state,
    detachedTabs: state.detachedTabs.filter((t) => t.windowLabel !== windowLabel),
  };
  notify();

  return tab;
}

export function getDetachedTabByWindow(windowLabel: string): DetachedTab | undefined {
  return state.detachedTabs.find((t) => t.windowLabel === windowLabel);
}

export async function closeAllDetachedWindows(): Promise<void> {
  for (const tab of state.detachedTabs) {
    try {
      const win = await WebviewWindow.getByLabel(tab.windowLabel);
      if (win) await win.close();
    } catch {}
  }
  state = { ...state, detachedTabs: [] };
  notify();
}

export async function checkMainWindowAndClose(): Promise<void> {
  const mainWindow = await WebviewWindow.getByLabel('main');
  if (!mainWindow) {
    const currentWindow = getCurrentWindow();
    await currentWindow.close();
  }
}
