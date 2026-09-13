import { describe, expect, it } from 'vitest';

import { buildDailyChallengeStats } from './dailyChallengeStats';

describe('daily challenge account stats', () => {
  it('counts each completed challenge once and excludes active attempts', () => {
    expect(buildDailyChallengeStats([
      { status: 'won', guesses: Array.from({ length: 4 }) },
      { status: 'exhausted', guesses: Array.from({ length: 10 }) },
      { status: 'active', guesses: Array.from({ length: 2 }) },
    ])).toEqual({
      completed: 2,
      wins: 1,
      winRate: 50,
      averageGuesses: 7,
      bestWinGuesses: 4,
    });
  });

  it('returns empty statistics when an account has no completed challenge', () => {
    expect(buildDailyChallengeStats([])).toEqual({
      completed: 0,
      wins: 0,
      winRate: 0,
      averageGuesses: null,
      bestWinGuesses: null,
    });
  });
});
