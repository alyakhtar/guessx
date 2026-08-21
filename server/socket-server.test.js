import { createServer } from 'node:http';
import { io as createClient } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import GameServer from './socket-server.js';

const TIMEOUT = 3_000;

function waitFor(socket, event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), TIMEOUT);
    socket.once(event, (...args) => {
      clearTimeout(timer);
      resolve(args.length === 1 ? args[0] : args);
    });
  });
}

async function emitAndWait(socket, responseEvent, event, ...args) {
  const response = waitFor(socket, responseEvent);
  socket.emit(event, ...args);
  return response;
}

describe('GameServer shareable-room contract', () => {
  let httpServer;
  let gameServer;
  let baseUrl;
  let sockets;

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    httpServer = createServer();
    gameServer = new GameServer(httpServer);
    sockets = [];
    await new Promise((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(0, '127.0.0.1', () => {
        httpServer.off('error', reject);
        resolve();
      });
    });
    const { port } = httpServer.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await gameServer.io.close();
    sockets.forEach((socket) => socket.close());
    if (httpServer.listening) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
    vi.restoreAllMocks();
  });

  async function connect() {
    const socket = createClient(baseUrl, {
      autoConnect: false,
      forceNew: true,
      reconnection: false,
      transports: ['websocket'],
    });
    sockets.push(socket);
    const connected = waitFor(socket, 'connect');
    socket.connect();
    await connected;
    return socket;
  }

  async function createRoom(socket, playerName, isPrivate) {
    const [roomId, room] = await emitAndWait(
      socket,
      'room_created',
      'create_room',
      playerName,
      4,
      false,
      false,
      'medium',
      isPrivate,
    );
    return { roomId, room };
  }

  it('normalizes a scoped private code and joins the target room', async () => {
    const creator = await connect();
    const joiner = await connect();
    const { roomId, room } = await createRoom(creator, 'Creator', true);

    const joined = waitFor(joiner, 'player_joined');
    joiner.emit('join_room_by_code', `  ${room.accessCode.toLowerCase()}  `, 'Guest', roomId);

    expect(await joined).toMatchObject({
      id: roomId,
      players: [{ name: 'Creator' }, { name: 'Guest' }],
    });
  });

  it('rejects a code belonging to a different target room', async () => {
    const firstCreator = await connect();
    const secondCreator = await connect();
    const joiner = await connect();
    const first = await createRoom(firstCreator, 'First', true);
    const second = await createRoom(secondCreator, 'Second', true);

    const error = await emitAndWait(
      joiner,
      'error',
      'join_room_by_code',
      second.room.accessCode,
      'Guest',
      first.roomId,
    );

    expect(error).toBe('SERVER_ERROR:invalidCode');
  });

  it('keeps unscoped manual code joins compatible', async () => {
    const creator = await connect();
    const joiner = await connect();
    const { roomId, room } = await createRoom(creator, 'Creator', true);

    const joined = waitFor(joiner, 'player_joined');
    joiner.emit('join_room_by_code', room.accessCode, 'Guest');

    expect(await joined).toMatchObject({ id: roomId });
  });

  it('returns the stable invalid-code key for an unknown code', async () => {
    const creator = await connect();
    const joiner = await connect();
    const { roomId } = await createRoom(creator, 'Creator', true);

    const error = await emitAndWait(
      joiner,
      'error',
      'join_room_by_code',
      'ZZZ',
      'Guest',
      roomId,
    );

    expect(error).toBe('SERVER_ERROR:invalidCode');
  });

  it('never exposes private access codes to room lists or non-members', async () => {
    const creator = await connect();
    const visitor = await connect();
    const { roomId } = await createRoom(creator, 'Creator', true);

    const rooms = await emitAndWait(visitor, 'room_list', 'get_rooms');
    const listedRoom = rooms.find((room) => room.id === roomId);
    expect(listedRoom).toMatchObject({ id: roomId, isPrivate: true, hasAccessCode: true });
    expect(listedRoom).not.toHaveProperty('accessCode');

    const roomState = await emitAndWait(visitor, 'room_updated', 'get_room_state', roomId);
    expect(roomState).toMatchObject({ id: roomId, isPrivate: true, hasAccessCode: true });
    expect(roomState).not.toHaveProperty('accessCode');
  });

  it('does not write the private access code to the creation log', async () => {
    const creator = await connect();
    const { roomId, room } = await createRoom(creator, 'Creator', true);

    const creationLog = console.log.mock.calls
      .map((args) => args.join(' '))
      .find((message) => message.includes(`Room ${roomId} created`));

    expect(creationLog).toContain('private');
    expect(creationLog).not.toContain(room.accessCode);
  });

  it('returns the stable room-full key when both seats are occupied', async () => {
    const creator = await connect();
    const secondPlayer = await connect();
    const thirdPlayer = await connect();
    const { roomId } = await createRoom(creator, 'Creator', false);
    await emitAndWait(secondPlayer, 'player_joined', 'join_room', roomId, 'Second');

    const error = await emitAndWait(thirdPlayer, 'error', 'join_room', roomId, 'Third');

    expect(error).toBe('SERVER_ERROR:roomFull');
  });

  it.each([
    { label: 'public join', isPrivate: false },
    { label: 'private code join', isPrivate: true },
  ])('reconnects the same name before capacity through $label', async ({ isPrivate }) => {
    const creator = await connect();
    const originalGuest = await connect();
    const created = await createRoom(creator, 'Creator', isPrivate);

    if (isPrivate) {
      await emitAndWait(
        originalGuest,
        'player_joined',
        'join_room_by_code',
        created.room.accessCode,
        'Guest',
        created.roomId,
      );
    } else {
      await emitAndWait(originalGuest, 'player_joined', 'join_room', created.roomId, 'Guest');
    }

    const left = waitFor(creator, 'player_left');
    originalGuest.disconnect();
    await left;

    const reconnectingGuest = await connect();
    const reconnected = waitFor(creator, 'player_reconnected');
    if (isPrivate) {
      reconnectingGuest.emit(
        'join_room_by_code',
        created.room.accessCode,
        'Guest',
        created.roomId,
      );
    } else {
      reconnectingGuest.emit('join_room', created.roomId, 'Guest');
    }

    expect(await reconnected).toMatchObject({
      id: created.roomId,
      players: [{ name: 'Creator' }, { id: reconnectingGuest.id, name: 'Guest', isConnected: true }],
    });
  });
});
