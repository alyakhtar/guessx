'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';

import GoogleIcon from './GoogleIcon';
import { useApplicationAuthAvailable } from './AuthProvider';
import DailyChallengeShareButton from './DailyChallengeShareButton';
import {
  guestDailyChallengeStreak,
  recordGuestDailyChallengeCompletion,
} from '../lib/dailyChallengeStreak';

type DailyGuess = {
  guess: string;
  correctPositions: number;
  createdAt: string;
};

type DailyAttempt = {
  challengeDate: string;
  challengeNumber: number;
  numberLength: number;
  maxGuesses: number;
  guesses: DailyGuess[];
  status: 'active' | 'won' | 'exhausted';
  remainingGuesses: number;
  participantKind: 'account' | 'guest';
  streak?: number;
  answer?: string;
};

function DailyChallengeSignInPrompt() {
  const locale = useLocale();
  const t = useTranslations('daily.signIn');
  const { status } = useSession();
  const [isWorking, setIsWorking] = useState(false);

  if (status !== 'unauthenticated') return null;

  const startSignIn = async () => {
    setIsWorking(true);
    try {
      await signIn('google', { redirectTo: `/${locale}/daily` });
    } catch {
      setIsWorking(false);
    }
  };

  return (
    <aside className="alert alert-info mt-3 mb-0" aria-label={t('title')}>
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
        <div>
          <h2 className="h6 mb-1">{t('title')}</h2>
          <p className="small mb-0">{t('description')}</p>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1 align-self-start align-self-sm-center"
          aria-label={t('buttonWithGoogle')}
          disabled={isWorking}
          onClick={startSignIn}
        >
          {isWorking ? t('working') : <><GoogleIcon /> <span>{t('button')}</span></>}
        </button>
      </div>
    </aside>
  );
}

export default function DailyChallenge() {
  const locale = useLocale();
  const t = useTranslations('daily');
  const applicationAuthAvailable = useApplicationAuthAvailable();
  const [attempt, setAttempt] = useState<DailyAttempt | null>(null);
  const [guess, setGuess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [guestStreak, setGuestStreak] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadAttempt = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/daily-challenge', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || t('errors.unavailable'));
      if (payload.participantKind === 'guest') {
        const streak = payload.status === 'active'
          ? guestDailyChallengeStreak(window.localStorage, payload.challengeDate)
          : recordGuestDailyChallengeCompletion(window.localStorage, payload.challengeDate);
        setGuestStreak(streak);
      }
      setAttempt(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('errors.unavailable'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // This is an asynchronous request, not a synchronous state derivation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAttempt();
  }, [loadAttempt]);

  useEffect(() => {
    if (attempt?.status === 'active' && !loading) inputRef.current?.focus();
  }, [attempt?.status, loading]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!attempt || attempt.status !== 'active' || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/daily-challenge/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guess }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || t('errors.submit'));
      if (payload.participantKind === 'guest' && payload.status !== 'active') {
        setGuestStreak(recordGuestDailyChallengeCompletion(window.localStorage, payload.challengeDate));
      }
      setAttempt(payload);
      setGuess('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('errors.submit'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main className="container py-4 py-md-5"><p className="text-center text-muted">{t('loading')}</p></main>;
  }

  if (!attempt) {
    return (
      <main className="container py-4 py-md-5">
        <div className="card mx-auto text-center p-4" style={{ maxWidth: '34rem' }}>
          <h1 className="h3">{t('title')}</h1>
          <p className="text-danger">{error || t('errors.unavailable')}</p>
          <button className="btn btn-primary" onClick={() => void loadAttempt()}>{t('retry')}</button>
        </div>
      </main>
    );
  }

  const complete = attempt.status !== 'active';
  const statusTitle = attempt.status === 'won' ? t('complete.wonTitle') : t('complete.exhaustedTitle');

  return (
    <main className="container py-3 py-sm-4 py-md-5">
      <div className="mx-auto" style={{ maxWidth: '42rem' }}>
        <Link href={`/${locale}`} className="btn btn-link px-0 mb-3">← {t('backToLobby')}</Link>
        <section className="card shadow-sm">
          <div className="card-body p-3 p-sm-4">
            <div className="text-center mb-4">
              <p className="text-uppercase text-primary fw-semibold small mb-1">{t('eyebrow')}</p>
              <h1 className="h2 mb-2">{t('titleWithNumber', { number: attempt.challengeNumber })}</h1>
              <p className="text-muted mb-0">{t('instructions', { length: attempt.numberLength, max: attempt.maxGuesses })}</p>
            </div>

            {complete ? (
              <div className={`alert ${attempt.status === 'won' ? 'alert-success' : 'alert-warning'} text-center`} role="status">
                <h2 className="h4">{statusTitle}</h2>
                <p className="mb-1">{attempt.status === 'won' ? t('complete.wonBody', { count: attempt.guesses.length }) : t('complete.exhaustedBody')}</p>
                <p className="mb-0">{t('complete.answer', { answer: attempt.answer ?? '—' })}</p>
              </div>
            ) : (
              <>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="fw-semibold">{t('progress')}</span>
                  <span className="badge text-bg-primary fs-6">{t('remaining', { remaining: attempt.remainingGuesses, max: attempt.maxGuesses })}</span>
                </div>
                <form onSubmit={submit} noValidate>
                  <label htmlFor="daily-guess" className="form-label fw-semibold">{t('guessLabel', { length: attempt.numberLength })}</label>
                  <div className="d-flex flex-column flex-sm-row gap-2">
                    <input
                      ref={inputRef}
                      id="daily-guess"
                      className="form-control form-control-lg text-center font-monospace fs-3 flex-grow-1"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      maxLength={attempt.numberLength}
                      value={guess}
                      onChange={(event) => setGuess(event.target.value.replace(/\D/g, '').slice(0, attempt.numberLength))}
                      aria-describedby="daily-guess-help"
                      style={{ minWidth: 0 }}
                    />
                    <button className="btn btn-primary btn-lg px-sm-4 flex-shrink-0 text-nowrap" disabled={submitting || guess.length !== attempt.numberLength}>
                      {submitting ? t('submitting') : t('submit')}
                    </button>
                  </div>
                  <p className="form-text" id="daily-guess-help">{t('guessHelp')}</p>
                </form>
              </>
            )}

            {error && <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>}
            {complete && <DailyChallengeShareButton attempt={attempt} streak={attempt.participantKind === 'account' ? attempt.streak : guestStreak} />}
            {complete && applicationAuthAvailable && <DailyChallengeSignInPrompt />}

            <section className="mt-4" aria-labelledby="daily-history-heading">
              <h2 className="h5" id="daily-history-heading">{t('history.title')}</h2>
              {attempt.guesses.length === 0 ? (
                <p className="text-muted mb-0">{t('history.empty')}</p>
              ) : (
                <ol className="list-group mb-0">
                  {[...attempt.guesses].reverse().map((entry, index) => (
                    <li className="list-group-item d-flex align-items-center justify-content-between gap-3" key={`${entry.guess}-${attempt.guesses.length - index}`} value={attempt.guesses.length - index}>
                      <span className="text-muted fw-semibold" aria-hidden="true">{attempt.guesses.length - index}.</span>
                      <code className="fs-5">{entry.guess}</code>
                      <span className={entry.correctPositions === attempt.numberLength ? 'badge text-bg-success fs-6' : 'badge text-bg-secondary fs-6'}>
                        {t('history.correct', { count: entry.correctPositions, length: attempt.numberLength })}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
