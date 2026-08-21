'use client';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'guessx.theme.v1';
const subscribers = new Set<() => void>();
let cachedTheme: Theme | undefined;
let listening = false;

function read(): Theme {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    // ignore
  }
  // Default to dark to match existing app behavior.
  return 'dark';
}

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  if (cachedTheme) return cachedTheme;
  return (cachedTheme = read());
}

// Render-safe snapshot for useSyncExternalStore: never mutates module state.
export function getThemeSnapshot(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return cachedTheme ?? read();
}

export function setTheme(theme: Theme) {
  cachedTheme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // in-memory only
  }
  notify();
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

function notify() {
  subscribers.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  subscribers.add(listener);
  if (!listening && typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY) return;
      cachedTheme = undefined;
      notify();
    });
    listening = true;
  }
  return () => subscribers.delete(listener);
}
