import { describe, expect, it, vi } from 'vitest';

import GameServer from './socket-server.js';

const ACCOUNT_A = '64b64c4fd6d7e7d6f7d6e001';
const ACCOUNT_B = '64b64c4fd6d7e7d6f7d6e002';

function createRoom(players) {
  return { id: 'ROOM01', players };
}

function createContext(room, identity, gameResults = []) {
  const findGameResults = vi.fn(async () => gameResults);
  return {
    playerRoomMap: new Map([[identity.socketId, room.id]]),
    rooms: new Map([[room.id, room]]),
    findGameResults,
    socketIdentity: GameServer.prototype.socketIdentity,
  };
}

async function requestStats(context, socketId, identity) {
  const emit = vi.fn();
  await GameServer.prototype.sendMatchupStats.call(context, {
    id: socketId,
    data: { identity },
    emit,
  });
  return emit;
}

describe('in-room matchup statistics', () => {
  it('uses stable IDs for account-versus-account history', async () => {
    const room = createRoom([
      { id: 'socket-a', name: 'Alex', accountId: ACCOUNT_A },
      { id: 'socket-b', name: 'Blair', accountId: ACCOUNT_B },
    ]);
    const context = createContext(room, { socketId: 'socket-a' }, [
      { winnerUserId: ACCOUNT_A },
      { winnerUserId: ACCOUNT_B },
    ]);

    const emit = await requestStats(context, 'socket-a', { kind: 'account', userId: ACCOUNT_A });

    expect(context.findGameResults).toHaveBeenCalledWith({
      $or: [
        { player1UserId: ACCOUNT_A, player2UserId: ACCOUNT_B },
        { player2UserId: ACCOUNT_A, player1UserId: ACCOUNT_B },
      ],
    });
    expect(emit).toHaveBeenCalledWith('matchup_stats', {
      opponentKind: 'account', opponentName: 'Blair', games: 2, wins: 1, losses: 1, winRate: 50, isNameBased: false,
    });
  });

  it('scopes account-versus-guest history to the account and guest name, never all guests', async () => {
    const room = createRoom([
      { id: 'socket-a', name: 'Alex', accountId: ACCOUNT_A },
      { id: 'socket-g', name: 'Pat' },
    ]);
    const context = createContext(room, { socketId: 'socket-a' }, [
      { winnerUserId: ACCOUNT_A },
      { winner: 'Pat' },
    ]);

    const emit = await requestStats(context, 'socket-a', { kind: 'account', userId: ACCOUNT_A });

    expect(context.findGameResults).toHaveBeenCalledWith({
      $or: [
        { player1UserId: ACCOUNT_A, player2IdentityKind: 'guest', player2DisplayName: 'Pat' },
        { player2UserId: ACCOUNT_A, player1IdentityKind: 'guest', player1DisplayName: 'Pat' },
      ],
    });
    expect(emit).toHaveBeenCalledWith('matchup_stats', {
      opponentKind: 'guest', opponentName: 'Pat', games: 2, wins: 1, losses: 1, winRate: 50, isNameBased: true,
    });
  });

  it('shows the guest the same explicitly name-based record against the account', async () => {
    const room = createRoom([
      { id: 'socket-g', name: 'Pat' },
      { id: 'socket-a', name: 'Alex', accountId: ACCOUNT_A },
    ]);
    const context = createContext(room, { socketId: 'socket-g' }, [
      { winnerUserId: ACCOUNT_A },
      { winner: 'Pat' },
    ]);

    const emit = await requestStats(context, 'socket-g', { kind: 'guest' });

    expect(context.findGameResults).toHaveBeenCalledWith({
      $or: [
        { player1UserId: ACCOUNT_A, player2IdentityKind: 'guest', player2DisplayName: 'Pat' },
        { player2UserId: ACCOUNT_A, player1IdentityKind: 'guest', player1DisplayName: 'Pat' },
      ],
    });
    expect(emit).toHaveBeenCalledWith('matchup_stats', {
      opponentKind: 'account', opponentName: 'Alex', games: 2, wins: 1, losses: 1, winRate: 50, isNameBased: true,
    });
  });

  it('returns a 0–0 record for a new account-and-guest pairing', async () => {
    const room = createRoom([
      { id: 'socket-a', name: 'Alex', accountId: ACCOUNT_A },
      { id: 'socket-g', name: 'New guest' },
    ]);
    const context = createContext(room, { socketId: 'socket-a' });

    const emit = await requestStats(context, 'socket-a', { kind: 'account', userId: ACCOUNT_A });

    expect(emit).toHaveBeenCalledWith('matchup_stats', expect.objectContaining({ games: 0, wins: 0, losses: 0, isNameBased: true }));
  });

  it('does not query or show a matchup record for guest-versus-guest games', async () => {
    const room = createRoom([
      { id: 'socket-a', name: 'Pat' },
      { id: 'socket-b', name: 'Robin' },
    ]);
    const context = createContext(room, { socketId: 'socket-a' });

    const emit = await requestStats(context, 'socket-a', { kind: 'guest' });

    expect(context.findGameResults).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('matchup_stats', null);
  });
});
