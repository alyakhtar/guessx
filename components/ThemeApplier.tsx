'use client';

import { useEffect } from 'react';
import { useUserSettings } from '../lib/useUserSettings';

export default function ThemeApplier() {
  const { darkMode } = useUserSettings();
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);
  return null;
}
