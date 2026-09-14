import { describe, expect, it, vi } from 'vitest';
import GameServer from './socket-server.js';

describe('quick reactions', () => {
  it('broadcasts a fixed reaction to room members and spectators', () => {
    const emitRoomEvent = vi.fn();
    const reject = vi.fn();
    const room = {
      id: 'ROOM01',
      gameStatus: 'playing',
      players: [{ id: 'player-1', name: 'Alice' }, { id: 'player-2', name: 'Bob' }],
    };

    GameServer.prototype.handleReaction.call({
      rooms: new Map([[room.id, room]]),
      emitRoomEvent,
      reject,
    }, { id: 'player-1' }, 'ROOM01', 'nice');

    expect(reject).not.toHaveBeenCalled();
    expect(emitRoomEvent).toHaveBeenCalledWith(room, 'reaction_received', {
      fromPlayerId: 'player-1',
      reaction: 'nice',
    });
  });

  it('rejects free text, invalid rooms, and spectators that try to react', () => {
    const emitRoomEvent = vi.fn();
    const reject = vi.fn();
    const room = {
      id: 'ROOM01',
      gameStatus: 'playing',
      players: [{ id: 'player-1', name: 'Alice' }],
    };
    const server = { rooms: new Map([[room.id, room]]), emitRoomEvent, reject };

    GameServer.prototype.handleReaction.call(server, { id: 'player-1' }, 'ROOM01', 'anything free-form');
    GameServer.prototype.handleReaction.call(server, { id: 'spectator-1' }, 'ROOM01', 'gg');

    expect(emitRoomEvent).not.toHaveBeenCalled();
    expect(reject).toHaveBeenCalledTimes(2);
  });
});
