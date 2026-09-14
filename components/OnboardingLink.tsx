'use client';

import { useTranslations } from 'next-intl';

import { openOnboarding } from '../lib/onboarding';

export default function OnboardingLink() {
  const t = useTranslations('lobby.onboarding');

  return (
    <button type="button" className="btn btn-link btn-sm p-0" onClick={openOnboarding} aria-haspopup="dialog">
      {t('open')}
    </button>
  );
}
