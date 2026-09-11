'use client';

import { useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';

import { useApplicationAuthAvailable } from './AuthProvider';
import GoogleIcon from './GoogleIcon';

function UnavailableAuthControl() {
  const t = useTranslations('lobby.account');
  return <span className="small text-muted">{t('unavailable')}</span>;
}

function AvailableAuthControl() {
  const t = useTranslations('lobby.account');
  const locale = useLocale();
  const { data: session, status } = useSession();
  const [isWorking, setIsWorking] = useState(false);
  const [hasFailure, setHasFailure] = useState(false);

  const returnToLobby = `/${locale}`;

  const startGoogleLogin = async () => {
    setHasFailure(false);
    setIsWorking(true);
    try {
      await signIn('google', { redirectTo: returnToLobby });
    } catch {
      setHasFailure(true);
      setIsWorking(false);
    }
  };

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

  if (status === 'loading') return <span className="small text-muted">{t('loading')}</span>;

  if (session?.user) {
    const name = session.user.name || session.user.email;
    return (
      <div className="d-flex align-items-center gap-2">
        <span className="small text-muted text-truncate" title={name ?? undefined}>
          {t('signedInAs', { name: name ?? t('playerFallback') })}
        </span>
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={isWorking} onClick={logout}>
          {isWorking ? t('signingOut') : t('signOut')}
        </button>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column align-items-end gap-1">
      <button
        type="button"
        className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
        aria-label={t('signInWithGoogle')}
        disabled={isWorking}
        onClick={startGoogleLogin}
      >
        {isWorking ? t('signingIn') : <><GoogleIcon /> <span>{t('signIn')}</span></>}
      </button>
      {hasFailure && <span className="small text-danger" role="status">{t('failure')}</span>}
    </div>
  );
}

export default function AuthControls() {
  const available = useApplicationAuthAvailable();
  return available ? <AvailableAuthControl /> : <UnavailableAuthControl />;
}
