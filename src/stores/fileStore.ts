import {
  readTextFile,
  writeTextFile,
  readDir,
  remove,
  rename,
  exists,
} from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";

export interface VirtualFile {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  modifiedAt: number;
  filePath?: string;
  isAutoexec?: boolean;
}

export interface FileStore {
  files: Map<string, VirtualFile>;
  getFile: (id: string) => VirtualFile | undefined;
  getFileByName: (name: string) => VirtualFile | undefined;
  getAllFiles: () => VirtualFile[];
  createFile: (name: string, content?: string) => Promise<VirtualFile>;
  updateFile: (id: string, content: string) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  renameFile: (id: string, newName: string) => Promise<void>;
  loadFilesFromDisk: () => Promise<void>;
  getFilePath: (id: string) => string | undefined;
  revealInExplorer: (id: string) => Promise<void>;
  addToAutoexec: (id: string) => Promise<void>;
  removeFromAutoexec: (id: string) => Promise<void>;
  isInAutoexec: (id: string) => boolean;
}

let scriptsDir: string | null = null;

async function getScriptsDir(): Promise<string> {
  if (!scriptsDir) {
    scriptsDir = await invoke<string>("get_scripts_path");
  }
  return scriptsDir;
}

let files: Map<string, VirtualFile> = new Map();
let listeners: Set<() => void> = new Set();
let initialized = false;

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function generateId(name: string): string {
  return `file_${name.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}`;
}

async function ensureScriptsDir(): Promise<string> {
  return await getScriptsDir();
}

async function createDefaultFiles(): Promise<void> {
  const dir = await getScriptsDir();

  const exampleContent = `-- Example Luau Script
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local function onPlayerAdded(player: Player)
    print("Welcome, " .. player.Name .. "!")

    player.CharacterAdded:Connect(function(character)
        local humanoid = character:WaitForChild("Humanoid")
        humanoid.WalkSpeed = 16
        humanoid.JumpPower = 50
    end)
end

Players.PlayerAdded:Connect(onPlayerAdded)

for _, player in Players:GetPlayers() do
    task.spawn(onPlayerAdded, player)
end

print("Example script loaded!")
`;

  const testContent = `-- Test Script
local HttpService = game:GetService("HttpService")
local RunService = game:GetService("RunService")

local config = {
    enabled = true,
    interval = 1,
    maxRetries = 3,
}

local function makeRequest(url: string, data: any): boolean
    local success, result = pcall(function()
        return HttpService:JSONEncode(data)
    end)

    if success then
        print("Request data:", result)
        return true
    else
        warn("Failed to encode:", result)
        return false
    end
end

local connection = RunService.Heartbeat:Connect(function(deltaTime)
    if config.enabled then
    end
end)

print("Test script initialized!")
`;

  const examplePath = `${dir}\\example.lua`;
  const testPath = `${dir}\\test.lua`;

  const exampleExists = await exists(examplePath);
  const testExists = await exists(testPath);

  if (!exampleExists) {
    await writeTextFile(examplePath, exampleContent);
  }

  if (!testExists) {
    await writeTextFile(testPath, testContent);
  }
}

async function loadFilesFromDisk(): Promise<void> {
  const dir = await ensureScriptsDir();
  await createDefaultFiles();

  const entries = await readDir(dir);
  const newFiles = new Map<string, VirtualFile>();

  let autoexecScripts: string[] = [];
  try {
    autoexecScripts = await invoke<string[]>("get_autoexec_scripts");
  } catch {
    autoexecScripts = [];
  }

  for (const entry of entries) {
    if (
      entry.isFile &&
      entry.name &&
      (entry.name.endsWith(".lua") || entry.name.endsWith(".luau"))
    ) {
      const filePath = `${dir}\\${entry.name}`;
      const content = await readTextFile(filePath);

      const existingFile = Array.from(files.values()).find(
        (f) => f.name === entry.name,
      );
      const id = existingFile?.id || generateId(entry.name);
      const now = Date.now();

      newFiles.set(id, {
        id,
        name: entry.name,
        content,
        createdAt: existingFile?.createdAt || now,
        modifiedAt: now,
        filePath,
        isAutoexec: autoexecScripts.includes(entry.name),
      });
    }
  }

  files = newFiles;
  initialized = true;
  notifyListeners();
}

export const fileStore: FileStore = {
  files,

  getFile(id: string): VirtualFile | undefined {
    return files.get(id);
  },

  getFileByName(name: string): VirtualFile | undefined {
    for (const file of files.values()) {
      if (file.name === name) return file;
    }
    return undefined;
  },

  getAllFiles(): VirtualFile[] {
    return Array.from(files.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  },

  getFilePath(id: string): string | undefined {
    const file = files.get(id);
    return file?.filePath;
  },

  async revealInExplorer(id: string): Promise<void> {
    const file = files.get(id);
    if (file?.filePath) {
      await invoke("reveal_in_explorer", { path: file.filePath });
    }
  },

  async createFile(name: string, content = ""): Promise<VirtualFile> {
    const dir = await ensureScriptsDir();

    const id = generateId(name);
    const now = Date.now();
    const filePath = `${dir}\\${name}`;
    const file: VirtualFile = {
      id,
      name,
      content,
      createdAt: now,
      modifiedAt: now,
      filePath,
    };

    await writeTextFile(filePath, content);

    files.set(id, file);
    notifyListeners();
    return file;
  },

  async updateFile(id: string, content: string): Promise<void> {
    const file = files.get(id);
    if (file && file.filePath) {
      await writeTextFile(file.filePath, content);

      file.content = content;
      file.modifiedAt = Date.now();
      files.set(id, file);
      notifyListeners();
    }
  },

  async deleteFile(id: string): Promise<void> {
    const file = files.get(id);
    if (file && file.filePath) {
      await remove(file.filePath);

      files.delete(id);
      notifyListeners();
    }
  },

  async renameFile(id: string, newName: string): Promise<void> {
    const file = files.get(id);
    if (file && file.filePath) {
      const dir = await getScriptsDir();
      const newPath = `${dir}\\${newName}`;

      await rename(file.filePath, newPath);

      file.name = newName;
      file.filePath = newPath;
      file.modifiedAt = Date.now();
      files.set(id, file);
      notifyListeners();
    }
  },

  async loadFilesFromDisk(): Promise<void> {
    await loadFilesFromDisk();
  },

  async addToAutoexec(id: string): Promise<void> {
    const file = files.get(id);
    if (file) {
      await invoke("add_to_autoexec", {
        scriptName: file.name,
        content: file.content,
      });
      file.isAutoexec = true;
      files.set(id, file);
      notifyListeners();
    }
  },

  async removeFromAutoexec(id: string): Promise<void> {
    const file = files.get(id);
    if (file) {
      await invoke("remove_from_autoexec", { scriptName: file.name });
      file.isAutoexec = false;
      files.set(id, file);
      notifyListeners();
    }
  },

  isInAutoexec(id: string): boolean {
    const file = files.get(id);
    return file?.isAutoexec ?? false;
  },
};

export function subscribeToFileStore(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export async function initializeFileStore(): Promise<void> {
  if (!initialized) {
    await loadFilesFromDisk();
  }
}
