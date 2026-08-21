'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import SettingsPanel from './SettingsPanel';

export default function SettingsCog() {
  const t = useTranslations('settings');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        aria-label={t('openAriaLabel')}
        onClick={() => setOpen(true)}
      >
        ⚙️
      </button>
      <SettingsPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
