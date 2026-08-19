'use client';

import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
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

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
