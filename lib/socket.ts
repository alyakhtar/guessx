'use client';

import { io, Socket } from 'socket.io-client';
import type { BotDifficulty, GameRoom, Guess, TurnTimerSeconds } from '../types/game';

export interface TurnStartedPayload {
  roomId: string;
  currentTurn: string;
  turnStartedAt?: number;
  turnDeadline?: number;
  turnDurationMs: number;
  serverNow?: number;
}

interface ServerToClientEvents {
  connected: (payload: { socketId: string }) => void;
  room_list: (rooms: GameRoom[]) => void;
  room_created: (roomId: string, room: GameRoom) => void;
  room_updated: (room: GameRoom) => void;
  secret_number_set: (room: GameRoom) => void;
  guess_made: (room: GameRoom, guess: Guess) => void;
  game_won: (room: GameRoom, winnerName: string) => void;
  player_joined: (room: GameRoom) => void;
  player_left: (room: GameRoom) => void;
  player_reconnected: (room: GameRoom) => void;
  turn_started: (payload: TurnStartedPayload) => void;
  rematch_offer: (payload: { roomId: string; from: string }) => void;
  rematch_offer_sent: () => void;
  rematch_declined: () => void;
  rematch_room_ready: (payload: { roomId: string; accessCode?: string; solo?: boolean }) => void;
  error: (message: string) => void;
}

interface ClientToServerEvents {
  get_rooms: () => void;
  create_room: (
    playerName: string,
    numberLength: number,
    spectatorModeEnabled: boolean,
    isSinglePlayer: boolean,
    botDifficulty: BotDifficulty,
    isPrivate: boolean,
    turnTimerSeconds: TurnTimerSeconds,
  ) => void;
  join_room_by_code: (accessCode: string, playerName: string) => void;
  join_room: (roomId: string, playerName: string) => void;
  get_room_state: (roomId: string) => void;
  set_secret_number: (secretNumber: string) => void;
  make_guess: (guess: string) => void;
  new_game: () => void;
  rematch_request: (roomId: string) => void;
  rematch_accept: (roomId: string) => void;
  rematch_decline: (roomId: string) => void;
}

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private isConnecting = false;

  connect() {
    if (this.socket?.connected) {
      return this.socket;
    }

    if (this.isConnecting) {
      return this.socket;
    }

    this.isConnecting = true;

    // Connect to the same host
    this.socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.debug('Socket connected:', this.socket?.id);
      this.isConnecting = false;
    });

    this.socket.on('disconnect', (reason) => {
      console.debug('Socket disconnected:', reason);
      this.isConnecting = false;
    });

    this.socket.on('connect_error', (error) => {
      console.debug('Socket connection error:', error);
      this.isConnecting = false;
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
  }

  getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
