import { invoke } from '@tauri-apps/api/core';

export interface WorkspaceEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string | null;
}

export interface WorkspaceNode extends WorkspaceEntry {
  children?: WorkspaceNode[];
  isLoading?: boolean;
  isExpanded?: boolean;
}

let workspacePath: string | null = null;
let rootEntries: WorkspaceNode[] = [];
let expandedPaths: Set<string> = new Set();
let childrenCache: Map<string, WorkspaceNode[]> = new Map();
let listeners: Set<() => void> = new Set();
let initialized = false;

const TEXT_EXTENSIONS = new Set([
  'lua', 'luau', 'txt', 'json', 'md', 'xml', 'yaml', 'yml',
  'toml', 'ini', 'cfg', 'conf', 'log', 'csv', 'html', 'css',
  'js', 'ts', 'tsx', 'jsx', 'py', 'rb', 'sh', 'bat', 'ps1'
]);

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

export async function getWorkspacePath(): Promise<string> {
  if (!workspacePath) {
    workspacePath = await invoke<string>('get_workspace_path');
  }
  return workspacePath;
}

export async function loadWorkspaceRoot(): Promise<void> {
  const path = await getWorkspacePath();
  const entries = await invoke<WorkspaceEntry[]>('read_workspace_dir', { dirPath: path });
  rootEntries = entries.map((e) => ({ ...e, isExpanded: expandedPaths.has(e.path) }));
  initialized = true;
  notifyListeners();
}

export async function loadChildren(dirPath: string): Promise<WorkspaceNode[]> {
  if (childrenCache.has(dirPath)) {
    return childrenCache.get(dirPath)!;
  }

  const entries = await invoke<WorkspaceEntry[]>('read_workspace_dir', { dirPath });
  const nodes: WorkspaceNode[] = entries.map((e) => ({
    ...e,
    isExpanded: expandedPaths.has(e.path)
  }));

  childrenCache.set(dirPath, nodes);
  return nodes;
}

export async function toggleExpand(path: string): Promise<void> {
  if (expandedPaths.has(path)) {
    expandedPaths.delete(path);
  } else {
    expandedPaths.add(path);
    if (!childrenCache.has(path)) {
      await loadChildren(path);
    }
  }
  notifyListeners();
}

export function isExpanded(path: string): boolean {
  return expandedPaths.has(path);
}

export function getChildren(path: string): WorkspaceNode[] | undefined {
  return childrenCache.get(path);
}

export async function readWorkspaceFile(filePath: string): Promise<string> {
  return invoke<string>('read_workspace_file', { filePath });
}

export function isTextFile(extension: string | null): boolean {
  if (!extension) return false;
  return TEXT_EXTENSIONS.has(extension.toLowerCase());
}

export function getRootEntries(): WorkspaceNode[] {
  return rootEntries;
}

export function isWorkspaceInitialized(): boolean {
  return initialized;
}

export function subscribeWorkspace(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export async function refreshWorkspace(): Promise<void> {
  childrenCache.clear();
  await loadWorkspaceRoot();

  for (const path of expandedPaths) {
    try {
      await loadChildren(path);
    } catch {
      expandedPaths.delete(path);
    }
  }
  notifyListeners();
}

export function clearWorkspaceCache(): void {
  childrenCache.clear();
  notifyListeners();
}
