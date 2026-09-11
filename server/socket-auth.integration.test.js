import { createServer } from 'node:http';
import { io as createClient } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import GameServer from './socket-server.js';

const TIMEOUT = 3_000;
const ACCOUNT_A = '64b64c4fd6d7e7d6f7d6e001';
const ACCOUNT_B = '64b64c4fd6d7e7d6f7d6e002';

function waitFor(socket, event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), TIMEOUT);
    socket.once(event, (...args) => {
      clearTimeout(timer);
      resolve(args.length === 1 ? args[0] : args);
    });
  });
}

function socketIdentityFromCookie(socket) {
  const cookie = socket.handshake.headers.cookie ?? '';
  if (cookie.includes('account-a')) return { kind: 'account', userId: ACCOUNT_A };
  if (cookie.includes('account-b')) return { kind: 'account', userId: ACCOUNT_B };
  return { kind: 'guest' };
}

describe('Socket.IO account identity and reconnect authorization', () => {
  let httpServer;
  let gameServer;
  let baseUrl;
  let sockets;

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    httpServer = createServer();
    gameServer = new GameServer(httpServer, { resolveSocketIdentity: socketIdentityFromCookie });
    sockets = [];
    await new Promise((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(0, '127.0.0.1', () => {
        httpServer.off('error', reject);
        resolve();
      });
    });
    baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
  });

  afterEach(async () => {
    await gameServer.io.close();
    sockets.forEach((socket) => socket.close());
    if (httpServer.listening) await new Promise((resolve) => httpServer.close(resolve));
    vi.restoreAllMocks();
  });

  async function connect(cookie) {
    const socket = createClient(baseUrl, {
      autoConnect: false,
      forceNew: true,
      reconnection: false,
      transports: ['websocket'],
      ...(cookie ? { extraHeaders: { Cookie: `authjs.session-token=${cookie}` } } : {}),
    });
    sockets.push(socket);
    const connected = waitFor(socket, 'connect');
    socket.connect();
    await connected;
    return socket;
  }

  it('reconnects an account by verified user ID, rejects another account with its name, and never broadcasts account IDs', async () => {
    const owner = await connect('account-a');
    const guest = await connect();
    const [roomId, createdRoom] = await waitForAfterEmit(
      owner,
      'room_created',
      'create_room',
      'Alice', 4, false, false, 'medium', false,
    );
    await waitForAfterEmit(guest, 'player_joined', 'join_room', roomId, 'Guest');

    expect(createdRoom.players[0]).not.toHaveProperty('accountId');
    expect(JSON.stringify(createdRoom)).not.toContain('account-a');
    expect(gameServer.rooms.get(roomId).players[0]).toMatchObject({ accountId: ACCOUNT_A, name: 'Alice' });

    const left = waitFor(guest, 'player_left');
    owner.disconnect();
    await left;

    const attacker = await connect('account-b');
    const rejected = waitFor(attacker, 'error');
    attacker.emit('join_room', roomId, 'Alice');
    await expect(rejected).resolves.toBe('SERVER_ERROR:duplicateName');

    const reconnectedOwner = await connect('account-a');
    const reconnected = waitFor(guest, 'player_reconnected');
    reconnectedOwner.emit('join_room', roomId, 'A different client name');
    await reconnected;

    const ownerPlayer = gameServer.rooms.get(roomId).players.find((player) => player.accountId === ACCOUNT_A);
    expect(ownerPlayer).toMatchObject({ id: reconnectedOwner.id, name: 'Alice', isConnected: true });
  });

  it('marks sockets without a verified session as guests and preserves the existing guest reconnect behavior', async () => {
    const creator = await connect();
    const observer = await connect();
    const [roomId] = await waitForAfterEmit(
      creator,
      'room_created',
      'create_room',
      'Guest', 4, false, false, 'medium', false,
    );
    await waitForAfterEmit(observer, 'player_joined', 'join_room', roomId, 'Observer');

    expect(gameServer.rooms.get(roomId).players[0]).not.toHaveProperty('accountId');

    const left = waitFor(observer, 'player_left');
    creator.disconnect();
    await left;

    const reconnectedGuest = await connect();
    const reconnected = waitFor(observer, 'player_reconnected');
    reconnectedGuest.emit('join_room', roomId, 'Guest');
    await reconnected;

    expect(gameServer.rooms.get(roomId).players[0]).toMatchObject({ id: reconnectedGuest.id, name: 'Guest' });
  });
});

function waitForAfterEmit(socket, responseEvent, event, ...args) {
  const response = waitFor(socket, responseEvent);
  socket.emit(event, ...args);
  return response;
}
