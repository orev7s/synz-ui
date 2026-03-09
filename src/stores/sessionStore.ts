import { readTextFile, writeTextFile, exists, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import { PaneTab } from './splitStore';

export interface SessionState {
  tabs: PaneTab[];
  activeTabId: string;
}

const SESSION_FILE = 'session.json';

async function ensureAppDataDir(): Promise<void> {
  try {
    const dirExists = await exists('', { baseDir: BaseDirectory.AppData });
    if (!dirExists) {
      await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true });
    }
  } catch {}
}

export async function saveSession(tabs: PaneTab[], activeTabId: string): Promise<void> {
  try {
    await ensureAppDataDir();
    const session: SessionState = { tabs, activeTabId };
    await writeTextFile(SESSION_FILE, JSON.stringify(session, null, 2), {
      baseDir: BaseDirectory.AppData,
    });
  } catch {}
}

export async function loadSession(): Promise<SessionState | null> {
  try {
    const fileExists = await exists(SESSION_FILE, { baseDir: BaseDirectory.AppData });
    if (!fileExists) return null;

    const content = await readTextFile(SESSION_FILE, { baseDir: BaseDirectory.AppData });
    const session = JSON.parse(content) as SessionState;

    if (!session.tabs || !Array.isArray(session.tabs)) return null;

    return session;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await writeTextFile(SESSION_FILE, '{}', {
      baseDir: BaseDirectory.AppData,
    });
  } catch {
  }
}
