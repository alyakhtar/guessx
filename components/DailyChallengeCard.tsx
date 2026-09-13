'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

type DailySummary = {
  challengeNumber: number;
  status: 'active' | 'won' | 'exhausted';
  remainingGuesses: number;
};

export default function DailyChallengeCard() {
  const locale = useLocale();
  const t = useTranslations('daily.card');
  const [daily, setDaily] = useState<DailySummary | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/daily-challenge', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Daily Challenge unavailable');
        return response.json() as Promise<DailySummary>;
      })
      .then(setDaily)
      .catch((error) => {
        if (error.name !== 'AbortError') setUnavailable(true);
      });
    return () => controller.abort();
  }, []);

  if (unavailable) return null;

  return (
    <section className="card border-primary shadow-sm mb-4 text-start" aria-label={t('title')}>
      <div className="card-body p-3">
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3">
          <div>
            <p className="text-uppercase text-primary fw-semibold small mb-1">{t('eyebrow')}</p>
            <h2 className="h5 mb-1">{daily ? t('titleWithNumber', { number: daily.challengeNumber }) : t('title')}</h2>
            <p className="text-muted small mb-0">
              {daily
                ? daily.status === 'active'
                  ? t('ready', { remaining: daily.remainingGuesses })
                  : daily.status === 'won'
                    ? t('won')
                    : t('exhausted')
                : t('loading')}
            </p>
          </div>
          <Link className="btn btn-primary align-self-stretch align-self-sm-center" href={`/${locale}/daily`}>
            {daily?.status === 'active' ? t('play') : t('view')}
          </Link>
        </div>
      </div>
    </section>
  );
}
