import { invoke } from '@tauri-apps/api/core';

export interface InstanceInfo {
  name: string;
  className: string;
  path: string;
  childCount: number;
  id: number;
  parent?: string;
  position?: number[];
  size?: number[];
  isScript?: boolean;
  disabled?: boolean;
  children?: InstanceInfo[];
}

export interface ConnectionInfo {
  gameId: number;
  placeId: number;
  placeVersion: number;
  jobId: string;
  executor: string;
  timestamp: number;
}

export interface ExplorerMessage {
  type: string;
  data: Record<string, unknown>;
  timestamp?: number;
  requestId?: string;
}

type ExplorerConnectionState = 'disconnected' | 'connecting' | 'connected';

export interface ExplorerState {
  state: ExplorerConnectionState;
  connectionInfo: ConnectionInfo | null;
  serverRunning: boolean;
}

let store: ExplorerState = {
  state: 'disconnected',
  connectionInfo: null,
  serverRunning: false,
};

const listeners = new Set<() => void>();
let pollInterval: ReturnType<typeof setInterval> | null = null;
let messageIdCounter = 0;

const childrenCache = new Map<string, { data: InstanceInfo[]; timestamp: number }>();
const propertiesCache = new Map<string, { data: Record<string, unknown>; timestamp: number }>();
const pendingRequests = new Map<string, Promise<Record<string, unknown>>>();

const CACHE_TTL = 30000;
const POLL_INTERVAL = 1000;

function notify() {
  listeners.forEach((l) => l());
}

export function getExplorerState(): ExplorerState {
  return store;
}

export function subscribeExplorer(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function initializeExplorerStore(): Promise<void> {
  try {
    const connected = await invoke<boolean>('is_explorer_connected');
    const info = await invoke<ConnectionInfo | null>('get_explorer_connection_info');
    const serverRunning = await invoke<boolean>('is_explorer_server_running').catch(() => connected || info !== null);

    const newState: ExplorerConnectionState = connected ? 'connected' : 'disconnected';

    store = {
      ...store,
      serverRunning: serverRunning || connected || info !== null,
      state: newState,
      connectionInfo: info
    };
    notify();

    if (store.serverRunning) {
      startPolling();
    }
  } catch {
    startPolling();
  }
}

export async function startExplorerServer(): Promise<void> {
  try {
    await invoke('start_explorer_server');
    store = { ...store, serverRunning: true };
    notify();
    startPolling();
  } catch (e) {
    console.error('Failed to start explorer server:', e);
    throw e;
  }
}

export async function stopExplorerServer(): Promise<void> {
  try {
    await invoke('stop_explorer_server');
    store = { ...store, serverRunning: false, state: 'disconnected', connectionInfo: null };
    clearAllCaches();
    notify();
    stopPolling();
  } catch (e) {
    console.error('Failed to stop explorer server:', e);
  }
}

function clearAllCaches() {
  childrenCache.clear();
  propertiesCache.clear();
  pendingRequests.clear();
}

function startPolling() {
  if (pollInterval) return;

  pollInterval = setInterval(async () => {
    try {
      const connected = await invoke<boolean>('is_explorer_connected');
      const info = await invoke<ConnectionInfo | null>('get_explorer_connection_info');

      const newState: ExplorerConnectionState = connected ? 'connected' : 'disconnected';

      if (newState === 'disconnected' && store.state === 'connected') {
        clearAllCaches();
      }

      if (newState !== store.state || JSON.stringify(info) !== JSON.stringify(store.connectionInfo)) {
        store = { ...store, state: newState, connectionInfo: info };
        notify();
      }
    } catch {
      if (store.state !== 'disconnected') {
        clearAllCaches();
        store = { ...store, state: 'disconnected', connectionInfo: null };
        notify();
      }
    }
  }, POLL_INTERVAL);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

async function sendExplorerMessageInternal(
  type: string,
  data: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const requestId = `req_${++messageIdCounter}_${Date.now()}`;

  const message: ExplorerMessage = {
    type,
    data,
    requestId,
  };

  const response = await invoke<string>('send_explorer_message', { message: JSON.stringify(message) });

  try {
    const parsed = JSON.parse(response);
    return parsed.data || parsed;
  } catch {
    return {};
  }
}

function createCacheKey(type: string, data: Record<string, unknown>): string {
  return `${type}:${JSON.stringify(data)}`;
}

export async function sendExplorerMessage(
  type: string,
  data: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const cacheKey = createCacheKey(type, data);

  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  const promise = sendExplorerMessageInternal(type, data);
  pendingRequests.set(cacheKey, promise);

  try {
    const result = await promise;
    return result;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

export async function getExplorerScript(): Promise<string> {
  return invoke<string>('get_explorer_script');
}

export async function getExplorerPort(): Promise<number> {
  return invoke<number>('get_explorer_port');
}

export async function getGameTree(path: string = 'game', depth: number = 1): Promise<InstanceInfo | null> {
  const response = await sendExplorerMessage('getTree', { path, depth });
  return (response.tree as InstanceInfo) || null;
}

export async function getChildren(path: string, forceRefresh = false): Promise<InstanceInfo[]> {
  const now = Date.now();
  const cached = childrenCache.get(path);

  if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  const response = await sendExplorerMessage('getChildren', { path });
  const children = (response.children as InstanceInfo[]) || [];

  childrenCache.set(path, { data: children, timestamp: now });

  return children;
}

export async function getProperties(path: string, forceRefresh = false): Promise<Record<string, unknown>> {
  const now = Date.now();
  const cached = propertiesCache.get(path);

  if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  const response = await sendExplorerMessage('getProperties', { path });
  const properties = (response.properties as Record<string, unknown>) || {};

  propertiesCache.set(path, { data: properties, timestamp: now });

  return properties;
}

export async function searchInstances(
  query: string,
  options: { maxResults?: number; searchClassName?: boolean } = {}
): Promise<InstanceInfo[]> {
  const response = await sendExplorerMessage('search', { query, options });
  return (response.results as InstanceInfo[]) || [];
}

export async function getServices(): Promise<{ name: string; className: string; path: string }[]> {
  const response = await sendExplorerMessage('getServices', {});
  return (response.services as { name: string; className: string; path: string }[]) || [];
}

export async function decompileScript(path: string): Promise<{ source: string | null; error: string | null }> {
  const response = await sendExplorerMessage('decompile', { path });
  return {
    source: response.source as string | null,
    error: response.error as string | null,
  };
}

export async function setProperty(
  path: string,
  property: string,
  value: unknown
): Promise<{ success: boolean; error?: string }> {
  const response = await sendExplorerMessage('setProperty', { path, property, value });

  if (response.success) {
    propertiesCache.delete(path);
  }

  return {
    success: response.success as boolean,
    error: response.error as string | undefined,
  };
}

export async function getNilInstances(): Promise<InstanceInfo[]> {
  const response = await sendExplorerMessage('getNil', {});
  return (response.instances as InstanceInfo[]) || [];
}

export async function getLoadedModules(): Promise<InstanceInfo[]> {
  const response = await sendExplorerMessage('getLoadedModules', {});
  return (response.modules as InstanceInfo[]) || [];
}

export async function getGameInfo(): Promise<{
  gameId: number;
  placeId: number;
  placeVersion: number;
  jobId: string;
}> {
  const response = await sendExplorerMessage('getGameInfo', {});
  return response as {
    gameId: number;
    placeId: number;
    placeVersion: number;
    jobId: string;
  };
}

export async function executeInGame(code: string): Promise<{ success: boolean; results?: unknown[]; error?: string }> {
  const response = await sendExplorerMessage('execute', { code });
  return response as { success: boolean; results?: unknown[]; error?: string };
}

export function invalidateChildrenCache(path: string) {
  childrenCache.delete(path);
}

export function invalidatePropertiesCache(path: string) {
  propertiesCache.delete(path);
}

export function clearExplorerCaches() {
  clearAllCaches();
}
