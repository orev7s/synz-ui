export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  id: string;
  fileId: string;
  fileName: string;
  severity: DiagnosticSeverity;
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  timestamp: Date;
}

export interface DiagnosticCounts {
  errors: number;
  warnings: number;
  info: number;
}

let diagnostics: Map<string, Diagnostic[]> = new Map();
let listeners: Set<() => void> = new Set();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function generateId(): string {
  return `diag_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function setDiagnostics(fileId: string, fileName: string, items: Omit<Diagnostic, 'id' | 'fileId' | 'fileName' | 'timestamp'>[]): void {
  const newDiagnostics: Diagnostic[] = items.map((item) => ({
    ...item,
    id: generateId(),
    fileId,
    fileName,
    timestamp: new Date(),
  }));

  diagnostics.set(fileId, newDiagnostics);
  notifyListeners();
}

export function clearDiagnostics(fileId: string): void {
  if (diagnostics.has(fileId)) {
    diagnostics.delete(fileId);
    notifyListeners();
  }
}

export function clearAllDiagnostics(): void {
  diagnostics.clear();
  notifyListeners();
}

export function getDiagnostics(fileId: string): Diagnostic[] {
  return diagnostics.get(fileId) || [];
}

export function getAllDiagnostics(): Diagnostic[] {
  const all: Diagnostic[] = [];
  for (const items of diagnostics.values()) {
    all.push(...items);
  }
  return all.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function getDiagnosticCounts(): DiagnosticCounts {
  const counts: DiagnosticCounts = { errors: 0, warnings: 0, info: 0 };

  for (const items of diagnostics.values()) {
    for (const item of items) {
      if (item.severity === 'error') counts.errors++;
      else if (item.severity === 'warning') counts.warnings++;
      else counts.info++;
    }
  }

  return counts;
}

export function subscribeToDiagnostics(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
