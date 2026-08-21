'use client';

import { useEffect } from 'react';
import { getThemeSnapshot, subscribe } from '../lib/theme';

/**
 * Mounted once (in the locale layout). Subscribes to the shared theme store and
 * applies it to <html data-bs-theme>. Changing the theme in the settings cog
 * updates every mounted screen immediately without a reload.
 */
export default function ThemeManager() {
  const apply = () => {
    const current = getThemeSnapshot();
    document.documentElement.setAttribute('data-bs-theme', current);
  };
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-bs-theme', getThemeSnapshot());
  }
  useEffect(() => {
    const unsub = subscribe(apply);
    return () => { unsub(); };
  }, []);

  return null;
}
