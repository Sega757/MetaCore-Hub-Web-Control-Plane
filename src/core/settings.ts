import type { EnginePolicy } from './types';

export type ThemeMode = 'dark' | 'light';
export type Locale = 'ru' | 'en';
export type SecretStorageMode = 'memory' | 'session';

export interface SecretCredentials {
  geminiApiKey: string;
  secondaryProviderKey: string;
  daemonBearerToken: string;
}

export interface AppPreferences {
  theme: ThemeMode;
  locale: Locale;
  secretStorageMode: SecretStorageMode;
  daemonBaseUrl: string;
}

const PREFS_KEY = 'metacore_hub_prefs_v1';
const SESSION_SECRETS_KEY = 'metacore_hub_session_secrets_v1';

export const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'dark',
  locale: 'ru',
  secretStorageMode: 'memory',
  daemonBaseUrl: 'http://localhost:8000',
};

export const EMPTY_SECRETS: SecretCredentials = {
  geminiApiKey: '',
  secondaryProviderKey: '',
  daemonBearerToken: '',
};

export function loadPreferences(): AppPreferences {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      locale: parsed.locale === 'en' ? 'en' : 'ru',
      secretStorageMode: parsed.secretStorageMode === 'session' ? 'session' : 'memory',
      daemonBaseUrl:
        typeof parsed.daemonBaseUrl === 'string' && parsed.daemonBaseUrl.trim()
          ? parsed.daemonBaseUrl.trim()
          : DEFAULT_PREFERENCES.daemonBaseUrl,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(prefs: AppPreferences): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSessionSecrets(mode: SecretStorageMode): SecretCredentials {
  if (mode !== 'session') return { ...EMPTY_SECRETS };
  try {
    const raw = window.sessionStorage.getItem(SESSION_SECRETS_KEY);
    if (!raw) return { ...EMPTY_SECRETS };
    const parsed = JSON.parse(raw) as Partial<SecretCredentials>;
    return {
      geminiApiKey: typeof parsed.geminiApiKey === 'string' ? parsed.geminiApiKey : '',
      secondaryProviderKey:
        typeof parsed.secondaryProviderKey === 'string' ? parsed.secondaryProviderKey : '',
      daemonBearerToken:
        typeof parsed.daemonBearerToken === 'string' ? parsed.daemonBearerToken : '',
    };
  } catch {
    return { ...EMPTY_SECRETS };
  }
}

export function persistSecrets(secrets: SecretCredentials, mode: SecretStorageMode): void {
  try {
    if (mode === 'session') {
      window.sessionStorage.setItem(SESSION_SECRETS_KEY, JSON.stringify(secrets));
    } else {
      window.sessionStorage.removeItem(SESSION_SECRETS_KEY);
    }
  } catch {
    // Ignore storage access errors
  }
}

export function clearStoredSecrets(): void {
  try {
    window.sessionStorage.removeItem(SESSION_SECRETS_KEY);
  } catch {
    // Ignore
  }
}

function escapeEnvValue(value: string): string {
  const sanitized = value.replace(/\r?\n/g, '');
  if (/[\s"'#]/.test(sanitized)) {
    return `"${sanitized.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return sanitized;
}

/**
 * Generates a valid .env configuration file for running the Sega757/Metacore-Hub
 * Python daemon locally without manual editing.
 */
export function buildDaemonEnvFile(params: {
  secrets: SecretCredentials;
  daemonBaseUrl: string;
  policy: EnginePolicy;
}): string {
  const { secrets, daemonBaseUrl, policy } = params;
  const lines = [
    '# MetaCore Hub — Local Python Daemon Configuration',
    '# Generated from Web Control Plane Settings (never commit real secrets to git)',
    '',
    '# === LLM Arbiter Providers ===',
    `GEMINI_API_KEY=${escapeEnvValue(secrets.geminiApiKey || 'REPLACE_WITH_GEMINI_API_KEY')}`,
    `SECONDARY_LLM_API_KEY=${escapeEnvValue(secrets.secondaryProviderKey || '')}`,
    '',
    '# === Daemon Transport & Auth ===',
    `METACORE_DAEMON_URL=${escapeEnvValue(daemonBaseUrl)}`,
    `METACORE_DAEMON_BEARER_TOKEN=${escapeEnvValue(secrets.daemonBearerToken || 'CHANGE_ME_LOCAL_TOKEN')}`,
    '',
    '# === Deterministic CoreEngine Policy ===',
    `METACORE_AUTO_MERGE_THRESHOLD=${policy.auto_merge_threshold.toFixed(2)}`,
    `METACORE_MAX_REWORK=${policy.max_rework}`,
    `METACORE_HITL_MODE=${policy.hitl_mode ? 'true' : 'false'}`,
    `METACORE_STALL_TIMEOUT_SEC=${policy.stall_timeout_sec}`,
    '',
  ];
  return lines.join('\n');
}
