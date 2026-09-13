'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { buildDailyChallengeShareMessage, type DailyChallengeShareAttempt } from '../lib/dailyChallengeShare';
import { canNativeShare, copyToClipboard } from '../lib/share';

type DailyChallengeShareButtonAttempt = DailyChallengeShareAttempt | (Omit<DailyChallengeShareAttempt, 'status'> & { status: 'active' });

export default function DailyChallengeShareButton({ attempt, streak }: { attempt: DailyChallengeShareButtonAttempt; streak?: number }) {
  const locale = useLocale();
  const t = useTranslations('daily.share');
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  if (attempt.status === 'active') return null;

  const result = () => buildDailyChallengeShareMessage(
    { ...attempt, ...(streak ? { streak } : {}) },
    new URL(`/${locale}/daily`, window.location.origin).toString(),
  );

  const copyResult = async () => {
    setCopied(false);
    setFailed(false);
    if (await copyToClipboard(result())) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
      return true;
    }
    setFailed(true);
    return false;
  };

  const share = async () => {
    setCopied(false);
    setFailed(false);
    if (canNativeShare()) {
      try {
        // Safari's Messages target can discard `text` when the Web Share URL
        // field is also supplied. Keep the entire result in `text` instead.
        await navigator.share({ title: t('title'), text: result() });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    await copyResult();
  };

  return (
    <div className="mt-3">
      <div className="d-grid d-sm-flex gap-2">
        <button type="button" className="btn btn-primary flex-sm-fill" onClick={share}>{t('button')}</button>
        <button type="button" className="btn btn-outline-primary flex-sm-fill" onClick={() => void copyResult()}>{copied ? t('copied') : t('copy')}</button>
      </div>
      {failed && <p className="text-danger small text-center mt-2 mb-0" role="alert">{t('failed')}</p>}
    </div>
  );
}
