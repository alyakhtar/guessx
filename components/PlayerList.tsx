'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useUserSettings } from '../lib/useUserSettings';
import { shouldRevealSecret } from '../lib/userSettings';
import { GameRoom, Player } from '../types/game';

interface PlayerListProps {
  room: GameRoom;
  currentPlayerId: string;
}

interface VsStats {
  player1: {
    name: string;
    wins: number;
    totalGames: number;
  };
  player2: {
    name: string;
    wins: number;
    totalGames: number;
  };
  totalGames: number;
}

export default function PlayerList({ room, currentPlayerId }: PlayerListProps) {
  const t = useTranslations('playerList');
  const settings = useUserSettings();
  const currentPlayer = room.players.find(p => p.id === currentPlayerId);
  const [vsStats, setVsStats] = useState<VsStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Fetch vs stats when there are two players
  useEffect(() => {
    if (room.players.length === 2) {
      const player1 = room.players[0].name;
      const player2 = room.players[1].name;

      const fetchVsStats = async () => {
        setLoadingStats(true);
        try {
          const response = await fetch(`/api/admin/player-stats?player1=${encodeURIComponent(player1)}&player2=${encodeURIComponent(player2)}`);
          if (response.ok) {
            const data = await response.json();
            setVsStats(data);
          }
        } catch (error) {
          console.error('Failed to fetch vs stats:', error);
        } finally {
          setLoadingStats(false);
        }
      };

      fetchVsStats();
    } else {
      setVsStats(null);
    }
  }, [room.players]);

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

  const getDigitGuessStatus = () => {
    if (!currentPlayer?.secretNumber) return [];

    const opponentGuesses = room.gameHistory.filter(guess =>
      room.players.find(p => p.name === guess.playerName)?.id !== currentPlayerId
    );

    return currentPlayer.secretNumber.split('').map((digit, index) => {
      const isGuessed = opponentGuesses.some(guess => guess.guess[index] === digit);
      return {
        digit,
        isGuessed,
        index
      };
    });
  };

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

      {/* VS Stats */}
      {vsStats && room.players.length === 2 && (
        <div className="card mb-3">
          <div className="card-body">
            <h4 className="card-title h6 fw-semibold mb-3">Head-to-Head</h4>
            {loadingStats ? (
              <div className="text-center">
                <div className="spinner-border spinner-border-sm" role="status"></div>
                <small className="text-muted ms-2">Loading stats...</small>
              </div>
            ) : (
              <div className="row text-center">
                <div className="col-5">
                  <div className="fw-bold">{vsStats.player1.name}</div>
                  <div className="h4 text-success mb-0">{vsStats.player1.wins}</div>
                </div>
                <div className="col-2 d-flex align-items-center justify-content-center">
                  <span className="text-muted">vs</span>
                </div>
                <div className="col-5">
                  <div className="fw-bold">{vsStats.player2.name}</div>
                  <div className="h4 text-success mb-0">{vsStats.player2.wins}</div>
                </div>
                <div className="col-12 mt-2">
                  <small className="text-muted">
                    {vsStats.totalGames} total games played
                  </small>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Secret Numbers */}
      {room.players.map((player) => (
        <div key={`secret-${player.id}`}>
          {(player.secretNumber && player.id === currentPlayerId) && (
            <div className="card mb-3">
              <div className="card-body">
                <h4 className="card-title h6 fw-semibold mb-3">{t('indicators.yourSecret')}</h4>
                <div className="d-flex gap-2 justify-content-center">
                  {getDigitGuessStatus().map(({ digit, isGuessed }, index) => (
                    <div
                      key={index}
                      className={`badge fs-5 fw-bold border border-2 ${isGuessed
                        ? 'text-bg-danger border-danger'
                        : 'text-bg-success border-success'
                        }`}
                      style={{
                        minWidth: '40px',
                        minHeight: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                      }}
                    >
                      {digit}
                    </div>
                  ))}
                </div>
                {room.gameStatus === 'playing' && (
                  <div className="small text-muted mt-2 d-flex justify-content-center align-items-center gap-1">
                    <span>{t('indicators.digitsGuessed')}</span>
                    <span className="badge text-bg-danger">
                      {getDigitGuessStatus().filter(d => d.isGuessed).length}/{currentPlayer.secretNumber.length}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          {shouldRevealSecret(settings, room.gameStatus) && player.secretNumber && player.id !== currentPlayerId && (
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
