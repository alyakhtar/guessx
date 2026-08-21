import type { Socket } from 'socket.io-client';

import type { GameRoom } from '../types/game';

export type RoomAccessState =
  | { status: 'member'; room: GameRoom }
  | { status: 'visitor-public'; room: GameRoom }
  | { status: 'visitor-private'; room: GameRoom }
  | { status: 'not-found' };

type RoomAccessCallbacks = {
  onState: (state: RoomAccessState) => void;
  onError: (error: string) => void;
};

const NOT_FOUND_DELAY = 5_000;

export function openRoomAccess(
  socket: Socket,
  roomId: string,
  initialCode: string | undefined,
  { onState, onError }: RoomAccessCallbacks,
) {
  let room: GameRoom | undefined;
  let notFoundTimer: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;
  const queryCode = initialCode?.trim().match(/^[A-Z0-9]{3}$/i)?.[0];

  const clearNotFoundTimer = () => {
    if (notFoundTimer) clearTimeout(notFoundTimer);
    notFoundTimer = undefined;
  };

  const requestRoom = () => {
    if (destroyed) return;
    clearNotFoundTimer();
    socket.emit('get_room_state', roomId);
    notFoundTimer = setTimeout(() => {
      notFoundTimer = undefined;
      if (!destroyed) onState({ status: 'not-found' });
    }, NOT_FOUND_DELAY);
  };

  const handleRoom = (nextRoom: GameRoom) => {
    if (destroyed || nextRoom.id !== roomId) return;
    clearNotFoundTimer();
    room = nextRoom;
    if (nextRoom.players.some((player) => player.id === socket.id)) {
      onState({ status: 'member', room: nextRoom });
    } else {
      onState({ status: nextRoom.isPrivate ? 'visitor-private' : 'visitor-public', room: nextRoom });
    }
  };

  const handleError = (error: string) => {
    if (!destroyed) onError(error);
  };

  socket.on('connect', requestRoom);
  socket.on('room_updated', handleRoom);
  socket.on('player_joined', handleRoom);
  socket.on('player_reconnected', handleRoom);
  socket.on('error', handleError);

  if (socket.connected) requestRoom();

  return {
    join(playerName: string, code?: string) {
      if (destroyed || !room) return;
      if (room.isPrivate) {
        socket.emit('join_room_by_code', code ?? queryCode ?? '', playerName, roomId);
      } else {
        socket.emit('join_room', roomId, playerName);
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearNotFoundTimer();
      socket.off('connect', requestRoom);
      socket.off('room_updated', handleRoom);
      socket.off('player_joined', handleRoom);
      socket.off('player_reconnected', handleRoom);
      socket.off('error', handleError);
    },
  };
}
