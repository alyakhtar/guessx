'use client';

import { useTranslations } from 'next-intl';
import { Guess } from '../types/game';

interface GameHistoryProps {
  gameHistory: Guess[];
  currentPlayerName?: string;
  title?: string;
}

export default function GameHistory({ gameHistory, currentPlayerName, title }: GameHistoryProps) {
  const t = useTranslations('gameHistory');
  const heading = title ?? t('title');
  // Only show current player's guesses, latest first
  const myGuesses = gameHistory.filter(guess => guess.playerName === currentPlayerName).reverse();

  if (myGuesses.length === 0) {
    return (
      <div className="card p-4 shadow h-100">
        <h2 className="card-title h5 fw-semibold mb-4">{heading}</h2>
        <div className="text-center py-5">
          <div className="fs-1 mb-3">🎯</div>
          <p className="text-muted">{t('empty.title')}</p>
          <p className="text-muted small">{t('empty.subtitle')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4 shadow h-100">
      <h2 className="card-title h5 fw-semibold mb-4">{heading}</h2>

      <div className="table-responsive">
        <table className="table table-striped table-hover table-bordered" style={{ tableLayout: "fixed" }}>
          <thead className="table-dark">
            <tr>
              <th className="text-center" style={{ width: "48px" }}>{t('table.number')}</th>
              <th className="text-center">{t('table.guess')}</th>
              <th className="text-center" style={{ width: "96px" }}>{t('table.correct')}</th>
            </tr>
          </thead>
          <tbody>
            {myGuesses.map((guess, index) => (
              <tr key={index}>
                <td className="text-center font-mono">{myGuesses.length - index}</td>
                <td className="text-center">
                  <code className="fs-5">{guess.guess}</code>
                </td>
                <td className="text-center">
                  <td className="text-center align-middle" style={{ width: '96px' }}>
                  <div className="d-flex flex-column align-items-center justify-content-center gap-1">
                    <span className={`fs-4 fw-bold ${guess.correctPositions === 0 ? 'text-danger' : 'text-success'}`}>
                      {guess.correctPositions}
                    </span>
                    <div className="d-flex gap-1 justify-content-center" style={{ minHeight: '8px' }}>
                      {Array.from({ length: guess.guess.length }).map((_, i) => (
                        <span
                          key={i}
                          className={`badge ${i < guess.correctPositions ? 'bg-success' : 'bg-secondary'}`}
                          style={{ width: '8px', height: '8px', borderRadius: '50%' }}
                        ></span>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="card mt-3">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 d-flex justify-content-between align-items-center">
              <strong className="text-nowrap me-3">{t('summary.total')}</strong>
              <span className="fs-5 fw-bold">{myGuesses.length}</span>
            </div>
            {myGuesses.length > 0 && (
              <div className="col-12 d-flex justify-content-between align-items-center">
                <strong className="text-nowrap me-3">{t('summary.last')}</strong>
                <code className="fs-5">{myGuesses[0].guess}</code>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
