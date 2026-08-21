'use client';

import { useEffect, useState } from 'react';
import { getTheme, subscribe, type Theme } from '../lib/theme';

/**
 * Mounted once (in the locale layout). Subscribes to the shared theme store and
 * applies it to <html data-bs-theme>. Changing the theme in the settings cog
 * updates every mounted screen immediately without a reload.
 */
export default function ThemeManager() {
  const [theme, setTheme] = useState<Theme>('dark');

  const apply = () => {
    const current = getTheme();
    setTheme(current);
    document.documentElement.setAttribute('data-bs-theme', current);
  };
  apply();
  useEffect(() => {
    const unsub = subscribe(apply);
    return () => { unsub(); };
  }, []);

  return null;
}
