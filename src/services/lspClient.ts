import { invoke } from '@tauri-apps/api/core';

export interface LspDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity: 1 | 2 | 3 | 4;
  message: string;
  source?: string;
}

export interface LspPublishDiagnosticsParams {
  uri: string;
  diagnostics: LspDiagnostic[];
}

let requestId = 0;
let initialized = false;
let documentVersion = new Map<string, number>();

function nextId(): number {
  return ++requestId;
}

export async function isLspAvailable(): Promise<boolean> {
  try {
    return await invoke<boolean>('lsp_available');
  } catch {
    return false;
  }
}

export async function startLsp(): Promise<boolean> {
  try {
    const result = await invoke<boolean>('start_lsp');
    if (result && !initialized) {
      await initializeLsp();
      initialized = true;
    }
    return result;
  } catch (e) {
    console.error('Failed to start LSP:', e);
    return false;
  }
}

export async function stopLsp(): Promise<boolean> {
  try {
    initialized = false;
    documentVersion.clear();
    return await invoke<boolean>('stop_lsp');
  } catch {
    return false;
  }
}

async function sendRequest(method: string, params: unknown): Promise<unknown> {
  const id = nextId();
  const message = JSON.stringify({
    jsonrpc: '2.0',
    id,
    method,
    params,
  });

  const response = await invoke<string>('send_lsp_message', { message });
  return JSON.parse(response);
}

async function sendNotification(method: string, params: unknown): Promise<void> {
  const message = JSON.stringify({
    jsonrpc: '2.0',
    method,
    params,
  });

  await invoke<string>('send_lsp_message', { message });
}

async function initializeLsp(): Promise<void> {
  await sendRequest('initialize', {
    processId: null,
    capabilities: {
      textDocument: {
        synchronization: {
          dynamicRegistration: false,
          willSave: false,
          willSaveWaitUntil: false,
          didSave: true,
        },
        completion: {
          dynamicRegistration: false,
          completionItem: {
            snippetSupport: true,
            commitCharactersSupport: true,
            documentationFormat: ['markdown', 'plaintext'],
          },
        },
        hover: {
          dynamicRegistration: false,
          contentFormat: ['markdown', 'plaintext'],
        },
        signatureHelp: {
          dynamicRegistration: false,
          signatureInformation: {
            documentationFormat: ['markdown', 'plaintext'],
          },
        },
        publishDiagnostics: {
          relatedInformation: true,
        },
      },
      workspace: {
        workspaceFolders: false,
      },
    },
    rootUri: null,
    workspaceFolders: null,
  });

  await sendNotification('initialized', {});
}

export async function openDocument(uri: string, content: string): Promise<void> {
  if (!initialized) return;

  const version = 1;
  documentVersion.set(uri, version);

  await sendNotification('textDocument/didOpen', {
    textDocument: {
      uri,
      languageId: 'luau',
      version,
      text: content,
    },
  });
}

export async function updateDocument(uri: string, content: string): Promise<void> {
  if (!initialized) return;

  const version = (documentVersion.get(uri) || 0) + 1;
  documentVersion.set(uri, version);

  await sendNotification('textDocument/didChange', {
    textDocument: {
      uri,
      version,
    },
    contentChanges: [{ text: content }],
  });
}

export async function closeDocument(uri: string): Promise<void> {
  if (!initialized) return;

  documentVersion.delete(uri);

  await sendNotification('textDocument/didClose', {
    textDocument: { uri },
  });
}

export async function getHover(
  uri: string,
  line: number,
  character: number
): Promise<{ contents: string } | null> {
  if (!initialized) return null;

  try {
    const response = await sendRequest('textDocument/hover', {
      textDocument: { uri },
      position: { line, character },
    }) as { result?: { contents: unknown } };

    if (response.result?.contents) {
      const contents = response.result.contents;
      if (typeof contents === 'string') {
        return { contents };
      }
      if (typeof contents === 'object' && 'value' in (contents as Record<string, unknown>)) {
        return { contents: (contents as { value: string }).value };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function getCompletions(
  uri: string,
  line: number,
  character: number
): Promise<unknown[]> {
  if (!initialized) return [];

  try {
    const response = await sendRequest('textDocument/completion', {
      textDocument: { uri },
      position: { line, character },
    }) as { result?: { items?: unknown[] } | unknown[] };

    if (Array.isArray(response.result)) {
      return response.result;
    }
    if (response.result?.items) {
      return response.result.items;
    }
    return [];
  } catch {
    return [];
  }
}

export async function getSignatureHelp(
  uri: string,
  line: number,
  character: number
): Promise<unknown | null> {
  if (!initialized) return null;

  try {
    const response = await sendRequest('textDocument/signatureHelp', {
      textDocument: { uri },
      position: { line, character },
    }) as { result?: unknown };

    return response.result || null;
  } catch {
    return null;
  }
}

export function fileIdToUri(_fileId: string, fileName: string): string {
  return `file:///${fileName}`;
}
