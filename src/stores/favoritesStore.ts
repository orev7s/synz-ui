import { invoke } from '@tauri-apps/api/core';

let favorites: Set<string> = new Set();
let listeners: Set<() => void> = new Set();
let initialized = false;

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

export async function loadFavorites(): Promise<void> {
  try {
    const data = await invoke<string[]>('load_favorites');
    if (Array.isArray(data)) {
      favorites = new Set(data);
    }
    initialized = true;
    notifyListeners();
  } catch {
    initialized = true;
  }
}

async function saveFavorites(): Promise<void> {
  try {
    await invoke('save_favorites', { favorites: Array.from(favorites) });
  } catch {}
}

export function isFavorite(identifier: string): boolean {
  return favorites.has(identifier);
}

export function isFavoriteByPath(filePath: string): boolean {
  return favorites.has(filePath);
}

export function toggleFavorite(identifier: string): void {
  if (favorites.has(identifier)) {
    favorites.delete(identifier);
  } else {
    favorites.add(identifier);
  }
  notifyListeners();
  saveFavorites();
}

export function toggleFavoriteByPath(filePath: string): void {
  if (favorites.has(filePath)) {
    favorites.delete(filePath);
  } else {
    favorites.add(filePath);
  }
  notifyListeners();
  saveFavorites();
}

export function getFavorites(): string[] {
  return Array.from(favorites);
}

export function subscribeToFavorites(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function isFavoritesInitialized(): boolean {
  return initialized;
}
