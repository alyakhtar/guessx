import { describe, expect, it } from 'vitest';

import GameServer from './socket-server.js';

const room = (gameStatus = 'playing') => ({
  id: 'ROOM01',
  gameStatus,
  accessCode: 'ABC',
  players: [
    { id: 'player-1', name: 'Alice', secretNumber: '1234' },
    { id: 'player-2', name: 'Bob', secretNumber: '5678' },
  ],
});

describe('active-game payload privacy', () => {
  const sanitizeFor = (gameRoom, socketId) =>
    GameServer.prototype.sanitizeFor.call({}, gameRoom, socketId);

  it('keeps only the requesting player secret in an active member payload', () => {
    const payload = sanitizeFor(room(), 'player-1');

    expect(payload.players[0].secretNumber).toBe('1234');
    expect(payload.players[1]).not.toHaveProperty('secretNumber');
  });

  it('keeps both secrets out of an active spectator payload', () => {
    const payload = sanitizeFor(room(), null);

    expect(payload.players[0]).not.toHaveProperty('secretNumber');
    expect(payload.players[1]).not.toHaveProperty('secretNumber');
    expect(payload).not.toHaveProperty('accessCode');
    expect(payload.hasAccessCode).toBe(true);
  });

  it('reveals both secrets only after the game is finished', () => {
    const payload = sanitizeFor(room('finished'), null);

    expect(payload.players[0].secretNumber).toBe('1234');
    expect(payload.players[1].secretNumber).toBe('5678');
    expect(payload).not.toHaveProperty('accessCode');
  });

  it('does not mutate the authoritative room while sanitizing', () => {
    const source = room();
    sanitizeFor(source, 'player-1');

    expect(source.players[0].secretNumber).toBe('1234');
    expect(source.players[1].secretNumber).toBe('5678');
  });
});
