import { readTextFile, writeTextFile, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { fileStore } from './fileStore';
import { transformScript } from './qolStore';
import { executeScript as executeScriptFromAttach } from './attachStore';

export interface ScriptKeybind {
  scriptId: string;
  keybind: string | null;
}

export interface QuickExecuteSettings {
  enabled: boolean;
  toggleKeybind: string;
  executeKeybind: string;
  saveKeybind: string;
  scriptKeybinds: Record<string, string>;
}

interface QuickExecuteState {
  isVisible: boolean;
  selectedScriptId: string | null;
  editorContent: string;
  settings: QuickExecuteSettings;
}

const DEFAULT_SETTINGS: QuickExecuteSettings = {
  enabled: false,
  toggleKeybind: 'Alt+Q',
  executeKeybind: 'F5',
  saveKeybind: 'CommandOrControl+S',
  scriptKeybinds: {},
};

const QUICK_EXECUTE_FILE = 'quick-execute.json';

let state: QuickExecuteState = {
  isVisible: false,
  selectedScriptId: null,
  editorContent: '',
  settings: { ...DEFAULT_SETTINGS },
};

let stateSnapshot: QuickExecuteState = { ...state, settings: { ...state.settings } };
let listeners: Set<() => void> = new Set();
let registeredShortcut: string | null = null;
let registeredScriptShortcuts: Map<string, string> = new Map();
let lastToggleTime = 0;
const TOGGLE_DEBOUNCE_MS = 300;

function updateSnapshot(): void {
  stateSnapshot = {
    isVisible: state.isVisible,
    selectedScriptId: state.selectedScriptId,
    editorContent: state.editorContent,
    settings: { ...state.settings },
  };
}

function notifyListeners(): void {
  updateSnapshot();
  listeners.forEach((listener) => listener());
}

function convertKeybindToTauri(keybind: string): string {
  return keybind
    .replace(/Ctrl/gi, 'CommandOrControl')
    .replace(/\+/g, '+');
}

async function registerGlobalShortcut(): Promise<void> {
  if (!state.settings.enabled) return;

  const shortcut = convertKeybindToTauri(state.settings.toggleKeybind);

  try {
    if (registeredShortcut && registeredShortcut !== shortcut) {
      const wasRegistered = await isRegistered(registeredShortcut);
      if (wasRegistered) {
        await unregister(registeredShortcut);
      }
    }

    const alreadyRegistered = await isRegistered(shortcut);
    if (alreadyRegistered) {
      registeredShortcut = shortcut;
      return;
    }

    await register(shortcut, async () => {
      await toggleQuickExecuteWindow();
    });

    registeredShortcut = shortcut;
  } catch (e) {
    console.error('Failed to register global shortcut:', e);
  }
}

async function executeScriptById(scriptId: string): Promise<void> {
  const file = fileStore.getFile(scriptId);
  if (!file) return;
  try {
    await executeScriptFromAttach(transformScript(file.content));
  } catch (err) {
    console.error('Script execution failed:', err);
  }
}

async function registerScriptShortcut(scriptId: string, keybind: string): Promise<void> {
  const shortcut = convertKeybindToTauri(keybind);
  try {
    const alreadyRegistered = await isRegistered(shortcut);
    if (alreadyRegistered) return;

    await register(shortcut, async () => {
      await executeScriptById(scriptId);
    });
    registeredScriptShortcuts.set(scriptId, shortcut);
  } catch (e) {
    console.error('Failed to register script shortcut:', e);
  }
}

async function unregisterScriptShortcut(scriptId: string): Promise<void> {
  const shortcut = registeredScriptShortcuts.get(scriptId);
  if (!shortcut) return;
  try {
    const wasRegistered = await isRegistered(shortcut);
    if (wasRegistered) {
      await unregister(shortcut);
    }
    registeredScriptShortcuts.delete(scriptId);
  } catch (e) {
    console.error('Failed to unregister script shortcut:', e);
  }
}

async function registerAllScriptShortcuts(): Promise<void> {
  for (const [scriptId, keybind] of Object.entries(state.settings.scriptKeybinds)) {
    await registerScriptShortcut(scriptId, keybind);
  }
}

async function unregisterGlobalShortcut(): Promise<void> {
  if (registeredShortcut) {
    try {
      const wasRegistered = await isRegistered(registeredShortcut);
      if (wasRegistered) {
        await unregister(registeredShortcut);
      }
      registeredShortcut = null;
    } catch (e) {
      console.error('Failed to unregister global shortcut:', e);
    }
  }
}

let quickExecuteWindowInstance: WebviewWindow | null = null;
let windowContentReady = false;
let hasBeenCentered = false;
let readyResolvers: Array<() => void> = [];

listen('quick-execute-ready', () => {
  windowContentReady = true;
  for (const resolve of readyResolvers) resolve();
  readyResolvers = [];
});

function waitForWindowReady(timeout = 5000): Promise<void> {
  if (windowContentReady) return Promise.resolve();
  return new Promise((resolve) => {
    readyResolvers.push(resolve);
    setTimeout(() => {
      readyResolvers = readyResolvers.filter((r) => r !== resolve);
      resolve();
    }, timeout);
  });
}

async function getOrCreateQuickExecuteWindow(): Promise<WebviewWindow | null> {
  if (quickExecuteWindowInstance) {
    return quickExecuteWindowInstance;
  }

  let win = await WebviewWindow.getByLabel('quick-execute');
  if (win) {
    quickExecuteWindowInstance = win;
    return win;
  }

  win = new WebviewWindow('quick-execute', {
    url: 'index.html?window=quick-execute',
    title: 'Quick Execute',
    width: 700,
    height: 450,
    x: -9999,
    y: -9999,
    resizable: true,
    decorations: false,
    transparent: true,
    visible: false,
    alwaysOnTop: true,
  });

  await new Promise<void>((resolve) => {
    win!.once('tauri://created', () => resolve());
    win!.once('tauri://error', () => resolve());
  });

  quickExecuteWindowInstance = win;
  return win;
}

export async function toggleQuickExecuteWindow(): Promise<void> {
  const now = Date.now();
  if (now - lastToggleTime < TOGGLE_DEBOUNCE_MS) {
    return;
  }
  lastToggleTime = now;

  const quickExecWindow = await getOrCreateQuickExecuteWindow();

  if (!quickExecWindow) {
    console.error('Failed to get or create quick execute window');
    return;
  }

  const isCurrentlyVisible = await quickExecWindow.isVisible();

  if (isCurrentlyVisible) {
    await quickExecWindow.hide();
    state.isVisible = false;
  } else {
    if (!windowContentReady) {
      await waitForWindowReady();
    }
    if (!hasBeenCentered) {
      await quickExecWindow.center();
      hasBeenCentered = true;
    }
    await quickExecWindow.show();
    await quickExecWindow.setFocus();
    state.isVisible = true;
  }

  notifyListeners();
}

export async function loadQuickExecuteSettings(): Promise<QuickExecuteSettings> {
  try {
    const fileExists = await exists(QUICK_EXECUTE_FILE, { baseDir: BaseDirectory.AppData });
    if (fileExists) {
      const content = await readTextFile(QUICK_EXECUTE_FILE, { baseDir: BaseDirectory.AppData });
      const loaded = JSON.parse(content);
      state.settings = { ...DEFAULT_SETTINGS, ...loaded };
    }
  } catch {
    state.settings = { ...DEFAULT_SETTINGS };
  }

  if (state.settings.enabled) {
    await registerGlobalShortcut();
    await registerAllScriptShortcuts();
  }

  notifyListeners();
  return state.settings;
}

export async function saveQuickExecuteSettings(newSettings: Partial<QuickExecuteSettings>): Promise<void> {
  const wasEnabled = state.settings.enabled;
  const oldKeybind = state.settings.toggleKeybind;

  state.settings = { ...state.settings, ...newSettings };
  notifyListeners();

  if (state.settings.enabled && (!wasEnabled || oldKeybind !== state.settings.toggleKeybind)) {
    await registerGlobalShortcut();
  } else if (!state.settings.enabled && wasEnabled) {
    await unregisterGlobalShortcut();
  }

  try {
    await writeTextFile(QUICK_EXECUTE_FILE, JSON.stringify(state.settings, null, 2), {
      baseDir: BaseDirectory.AppData,
    });
  } catch {
  }
}

export function getQuickExecuteState(): QuickExecuteState {
  return stateSnapshot;
}

export function getQuickExecuteSettings(): QuickExecuteSettings {
  return { ...state.settings };
}

export function setQuickExecuteVisible(visible: boolean): void {
  state.isVisible = visible;
  notifyListeners();
}

export function toggleQuickExecuteVisible(): void {
  state.isVisible = !state.isVisible;
  notifyListeners();
}

export function setSelectedScript(scriptId: string | null, content: string = ''): void {
  state.selectedScriptId = scriptId;
  state.editorContent = content;
  notifyListeners();
}

export function setEditorContent(content: string): void {
  state.editorContent = content;
  notifyListeners();
}

export async function setScriptKeybind(scriptId: string, keybind: string | null): Promise<void> {
  await unregisterScriptShortcut(scriptId);

  if (keybind) {
    state.settings.scriptKeybinds[scriptId] = keybind;
    if (state.settings.enabled) {
      await registerScriptShortcut(scriptId, keybind);
    }
  } else {
    delete state.settings.scriptKeybinds[scriptId];
  }
  await saveQuickExecuteSettings({ scriptKeybinds: state.settings.scriptKeybinds });
}

export function getScriptKeybind(scriptId: string): string | null {
  return state.settings.scriptKeybinds[scriptId] || null;
}

export function subscribeToQuickExecute(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function parseKeybind(keybind: string): { ctrl: boolean; alt: boolean; shift: boolean; key: string } {
  const parts = keybind.split('+').map((p) => p.trim().toLowerCase());
  return {
    ctrl: parts.includes('ctrl') || parts.includes('control') || parts.includes('commandorcontrol'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
    key: parts.filter((p) => !['ctrl', 'control', 'alt', 'shift', 'commandorcontrol'].includes(p))[0] || '',
  };
}

export function matchesKeybind(event: KeyboardEvent, keybind: string): boolean {
  if (!keybind) return false;
  const parsed = parseKeybind(keybind);
  const eventKey = event.key.toLowerCase();
  const keyMatch = eventKey === parsed.key.toLowerCase() || event.code.toLowerCase() === `key${parsed.key.toLowerCase()}`;
  return event.ctrlKey === parsed.ctrl && event.altKey === parsed.alt && event.shiftKey === parsed.shift && keyMatch;
}

export function formatKeybind(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');

  let key = event.key;
  if (key === ' ') key = 'Space';
  else if (key.length === 1) key = key.toUpperCase();
  else if (key.startsWith('Arrow')) key = key.replace('Arrow', '');

  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    parts.push(key);
  }

  return parts.join('+');
}
