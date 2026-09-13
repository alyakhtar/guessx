'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { TRACKED_DIGITS, nextDigitTrackerState, type DigitTrackerState } from '../lib/digitTracker';

const buttonClass: Record<DigitTrackerState, string> = {
  unknown: 'btn-outline-secondary',
  eliminated: 'btn-outline-danger text-decoration-line-through',
  confirmed: 'btn-success',
};

export default function DigitTracker() {
  const t = useTranslations('digitTracker');
  const [states, setStates] = useState<Record<string, DigitTrackerState>>({});

  return (
    <section className="border-top mt-4 pt-3" aria-labelledby="digit-tracker-title">
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-baseline gap-1 mb-3">
        <h3 className="h6 fw-semibold mb-0" id="digit-tracker-title">{t('title')}</h3>
        <p className="small text-muted mb-0">{t('help')}</p>
      </div>
      <div className="d-flex flex-wrap justify-content-center gap-2" role="list" aria-label={t('title')}>
        {TRACKED_DIGITS.map((digit) => {
          const state = states[digit] ?? 'unknown';
          return (
            <button
              key={digit}
              type="button"
              className={`btn ${buttonClass[state]} fw-bold font-monospace`}
              style={{ width: '2.75rem', minHeight: '2.75rem' }}
              aria-label={t('digitLabel', { digit, state: t(`states.${state}`) })}
              onClick={() => setStates((current) => ({ ...current, [digit]: nextDigitTrackerState(current[digit] ?? 'unknown') }))}
            >
              {digit}
            </button>
          );
        })}
      </div>
      <p className="small text-muted text-center mt-3 mb-0">{t('legend')}</p>
    </section>
  );
}
