'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { dismissToast, getToasts, subscribe, type Toast } from '../lib/toast';

const EMPTY: readonly Toast[] = Object.freeze([]);

export default function ToastHost() {
  const toasts = useSyncExternalStore(subscribe, getToasts, () => EMPTY);
  const t = useTranslations('toast');

  return (
    <div
      className="toast-container position-fixed top-0 end-0 p-3"
      style={{ zIndex: 1080 }}
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map(({ id, message, variant }) => (
        <div
          key={id}
          className={`toast show align-items-center text-bg-${variant} border-0`}
          role={variant === 'danger' ? 'alert' : 'status'}
        >
          <div className="d-flex">
            <div className="toast-body text-break">{message}</div>
            <button
              type="button"
              className="btn-close btn-close-white me-2 m-auto"
              aria-label={t('close')}
              onClick={() => dismissToast(id)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
