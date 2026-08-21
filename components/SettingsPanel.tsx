'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { SETTINGS_SCHEMA, setSetting } from '../lib/userSettings';
import { useUserSettings } from '../lib/useUserSettings';

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
            {SETTINGS_SCHEMA.map((setting) => (
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
