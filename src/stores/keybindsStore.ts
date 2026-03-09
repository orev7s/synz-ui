import { readTextFile, writeTextFile, exists, BaseDirectory } from '@tauri-apps/plugin-fs';

export type KeybindAction =
  | 'newScript'
  | 'openFile'
  | 'saveScript'
  | 'closeTab'
  | 'executeScript'
  | 'toggleTerminal'
  | 'openSettings'
  | 'findInFile'
  | 'quickFilePicker'
  | 'openExplorer';

export interface KeybindConfig {
  action: KeybindAction;
  label: string;
  keybind: string;
  defaultKeybind: string;
}

export interface KeybindsSettings {
  newScript: string;
  openFile: string;
  saveScript: string;
  closeTab: string;
  executeScript: string;
  toggleTerminal: string;
  openSettings: string;
  findInFile: string;
  quickFilePicker: string;
  openExplorer: string;
}

const DEFAULT_KEYBINDS: KeybindsSettings = {
  newScript: 'Ctrl+N',
  openFile: 'Ctrl+O',
  saveScript: 'Ctrl+S',
  closeTab: 'Ctrl+W',
  executeScript: 'F5',
  toggleTerminal: 'Ctrl+`',
  openSettings: 'Ctrl+,',
  findInFile: 'Ctrl+F',
  quickFilePicker: 'Ctrl+Alt+P',
  openExplorer: 'Ctrl+Shift+D',
};

const KEYBINDS_FILE = 'keybinds.json';
let keybinds: KeybindsSettings = { ...DEFAULT_KEYBINDS };
let listeners: Set<() => void> = new Set();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

export async function loadKeybinds(): Promise<KeybindsSettings> {
  try {
    const fileExists = await exists(KEYBINDS_FILE, { baseDir: BaseDirectory.AppData });
    if (fileExists) {
      const content = await readTextFile(KEYBINDS_FILE, { baseDir: BaseDirectory.AppData });
      const loaded = JSON.parse(content);
      keybinds = { ...DEFAULT_KEYBINDS, ...loaded };
    }
  } catch {
    keybinds = { ...DEFAULT_KEYBINDS };
  }
  notifyListeners();
  return keybinds;
}

export async function saveKeybinds(newKeybinds: Partial<KeybindsSettings>): Promise<void> {
  keybinds = { ...keybinds, ...newKeybinds };
  notifyListeners();
  try {
    await writeTextFile(KEYBINDS_FILE, JSON.stringify(keybinds, null, 2), {
      baseDir: BaseDirectory.AppData,
    });
  } catch {}
}

export async function resetKeybinds(): Promise<void> {
  keybinds = { ...DEFAULT_KEYBINDS };
  notifyListeners();
  try {
    await writeTextFile(KEYBINDS_FILE, JSON.stringify(keybinds, null, 2), {
      baseDir: BaseDirectory.AppData,
    });
  } catch {}
}

export function getKeybinds(): KeybindsSettings {
  return { ...keybinds };
}

export function getDefaultKeybinds(): KeybindsSettings {
  return { ...DEFAULT_KEYBINDS };
}

export function subscribeToKeybinds(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function parseKeybind(keybind: string): { ctrl: boolean; alt: boolean; shift: boolean; key: string } {
  const parts = keybind.split('+').map((p) => p.trim().toLowerCase());
  return {
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
    key: parts.filter((p) => !['ctrl', 'control', 'alt', 'shift'].includes(p))[0] || '',
  };
}

export function matchesKeybind(event: KeyboardEvent, keybind: string): boolean {
  if (!keybind) return false;
  const parsed = parseKeybind(keybind);
  const eventKey = event.key.toLowerCase();
  const parsedKey = parsed.key.toLowerCase();

  const keyMatch =
    eventKey === parsedKey ||
    event.code.toLowerCase() === `key${parsedKey}` ||
    event.code.toLowerCase() === parsedKey ||
    event.code.toLowerCase() === `digit${parsedKey}` ||
    (parsedKey === '`' && event.code === 'Backquote') ||
    (parsedKey === ',' && event.key === ',') ||
    (parsedKey.startsWith('f') && event.code.toLowerCase() === parsedKey);

  return event.ctrlKey === parsed.ctrl && event.altKey === parsed.alt && event.shiftKey === parsed.shift && keyMatch;
}

export function formatKeybind(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');

  let key = event.key;
  if (key === ' ') key = 'Space';
  else if (key === 'Backspace') key = 'Backspace';
  else if (key === 'Delete') key = 'Delete';
  else if (key === 'Escape') key = 'Escape';
  else if (key === 'Enter') key = 'Enter';
  else if (key === 'Tab') key = 'Tab';
  else if (key.length === 1) key = key.toUpperCase();
  else if (key.startsWith('Arrow')) key = key.replace('Arrow', '');
  else if (key.startsWith('F') && /^F\d+$/.test(key)) key = key;

  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    parts.push(key);
  }

  return parts.join('+');
}

export function keybindToDisplay(keybind: string): string[] {
  return keybind.split('+').map((k) => k.trim());
}

export const KEYBIND_LABELS: Record<KeybindAction, string> = {
  newScript: 'New Script',
  openFile: 'Open File',
  saveScript: 'Save Script',
  closeTab: 'Close Tab',
  executeScript: 'Execute Script',
  toggleTerminal: 'Toggle Terminal',
  openSettings: 'Open Settings',
  findInFile: 'Find in File',
  quickFilePicker: 'Quick File Picker',
  openExplorer: 'Open Explorer',
};

export const KEYBIND_DESCRIPTIONS: Record<KeybindAction, string> = {
  newScript: 'Create a new script file',
  openFile: 'Open file from workspace',
  saveScript: 'Save the current script',
  closeTab: 'Close the current tab',
  executeScript: 'Run the current script',
  toggleTerminal: 'Show or hide the terminal panel',
  openSettings: 'Open settings page',
  findInFile: 'Find text in the current file',
  quickFilePicker: 'Quickly search and open scripts',
  openExplorer: 'Open the game explorer',
};
