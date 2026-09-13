'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { hasSeenOnboarding, markOnboardingSeen } from '../lib/onboarding';

const STEP_KEYS = ['secret', 'turns', 'feedback'] as const;

export default function FirstVisitOnboarding() {
  const t = useTranslations('lobby.onboarding');
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const close = () => {
    markOnboardingSeen(window.localStorage);
    setOpen(false);
  };

  const reopen = () => {
    setStep(0);
    setOpen(true);
  };

  useEffect(() => {
    if (!hasSeenOnboarding(window.localStorage)) setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const stepKey = STEP_KEYS[step];
  const isLastStep = step === STEP_KEYS.length - 1;

  return (
    <>
      <button type="button" className="btn btn-link btn-sm p-0" onClick={reopen} aria-haspopup="dialog">
        {t('open')}
      </button>

      {open && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboardingTitle"
          style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered mx-3 mx-sm-auto">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title fs-5" id="onboardingTitle">{t('title')}</h2>
                <button type="button" className="btn-close" aria-label={t('close')} onClick={close} />
              </div>
              <div className="modal-body">
                <p className="small text-muted text-uppercase fw-semibold mb-3">
                  {t('progress', { current: step + 1, total: STEP_KEYS.length })}
                </p>
                <h3 className="h4">{t(`steps.${stepKey}.title`)}</h3>
                <p className="mb-0">{t(`steps.${stepKey}.description`)}</p>
              </div>
              <div className="modal-footer d-flex justify-content-between gap-2">
                <button
                  type="button"
                  className={`btn btn-outline-secondary ${step === 0 ? 'invisible' : ''}`}
                  onClick={() => setStep((currentStep) => currentStep - 1)}
                  tabIndex={step === 0 ? -1 : undefined}
                >
                  {t('back')}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => (isLastStep ? close() : setStep((currentStep) => currentStep + 1))}
                >
                  {isLastStep ? t('done') : t('next')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
