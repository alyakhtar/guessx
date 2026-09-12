'use client';

import { useState } from 'react';
import Link from 'next/link';
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
    <div className="d-flex flex-column align-items-center gap-1">
      <div className="d-flex flex-wrap justify-content-center align-items-center gap-2">
        <span
          className="small text-muted text-truncate"
          style={{ maxWidth: 'min(16rem, calc(100vw - 10rem))' }}
          title={name ?? undefined}
        >
          {t('signedInAs', { name: name ?? t('playerFallback') })}
        </span>
        <Link className="btn btn-outline-primary btn-sm" href={`/${locale}/stats`}>
          {t('stats')}
        </Link>
        {session.user.isAdmin && (
          <Link className="btn btn-outline-secondary btn-sm" href="/admin">
            {t('admin')}
          </Link>
        )}
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
