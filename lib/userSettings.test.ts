import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'guessx.userSettings.v1';

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();
  readonly getItem = vi.fn((key: string) => this.values.get(key) ?? null);
  readonly setItem = vi.fn((key: string, value: string) => {
    this.values.set(key, value);
  });
  readonly removeItem = vi.fn((key: string) => this.values.delete(key));
  readonly clear = vi.fn(() => this.values.clear());
  readonly key = vi.fn((index: number) => [...this.values.keys()][index] ?? null);

  get length() {
    return this.values.size;
  }
}

class MemoryWindow extends EventTarget {
  readonly localStorage = new MemoryStorage();
}

let browser: MemoryWindow;

async function loadSettings() {
  vi.resetModules();
  return import('./userSettings');
}

beforeEach(() => {
  browser = new MemoryWindow();
  vi.stubGlobal('window', browser);
  vi.stubGlobal('localStorage', browser.localStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getSettings', () => {
  it('returns defaults when storage is empty', async () => {
    const { DEFAULTS, getSettings } = await loadSettings();

    expect(getSettings()).toBe(DEFAULTS);
  });

  it('returns defaults without throwing for corrupt JSON', async () => {
    browser.localStorage.values.set(STORAGE_KEY, '{');
    const { DEFAULTS, getSettings } = await loadSettings();

    expect(getSettings()).toBe(DEFAULTS);
  });

  it.each(['null', '42', '"hello"'])('returns defaults for non-object JSON %s', async (stored) => {
    browser.localStorage.values.set(STORAGE_KEY, stored);
    const { DEFAULTS, getSettings } = await loadSettings();

    expect(getSettings()).toBe(DEFAULTS);
  });

  it('ignores unknown keys and merges known booleans over defaults', async () => {
    browser.localStorage.values.set(
      STORAGE_KEY,
      JSON.stringify({ sideBySideBoard: true, futureSetting: true }),
    );
    const { getSettings } = await loadSettings();

    expect(getSettings()).toEqual({ sideBySideBoard: true, revealSecretsOnWin: false });
    expect(getSettings()).not.toHaveProperty('futureSetting');
  });

  it('uses the default for a wrong-typed known key', async () => {
    browser.localStorage.values.set(
      STORAGE_KEY,
      JSON.stringify({ sideBySideBoard: 'false', revealSecretsOnWin: true }),
    );
    const { getSettings } = await loadSettings();

    expect(getSettings()).toEqual({ sideBySideBoard: false, revealSecretsOnWin: true });
  });

  it('uses the schema as the allowlist for stored keys', async () => {
    browser.localStorage.values.set(STORAGE_KEY, JSON.stringify({ sideBySideBoard: true }));
    const { SETTINGS_SCHEMA, getSettings } = await loadSettings();
    const schema = SETTINGS_SCHEMA as unknown as Array<(typeof SETTINGS_SCHEMA)[number]>;
    const sideBySideSetting = schema.shift()!;

    try {
      expect(getSettings()).toEqual({ sideBySideBoard: false, revealSecretsOnWin: false });
    } finally {
      schema.unshift(sideBySideSetting);
    }
  });

  it('returns the same snapshot reference until invalidated', async () => {
    const { getSettings } = await loadSettings();

    expect(getSettings()).toBe(getSettings());
  });
});

describe('setSetting', () => {
  it('persists a change that a fresh module reads back', async () => {
    let settings = await loadSettings();
    settings.setSetting('sideBySideBoard', true);

    settings = await loadSettings();
    expect(settings.getSettings()).toEqual({ sideBySideBoard: true, revealSecretsOnWin: false });
  });

  it('keeps failed writes in the current snapshot and merges the next write onto them', async () => {
    const settings = await loadSettings();
    browser.localStorage.setItem.mockImplementationOnce(() => {
      throw new Error('storage full');
    });

    settings.setSetting('sideBySideBoard', true);
    expect(settings.getSettings()).toEqual({ sideBySideBoard: true, revealSecretsOnWin: false });

    settings.setSetting('revealSecretsOnWin', true);

    expect(settings.getSettings()).toEqual({ sideBySideBoard: true, revealSecretsOnWin: true });
    expect(JSON.parse(browser.localStorage.values.get(STORAGE_KEY)!)).toEqual({
      sideBySideBoard: true,
      revealSecretsOnWin: true,
    });
  });

  it('notifies subscribers until they unsubscribe', async () => {
    const { getSettings, setSetting, subscribe } = await loadSettings();
    let observedSetting = false;
    const listener = vi.fn(() => {
      observedSetting = getSettings().sideBySideBoard;
    });
    const unsubscribe = subscribe(listener);

    setSetting('sideBySideBoard', true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(observedSetting).toBe(true);

    unsubscribe();
    setSetting('sideBySideBoard', false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('storage events', () => {
  it('invalidates and notifies for the settings key only', async () => {
    const { getSettings, subscribe } = await loadSettings();
    const listener = vi.fn();
    subscribe(listener);
    getSettings();

    browser.localStorage.values.set(STORAGE_KEY, JSON.stringify({ revealSecretsOnWin: true }));
    const sameKeyEvent = new Event('storage') as StorageEvent;
    Object.defineProperty(sameKeyEvent, 'key', { value: STORAGE_KEY });
    browser.dispatchEvent(sameKeyEvent);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getSettings()).toEqual({ sideBySideBoard: false, revealSecretsOnWin: true });

    const otherKeyEvent = new Event('storage') as StorageEvent;
    Object.defineProperty(otherKeyEvent, 'key', { value: 'other.key' });
    browser.dispatchEvent(otherKeyEvent);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('shouldRevealSecret', () => {
  it.each([
    [{ revealSecretsOnWin: true }, 'finished', true],
    [{ revealSecretsOnWin: true }, 'waiting', false],
    [{ revealSecretsOnWin: true }, 'playing', false],
    [{ revealSecretsOnWin: false }, 'finished', false],
  ] as const)('returns %s for %s', async (partial, gameStatus, expected) => {
    const { DEFAULTS, shouldRevealSecret } = await loadSettings();

    expect(shouldRevealSecret({ ...DEFAULTS, ...partial }, gameStatus)).toBe(expected);
  });
});
