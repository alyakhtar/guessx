import type { GameRoom } from '../types/game';

export interface UserSettings {
  sideBySideBoard: boolean;
  revealSecretsOnWin: boolean;
}

export const DEFAULTS: UserSettings = {
  sideBySideBoard: false,
  revealSecretsOnWin: false,
};

export const SETTINGS_SCHEMA = [
  {
    key: 'sideBySideBoard',
    labelKey: 'settings.sideBySideBoard.label',
    descriptionKey: 'settings.sideBySideBoard.description',
  },
  {
    key: 'revealSecretsOnWin',
    labelKey: 'settings.revealSecretsOnWin.label',
    descriptionKey: 'settings.revealSecretsOnWin.description',
  },
] as const;

const STORAGE_KEY = 'guessx.userSettings.v1';
const subscribers = new Set<() => void>();
let cachedSettings: UserSettings | undefined;
let listeningForStorage = false;

function notify() {
  subscribers.forEach((listener) => listener());
}

function readSettings(): UserSettings {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return DEFAULTS;

    const values = parsed as Record<string, unknown>;
    return SETTINGS_SCHEMA.reduce<UserSettings>((settings, setting) => {
      const value = values[setting.key];
      settings[setting.key] = typeof value === 'boolean' ? value : DEFAULTS[setting.key];
      return settings;
    }, { ...DEFAULTS });
  } catch {
    return DEFAULTS;
  }
}

export function getSettings(): UserSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  if (cachedSettings) return cachedSettings;
  return (cachedSettings = readSettings());
}

export function setSetting<Key extends keyof UserSettings>(key: Key, value: UserSettings[Key]) {
  cachedSettings = { ...getSettings(), [key]: value };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedSettings));
  } catch {
    // The in-memory setting remains active when storage is unavailable.
  }
  notify();
}

export function subscribe(listener: () => void) {
  subscribers.add(listener);
  if (!listeningForStorage && typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY) return;
      cachedSettings = undefined;
      notify();
    });
    listeningForStorage = true;
  }

  return () => subscribers.delete(listener);
}

export function shouldRevealSecret(
  settings: UserSettings,
  gameStatus: GameRoom['gameStatus'],
) {
  return settings.revealSecretsOnWin && gameStatus === 'finished';
}
