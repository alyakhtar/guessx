import { describe, expect, it } from 'vitest';
import { buildDailyGameplayMetrics } from './dailyAdminStats';

describe('daily admin gameplay metrics', () => {
  it('keeps account and guest activity separate while reporting totals', () => {
    const metrics = buildDailyGameplayMetrics([
      { participantKind: 'account', status: 'won', guesses: [{}, {}, {}] },
      { participantKind: 'account', status: 'exhausted', guesses: [{}, {}, {}, {}] },
      { participantKind: 'guest', status: 'won', guesses: [{}, {}] },
      { participantKind: 'guest', status: 'active', guesses: [{}] },
    ]);

    expect(metrics).toMatchObject({
      gamesStarted: 4,
      completedGames: 3,
      activeGames: 1,
      solves: 2,
      exhaustedGames: 1,
      totalGuesses: 10,
      solveRate: 66.66666666666666,
      averageGuessesPerGame: 2.5,
      averageGuessesToSolve: 2.5,
      bestSolveGuesses: 2,
    });
    expect(metrics.accounts).toMatchObject({
      gamesStarted: 2,
      solves: 1,
      exhaustedGames: 1,
      totalGuesses: 7,
      solveRate: 50,
      averageGuessesToSolve: 3,
      bestSolveGuesses: 3,
    });
    expect(metrics.guests).toMatchObject({
      gamesStarted: 2,
      activeGames: 1,
      solves: 1,
      totalGuesses: 3,
      solveRate: 100,
      averageGuessesToSolve: 2,
      bestSolveGuesses: 2,
    });
  });

  it('returns safe zero and empty values when no Daily Challenge activity exists', () => {
    const metrics = buildDailyGameplayMetrics([]);

    expect(metrics.gamesStarted).toBe(0);
    expect(metrics.solveRate).toBe(0);
    expect(metrics.totalGuesses).toBe(0);
    expect(metrics.averageGuessesPerGame).toBeNull();
    expect(metrics.averageGuessesToSolve).toBeNull();
    expect(metrics.bestSolveGuesses).toBeNull();
  });
});
