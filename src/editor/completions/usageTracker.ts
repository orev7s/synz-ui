import { readTextFile, writeTextFile, exists, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';

const USAGE_FILE = 'completion-usage.json';
const MAX_ENTRIES = 500;
const DECAY_FACTOR = 0.95;
const SAVE_DEBOUNCE_MS = 5000;

let usageMap = new Map<string, number>();
let loaded = false;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let dirty = false;

async function ensureDir(): Promise<void> {
  try {
    const dirExists = await exists('', { baseDir: BaseDirectory.AppData });
    if (!dirExists) {
      await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true });
    }
  } catch {}
}

export async function loadUsageData(): Promise<void> {
  if (loaded) return;
  try {
    const fileExists = await exists(USAGE_FILE, { baseDir: BaseDirectory.AppData });
    if (!fileExists) {
      loaded = true;
      return;
    }
    const content = await readTextFile(USAGE_FILE, { baseDir: BaseDirectory.AppData });
    const data = JSON.parse(content) as Record<string, number>;
    usageMap = new Map(Object.entries(data));
    loaded = true;
  } catch {
    loaded = true;
  }
}

async function saveUsageData(): Promise<void> {
  if (!dirty) return;
  try {
    await ensureDir();
    const entries = Array.from(usageMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_ENTRIES);
    const data: Record<string, number> = {};
    for (const [key, value] of entries) {
      data[key] = Math.round(value * 100) / 100;
    }
    await writeTextFile(USAGE_FILE, JSON.stringify(data), {
      baseDir: BaseDirectory.AppData,
    });
    dirty = false;
  } catch {}
}

function scheduleSave(): void {
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    saveUsageData();
  }, SAVE_DEBOUNCE_MS);
}

export function recordUsage(label: string): void {
  for (const [key, value] of usageMap.entries()) {
    usageMap.set(key, value * DECAY_FACTOR);
  }
  const current = usageMap.get(label) ?? 0;
  usageMap.set(label, current + 1);
  dirty = true;
  scheduleSave();
}

export function getUsageBoost(label: string): number {
  const count = usageMap.get(label) ?? 0;
  if (count <= 0) return 0;
  return Math.min(Math.log2(count + 1) * 2, 10);
}
