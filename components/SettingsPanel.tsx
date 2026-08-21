'use client';

import { useSyncExternalStore, useEffect, useReducer } from 'react';
import { useTranslations } from 'next-intl';
import { SETTINGS_SCHEMA, setSetting, subscribe, getSettings, DEFAULTS } from '../lib/userSettings';
import type { UserSettings } from '../lib/userSettings';
import { getTheme, toggleTheme } from '../lib/theme';
import LocaleSelector from './LocaleSelector';

export default function SettingsPanel({ isOpen, onClose }: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const t = useTranslations();
  const settings = useSyncExternalStore(subscribe, getSettings, () => DEFAULTS);
  const [, forceTheme] = useReducer((x) => x + 1, 0);
  const theme = getTheme();
  useEffect(() => {
    const unsub = subscribe(forceTheme);
    return () => { unsub(); };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="modal show d-block" tabIndex={-1} role="dialog" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{t('settings.title')}</h5>
            <button type="button" className="btn-close" aria-label={t('settings.close')} onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label fw-semibold">{t('settings.language')}</label>
              <LocaleSelector />
            </div>
                        <div className="mb-3 d-flex justify-content-between align-items-center">
              <label className="form-label fw-semibold mb-0">{t('settings.theme')}</label>
              <button type="button" className="btn btn-outline-secondary" onClick={() => toggleTheme()} aria-label={t('settings.toggleTheme')}>
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            </div>
            <hr />
            {SETTINGS_SCHEMA.map((setting) => setting.type === 'toggle' ? (
              <div className="form-check form-switch mb-3" key={setting.key}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id={`setting-${setting.key}`}
                  checked={settings[setting.key]}
                  onChange={(event) => setSetting(setting.key, event.target.checked as UserSettings[typeof setting.key])}
                />
                <label className="form-check-label" htmlFor={`setting-${setting.key}`}>
                  {t(setting.labelKey)}
                  <div className="form-text text-muted">{t(setting.descriptionKey)}</div>
                </label>
              </div>
            ) : null)}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('settings.close')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
