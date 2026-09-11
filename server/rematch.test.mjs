import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { attachRematch } = require('./rematch.js');

function registeredHandlers() {
  const handlers = {};
  const socket = { on: (event, handler) => { handlers[event] = handler; } };
  const gameServer = {
    io: { on: (_event, callback) => callback(socket) },
    allow: vi.fn(() => true),
    reject: vi.fn(),
    rooms: new Map(),
  };
  attachRematch(gameServer);
  return { gameServer, handlers };
}

describe('rematch socket validation', () => {
  it('registers all rematch events through the shared limiter without throwing', () => {
    const { gameServer, handlers } = registeredHandlers();

    expect(() => handlers.rematch_request('ABC123')).not.toThrow();
    expect(() => handlers.rematch_accept('ABC123')).not.toThrow();
    expect(() => handlers.rematch_decline('ABC123')).not.toThrow();
    expect(gameServer.allow).toHaveBeenCalledTimes(3);
    expect(gameServer.allow).toHaveBeenCalledWith(expect.anything(), 'rematch');
  });

  it('rejects malformed rematch arguments before rate limiting', () => {
    const { gameServer, handlers } = registeredHandlers();

    handlers.rematch_request('ABC123', 'unexpected');
    handlers.rematch_accept('bad-room');

    expect(gameServer.reject).toHaveBeenCalledTimes(2);
    expect(gameServer.allow).not.toHaveBeenCalled();
  });

  it('retains a server-only account ID when an authenticated solo player creates a rematch', () => {
    const handlers = {};
    const socket = { id: 'socket-a', on: (event, handler) => { handlers[event] = handler; }, emit: vi.fn(), join: vi.fn() };
    const sourceRoom = {
      id: 'ABC123', gameStatus: 'finished', isSinglePlayer: true, isPrivate: false,
      numberLength: 4, spectatorModeEnabled: false, turnTimerSeconds: 0,
      players: [
        { id: 'socket-a', name: 'Alice', accountId: '64b64c4fd6d7e7d6f7d6e001', isConnected: true, isReady: true },
        { id: 'bot_ABC123', name: 'Bot', isBot: true, botDifficulty: 'medium', numberLength: 4, isConnected: true, isReady: true },
      ],
    };
    const gameServer = {
      io: {
        on: (_event, callback) => callback(socket),
        sockets: { sockets: new Map([['socket-a', socket]]) },
      },
      allow: vi.fn(() => true),
      reject: vi.fn(),
      rooms: new Map([[sourceRoom.id, sourceRoom]]),
      playerRoomMap: new Map([['socket-a', sourceRoom.id]]),
      broadcastRoomList: vi.fn(),
    };
    attachRematch(gameServer);

    handlers.rematch_request(sourceRoom.id);

    const rematchRoom = [...gameServer.rooms.values()][0];
    expect(rematchRoom.players[0]).toMatchObject({
      id: 'socket-a', accountId: '64b64c4fd6d7e7d6f7d6e001', name: 'Alice',
    });
  });

  it('moves a requester into the fresh room when a disconnected opponent later needs to rejoin', () => {
    const handlers = {};
    const requester = { id: 'socket-a', on: (event, handler) => { handlers[event] = handler; }, emit: vi.fn(), join: vi.fn() };
    const sourceRoom = {
      id: 'ABC123', gameStatus: 'finished', isSinglePlayer: false, isPrivate: false,
      numberLength: 4, spectatorModeEnabled: false, turnTimerSeconds: 0,
      players: [
        { id: 'socket-a', name: 'Alice', isConnected: true, isReady: true },
        { id: 'socket-b', name: 'Bob', isConnected: false, isReady: true },
      ],
    };
    const gameServer = {
      io: {
        on: (_event, callback) => callback(requester),
        sockets: { sockets: new Map([['socket-a', requester]]) },
      },
      allow: vi.fn(() => true),
      reject: vi.fn(),
      rooms: new Map([[sourceRoom.id, sourceRoom]]),
      playerRoomMap: new Map([['socket-a', sourceRoom.id]]),
      broadcastRoomList: vi.fn(),
    };
    attachRematch(gameServer);

    handlers.rematch_request(sourceRoom.id);

    const rematchRoom = [...gameServer.rooms.values()][0];
    expect(gameServer.playerRoomMap.get('socket-a')).toBe(rematchRoom.id);
    expect(requester.join).toHaveBeenCalledWith(rematchRoom.id);
    expect(requester.emit).toHaveBeenCalledWith('rematch_room_ready', { roomId: rematchRoom.id, accessCode: undefined });
  });
});
