import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { io as createClient } from 'socket.io-client';

const require = createRequire(import.meta.url);
const GameServer = require('./socket-server.js');

const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const controlledTimer = Symbol('controlledTimer');

function createClock() {
  let now = 1_800_000_000_000;
  let tasks = [];

  return {
    now: () => now,
    setTimeout(callback, delay, ...args) {
      if (delay !== 15_000) return realSetTimeout(callback, delay, ...args);
      const task = { [controlledTimer]: true, callback, args, due: now + delay, cancelled: false, done: false };
      tasks.push(task);
      return task;
    },
    clearTimeout(handle) {
      if (handle?.[controlledTimer]) handle.cancelled = true;
      else realClearTimeout(handle);
    },
    advance(milliseconds) {
      now += milliseconds;
      let due;
      while ((due = tasks.find(task => !task.cancelled && !task.done && task.due <= now))) {
        due.done = true;
        due.callback(...due.args);
      }
    },
    activeCount: () => tasks.filter(task => !task.cancelled && !task.done).length,
    reset() {
      tasks = [];
      now = 1_800_000_000_000;
    },
  };
}

function waitFor(socket, event, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timeout = realSetTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`Timed out waiting for ${event}`));
    }, 2_000);
    const listener = (...args) => {
      if (!predicate(...args)) return;
      realClearTimeout(timeout);
      socket.off(event, listener);
      resolve(args);
    };
    socket.on(event, listener);
  });
}

const flushNetwork = () => new Promise(resolve => realSetTimeout(resolve, 30));

describe('server turn timer integration', () => {
  const clock = createClock();
  const clients = [];
  let httpServer;
  let gameServer;
  let url;

  beforeAll(async () => {
    vi.spyOn(Date, 'now').mockImplementation(clock.now);
    vi.stubGlobal('setTimeout', clock.setTimeout);
    vi.stubGlobal('clearTimeout', clock.clearTimeout);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));

    httpServer = createServer();
    gameServer = new GameServer(httpServer);
    await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${httpServer.address().port}`;
  });

  beforeEach(() => clock.reset());

  afterEach(async () => {
    for (const socket of clients.splice(0)) socket.conn?.close();
    await flushNetwork();
  });

  afterAll(async () => {
    await new Promise(resolve => gameServer.io.close(resolve));
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function connect(socket) {
    const connected = waitFor(socket, 'connect');
    socket.connect();
    await connected;
    socket.conn = socket.io.engine;
    return socket;
  }

  async function twoClients() {
    const options = { autoConnect: false, forceNew: true, reconnection: false, transports: ['websocket'] };
    const first = createClient(url, options);
    const second = createClient(url, options);
    clients.push(first, second);
    await Promise.all([connect(first), connect(second)]);
    return { first, second };
  }

  async function createRoom(first, turnTimerSeconds, spectatorModeEnabled = false, isSinglePlayer = false) {
    const created = waitFor(first, 'room_created');
    first.emit('create_room', 'Alice', 4, spectatorModeEnabled, isSinglePlayer, 'medium', false, turnTimerSeconds);
    const [roomId, room] = await created;
    return { roomId, room };
  }

  async function startMultiplayer(turnTimerSeconds = 15) {
    const { first, second } = await twoClients();
    const created = await createRoom(first, turnTimerSeconds);
    const joined = waitFor(first, 'room_updated', room => room.players.length === 2);
    second.emit('join_room', created.roomId, 'Bob');
    await joined;

    const turnStarted = waitFor(first, 'turn_started');
    const playing = waitFor(first, 'room_updated', room => room.gameStatus === 'playing');
    first.emit('set_secret_number', '1234');
    second.emit('set_secret_number', '5678');
    const [[turn], [room]] = await Promise.all([turnStarted, playing]);
    return { first, second, ...created, room, turn };
  }

  function playersForTurn(game) {
    const active = game.room.currentTurn === game.first.id ? game.first : game.second;
    const opponent = active === game.first ? game.second : game.first;
    return { active, opponent };
  }

  it('forfeits the idle player when a timed turn expires', async () => {
    const game = await startMultiplayer();
    const { opponent } = playersForTurn(game);
    const expectedWinner = opponent === game.first ? 'Alice' : 'Bob';
    const won = waitFor(game.first, 'game_won');

    clock.advance(15_000);
    const args = await won;

    expect(args).toHaveLength(2);
    expect(args[0]).toMatchObject({
      gameStatus: 'finished',
      gameEndReason: 'idle_forfeit',
      forfeitedBy: game.room.currentTurn,
    });
    expect(args[0].winner).toBe(expectedWinner);
    expect(args[1]).toBe(expectedWinner);
  });

  it('clears the old deadline after a valid guess and forfeits the next player at the new deadline', async () => {
    const game = await startMultiplayer();
    const { active, opponent } = playersForTurn(game);
    const wins = [];
    game.first.on('game_won', (...args) => wins.push(args));

    clock.advance(5_000);
    const guessed = waitFor(game.first, 'guess_made');
    active.emit('make_guess', active === game.first ? '1234' : '5678');
    const [nextRoom] = await guessed;
    expect(nextRoom.currentTurn).toBe(opponent.id);

    clock.advance(10_000);
    await flushNetwork();
    expect(wins).toHaveLength(0);

    clock.advance(5_000);
    await flushNetwork();
    expect(wins).toHaveLength(1);
    expect(wins[0][0]).toMatchObject({
      gameEndReason: 'idle_forfeit',
      forfeitedBy: opponent.id,
    });
  });

  it('falls back to an untimed room for an invalid seventh create_room argument', async () => {
    const game = await startMultiplayer(13);
    const wins = [];
    game.first.on('game_won', (...args) => wins.push(args));

    expect(game.room.turnTimerSeconds).toBe(0);
    expect(game.turn).toMatchObject({ currentTurn: game.room.currentTurn, turnDurationMs: 0 });
    expect(game.turn).not.toHaveProperty('turnDeadline');
    expect(game.turn).not.toHaveProperty('serverNow');
    expect(clock.activeCount()).toBe(0);

    clock.advance(60_000);
    await flushNetwork();
    expect(wins).toHaveLength(0);
  });

  it('sends the same turn_started deadline to spectators', async () => {
    const { first, second: spectator } = await twoClients();
    const { roomId } = await createRoom(first, 15, true, true);
    const hydrated = waitFor(spectator, 'room_updated');
    spectator.emit('get_room_state', roomId);
    await hydrated;

    const memberTurn = waitFor(first, 'turn_started');
    const spectatorTurn = waitFor(spectator, 'turn_started');
    first.emit('set_secret_number', '1234');
    const [[member], [observed]] = await Promise.all([memberTurn, spectatorTurn]);

    expect(observed).toEqual(member);
    expect(observed).toMatchObject({
      currentTurn: first.id,
      turnStartedAt: clock.now(),
      turnDeadline: clock.now() + 15_000,
      turnDurationMs: 15_000,
      serverNow: clock.now(),
    });
  });

  it('stamps a mid-turn get_room_state hydration with fresh server time', async () => {
    const game = await startMultiplayer();
    clock.advance(5_000);

    const hydrated = waitFor(game.second, 'room_updated', room => room.serverNow === clock.now());
    game.second.emit('get_room_state', game.roomId);
    const [room] = await hydrated;

    expect(room).toMatchObject({
      turnTimerSeconds: 15,
      turnStartedAt: game.turn.turnStartedAt,
      turnDeadline: game.turn.turnDeadline,
      serverNow: clock.now(),
    });
  });

  it('does not restart the active turn when a ready player repeats set_secret_number', async () => {
    const game = await startMultiplayer();
    const originalTurn = game.room.currentTurn;
    const originalDeadline = game.room.turnDeadline;
    clock.advance(5_000);

    const updated = waitFor(game.first, 'room_updated', room =>
      room.players.find(player => player.id === game.first.id)?.secretNumber === '2222'
    );
    game.first.emit('set_secret_number', '2222');
    const [room] = await updated;

    expect(room.currentTurn).toBe(originalTurn);
    expect(room.turnDeadline).toBe(originalDeadline);
  });

  it('cancels the pending timer after a normal win', async () => {
    const game = await startMultiplayer();
    const { active } = playersForTurn(game);
    const wins = [];
    game.first.on('game_won', (...args) => wins.push(args));
    const won = waitFor(game.first, 'game_won');

    active.emit('make_guess', active === game.first ? '5678' : '1234');
    const [winningRoom] = await won;
    expect(winningRoom.gameEndReason).toBeUndefined();

    clock.advance(15_000);
    await flushNetwork();
    expect(wins).toHaveLength(1);
  });

  it('clears the pending timer when all players disconnect and the room is deleted', async () => {
    const game = await startMultiplayer();
    game.first.conn.close();
    game.second.conn.close();
    await flushNetwork();

    expect(clock.activeCount()).toBe(0);
    clock.advance(15_000);

    await connect(game.first);
    const listed = waitFor(game.first, 'room_list');
    game.first.emit('get_rooms');
    const [rooms] = await listed;
    expect(rooms.some(room => room.id === game.roomId)).toBe(false);
  });

  it('keeps the deadline after disconnect and stamps both disconnect room payloads', async () => {
    const game = await startMultiplayer();
    const { active, opponent } = playersForTurn(game);
    const disconnectedId = active.id;
    clock.advance(4_000);
    const left = waitFor(opponent, 'player_left');
    const updated = waitFor(opponent, 'room_updated', room => room.players.some(player => !player.isConnected));
    const won = waitFor(opponent, 'game_won');

    active.conn.close();
    const [[leftRoom], [updatedRoom]] = await Promise.all([left, updated]);
    expect(leftRoom.serverNow).toBe(clock.now());
    expect(updatedRoom.serverNow).toBe(clock.now());
    expect(updatedRoom.turnDeadline).toBe(game.turn.turnDeadline);

    clock.advance(11_000);
    const [winningRoom] = await won;
    expect(winningRoom).toMatchObject({
      gameEndReason: 'idle_forfeit',
      forfeitedBy: disconnectedId,
    });
  });

  it('keeps the original deadline and forfeits the remapped player after reconnect', async () => {
    const game = await startMultiplayer();
    const { active, opponent } = playersForTurn(game);
    const playerName = active === game.first ? 'Alice' : 'Bob';
    const oldId = active.id;
    clock.advance(4_000);
    const left = waitFor(opponent, 'player_left');

    active.conn.close();
    await left;
    await connect(active);
    const reconnected = waitFor(opponent, 'player_reconnected');
    active.emit('join_room', game.roomId, playerName);
    const [room] = await reconnected;

    expect(active.id).not.toBe(oldId);
    expect(room.currentTurn).toBe(active.id);
    expect(room.turnDeadline).toBe(game.turn.turnDeadline);
    expect(room.serverNow).toBe(clock.now());

    const won = waitFor(opponent, 'game_won');
    clock.advance(11_000);
    const [winningRoom] = await won;
    expect(winningRoom).toMatchObject({
      gameEndReason: 'idle_forfeit',
      forfeitedBy: active.id,
    });
  });
});
