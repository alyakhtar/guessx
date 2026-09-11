'use client';

import { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

import { useApplicationAuthAvailable } from './AuthProvider';
import GoogleIcon from './GoogleIcon';

type GuestSignInPromptProps = { returnTo: string };

function AvailableGuestSignInPrompt({ returnTo }: GuestSignInPromptProps) {
  const t = useTranslations('gameRoom.guest');
  const { status } = useSession();
  const [isWorking, setIsWorking] = useState(false);

  const startSignIn = async () => {
    setIsWorking(true);
    try {
      await signIn('google', { redirectTo: returnTo });
    } catch {
      setIsWorking(false);
    }
  };

  if (status !== 'unauthenticated') return null;

  return (
    <aside className="alert alert-secondary mt-3 mb-0" aria-label={t('title')}>
      <h2 className="h6">{t('title')}</h2>
      <p className="small mb-3">{t('description')}</p>
      <button
        type="button"
        className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
        aria-label={t('signInWithGoogle')}
        disabled={isWorking}
        onClick={startSignIn}
      >
        {isWorking ? t('signingIn') : <><GoogleIcon /> <span>{t('signIn')}</span></>}
      </button>
    </aside>
  );
}

export default function GuestSignInPrompt({ returnTo }: GuestSignInPromptProps) {
  const authenticationAvailable = useApplicationAuthAvailable();
  return authenticationAvailable ? <AvailableGuestSignInPrompt returnTo={returnTo} /> : null;
}
