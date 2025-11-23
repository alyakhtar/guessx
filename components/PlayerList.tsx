'use client';

import { useTranslations } from 'next-intl';
import { GameRoom, Player } from '../types/game';

interface PlayerListProps {
  room: GameRoom;
  currentPlayerId: string;
}

export default function PlayerList({ room, currentPlayerId }: PlayerListProps) {
  const t = useTranslations('playerList');
  const currentPlayer = room.players.find(p => p.id === currentPlayerId);

  const getStatusBadge = (player: Player) => {
    if (player.isReady) {
      return <span className="badge text-bg-success">{t('status.ready')}</span>;
    } else {
      return <span className="badge text-bg-warning">{t('status.settingUp')}</span>;
    }
  };

  const getGameStatusText = () => {
    switch (room.gameStatus) {
      case 'waiting':
        return { text: t('status.waiting'), variant: 'warning' };
      case 'setup':
        return { text: t('status.setup'), variant: 'info' };
      case 'playing':
        return { text: t('status.playing'), variant: 'success' };
      case 'finished':
        return { text: t('status.finished'), variant: 'primary' };
      default:
        return { text: room.gameStatus, variant: 'secondary' };
    }
  };

  const statusInfo = getGameStatusText();

  return (
    <div className="card p-4 shadow h-100">
      <h2 className="card-title h5 fw-semibold mb-4">{t('title')}</h2>

      <div className="list-group mb-4">
        {room.players.map((player) => (
          <a
            key={player.id}
            href="#"
            className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${player.id === currentPlayerId ? 'list-group-item-info' : ''}`}
          >
            <div>
              <strong>{player.name}</strong> {player.id === currentPlayerId && <small>{t('indicators.you')}</small>}
            </div>
            <div className="d-flex align-items-center gap-2">
              {room.currentTurn === player.id && room.gameStatus === 'playing' && (
                <span className="badge text-bg-success small">{t('indicators.thinking')}</span>
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
              <strong>{t('indicators.yourSecret')}</strong> <code>{player.secretNumber}</code>
            </div>
          )}
          {room.gameStatus === 'finished' && player.secretNumber && player.id !== currentPlayerId && (
            <div className="alert alert-secondary small mb-3">
              <strong>{t('indicators.playerSecret', { player: player.name })}</strong> <code>{player.secretNumber}</code>
            </div>
          )}
        </div>
      ))}

      {/* Room Status */}
      <div className="card mb-3">
        <div className="card-body">
          <h3 className="card-title h6 fw-semibold mb-3">{t('roomStatus.title')}</h3>
          <div className="row g-2">
            <div className="col-6">
              <strong>{t('roomStatus.status')}</strong>
            </div>
            <div className="col-6">
              <span className={`badge text-bg-${statusInfo.variant}`}>{statusInfo.text}</span>
            </div>
            <div className="col-6">
              <strong>{t('roomStatus.players')}</strong>
            </div>
            <div className="col-6">
              {room.players.length}/2
            </div>
          </div>
        </div>
      </div>

      {room.players.length === 1 && (
        <div className="alert alert-warning small text-center">
          {t('roomStatus.waitingForPlayer')}
        </div>
      )}
    </div>
  );
}
