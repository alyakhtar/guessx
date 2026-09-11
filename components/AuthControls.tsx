'use client';

import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';

import { useApplicationAuthAvailable } from './AuthProvider';

function AvailableAuthControl() {
  const t = useTranslations('lobby.account');
  const locale = useLocale();
  const { data: session, status } = useSession();
  const [isWorking, setIsWorking] = useState(false);
  const [hasFailure, setHasFailure] = useState(false);

  const returnToLobby = `/${locale}`;

  const logout = async () => {
    setHasFailure(false);
    setIsWorking(true);
    try {
      await signOut({ redirectTo: returnToLobby });
    } catch {
      setHasFailure(true);
      setIsWorking(false);
    }
  };

  if (status !== 'authenticated' || !session?.user) return null;

  const name = session.user.name || session.user.email;
  return (
    <div className="d-flex flex-column align-items-end gap-1 w-100">
      <div className="d-flex justify-content-end align-items-center gap-2 w-100">
        <span className="small text-muted text-truncate" style={{ minWidth: 0 }} title={name ?? undefined}>
          {t('signedInAs', { name: name ?? t('playerFallback') })}
        </span>
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        disabled={isWorking}
        onClick={logout}
      >
        {isWorking ? t('signingOut') : t('signOut')}
      </button>
      </div>
      {hasFailure && <span className="small text-danger" role="status">{t('failure')}</span>}
    </div>
  );
}

export default function AuthControls() {
  const available = useApplicationAuthAvailable();
  return available ? <AvailableAuthControl /> : null;
}
