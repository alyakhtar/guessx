'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { buildDailyChallengeShareText, type DailyChallengeShareAttempt } from '../lib/dailyChallengeShare';
import { canNativeShare, copyToClipboard } from '../lib/share';

type DailyChallengeShareButtonAttempt = DailyChallengeShareAttempt | (Omit<DailyChallengeShareAttempt, 'status'> & { status: 'active' });

export default function DailyChallengeShareButton({ attempt }: { attempt: DailyChallengeShareButtonAttempt }) {
  const locale = useLocale();
  const t = useTranslations('daily.share');
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  if (attempt.status === 'active') return null;

  const share = async () => {
    const text = buildDailyChallengeShareText(attempt);
    const url = new URL(`/${locale}/daily`, window.location.origin).toString();
    setCopied(false);
    setFailed(false);

    if (canNativeShare()) {
      try {
        await navigator.share({ title: t('title'), text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    if (await copyToClipboard(`${text}\n${url}`)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } else {
      setFailed(true);
    }
  };

  return (
    <div className="mt-3">
      <button type="button" className="btn btn-outline-primary w-100" onClick={share}>
        {copied ? t('copied') : t('button')}
      </button>
      {failed && <p className="text-danger small text-center mt-2 mb-0" role="alert">{t('failed')}</p>}
    </div>
  );
}
