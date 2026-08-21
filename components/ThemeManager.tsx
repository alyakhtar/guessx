'use client';

import { useEffect, useState } from 'react';
import { getTheme, subscribe } from '../lib/theme';

/**
 * Mounted once (in the locale layout). Subscribes to the shared theme store and
 * applies it to <html data-bs-theme>. Changing the theme in the settings cog
 * updates every mounted screen immediately without a reload.
 */
export default function ThemeManager() {
  const [theme, setTheme] = useState<string>('dark');

  useEffect(() => {
    const apply = () => {
      const current = getTheme();
      setTheme(current);
      document.documentElement.setAttribute('data-bs-theme', current);
    };
    apply();
    return subscribe(apply);
  }, []);

  return null;
}
