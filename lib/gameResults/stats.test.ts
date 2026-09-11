import { describe, expect, it } from 'vitest';

import { buildAccountStats, buildPlayerStats } from './stats';

describe('identity-aware player statistics', () => {
  it('aggregates account history by user ID, not matching display names', () => {
    const stats = buildPlayerStats([
      {
        player1DisplayName: 'Alex', player2DisplayName: 'Alex', winner: 'Alex',
        player1UserId: 'user-a', player2UserId: 'user-b', winnerUserId: 'user-b',
        player1IdentityKind: 'account', player2IdentityKind: 'account',
        totalGuesses: 4, numberLength: 4, isVsBot: false, createdAt: new Date('2026-01-01'),
      },
    ]);

    expect(stats.accounts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'user-a', name: 'Alex', totalGames: 1, wins: 0 }),
      expect.objectContaining({ id: 'user-b', name: 'Alex', totalGames: 1, wins: 1 }),
    ]));
  });

  it('keeps current guests and legacy guests separate, and excludes bots', () => {
    const stats = buildPlayerStats([
      {
        player1DisplayName: 'Guest', player2DisplayName: 'Bot', winner: 'Guest',
        player1IdentityKind: 'guest', player2IdentityKind: 'bot',
        totalGuesses: 3, numberLength: 4, isVsBot: true, createdAt: new Date('2026-01-02'),
      },
      {
        player1: 'Guest', player2: 'Bot', winner: 'Bot',
        totalGuesses: 7, numberLength: 4, isVsBot: true, createdAt: new Date('2025-01-02'),
      },
    ]);

    expect(stats.guests.current).toEqual([expect.objectContaining({ name: 'Guest', totalGames: 1, wins: 1 })]);
    expect(stats.guests.legacy).toEqual([expect.objectContaining({ name: 'Guest', totalGames: 1, losses: 1 })]);
    expect(stats.accounts).toEqual([]);
  });

  it('handles account/guest, account/account, guest/guest, and account/bot outcomes without name attribution', () => {
    const stats = buildPlayerStats([
      {
        player1DisplayName: 'Alex', player2DisplayName: 'Guest', winner: 'Alex', winnerUserId: 'user-a',
        player1UserId: 'user-a', player1IdentityKind: 'account', player2IdentityKind: 'guest',
        totalGuesses: 4, numberLength: 4, isVsBot: false, createdAt: new Date('2026-01-04'),
      },
      {
        player1DisplayName: 'Alex', player2DisplayName: 'Alex', winner: 'Alex', winnerUserId: 'user-b',
        player1UserId: 'user-a', player2UserId: 'user-b', player1IdentityKind: 'account', player2IdentityKind: 'account',
        totalGuesses: 5, numberLength: 4, isVsBot: false, createdAt: new Date('2026-01-03'),
      },
      {
        player1DisplayName: 'Guest', player2DisplayName: 'Visitor', winner: 'Visitor',
        player1IdentityKind: 'guest', player2IdentityKind: 'guest',
        totalGuesses: 6, numberLength: 4, isVsBot: false, createdAt: new Date('2026-01-02'),
      },
      {
        player1DisplayName: 'Alex', player2DisplayName: 'Bot', winner: 'Bot',
        player1UserId: 'user-a', player1IdentityKind: 'account', player2IdentityKind: 'bot',
        totalGuesses: 7, numberLength: 4, isVsBot: true, createdAt: new Date('2026-01-01'),
      },
    ]);

    expect(stats.accounts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'user-a', totalGames: 3, wins: 1, losses: 2, vsBotGames: 1 }),
      expect.objectContaining({ id: 'user-b', totalGames: 1, wins: 1, losses: 0 }),
    ]));
    expect(stats.guests.current).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'Guest', totalGames: 2, wins: 0, losses: 2 }),
      expect.objectContaining({ id: 'Visitor', totalGames: 1, wins: 1, losses: 0 }),
    ]));
  });

  it('reports winning-guess performance only when the result recorded a winner guess count', () => {
    const stats = buildAccountStats([
      {
        player1DisplayName: 'Alex', player2DisplayName: 'Guest', winner: 'Alex', winnerUserId: 'user-a',
        player1UserId: 'user-a', player1IdentityKind: 'account', player2IdentityKind: 'guest',
        totalGuesses: 7, winnerGuesses: 4, numberLength: 4, isVsBot: false, createdAt: new Date('2026-01-04'),
      },
      {
        player1DisplayName: 'Alex', player2DisplayName: 'Bot', winner: 'Alex', winnerUserId: 'user-a',
        player1UserId: 'user-a', player1IdentityKind: 'account', player2IdentityKind: 'bot',
        totalGuesses: 5, winnerGuesses: 2, numberLength: 4, isVsBot: true, createdAt: new Date('2026-01-03'),
      },
      {
        player1DisplayName: 'Alex', player2DisplayName: 'Guest', winner: 'Guest',
        player1UserId: 'user-a', player1IdentityKind: 'account', player2IdentityKind: 'guest',
        totalGuesses: 6, numberLength: 4, isVsBot: false, createdAt: new Date('2026-01-02'),
      },
    ], 'user-a', 'Alex');

    expect(stats).toMatchObject({
      totalGames: 3,
      wins: 2,
      averageGuesses: 6,
      averageGuessesToWin: 3,
      bestWinGuesses: 2,
    });
  });

  it('returns an empty account record when the account has no results', () => {
    expect(buildAccountStats([], 'user-a', 'Alex')).toMatchObject({
      id: 'user-a', name: 'Alex', totalGames: 0, wins: 0,
      averageGuessesToWin: null, bestWinGuesses: null,
    });
  });
});
