'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { SETTINGS_SCHEMA, setSetting } from '../lib/userSettings';
import type { UserSettings } from '../lib/userSettings';
import { useUserSettings } from '../lib/useUserSettings';
import { getTheme, toggleTheme } from '../lib/theme';
import LocaleSelector from './LocaleSelector';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const t = useTranslations();
  const settings = useUserSettings();

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  const theme = getTheme();

  return (
    <div
      className="modal show d-block"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settingsModalTitle"
      style={{ background: 'rgba(0,0,0,0.65)', zIndex: 1050 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title fs-5" id="settingsModalTitle">
              {t('settings.title')}
            </h2>
            <button
              type="button"
              className="btn-close"
              aria-label={t('settings.close')}
              onClick={onClose}
            />
          </div>
          <div className="modal-body">
            {/* Language + theme - available on every screen via the cog */}
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small">{t('settings.language')}</span>
              <LocaleSelector />
            </div>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <span className="text-muted small">{t('settings.theme')}</span>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => toggleTheme()}
                aria-label={t('settings.toggleTheme')}
              >
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
                  onChange={(event) => setSetting(setting.key, event.target.checked)}
                />
                <label className="form-check-label" htmlFor={`setting-${setting.key}`}>
                  {t(setting.labelKey)}
                </label>
                <div className="form-text text-muted">{t(setting.descriptionKey)}</div>
              </div>
            ) : (
              <div className="mb-3" key={setting.key}>
                <label className="form-label" htmlFor={`setting-${setting.key}`}>
                  {t(`${setting.labelKey}.label`)}
                </label>
                <select
                  className="form-select"
                  id={`setting-${setting.key}`}
                  value={settings[setting.key]}
                  onChange={(event) => setSetting(
                    setting.key,
                    Number(event.target.value) as UserSettings[typeof setting.key],
                  )}
                >
                  {setting.options.map((option) => (
                    <option key={option} value={option}>
                      {t(`${setting.labelKey}.options.${option}`)}
                    </option>
                  ))}
                </select>
                <div className="form-text text-muted">{t(setting.descriptionKey)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
