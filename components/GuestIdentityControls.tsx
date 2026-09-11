'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

import { announceGuestNameChange, generateNewGuestIdentityName, getOrCreateGuestIdentity } from '../lib/guestIdentity';
import { useApplicationAuthAvailable } from './AuthProvider';

type GuestIdentityControlsProps = {
  onNameChange: (name: string) => void;
};

function GuestActions({ onNameChange }: GuestIdentityControlsProps) {
  const t = useTranslations('lobby.guest');
  const [guestName, setGuestName] = useState<string | null>(null);

  const applyGuestIdentity = (generateNewName: boolean) => {
    const identity = generateNewName
      ? generateNewGuestIdentityName(window.localStorage)
      : getOrCreateGuestIdentity(window.localStorage);
    setGuestName(identity.displayName);
    onNameChange(identity.displayName);
    announceGuestNameChange();
  };

  return (
    <div className="border rounded p-3 mb-3 bg-body-tertiary">
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
        <div>
          <h3 className="h6 mb-1">{t('title')}</h3>
          <p className="small text-muted mb-0">{t('description')}</p>
        </div>
        <button type="button" className="btn btn-outline-primary" onClick={() => applyGuestIdentity(false)}>
          {t('continue')}
        </button>
      </div>
      <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
        <button type="button" className="btn btn-link btn-sm p-0" onClick={() => applyGuestIdentity(true)}>
          {t('generate')}
        </button>
        {guestName && <span className="small text-muted">{t('ready', { name: guestName })}</span>}
      </div>
    </div>
  );
}

function SessionAwareGuestIdentityControls({ onNameChange }: GuestIdentityControlsProps) {
  const { status } = useSession();
  if (status === 'loading' || status === 'authenticated') return null;
  return <GuestActions onNameChange={onNameChange} />;
}

export default function GuestIdentityControls({ onNameChange }: GuestIdentityControlsProps) {
  const authenticationAvailable = useApplicationAuthAvailable();
  return authenticationAvailable
    ? <SessionAwareGuestIdentityControls onNameChange={onNameChange} />
    : <GuestActions onNameChange={onNameChange} />;
}
