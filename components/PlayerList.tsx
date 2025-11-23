'use client';

import { GameRoom, Player } from '../types/game';

interface PlayerListProps {
  room: GameRoom;
  currentPlayerId: string;
}

export default function PlayerList({ room, currentPlayerId }: PlayerListProps) {
  const currentPlayer = room.players.find(p => p.id === currentPlayerId);

  const getStatusBadge = (player: Player) => {
    if (player.isReady) {
      return <span className="badge text-bg-success">Ready</span>;
    } else {
      return <span className="badge text-bg-warning">Setting up...</span>;
    }
  };

  const getGameStatusText = () => {
    switch (room.gameStatus) {
      case 'waiting':
        return { text: 'Waiting', variant: 'warning' };
      case 'setup':
        return { text: 'Setup', variant: 'info' };
      case 'playing':
        return { text: 'Playing', variant: 'success' };
      case 'finished':
        return { text: 'Finished', variant: 'primary' };
      default:
        return { text: room.gameStatus, variant: 'secondary' };
    }
  };

  const statusInfo = getGameStatusText();

  return (
    <div className="card p-4 shadow h-100">
      <h2 className="card-title h5 fw-semibold mb-4">Players</h2>

      <div className="list-group mb-4">
        {room.players.map((player) => (
          <a
            key={player.id}
            href="#"
            className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${player.id === currentPlayerId ? 'list-group-item-info' : ''
              }`}
          >
            <div>
              <strong>{player.name}</strong> {player.id === currentPlayerId && <small>(You)</small>}
            </div>
            <div className="d-flex align-items-center gap-2">
              {room.currentTurn === player.id && room.gameStatus === 'playing' && (
                <span className="badge text-bg-success small">Thinking...</span>
              )}
              {getStatusBadge(player)}
            </div>
          </a>
        ))}
      </div>

      {/* Secret Numbers */}
      {room.players.map((player) => (
        <div key={`secret-${player.id}`}>
          {(player.secretNumber && player.id === currentPlayerId) && (
            <div className="alert alert-secondary small mb-3">
              <strong>Your secret:</strong> <code>{player.secretNumber}</code>
            </div>
          )}
          {room.gameStatus === 'finished' && player.secretNumber && player.id !== currentPlayerId && (
            <div className="alert alert-secondary small mb-3">
              <strong>{player.name}'s secret:</strong> <code>{player.secretNumber}</code>
            </div>
          )}
        </div>
      ))}

      {/* Room Status */}
      <div className="card mb-3">
        <div className="card-body">
          <h3 className="card-title h6 fw-semibold mb-3">Room Status</h3>
          <div className="row g-2">
            <div className="col-6">
              <strong>Status:</strong>
            </div>
            <div className="col-6">
              <span className={`badge text-bg-${statusInfo.variant}`}>{statusInfo.text}</span>
            </div>
            <div className="col-6">
              <strong>Players:</strong>
            </div>
            <div className="col-6">
              {room.players.length}/2
            </div>
          </div>
        </div>
      </div>

      {room.players.length === 1 && (
        <div className="alert alert-warning small text-center">
          Waiting for another player to join...
        </div>
      )}
    </div>
  );
}
