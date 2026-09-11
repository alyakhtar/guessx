'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

type PersonalStats = {
  name: string;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  vsHumanGames: number;
  vsHumanWins: number;
  vsBotGames: number;
  vsBotWins: number;
  averageGuesses: number;
  averageGuessesToWin: number | null;
  bestWinGuesses: number | null;
  fastestWin: number | null;
};

function formatDuration(ms: number | null) {
  if (!ms) return '—';
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function PlayerStatsPage() {
  const locale = useLocale();
  const t = useTranslations('playerStats');
  const [stats, setStats] = useState<PersonalStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/player-stats/me', { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load stats');
        const data = await response.json();
        if (active) setStats(data);
      } catch {
        if (active) setError(true);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  return (
    <main className="container py-3 py-md-4">
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4">
        <div>
          <h1 className="h2 mb-1">{t('title')}</h1>
          {stats && <p className="text-muted mb-0">{t('subtitle', { name: stats.name })}</p>}
        </div>
        <Link className="btn btn-outline-secondary align-self-start" href={`/${locale}`}>
          {t('backToLobby')}
        </Link>
      </div>

      {!stats && !error && (
        <div className="text-center py-5" aria-live="polite">
          <div className="spinner-border" role="status" />
          <p className="text-muted mt-3 mb-0">{t('loading')}</p>
        </div>
      )}
      {error && <div className="alert alert-danger">{t('loadError')}</div>}

      {stats && (
        <>
          <section className="row row-cols-2 row-cols-md-4 g-3 mb-4" aria-label={t('overview')}>
            <Metric label={t('metrics.games')} value={stats.totalGames} />
            <Metric label={t('metrics.wins')} value={stats.wins} accent="text-success" />
            <Metric label={t('metrics.losses')} value={stats.losses} accent="text-danger" />
            <Metric label={t('metrics.winRate')} value={`${stats.winRate.toFixed(1)}%`} />
          </section>

          <section className="row row-cols-1 row-cols-md-2 g-3">
            <div className="col">
              <div className="card h-100 shadow-sm">
                <div className="card-body">
                  <h2 className="h5">{t('breakdowns.title')}</h2>
                  <dl className="row mb-0">
                    <dt className="col-7">{t('breakdowns.vsHumans')}</dt>
                    <dd className="col-5 text-end">{stats.vsHumanWins}/{stats.vsHumanGames}</dd>
                    <dt className="col-7">{t('breakdowns.vsBot')}</dt>
                    <dd className="col-5 text-end mb-0">{stats.vsBotWins}/{stats.vsBotGames}</dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="col">
              <div className="card h-100 shadow-sm">
                <div className="card-body">
                  <h2 className="h5">{t('performance.title')}</h2>
                  <dl className="row mb-0">
                    <dt className="col-7">{t('performance.averageGameGuesses')}</dt>
                    <dd className="col-5 text-end">{stats.averageGuesses.toFixed(1)}</dd>
                    <dt className="col-7">{t('performance.averageWinningGuesses')}</dt>
                    <dd className="col-5 text-end">{stats.averageGuessesToWin?.toFixed(1) ?? '—'}</dd>
                    <dt className="col-7">{t('performance.bestWin')}</dt>
                    <dd className="col-5 text-end">{stats.bestWinGuesses ?? '—'}</dd>
                    <dt className="col-7">{t('performance.fastestWin')}</dt>
                    <dd className="col-5 text-end mb-0">{formatDuration(stats.fastestWin)}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </section>
          {stats.totalGames === 0 && <p className="text-muted text-center mt-4">{t('noGames')}</p>}
        </>
      )}
    </main>
  );
}

function Metric({ label, value, accent = '' }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="col">
      <div className="card h-100 shadow-sm">
        <div className="card-body text-center py-3">
          <div className={`h3 mb-1 ${accent}`}>{value}</div>
          <div className="small text-muted">{label}</div>
        </div>
      </div>
    </div>
  );
}
