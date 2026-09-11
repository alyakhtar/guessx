import { describe, expect, it } from 'vitest';

import GameServer from './socket-server.js';

const { buildGameResultPayload } = GameServer;

function room(players, winner) {
  return {
    players,
    winner,
    gameHistory: [
      { timestamp: new Date('2026-09-11T00:00:00.000Z') },
      { timestamp: new Date('2026-09-11T00:00:05.000Z') },
    ],
    numberLength: 4,
  };
}

describe('identity-aware game-result persistence', () => {
  it('persists an account winner by server-side user ID, never by display-name lookup', () => {
    const result = buildGameResultPayload(room([
      { name: 'Alex', accountId: '64b64c4fd6d7e7d6f7d6e001' },
      { name: 'Mallory', accountId: '64b64c4fd6d7e7d6f7d6e002' },
    ], 'Alex'));

    expect(result).toMatchObject({
      player1UserId: '64b64c4fd6d7e7d6f7d6e001',
      player2UserId: '64b64c4fd6d7e7d6f7d6e002',
      player1IdentityKind: 'account',
      player2IdentityKind: 'account',
      winnerUserId: '64b64c4fd6d7e7d6f7d6e001',
    });
  });

  it('keeps guest results unattributed and records bot identity separately', () => {
    const guestWin = buildGameResultPayload(room([
      { name: 'Guest' },
      { name: 'Account', accountId: '64b64c4fd6d7e7d6f7d6e001' },
    ], 'Guest'));
    const botWin = buildGameResultPayload(room([
      { name: 'Account', accountId: '64b64c4fd6d7e7d6f7d6e001' },
      { name: 'Bot', isBot: true, botDifficulty: 'hard' },
    ], 'Bot'));

    expect(guestWin).toMatchObject({
      player1IdentityKind: 'guest',
      player2IdentityKind: 'account',
      player2UserId: '64b64c4fd6d7e7d6f7d6e001',
    });
    expect(guestWin).not.toHaveProperty('player1UserId');
    expect(guestWin).not.toHaveProperty('winnerUserId');
    expect(botWin).toMatchObject({
      player1IdentityKind: 'account',
      player2IdentityKind: 'bot',
      difficulty: 'hard',
      isVsBot: true,
    });
    expect(botWin).not.toHaveProperty('winnerUserId');
  });
});
