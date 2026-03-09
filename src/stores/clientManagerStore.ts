import { readTextFile, writeTextFile, exists, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';

export interface RobloxAccount {
  id: string;
  cookie: string;
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string;
}

export interface RobloxGame {
  id: string;
  placeId: number;
  universeId: number;
  name: string;
  thumbnailUrl: string;
}

interface ClientManagerData {
  accounts: RobloxAccount[];
  games: RobloxGame[];
}

const FILE_NAME = 'client-manager.json';

let data: ClientManagerData = { accounts: [], games: [] };
let listeners: Set<() => void> = new Set();
let initialized = false;

function notify(): void {
  listeners.forEach((l) => l());
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

async function ensureDir(): Promise<void> {
  try {
    const dirExists = await exists('', { baseDir: BaseDirectory.AppData });
    if (!dirExists) {
      await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true });
    }
  } catch {}
}

async function persist(): Promise<void> {
  try {
    await ensureDir();
    await writeTextFile(FILE_NAME, JSON.stringify(data, null, 2), {
      baseDir: BaseDirectory.AppData,
    });
  } catch (e) {
    console.error('Failed to save client manager data:', e);
  }
}

export async function loadClientManager(): Promise<void> {
  if (initialized) return;
  try {
    await ensureDir();
    const fileExists = await exists(FILE_NAME, { baseDir: BaseDirectory.AppData });
    if (fileExists) {
      const content = await readTextFile(FILE_NAME, { baseDir: BaseDirectory.AppData });
      const loaded = JSON.parse(content);
      data = {
        accounts: loaded.accounts || [],
        games: loaded.games || [],
      };
    }
  } catch (e) {
    console.error('Failed to load client manager data:', e);
  }
  initialized = true;
  notify();
}

function cleanCookie(raw: string): string {
  let c = raw.trim();
  if (c.startsWith('.ROBLOSECURITY=')) {
    c = c.substring('.ROBLOSECURITY='.length);
  }
  return c;
}

export async function addAccount(rawCookie: string): Promise<RobloxAccount> {
  const cleaned = cleanCookie(rawCookie);

  const existing = data.accounts.find((a) => a.cookie === cleaned);
  if (existing) throw new Error('Account already added');

  const user = await invoke<{ id: number; name: string; displayName: string }>(
    'fetch_roblox_user_from_cookie',
    { cookie: cleaned }
  );
  const avatarUrl = await invoke<string>('fetch_roblox_avatar', { userId: user.id });

  const account: RobloxAccount = {
    id: genId(),
    cookie: cleaned,
    userId: user.id,
    username: user.name,
    displayName: user.displayName,
    avatarUrl,
  };

  data = { ...data, accounts: [...data.accounts, account] };
  notify();
  await persist();
  return account;
}

export function removeAccount(id: string): void {
  data = { ...data, accounts: data.accounts.filter((a) => a.id !== id) };
  notify();
  persist();
}

export async function addGame(placeId: number): Promise<RobloxGame> {
  const existing = data.games.find((g) => g.placeId === placeId);
  if (existing) throw new Error('Game already added');

  const details = await invoke<{ universeId: number; name: string; thumbnailUrl: string }>(
    'fetch_roblox_game_details',
    { placeId }
  );

  const game: RobloxGame = {
    id: genId(),
    placeId,
    universeId: details.universeId,
    name: details.name,
    thumbnailUrl: details.thumbnailUrl,
  };

  data = { ...data, games: [...data.games, game] };
  notify();
  await persist();
  return game;
}

export function removeGame(id: string): void {
  data = { ...data, games: data.games.filter((g) => g.id !== id) };
  notify();
  persist();
}

export function getClientManager(): ClientManagerData {
  return data;
}

export function subscribeClientManager(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
