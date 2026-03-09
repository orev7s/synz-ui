import { invoke } from '@tauri-apps/api/core';
import { readTextFile, writeTextFile, exists, BaseDirectory } from '@tauri-apps/plugin-fs';

interface AuthState {
  isRemembered: boolean;
  licenseKey?: string;
  sessionToken?: string;
  displayName?: string;
  expiresAt?: string;
}

export interface AuthSessionData {
  token: string;
  licenseKey: string;
  displayName: string;
  expiresAt?: string;
}

const AUTH_FILE = 'auth.json';

let cachedSession: AuthState | null = null;

export async function saveAuthState(
  isRemembered: boolean,
  licenseKey?: string,
  sessionData?: AuthSessionData
): Promise<void> {
  const state: AuthState = {
    isRemembered,
    licenseKey: isRemembered ? licenseKey : undefined,
    sessionToken: sessionData?.token,
    displayName: sessionData?.displayName,
    expiresAt: sessionData?.expiresAt,
  };

  cachedSession = state;

  try {
    await writeTextFile(AUTH_FILE, JSON.stringify(state), {
      baseDir: BaseDirectory.AppData,
    });
  } catch {}
}

export async function loadAuthState(): Promise<AuthState | null> {
  try {
    const fileExists = await exists(AUTH_FILE, { baseDir: BaseDirectory.AppData });
    if (!fileExists) return null;

    const content = await readTextFile(AUTH_FILE, { baseDir: BaseDirectory.AppData });
    const parsed = JSON.parse(content) as AuthState & { email?: string };
    const state: AuthState = {
      isRemembered: parsed.isRemembered,
      licenseKey: parsed.licenseKey ?? parsed.email,
      sessionToken: parsed.sessionToken,
      displayName: parsed.displayName,
      expiresAt: parsed.expiresAt,
    };

    cachedSession = state;
    return state;
  } catch {
    return null;
  }
}

export async function loginWithLicense(licenseKey: string): Promise<AuthSessionData | null> {
  const trimmedLicense = licenseKey.trim();
  if (!trimmedLicense) {
    return null;
  }

  try {
    const session = await invoke<Omit<AuthSessionData, 'licenseKey'>>('redeem_license', {
      license: trimmedLicense,
    });

    return {
      ...session,
      licenseKey: trimmedLicense,
    };
  } catch {
    return null;
  }
}

export async function validateSession(): Promise<boolean> {
  const state = await loadAuthState();
  if (!state?.isRemembered || !state.sessionToken || !state.licenseKey) {
    return false;
  }

  try {
    return await invoke<boolean>('validate_license_session', {
      license: state.licenseKey,
    });
  } catch {
    return state.isRemembered && !!state.sessionToken && !!state.licenseKey;
  }
}

export function getSession(): AuthState | null {
  return cachedSession;
}

export async function clearAuthState(): Promise<void> {
  cachedSession = null;
  try {
    await writeTextFile(AUTH_FILE, JSON.stringify({ isRemembered: false }), {
      baseDir: BaseDirectory.AppData,
    });
  } catch {}
}
