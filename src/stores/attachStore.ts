import { invoke } from '@tauri-apps/api/core';

type AttachState = 'detached' | 'attaching' | 'attached';

export interface RobloxProcess {
  pid: number;
  name: string;
}

interface AttachStore {
  state: AttachState;
  dmaMode: boolean;
  selectedPids: number[];
  processes: RobloxProcess[];
}

let store: AttachStore = {
  state: 'attached',
  dmaMode: false,
  selectedPids: [],
  processes: [],
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function getAttachState(): AttachState {
  return store.state;
}

export function isDmaMode(): boolean {
  return false;
}

export function getProcesses(): RobloxProcess[] {
  return store.processes;
}

export function getSelectedPids(): number[] {
  return store.selectedPids;
}

export function setSelectedPids(pids: number[]): void {
  store = { ...store, selectedPids: pids };
  notify();
}

export function togglePid(pid: number): void {
  const current = store.selectedPids;
  const next = current.includes(pid)
    ? current.filter((p) => p !== pid)
    : [...current, pid];
  store = { ...store, selectedPids: next };
  notify();
}

export function selectAllPids(): void {
  store = { ...store, selectedPids: store.processes.map((p) => p.pid) };
  notify();
}

export function deselectAllPids(): void {
  store = { ...store, selectedPids: [] };
  notify();
}

export async function refreshProcesses(): Promise<void> {
  try {
    const processes = await invoke<RobloxProcess[]>('get_roblox_processes');
    const validPids = new Set(processes.map((p) => p.pid));
    const selectedPids = store.selectedPids.filter((pid) => validPids.has(pid));
    store = { ...store, processes, selectedPids };
    notify();
  } catch {
    store = { ...store, processes: [], selectedPids: [] };
    notify();
  }
}

export function subscribeAttach(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startAttaching(): void {
  store = { ...store, state: 'attaching' };
  notify();
}

export async function setAttached(): Promise<void> {
  store = { ...store, state: 'attached', dmaMode: false };
  notify();

  try {
    await invoke('start_vscode_server');
  } catch {}
}

export async function setDetached(): Promise<void> {
  store = { ...store, state: 'detached', dmaMode: false };
  notify();

  try {
    await invoke('stop_vscode_server');
  } catch {}
}

export async function performAttach(invokeFunc: () => Promise<void>): Promise<void> {
  try {
    if (store.state !== 'attached') {
      startAttaching();
      await invokeFunc();
      await setAttached();
    }
  } catch {
    await setDetached();
  }
}

export async function executeScript(script: string): Promise<void> {
  if (store.state !== 'attached') {
    await setAttached();
  }

  const pids = store.selectedPids.length > 0 ? store.selectedPids : undefined;
  await invoke('execute_script', { script, pids });
}
