export type DailyChallengeStatsRecord = {
  status: 'active' | 'won' | 'exhausted';
  guesses?: Array<unknown>;
};

export type DailyChallengeStats = {
  completed: number;
  wins: number;
  winRate: number;
  averageGuesses: number | null;
  bestWinGuesses: number | null;
};

export function buildDailyChallengeStats(records: DailyChallengeStatsRecord[]): DailyChallengeStats {
  const completed = records.filter((record) => record.status === 'won' || record.status === 'exhausted');
  const wins = completed.filter((record) => record.status === 'won');
  const totalGuesses = completed.reduce((total, record) => total + (record.guesses?.length ?? 0), 0);
  const winningGuessCounts = wins.map((record) => record.guesses?.length ?? 0);

  return {
    completed: completed.length,
    wins: wins.length,
    winRate: completed.length ? (wins.length / completed.length) * 100 : 0,
    averageGuesses: completed.length ? totalGuesses / completed.length : null,
    bestWinGuesses: winningGuessCounts.length ? Math.min(...winningGuessCounts) : null,
  };
}
