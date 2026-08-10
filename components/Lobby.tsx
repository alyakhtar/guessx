'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { socketService } from '../lib/socket';
import { GameRoom } from '../types/game';
import LocaleSelector from './LocaleSelector';

export default function Lobby() {
  const t = useTranslations('lobby');
  const locale = useLocale();

  const [playerName, setPlayerName] = useState('');
  const [numberLength, setNumberLength] = useState(4);
  const [spectatorModeEnabled, setSpectatorModeEnabled] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSinglePlayer, setIsSinglePlayer] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [socket, setSocket] = useState<any>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  // Private room toggle (default off, per issue AC)
  const [isPrivate, setIsPrivate] = useState(false);
  // Private-room join modal state
  const [modalRoom, setModalRoom] = useState<string | null>(null);
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '']);
  const [joinError, setJoinError] = useState('');
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedName = localStorage.getItem('playerName');
    if (savedName) setPlayerName(savedName);
  }, []);

  useEffect(() => {
    const socketInstance = socketService.connect();
    setSocket(socketInstance);
    socketInstance.emit('get_rooms');
    socketInstance.on('room_list', (rooms: GameRoom[]) => setRooms(rooms));
    return () => {};
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const blurActive = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  const handleCreateRoom = () => {
    const trimmedName = playerName.trim();
    if (!trimmedName) { alert(t('errors.nameRequired')); return; }
    localStorage.setItem('playerName', trimmedName);
    if (!socket) { alert(t('errors.connectionError')); return; }
    setIsCreating(true);
    socket.emit('create_room', trimmedName, numberLength, spectatorModeEnabled, isSinglePlayer, botDifficulty, isPrivate);
    const handleRoomCreated = (newRoomId: string, room: any) => {
      setIsCreating(false);
      if (room && room.isPrivate && room.accessCode) {
        alert(t('createGame.privateRoomCreated', { code: room.accessCode }));
      }
      router.push(`/${locale}/game/${newRoomId}`);
    };
    const handleError = (error: string) => { alert(error); setIsCreating(false); };
    socket.once('room_created', handleRoomCreated);
    socket.once('error', handleError);
    setTimeout(() => { socket.off('room_created', handleRoomCreated); socket.off('error', handleError); }, 5000);
    blurActive();
  };

  // Public room join (table row)
  const handleJoinRoomTable = (roomId: string) => {
    const trimmedName = playerName.trim();
    if (!trimmedName) { alert(t('errors.nameRequired')); return; }
    localStorage.setItem('playerName', trimmedName);
    if (!socket) { alert(t('errors.connectionError')); return; }
    socket.emit('join_room', roomId, trimmedName);
    const handleRoomUpdated = (room: any) => router.push(`/${locale}/game/${room.id}`);
    const handleError = (error: string) => alert(error);
    socket.once('room_updated', handleRoomUpdated);
    socket.once('error', handleError);
    setTimeout(() => { socket.off('room_updated', handleRoomUpdated); socket.off('error', handleError); }, 5000);
    blurActive();
  };

  // Private room join — handled through a modal (no inline input; errors shown in-modal)
  const openCodeModal = (roomId: string) => {
    setModalRoom(roomId);
    setCodeDigits(['', '', '']);
    setJoinError('');
    setTimeout(() => codeRefs.current[0]?.focus(), 50);
  };

  const handleDigit = (idx: number, val: string) => {
    const v = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1);
    const next = [...codeDigits];
    next[idx] = v;
    setCodeDigits(next);
    if (v && idx < 2) codeRefs.current[idx + 1]?.focus();
  };

  const handleJoinByCode = () => {
    if (!modalRoom) return;
    const code = codeDigits.join('').toUpperCase();
    const trimmedName = playerName.trim();
    if (!trimmedName) { setJoinError(t('errors.nameRequired')); return; }
    if (code.length < 3) { setJoinError(t('joinGame.errors.codeRequired')); return; }
    if (!socket) { setJoinError(t('errors.connectionError')); return; }
    localStorage.setItem('playerName', trimmedName);
    socket.emit('join_room_by_code', code, trimmedName);
    const handleRoomUpdated = (room: any) => { setModalRoom(null); router.push(`/${locale}/game/${room.id}`); };
    const handleError = (error: string) => setJoinError(error);
    socket.once('room_updated', handleRoomUpdated);
    socket.once('error', handleError);
    setTimeout(() => { socket.off('room_updated', handleRoomUpdated); socket.off('error', handleError); }, 5000);
  };

  const handleSpectateRoomTable = (roomId: string) => {
    router.push(`/${locale}/game/${roomId}/spectate`);
  };

  return (
    <div ref={cardRef} className="card p-2 p-sm-4 shadow position-relative">
      <div className="d-flex justify-content-end gap-2 position-absolute top-0 end-0 m-2">
        <LocaleSelector />
        <button className="btn btn-sm btn-outline-secondary" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? '🌞' : '🌙'}
        </button>
      </div>
      <div className="text-center mb-4">
        <h1 className="display-5 display-sm-4 fw-bold text-primary mb-2">
          Guess<span className="text-info">X</span>
        </h1>
        <p className="text-muted mb-3 small">{t('subtitle')}</p>
        <div className="d-flex justify-content-center align-items-center gap-2 mb-3">
          <span className={`badge ${socket?.connected ? 'bg-success' : 'bg-danger'}`}>●</span>
          <span className="small text-muted">
            {socket?.connected ? t('connectionStatus.connected') : t('connectionStatus.connecting')}
          </span>
        </div>
      </div>

      {/* Create Room */}
      <div className="mb-4">
        <h2 className="h5 fw-semibold mb-3">{t('createGame.heading')}</h2>
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
            <input className="form-check-input" type="checkbox" role="switch" id="singlePlayerModeToggle"
              checked={isSinglePlayer} onChange={(e) => setIsSinglePlayer(e.target.checked)} />
            <label className="form-check-label fw-medium small" htmlFor="singlePlayerModeToggle">
              {t('createGame.singlePlayerMode.label')}
            </label>
          </div>
          <div className="form-text small text-muted">{t('createGame.singlePlayerMode.description')}</div>
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
              <input className="form-check-input" type="checkbox" role="switch" id="spectatorModeToggle"
                checked={spectatorModeEnabled} onChange={(e) => setSpectatorModeEnabled(e.target.checked)} />
              <label className="form-check-label fw-medium small" htmlFor="spectatorModeToggle">
                {t('createGame.spectatorMode.label')}
              </label>
            </div>
            <div className="form-text small text-muted">{t('createGame.spectatorMode.description')}</div>
          </div>
        )}
        {/* NEW: Private room toggle (default off) */}
        {!isSinglePlayer && (
          <div className="mb-3">
            <div className="form-check form-switch">
              <input className="form-check-input" type="checkbox" role="switch" id="privateRoomToggle"
                checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              <label className="form-check-label fw-medium small" htmlFor="privateRoomToggle">
                {t('createGame.privateRoom.label')}
              </label>
            </div>
            <div className="form-text small text-muted">{t('createGame.privateRoom.description')}</div>
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

      {/* Shared room list: public + private, distinguished by a Room Type badge */}
      <div className="mb-4">
        <h2 className="h5 fw-semibold mb-3">{t('joinGame.heading')}</h2>
        {rooms.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-sm table-striped table-dark align-middle">
              <thead>
                <tr>
                  <th>{t('joinGame.table.roomId')}</th>
                  <th>{t('joinGame.table.type.header')}</th>
                  <th className="d-none d-sm-table-cell">{t('joinGame.table.player1')}</th>
                  <th className="d-none d-sm-table-cell">{t('joinGame.table.player2')}</th>
                  <th>{t('joinGame.table.action')}</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map(room => {
                  const isPriv = !!room.isPrivate;
                  const p1 = room.players[0];
                  const p2 = room.players[1];
                  const bothPlayersActive = p1?.isConnected && p2?.isConnected;
                  const currentPlayerName = playerName.trim();
                  const canRejoinAsPlayer1 = currentPlayerName === p1?.name;
                  const canRejoinAsPlayer2 = currentPlayerName === p2?.name;
                  const isRegisteredPlayer = canRejoinAsPlayer1 || canRejoinAsPlayer2;
                  const hasTwoPlayers = room.players.length >= 2;
                  const hasActiveGame = p1?.isConnected || p2?.isConnected;
                  const shouldShowSpectate = room.spectatorModeEnabled &&
                    hasTwoPlayers && hasActiveGame && !isRegisteredPlayer;
                  return (
                    <tr key={room.id}>
                      <td>{room.id}</td>
                      <td>
                        {isPriv ? (
                          <span className="badge bg-warning text-dark">{t('joinGame.table.type.private')}</span>
                        ) : (
                          <span className="badge bg-secondary">{t('joinGame.table.type.public')}</span>
                        )}
                      </td>
                      <td className="d-none d-sm-table-cell">{p1?.name} {p1?.isConnected ? '' : t('joinGame.statuses.disconnected')}</td>
                      <td className="d-none d-sm-table-cell">{p2?.name} {p2?.isConnected ? '' : t('joinGame.statuses.disconnected')}</td>
                      <td>
                        {shouldShowSpectate ? (
                          <button className="btn btn-info btn-sm w-100" onClick={() => handleSpectateRoomTable(room.id)}>
                            {t('joinGame.statuses.spectate')}
                          </button>
                        ) : isPriv ? (
                          <button className="btn btn-outline-primary btn-sm w-100" onClick={() => openCodeModal(room.id)}>
                            {t('joinGame.statuses.join')}
                          </button>
                        ) : (
                          <button className="btn btn-secondary btn-sm w-100" onClick={() => handleJoinRoomTable(room.id)}>
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

      {/* Private-room access-code modal: 3-box input, errors shown in-modal (no alerts) */}
      {modalRoom && (
        <div className="modal show d-block" tabIndex={-1} style={{ background: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{t('joinGame.byCode.heading')}</h5>
                <button type="button" className="btn-close" aria-label={t('joinGame.cancel')} onClick={() => setModalRoom(null)}></button>
              </div>
              <div className="modal-body text-center">
                <p className="text-muted small">{t('joinGame.byCode.codeLabel')}</p>
                <div className="d-flex justify-content-center gap-2 mb-3">
                  {[0, 1, 2].map((i) => (
                    <input
                      key={i}
                      ref={(el) => { codeRefs.current[i] = el; }}
                      type="text"
                      inputMode="text"
                      value={codeDigits[i]}
                      onChange={(e) => handleDigit(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !codeDigits[i] && i > 0) codeRefs.current[i - 1]?.focus();
                      }}
                      maxLength={1}
                      className="form-control form-control-lg text-center text-uppercase"
                      style={{ width: '3.5rem', fontSize: '1.6rem', letterSpacing: '0.15em' }}
                    />
                  ))}
                </div>
                {joinError && <div className="alert alert-danger py-2 mb-0">{joinError}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalRoom(null)}>{t('joinGame.cancel')}</button>
                <button type="button" className="btn btn-primary" onClick={handleJoinByCode}>{t('joinGame.byCode.button')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
