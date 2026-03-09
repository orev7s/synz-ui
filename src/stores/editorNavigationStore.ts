interface NavigationRequest {
  fileId: string;
  line: number;
  column: number;
}

type NavigationListener = (request: NavigationRequest) => void;

let listeners: Set<NavigationListener> = new Set();

export function navigateToPosition(fileId: string, line: number, column: number): void {
  const request: NavigationRequest = { fileId, line, column };
  listeners.forEach((listener) => listener(request));
}

export function subscribeToNavigation(callback: NavigationListener): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}
