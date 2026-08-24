import { describe, expect, it, vi } from 'vitest';

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

  it('does not leak secrets through the lobby room list', () => {
    const openRoom = {
      ...room(),
      spectatorModeEnabled: true,
      players: room().players.map(player => ({ ...player, isConnected: true })),
    };
    const payload = GameServer.prototype.getOpenRooms.call({
      rooms: new Map([[openRoom.id, openRoom]]),
      sanitizeFor: GameServer.prototype.sanitizeFor,
    });

    expect(payload).toHaveLength(1);
    expect(payload[0].players[0]).not.toHaveProperty('secretNumber');
    expect(payload[0].players[1]).not.toHaveProperty('secretNumber');
    expect(payload[0]).not.toHaveProperty('accessCode');
    expect(payload[0].hasAccessCode).toBe(true);
  });

  it('sanitizes each member and spectator emit independently', () => {
    const sent = new Map();
    const sockets = new Map(room().players.map(player => [player.id, {
      emit: (event, payload) => sent.set(player.id, { event, payload }),
    }]));
    const spectatorEmit = vi.fn();
    const gameRoom = { ...room(), spectatorModeEnabled: true };

    GameServer.prototype.emitRoomEvent.call({
      io: {
        sockets: { sockets },
        to: () => ({ emit: spectatorEmit }),
      },
      withServerNow: GameServer.prototype.withServerNow,
      sanitizeFor: GameServer.prototype.sanitizeFor,
    }, gameRoom, 'room_updated');

    expect(sent.get('player-1').payload.players[0].secretNumber).toBe('1234');
    expect(sent.get('player-1').payload.players[1]).not.toHaveProperty('secretNumber');
    expect(sent.get('player-2').payload.players[1].secretNumber).toBe('5678');
    expect(sent.get('player-2').payload.players[0]).not.toHaveProperty('secretNumber');
    expect(spectatorEmit.mock.calls[0][1].players.every(player => !('secretNumber' in player))).toBe(true);
  });
});
