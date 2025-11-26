'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { socketService } from '../lib/socket';
import { GameRoom } from '../types/game';
import LocaleSelector from './LocaleSelector';

export default function Lobby() {
  const t = useTranslations('lobby');
  const locale = useLocale();

  console.debug('🏴 Lobby debug: current locale:', locale);
  const [playerName, setPlayerName] = useState('');
  const [numberLength, setNumberLength] = useState(4);
  const [spectatorModeEnabled, setSpectatorModeEnabled] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSinglePlayer, setIsSinglePlayer] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [socket, setSocket] = useState<any>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const router = useRouter();

  useEffect(() => {
    // Load saved player name from localStorage
    const savedName = localStorage.getItem('playerName');
    if (savedName) {
      setPlayerName(savedName);
    }
  }, []);

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = socketService.connect();
    setSocket(socketInstance);

    socketInstance.emit('get_rooms');
    socketInstance.on('room_list', (rooms: GameRoom[]) => setRooms(rooms));

    // Cleanup on unmount
    return () => {
      // Don't disconnect here - we want to maintain the connection
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const handleCreateRoom = () => {
    const trimmedName = playerName.trim();
    if (!trimmedName) {
      alert(t('errors.nameRequired'));
      return;
    }

    // Save to localStorage
    localStorage.setItem('playerName', trimmedName);

    if (!socket) {
      alert(t('errors.connectionError'));
      return;
    }

    setIsCreating(true);

    // Set up one-time listeners
    socket.emit(
      'create_room',
      trimmedName,
      numberLength,
      spectatorModeEnabled,
      isSinglePlayer,
      botDifficulty
    );

    const handleRoomCreated = (newRoomId: string, room: any) => {
      console.debug('Room created, navigating to:', newRoomId);
      setIsCreating(false);
      router.push(`/${locale}/game/${newRoomId}`);
    };

    const handleError = (error: string) => {
      console.debug('Room creation error:', error);
      alert(error);
      setIsCreating(false);
    };

    socket.once('room_created', handleRoomCreated);
    socket.once('error', handleError);

    // Cleanup listeners after 5 seconds
    setTimeout(() => {
      socket.off('room_created', handleRoomCreated);
      socket.off('error', handleError);
    }, 5000);

    // Blur active input to prevent zoom on mobile
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleJoinRoomTable = (roomId: string) => {
    const trimmedName = playerName.trim();
    if (!trimmedName) {
      alert(t('errors.nameRequired'));
      return;
    }

    // Save to localStorage
    localStorage.setItem('playerName', trimmedName);

    if (!socket) {
      alert(t('errors.connectionError'));
      return;
    }

    socket.emit('join_room', roomId, trimmedName);

    const handleRoomUpdated = (room: any) => {
      console.debug('Joined room, navigating to:', room.id);
      router.push(`/${locale}/game/${room.id}`);
    };

    const handleError = (error: string) => {
      console.debug('Join room error:', error);
      alert(error);
    };

    socket.once('room_updated', handleRoomUpdated);
    socket.once('error', handleError);

    // Cleanup listeners after 5 seconds
    setTimeout(() => {
      socket.off('room_updated', handleRoomUpdated);
      socket.off('error', handleError);
    }, 5000);

    // Blur active input to prevent zoom on mobile
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleSpectateRoomTable = (roomId: string) => {
    router.push(`/${locale}/game/${roomId}/spectate`);
  };

  return (
    <div className="card p-4 shadow position-relative">
      <div className="d-flex justify-content-end gap-2 position-absolute top-0 end-0 m-2">
        <LocaleSelector />
        <button className="btn btn-sm btn-outline-secondary" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? '🌞' : '🌙'}
        </button>
      </div>
      <div className="text-center mb-4">
        <h1 className="display-4 fw-bold text-primary mb-2">
          Guess<span className="text-info">X</span>
        </h1>
        <p className="text-muted mb-3 small">
          {t('subtitle')}
        </p>
        <div className="d-flex justify-content-center align-items-center gap-2 mb-3">
          <span className={`badge ${socket?.connected ? 'bg-success' : 'bg-danger'}`}>●</span>
          <span className="small text-muted">
            {socket?.connected ? t('connectionStatus.connected') : t('connectionStatus.connecting')}
          </span>
        </div>
      </div>
      {/* Create Room */}
      <div className="mb-4">
        <h2 className="h5 fw-semibold mb-4">{t('createGame.heading')}</h2>

        <div className="mb-3">
          <label className="form-label fw-medium small">{t('createGame.nameLabel')}</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="form-control form-control-lg"
            placeholder={t('createGame.namePlaceholder')}
          />
        </div>

        <div className="mb-3">
          <label className="form-label fw-medium small">{t('createGame.numberLengthLabel')}</label>
          <select
            value={numberLength}
            onChange={(e) => setNumberLength(parseInt(e.target.value))}
            className="form-select form-select-lg"
          >
            <option value={4}>{t('createGame.numberLengthOptions.4')}</option>
            <option value={5}>{t('createGame.numberLengthOptions.5')}</option>
            <option value={6}>{t('createGame.numberLengthOptions.6')}</option>
          </select>
        </div>

        <div className="mb-3">
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="singlePlayerModeToggle"
              checked={isSinglePlayer}
              onChange={(e) => setIsSinglePlayer(e.target.checked)}
            />
            <label className="form-check-label fw-medium small" htmlFor="singlePlayerModeToggle">
              {t('createGame.singlePlayerMode.label')}
            </label>
          </div>
          <div className="form-text small text-muted">
            {t('createGame.singlePlayerMode.description')}
          </div>
        </div>

        {isSinglePlayer && (
          <div className="mb-3">
            <label className="form-label fw-medium small">{t('createGame.botDifficultyLabel')}</label>
            <select
              value={botDifficulty}
              onChange={(e) => setBotDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
              className="form-select form-select-lg"
            >
              <option value="easy">{t('createGame.botDifficultyOptions.easy')}</option>
              <option value="medium">{t('createGame.botDifficultyOptions.medium')}</option>
              <option value="hard">{t('createGame.botDifficultyOptions.hard')}</option>
            </select>
          </div>
        )}

        {!isSinglePlayer && (
          <div className="mb-3">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="spectatorModeToggle"
                checked={spectatorModeEnabled}
                onChange={(e) => setSpectatorModeEnabled(e.target.checked)}
              />
              <label className="form-check-label fw-medium small" htmlFor="spectatorModeToggle">
                {t('createGame.spectatorMode.label')}
              </label>
            </div>
            <div className="form-text small text-muted">
              {t('createGame.spectatorMode.description')}
            </div>
          </div>
        )}

        <button
          onClick={handleCreateRoom}
          disabled={isCreating || !socket?.connected}
          className="btn btn-primary btn-lg w-100 mb-4"
        >
          {!socket?.connected ? t('createGame.buttons.connecting') :
            isCreating ? t('createGame.buttons.creating') : t('createGame.buttons.create')}
        </button>
      </div>

      {/* Join Room */}
      <div className="mb-4">
        <h2 className="h5 fw-semibold mb-4">{t('joinGame.heading')}</h2>

        {rooms.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-striped table-dark">
              <thead>
                <tr>
                  <th>{t('joinGame.table.roomId')}</th>
                  <th>{t('joinGame.table.player1')}</th>
                  <th>{t('joinGame.table.player2')}</th>
                  <th>{t('joinGame.table.action')}</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map(room => {
                  const p1 = room.players[0];
                  const p2 = room.players[1];
                  const bothPlayersActive = p1?.isConnected && p2?.isConnected;
                  const currentPlayerName = playerName.trim();

                  // Determine if player can join as a player
                  const canRejoinAsPlayer1 = currentPlayerName === p1?.name;
                  const canRejoinAsPlayer2 = currentPlayerName === p2?.name;
                  const canJoinAsPlayer = bothPlayersActive && room.players.length < 2;

                  // Check if user is one of the registered players for this room
                  const isRegisteredPlayer = canRejoinAsPlayer1 || canRejoinAsPlayer2;

                  // Check if there are actually two players registered in the room
                  const hasTwoPlayers = room.players.length >= 2;

                  // Check if there's an active game happening (at least one connected player)
                  const hasActiveGame = p1?.isConnected || p2?.isConnected;

                  // Show spectate if:
                  // - Room has 2 registered players AND spectator mode enabled AND has active game AND user is NOT a registered player
                  const shouldShowSpectate = room.spectatorModeEnabled &&
                    hasTwoPlayers &&
                    hasActiveGame &&
                    !isRegisteredPlayer;

                  return (
                    <tr key={room.id}>
                      <td>{room.id}</td>
                      <td>{p1?.name} {p1?.isConnected ? '' : t('joinGame.statuses.disconnected')}</td>
                      <td>{p2?.name} {p2?.isConnected ? '' : t('joinGame.statuses.disconnected')}</td>
                      <td>
                        {shouldShowSpectate ? (
                          <button className="btn btn-info btn-sm" onClick={() => handleSpectateRoomTable(room.id)}>
                            {t('joinGame.statuses.spectate')}
                          </button>
                        ) : (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleJoinRoomTable(room.id)}>
                            {t('joinGame.statuses.join')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">{t('joinGame.noRooms')}</p>
        )}
      </div>

      {/* Connection Status */}
      <div className="alert alert-secondary small">
        <span className="me-2">
          <span className={`badge ${socket?.connected ? 'bg-success' : 'bg-danger'}`}>●</span>
        </span>
        {socket?.connected ? `${t('connectionStatus.connected')} (${socket.id})` : t('connectionStatus.disconnected')}
      </div>
    </div>
  );
}
