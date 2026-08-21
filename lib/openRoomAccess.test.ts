import { createServer, type Server as HttpServer } from 'node:http';

import { io as createClient, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import GameServer from '../server/socket-server.js';
import { openRoomAccess, type RoomAccessState } from './openRoomAccess';

const EVENT_TIMEOUT = 3_000;
const NOT_FOUND_TIMEOUT = 5_000;

function once(socket: Socket, event: string, timeout = EVENT_TIMEOUT): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
    socket.once(event, (...args) => {
      clearTimeout(timer);
      resolve(args);
    });
  });
}

function recorder<T>() {
  const values: T[] = [];
  const waiters = new Set<{
    predicate: (value: T) => boolean;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  return {
    values,
    push(value: T) {
      values.push(value);
      for (const waiter of waiters) {
        if (!waiter.predicate(value)) continue;
        clearTimeout(waiter.timer);
        waiters.delete(waiter);
        waiter.resolve(value);
      }
    },
    waitFor(predicate: (value: T) => boolean, timeout = EVENT_TIMEOUT): Promise<T> {
      const existing = values.find(predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const waiter = {
          predicate,
          resolve,
          reject,
          timer: setTimeout(() => {
            waiters.delete(waiter);
            reject(new Error('Timed out waiting for recorded value'));
          }, timeout),
        };
        waiters.add(waiter);
      });
    },
    clear() {
      values.length = 0;
    },
    destroy() {
      for (const waiter of waiters) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error('Recorder destroyed'));
      }
      waiters.clear();
    },
  };
}

describe('openRoomAccess', () => {
  let httpServer: HttpServer;
  let gameServer: InstanceType<typeof GameServer>;
  let baseUrl: string;
  let clients: Socket[];
  let stateRequests: Array<{ socketId: string; roomId: string; at: number }>;

  beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => vi.restoreAllMocks());

  beforeEach(async () => {
    httpServer = createServer();
    gameServer = new GameServer(httpServer);
    clients = [];
    stateRequests = [];
    gameServer.io.on('connection', (serverSocket: { id: string; on: (event: string, handler: (roomId: string) => void) => void }) => {
      serverSocket.on('get_room_state', (roomId: string) => {
        stateRequests.push({ socketId: serverSocket.id, roomId, at: Date.now() });
      });
    });
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Expected an ephemeral TCP port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    vi.useRealTimers();
    for (const socket of clients) {
      socket.io.reconnection(false);
      socket.io.engine?.close();
    }
    await new Promise<void>((resolve) => gameServer.io.close(() => resolve()));
    if (httpServer.listening) {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => error ? reject(error) : resolve());
      });
    }
  });

  function client(autoConnect = true) {
    const socket = createClient(baseUrl, {
      autoConnect,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 25,
      reconnectionDelayMax: 25,
      randomizationFactor: 0,
      transports: ['websocket'],
    });
    clients.push(socket);
    return socket;
  }

  async function connectedClient() {
    const socket = client(false);
    const connected = once(socket, 'connect');
    socket.connect();
    await connected;
    return socket;
  }

  async function createRoom(creator: Socket, name: string, isPrivate = false) {
    const created = once(creator, 'room_created');
    creator.emit('create_room', name, 4, false, false, 'medium', isPrivate);
    const [roomId, room] = await created;
    return { roomId: roomId as string, room: room as { id: string; accessCode?: string } };
  }

  function waitForRequest(predicate: (request: { socketId: string; roomId: string; at: number }) => boolean) {
    return new Promise<{ socketId: string; roomId: string; at: number }>((resolve, reject) => {
      const poll = setInterval(() => {
        const request = stateRequests.find(predicate);
        if (!request) return;
        clearTimeout(deadline);
        clearInterval(poll);
        resolve(request);
      }, 5);
      const deadline = setTimeout(() => {
        clearInterval(poll);
        reject(new Error('Missing room-state request'));
      }, EVENT_TIMEOUT);
    });
  }

  function open(socket: Socket, roomId: string, initialCode?: string) {
    const states = recorder<RoomAccessState>();
    const errors = recorder<string>();
    const controller = openRoomAccess(socket, roomId, initialCode, {
      onState: states.push,
      onError: errors.push,
    });
    return { controller, states, errors };
  }

  it('waits for the first connection, then joins a public room', async () => {
    const creator = await connectedClient();
    const { roomId } = await createRoom(creator, 'Creator');
    const visitor = client(false);
    const { controller, states } = open(visitor, roomId);

    expect(stateRequests).toHaveLength(0);
    const connected = once(visitor, 'connect');
    visitor.connect();
    await connected;

    const visiting = await states.waitFor((state) => state.status === 'visitor-public');
    expect(visiting).toMatchObject({ status: 'visitor-public', room: { id: roomId } });

    controller.join('Guest');
    const member = await states.waitFor((state) => state.status === 'member');
    expect(member).toMatchObject({
      status: 'member',
      room: { id: roomId, players: [{ name: 'Creator' }, { id: visitor.id, name: 'Guest' }] },
    });
    controller.destroy();
  });

  it('uses a room-scoped query code and retains the code in private member state', async () => {
    const creator = await connectedClient();
    const { roomId, room } = await createRoom(creator, 'Creator', true);
    const visitor = await connectedClient();
    const { controller, states } = open(visitor, roomId, room.accessCode);

    const visiting = await states.waitFor((state) => state.status === 'visitor-private');
    expect(visiting).toMatchObject({ status: 'visitor-private', room: { id: roomId, isPrivate: true } });
    if (visiting.status !== 'visitor-private') throw new Error('Expected private visitor state');
    expect(visiting.room).not.toHaveProperty('accessCode');

    controller.join('Guest');
    const member = await states.waitFor((state) => state.status === 'member');
    expect(member).toMatchObject({
      status: 'member',
      room: { id: roomId, accessCode: room.accessCode, players: [{}, { id: visitor.id }] },
    });
    controller.destroy();
  });

  it('preserves an authorized private code across a later sanitized target-room update', async () => {
    const creator = await connectedClient();
    const { roomId, room } = await createRoom(creator, 'Creator', true);
    const visitor = await connectedClient();
    const { controller, states } = open(visitor, roomId, room.accessCode);
    await states.waitFor((state) => state.status === 'visitor-private');
    controller.join('Guest');
    const authorized = await states.waitFor((state) => state.status === 'member');
    if (authorized.status !== 'member') throw new Error('Expected member state');
    const { accessCode, ...sanitizedRoom } = authorized.room;
    states.clear();

    gameServer.io.sockets.sockets.get(visitor.id!)!.emit('room_updated', sanitizedRoom);

    const refreshed = await states.waitFor((state) => state.status === 'member');
    expect(refreshed).toMatchObject({
      status: 'member',
      room: { id: roomId, accessCode },
    });
    controller.destroy();
  });

  it('retries a rejected private code without duplicating controller effects', async () => {
    const creator = await connectedClient();
    const { roomId, room } = await createRoom(creator, 'Creator', true);
    const otherCreator = await connectedClient();
    const other = await createRoom(otherCreator, 'Other', true);
    const visitor = await connectedClient();
    const { controller, states, errors } = open(visitor, roomId, other.room.accessCode);
    await states.waitFor((state) => state.status === 'visitor-private');
    const listenerCounts = ['connect', 'room_updated', 'player_joined', 'player_reconnected', 'error']
      .map((event) => visitor.listeners(event).length);

    controller.join('Guest');
    expect(await errors.waitFor((error) => error === 'SERVER_ERROR:invalidCode')).toBe('SERVER_ERROR:invalidCode');
    expect(errors.values).toEqual(['SERVER_ERROR:invalidCode']);

    controller.join('Guest', room.accessCode);
    await states.waitFor((state) => state.status === 'member');
    expect(['connect', 'room_updated', 'player_joined', 'player_reconnected', 'error']
      .map((event) => visitor.listeners(event).length)).toEqual(listenerCounts);
    expect(errors.values).toEqual(['SERVER_ERROR:invalidCode']);
    controller.destroy();
  });

  it('reports not-found five seconds after the request is sent', async () => {
    const visitor = client(false);
    const { controller, states } = open(visitor, 'MISSING');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(states.values).toEqual([]);

    const connected = once(visitor, 'connect');
    const started = Date.now();
    visitor.connect();
    await connected;
    const request = await waitForRequest((candidate) => candidate.socketId === visitor.id);
    const missing = await states.waitFor(
      (state) => state.status === 'not-found',
      NOT_FOUND_TIMEOUT + EVENT_TIMEOUT,
    );

    expect(missing).toEqual({ status: 'not-found' });
    expect(Date.now() - request.at).toBeGreaterThanOrEqual(NOT_FOUND_TIMEOUT - 100);
    expect(request.at).toBeGreaterThanOrEqual(started);
    controller.destroy();
  }, 10_000);

  it('uses the connected fast path, filters other rooms, and removes only its listeners', async () => {
    const creator = await connectedClient();
    const otherCreator = await connectedClient();
    const target = await createRoom(creator, 'Creator');
    const other = await createRoom(otherCreator, 'Other');
    const visitor = await connectedClient();
    const unrelatedError = () => {};
    visitor.on('error', unrelatedError);
    const baseline = new Map(
      ['connect', 'room_updated', 'player_joined', 'player_reconnected', 'error']
        .map((event) => [event, visitor.listeners(event).length]),
    );

    const { controller, states } = open(visitor, target.roomId);
    await states.waitFor((state) => state.status === 'visitor-public');
    expect(stateRequests.filter((request) => request.socketId === visitor.id)).toEqual([
      expect.objectContaining({ roomId: target.roomId }),
    ]);

    const serverSocket = gameServer.io.sockets.sockets.get(visitor.id!);
    for (const event of ['room_updated', 'player_joined', 'player_reconnected']) {
      serverSocket!.emit(event, { ...other.room, id: other.roomId, players: [] });
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(states.values).toHaveLength(1);

    controller.destroy();
    controller.destroy();
    for (const [event, count] of baseline) {
      expect(visitor.listeners(event)).toHaveLength(count);
    }
    expect(visitor.listeners('error')).toContain(unrelatedError);
  });

  it('clears a pending not-found timer when destroyed', async () => {
    const visitor = await connectedClient();
    vi.useFakeTimers();
    const { controller, states } = open(visitor, 'MISSING');

    controller.destroy();
    await vi.advanceTimersByTimeAsync(NOT_FOUND_TIMEOUT);

    expect(states.values).toEqual([]);
  });

  it('routes the stable room-full server error through onError', async () => {
    const creator = await connectedClient();
    const second = await connectedClient();
    const target = await createRoom(creator, 'Creator');
    const joined = once(second, 'player_joined');
    second.emit('join_room', target.roomId, 'Second');
    await joined;
    const visitor = await connectedClient();
    const { controller, states, errors } = open(visitor, target.roomId);
    await states.waitFor((state) => state.status === 'visitor-public');

    controller.join('Third');

    expect(await errors.waitFor((error) => error === 'SERVER_ERROR:roomFull')).toBe('SERVER_ERROR:roomFull');
    controller.destroy();
  });

  it('re-requests after transport reconnect, uses the new socket id, and restarts not-found timing', async () => {
    const creator = await connectedClient();
    const target = await createRoom(creator, 'Creator');
    const visitor = await connectedClient();
    const { controller, states } = open(visitor, target.roomId);
    await states.waitFor((state) => state.status === 'visitor-public');
    controller.join('Guest');
    await states.waitFor((state) => state.status === 'member');
    states.clear();

    const oldId = visitor.id!;
    const reconnected = once(visitor, 'connect');
    gameServer.io.sockets.sockets.get(oldId)!.conn.close();
    await reconnected;
    const newId = visitor.id!;
    expect(newId).not.toBe(oldId);
    await states.waitFor((state) => state.status === 'visitor-public');
    controller.join('Guest');
    const member = await states.waitFor((state) =>
      state.status === 'member' && state.room.players.some((player) => player.id === newId),
    );
    expect(member).toMatchObject({ status: 'member', room: { id: target.roomId } });
    expect(stateRequests.filter((request) => request.roomId === target.roomId)).toHaveLength(2);

    creator.io.reconnection(false);
    const creatorServerSocket = gameServer.io.sockets.sockets.get(creator.id!);
    const creatorLeft = once(visitor, 'room_updated');
    creatorServerSocket!.conn.close();
    await creatorLeft;

    states.clear();
    const secondId = visitor.id!;
    const reconnectedAgain = once(visitor, 'connect');
    gameServer.io.sockets.sockets.get(secondId)!.conn.close();
    await reconnectedAgain;
    const thirdRequest = await waitForRequest((candidate) => candidate.socketId === visitor.id);
    const missing = await states.waitFor(
      (state) => state.status === 'not-found',
      NOT_FOUND_TIMEOUT + EVENT_TIMEOUT,
    );

    expect(missing).toEqual({ status: 'not-found' });
    expect(Date.now() - thirdRequest.at).toBeGreaterThanOrEqual(NOT_FOUND_TIMEOUT - 100);
    expect(stateRequests.filter((request) => request.roomId === target.roomId)).toHaveLength(3);
    controller.destroy();
  }, 15_000);
});
