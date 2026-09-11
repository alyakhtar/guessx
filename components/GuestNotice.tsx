'use client';

import { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';

import { useApplicationAuthAvailable } from './AuthProvider';
import GoogleIcon from './GoogleIcon';

function GuestNoticeContent() {
  const t = useTranslations('lobby.guestNotice');
  const locale = useLocale();
  const { status } = useSession();
  const [isWorking, setIsWorking] = useState(false);

  const startSignIn = async () => {
    setIsWorking(true);
    try {
      await signIn('google', { redirectTo: `/${locale}` });
    } catch {
      setIsWorking(false);
    }
  };

  if (status !== 'unauthenticated') return null;

  return (
    <aside className="alert alert-secondary py-3 mb-3" aria-label={t('title')}>
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
        <div>
          <h3 className="h6 mb-1">{t('title')}</h3>
          <p className="small mb-0">{t('description')}</p>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1 align-self-start align-self-sm-center"
          aria-label={t('signInWithGoogle')}
          disabled={isWorking}
          onClick={startSignIn}
        >
          {isWorking ? t('signingIn') : <><GoogleIcon /> <span>{t('signIn')}</span></>}
        </button>
      </div>
    </aside>
  );
}

export default function GuestNotice() {
  const authenticationAvailable = useApplicationAuthAvailable();
  return authenticationAvailable ? <GuestNoticeContent /> : null;
}
