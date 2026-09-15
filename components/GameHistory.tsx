'use client';

import { useTranslations } from 'next-intl';
import { Guess } from '../types/game';

interface GameHistoryProps {
  gameHistory: Guess[];
  currentPlayerName?: string;
  opponentPlayerName?: string;
}

function GuessResult({ guess, compact }: { guess?: Guess; compact: boolean }) {
  if (!guess) return <span className="text-muted">—</span>;

  return (
    <span className={`fw-bold lh-1 ${compact ? 'fs-5' : 'fs-4'} ${guess.correctPositions === 0 ? 'text-danger' : 'text-success'}`}>
      {guess.correctPositions}
    </span>
  );
}

export default function GameHistory({ gameHistory, currentPlayerName, opponentPlayerName }: GameHistoryProps) {
  const t = useTranslations('gameHistory');
  const myGuesses = gameHistory.filter((guess) => guess.playerName === currentPlayerName).reverse();
  const opponentGuesses = opponentPlayerName
    ? gameHistory.filter((guess) => guess.playerName === opponentPlayerName).reverse()
    : [];
  const showComparison = Boolean(opponentPlayerName);
  const rowCount = Math.max(myGuesses.length, opponentGuesses.length);

  if (rowCount === 0) {
    return (
      <div className="card p-4 shadow h-100 game-history-card">
        <h2 className="card-title h5 fw-semibold mb-4">{t('title')}</h2>
        <div className="text-center py-5">
          <div className="fs-1 mb-3">🎯</div>
          <p className="text-muted">{t('empty.title')}</p>
          <p className="text-muted small">{t('empty.subtitle')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4 shadow h-100 d-flex flex-column game-history-card">
      <h2 className="card-title h5 fw-semibold mb-4">{t('title')}</h2>

      <div className={`table-responsive game-history-table${showComparison ? ' game-history-table--comparison' : ''}`}>
        <table className="table table-striped table-hover table-bordered mb-0" style={{ tableLayout: 'fixed' }}>
          <thead className="table-dark">
            <tr>
              <th className="text-center">{showComparison ? t('table.yourGuess') : t('table.guess')}</th>
              <th className="text-center game-history-result-column">{t('table.correct')}</th>
              {showComparison && <th className="text-center">{t('table.opponentGuess')}</th>}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, index) => {
              const myGuess = myGuesses[index];
              const opponentGuess = opponentGuesses[index];

              return (
                <tr key={index} className={index === 0 ? 'game-history-latest' : undefined}>
                  <td className="text-center align-middle">
                    {myGuess ? <code className={showComparison ? 'fs-6' : 'fs-5'}>{myGuess.guess}</code> : <span className="text-muted">—</span>}
                  </td>
                  <td className="text-center align-middle game-history-result-column">
                    {showComparison ? (
                      <div className="game-history-correct-pair">
                        <GuessResult guess={myGuess} compact />
                        <span className="game-history-correct-divider" aria-hidden="true" />
                        <GuessResult guess={opponentGuess} compact />
                      </div>
                    ) : <GuessResult guess={myGuess} compact={false} />}
                  </td>
                  {showComparison && (
                    <td className="text-center align-middle">
                      {opponentGuess ? <code className="fs-6">{opponentGuess.guess}</code> : <span className="text-muted">—</span>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card mt-3">
        <div className="card-body py-2">
          {showComparison ? (
            <div className="row g-2">
              <div className="col-6 d-flex justify-content-between align-items-center gap-2">
                <strong className="small">{t('summary.yourTotal')}</strong>
                <span className="fs-5 fw-bold">{myGuesses.length}</span>
              </div>
              <div className="col-6 d-flex justify-content-between align-items-center gap-2">
                <strong className="small text-truncate">{t('summary.opponentTotal', { name: opponentPlayerName })}</strong>
                <span className="fs-5 fw-bold">{opponentGuesses.length}</span>
              </div>
            </div>
          ) : (
            <div className="d-flex justify-content-between align-items-center">
              <strong>{t('summary.total')}</strong>
              <span className="fs-5 fw-bold">{myGuesses.length}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
