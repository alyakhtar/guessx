export type DailyAdminStatsRecord = {
  challengeDate?: string;
  participantKind: 'account' | 'guest';
  status: 'active' | 'won' | 'exhausted';
  guesses?: Array<unknown>;
};

export type DailyParticipantMetrics = {
  gamesStarted: number;
  activeGames: number;
  completedGames: number;
  solves: number;
  exhaustedGames: number;
  solveRate: number;
  totalGuesses: number;
  averageGuessesPerGame: number | null;
  averageGuessesToSolve: number | null;
  bestSolveGuesses: number | null;
};

export type DailyGameplayMetrics = DailyParticipantMetrics & {
  accounts: DailyParticipantMetrics;
  guests: DailyParticipantMetrics;
};

function emptyMetrics(): DailyParticipantMetrics {
  return {
    gamesStarted: 0,
    activeGames: 0,
    completedGames: 0,
    solves: 0,
    exhaustedGames: 0,
    solveRate: 0,
    totalGuesses: 0,
    averageGuessesPerGame: null,
    averageGuessesToSolve: null,
    bestSolveGuesses: null,
  };
}

function addRecord(metrics: DailyParticipantMetrics, record: DailyAdminStatsRecord) {
  const guessCount = record.guesses?.length ?? 0;
  metrics.gamesStarted += 1;
  metrics.totalGuesses += guessCount;

  if (record.status === 'active') {
    metrics.activeGames += 1;
    return;
  }

  metrics.completedGames += 1;
  if (record.status === 'exhausted') {
    metrics.exhaustedGames += 1;
    return;
  }

  metrics.solves += 1;
  metrics.bestSolveGuesses = metrics.bestSolveGuesses === null
    ? guessCount
    : Math.min(metrics.bestSolveGuesses, guessCount);
}

function finalizeMetrics(metrics: DailyParticipantMetrics, winningGuessTotal: number): DailyParticipantMetrics {
  return {
    ...metrics,
    solveRate: metrics.completedGames ? (metrics.solves / metrics.completedGames) * 100 : 0,
    averageGuessesPerGame: metrics.gamesStarted ? metrics.totalGuesses / metrics.gamesStarted : null,
    averageGuessesToSolve: metrics.solves ? winningGuessTotal / metrics.solves : null,
  };
}

export function buildDailyGameplayMetrics(records: DailyAdminStatsRecord[]): DailyGameplayMetrics {
  const accounts = emptyMetrics();
  const guests = emptyMetrics();
  const overall = emptyMetrics();
  let accountWinningGuesses = 0;
  let guestWinningGuesses = 0;
  let overallWinningGuesses = 0;

  records.forEach((record) => {
    const guessCount = record.guesses?.length ?? 0;
    const participantMetrics = record.participantKind === 'account' ? accounts : guests;
    addRecord(participantMetrics, record);
    addRecord(overall, record);

    if (record.status === 'won') {
      overallWinningGuesses += guessCount;
      if (record.participantKind === 'account') accountWinningGuesses += guessCount;
      else guestWinningGuesses += guessCount;
    }
  });

  return {
    ...finalizeMetrics(overall, overallWinningGuesses),
    accounts: finalizeMetrics(accounts, accountWinningGuesses),
    guests: finalizeMetrics(guests, guestWinningGuesses),
  };
}
