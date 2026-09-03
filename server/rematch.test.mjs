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
});
