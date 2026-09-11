export type ParticipantIdentityKind = 'account' | 'guest' | 'legacy-guest' | 'bot';

export type GameResultRecord = {
  player1?: string;
  player2?: string;
  winner?: string;
  player1DisplayName?: string;
  player2DisplayName?: string;
  player1UserId?: unknown;
  player2UserId?: unknown;
  winnerUserId?: unknown;
  player1IdentityKind?: ParticipantIdentityKind;
  player2IdentityKind?: ParticipantIdentityKind;
  gameDuration?: number | null;
  winnerGuesses?: number | null;
  totalGuesses: number;
  numberLength: number;
  difficulty?: string;
  isVsBot: boolean;
  createdAt: Date | string;
};

type Participant = {
  displayName: string;
  identityKind: ParticipantIdentityKind;
  userId?: string;
};

export type PlayerStats = {
  id: string;
  name: string;
  identityKind: 'account' | 'guest' | 'legacy-guest';
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
  totalGuesses: number;
  fastestWin: number | null;
  slowestWin: number | null;
  recentGames: Array<{
    opponent: string;
    winner: string;
    totalGuesses: number;
    gameDuration?: number | null;
    numberLength: number;
    difficulty?: string;
    isVsBot: boolean;
    createdAt: Date | string;
  }>;
};

export type PlayerStatsResponse = {
  accounts: PlayerStats[];
  guests: {
    current: PlayerStats[];
    legacy: PlayerStats[];
  };
};

type WorkingPlayerStats = PlayerStats & {
  winsWithGuessCounts: number;
  totalWinningGuesses: number;
};

function stringId(value: unknown) {
  if (typeof value === 'string' && value) return value;
  if (value && typeof value === 'object' && 'toString' in value) {
    const id = String(value);
    return id && id !== '[object Object]' ? id : undefined;
  }
  return undefined;
}

function legacyIdentityKind(displayName: string): ParticipantIdentityKind {
  return displayName === 'Bot' ? 'bot' : 'legacy-guest';
}

function participantFor(
  game: GameResultRecord,
  position: 1 | 2,
): Participant {
  const displayName = (position === 1 ? game.player1DisplayName ?? game.player1 : game.player2DisplayName ?? game.player2) ?? 'Unknown';
  const identityKind = position === 1 ? game.player1IdentityKind : game.player2IdentityKind;
  const userId = stringId(position === 1 ? game.player1UserId : game.player2UserId);

  if (identityKind === 'account' && userId) return { displayName, identityKind, userId };
  if (identityKind === 'guest' || identityKind === 'legacy-guest' || identityKind === 'bot') {
    return { displayName, identityKind };
  }
  return { displayName, identityKind: legacyIdentityKind(displayName) };
}

function winnerFor(game: GameResultRecord, participants: Participant[]) {
  const winnerUserId = stringId(game.winnerUserId);
  if (winnerUserId) {
    return participants.find((participant) => participant.identityKind === 'account' && participant.userId === winnerUserId);
  }

  // Name-based winner attribution is permitted only for non-account data. An
  // account result without a winnerUserId remains deliberately unattributed.
  return participants.find((participant) => participant.identityKind !== 'account' && participant.displayName === game.winner);
}

function emptyStats(participant: Participant): WorkingPlayerStats {
  const id = participant.identityKind === 'account' ? participant.userId! : participant.displayName;
  return {
    id,
    name: participant.displayName,
    identityKind: participant.identityKind as PlayerStats['identityKind'],
    totalGames: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    vsHumanGames: 0,
    vsHumanWins: 0,
    vsBotGames: 0,
    vsBotWins: 0,
    averageGuesses: 0,
    averageGuessesToWin: null,
    bestWinGuesses: null,
    totalGuesses: 0,
    fastestWin: null,
    slowestWin: null,
    recentGames: [],
    winsWithGuessCounts: 0,
    totalWinningGuesses: 0,
  };
}

export function emptyAccountStats(userId: string, displayName: string): PlayerStats {
  return toPlayerStats(emptyStats({ userId, displayName, identityKind: 'account' }));
}

function addGame(stats: WorkingPlayerStats, participant: Participant, opponent: Participant, winner: Participant | undefined, game: GameResultRecord) {
  const won = winner?.identityKind === participant.identityKind
    && (participant.identityKind === 'account' ? winner.userId === participant.userId : winner.displayName === participant.displayName);

  stats.totalGames += 1;
  stats.totalGuesses += game.totalGuesses;
  if (won) {
    stats.wins += 1;
    if (game.gameDuration !== undefined && game.gameDuration !== null) {
      stats.fastestWin = stats.fastestWin === null ? game.gameDuration : Math.min(stats.fastestWin, game.gameDuration);
      stats.slowestWin = stats.slowestWin === null ? game.gameDuration : Math.max(stats.slowestWin, game.gameDuration);
    }
    if (game.winnerGuesses !== undefined && game.winnerGuesses !== null) {
      stats.winsWithGuessCounts += 1;
      stats.totalWinningGuesses += game.winnerGuesses;
      stats.bestWinGuesses = stats.bestWinGuesses === null
        ? game.winnerGuesses
        : Math.min(stats.bestWinGuesses, game.winnerGuesses);
    }
  } else {
    stats.losses += 1;
  }

  if (game.isVsBot || opponent.identityKind === 'bot') {
    stats.vsBotGames += 1;
    if (won) stats.vsBotWins += 1;
  } else {
    stats.vsHumanGames += 1;
    if (won) stats.vsHumanWins += 1;
  }

  stats.recentGames.push({
    opponent: opponent.displayName,
    winner: game.winner ?? '',
    totalGuesses: game.totalGuesses,
    gameDuration: game.gameDuration,
    numberLength: game.numberLength,
    difficulty: game.difficulty,
    isVsBot: game.isVsBot,
    createdAt: game.createdAt,
  });
}

function toPlayerStats(entry: WorkingPlayerStats): PlayerStats {
  return {
    id: entry.id,
    name: entry.name,
    identityKind: entry.identityKind,
    totalGames: entry.totalGames,
    wins: entry.wins,
    losses: entry.losses,
    winRate: entry.totalGames ? (entry.wins / entry.totalGames) * 100 : 0,
    vsHumanGames: entry.vsHumanGames,
    vsHumanWins: entry.vsHumanWins,
    vsBotGames: entry.vsBotGames,
    vsBotWins: entry.vsBotWins,
    averageGuesses: entry.totalGames ? entry.totalGuesses / entry.totalGames : 0,
    averageGuessesToWin: entry.winsWithGuessCounts
      ? entry.totalWinningGuesses / entry.winsWithGuessCounts
      : null,
    bestWinGuesses: entry.bestWinGuesses,
    totalGuesses: entry.totalGuesses,
    fastestWin: entry.fastestWin,
    slowestWin: entry.slowestWin,
    recentGames: [...entry.recentGames]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10),
  };
}

function finalizeStats(stats: Map<string, WorkingPlayerStats>): PlayerStats[] {
  return [...stats.values()]
    .map(toPlayerStats)
    .sort((a, b) => b.totalGames - a.totalGames || a.name.localeCompare(b.name));
}

export function buildAccountStats(
  gameResults: GameResultRecord[],
  userId: string,
  displayName: string,
): PlayerStats {
  return buildPlayerStats(gameResults).accounts.find((stats) => stats.id === userId)
    ?? emptyAccountStats(userId, displayName);
}

export function buildPlayerStats(gameResults: GameResultRecord[]): PlayerStatsResponse {
  const accounts = new Map<string, WorkingPlayerStats>();
  const currentGuests = new Map<string, WorkingPlayerStats>();
  const legacyGuests = new Map<string, WorkingPlayerStats>();

  for (const game of gameResults) {
    const participants = [participantFor(game, 1), participantFor(game, 2)];
    const winner = winnerFor(game, participants);

    participants.forEach((participant, index) => {
      if (participant.identityKind === 'bot') return;
      const opponent = participants[index === 0 ? 1 : 0];
      const destination = participant.identityKind === 'account'
        ? accounts
        : participant.identityKind === 'guest'
          ? currentGuests
          : legacyGuests;
      const key = participant.identityKind === 'account' ? participant.userId! : participant.displayName;
      const stats = destination.get(key) ?? emptyStats(participant);
      addGame(stats, participant, opponent, winner, game);
      destination.set(key, stats);
    });
  }

  return {
    accounts: finalizeStats(accounts),
    guests: {
      current: finalizeStats(currentGuests),
      legacy: finalizeStats(legacyGuests),
    },
  };
}
