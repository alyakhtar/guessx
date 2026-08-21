'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { openRoomAccess, RoomAccessState } from '../lib/openRoomAccess';
import { socketService, TurnStartedPayload } from '../lib/socket';
import { useUserSettings } from '../lib/useUserSettings';
import { GameRoom as GameRoomType, TurnTimerSeconds } from '../types/game';
import Celebration from './Celebration';
import GameHistory from './GameHistory';
import GuessInput from './GuessInput';
import PlayerList from './PlayerList';
import ShareRoomButton from './ShareRoomButton';
import TurnTimer from './TurnTimer';
import SettingsCog from './SettingsCog';

type FlowState = { roomId: string; access: RoomAccessState };

// Rematch UI state machine (issue #4).
//   idle     -> show "Rematch" button
//   sent     -> I requested; waiting for opponent to accept/decline
//   incoming -> opponent requested; I see Accept/Decline
//   ready    -> new room created; navigate (or show code if solo)
type RematchStatus = 'idle' | 'sent' | 'incoming' | 'declined' | 'ready';
interface RematchInfo { roomId: string; accessCode?: string; solo?: boolean }

export default function GameRoom() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const roomId = params.routeId as string;
  const initialCode = searchParams.get('code') ?? undefined;
  const hasValidInitialCode = /^[A-Z0-9]{3}$/i.test(initialCode?.trim() ?? '');
  const t = useTranslations('gameRoom');
  const tLobby = useTranslations('lobby');
  const settings = useUserSettings();

  const [flow, setFlow] = useState<FlowState | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [codeEntry, setCodeEntry] = useState<{ roomId: string; digits: string[] }>({ roomId, digits: ['', '', ''] });
  const [manualCodeRoomId, setManualCodeRoomId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<{ roomId: string; message: string } | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [rematchStatus, setRematchStatus] = useState<RematchStatus>('idle');
  const [rematchInfo, setRematchInfo] = useState<RematchInfo | null>(null);
  const controllerRef = useRef<ReturnType<typeof openRoomAccess> | null>(null);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  const translateServerError = (error: string) => {
    if (error === 'SERVER_ERROR:duplicateName') return tLobby('errors.server.duplicateName');
    if (error === 'SERVER_ERROR:invalidCode') return tLobby('errors.server.invalidCode');
    if (error === 'SERVER_ERROR:roomFull') return tLobby('errors.server.roomFull');
    return error;
  };

  useEffect(() => {
    const savedName = localStorage.getItem('playerName');
    // Intentional: restore the persisted name once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedName) setPlayerName(savedName);
  }, []);

  useEffect(() => {
    const socket = socketService.connect();
    if (!socket) return;

    const handleGameplayUpdate = (updatedRoom: GameRoomType) => {
      if (updatedRoom.id !== roomId) return;
      setFlow((current) => current?.roomId === roomId && current.access.status === 'member'
        ? { roomId, access: { status: 'member', room: updatedRoom } }
        : current);
      if (updatedRoom.gameStatus === 'finished') setShowCelebration(true);
    };

    // Rematch flow (issue #4)
    const handleRematchOffer = () => setRematchStatus('incoming');
    const handleRematchOfferSent = () => setRematchStatus('sent');
    const handleRematchDeclined = () => setRematchStatus('declined');
    const handleRematchReady = (info: RematchInfo) => {
      if (info.solo) {
        // Only I am connected — show the new room id / code so the other
        // player can rejoin from the list or by code.
        setRematchInfo(info);
        setRematchStatus('ready');
      } else {
        // Both connected — auto-invited: navigate to the fresh room.
        router.push(`/${locale}/game/${info.roomId}`);
      }
    };

    const handleTurnStarted = (payload: TurnStartedPayload) => {
      setFlow((current) => current?.roomId === roomId && current.access.status === 'member'
        ? {
            roomId,
            access: {
              status: 'member',
              room: {
                ...current.access.room,
                currentTurn: payload.currentTurn,
                turnStartedAt: payload.turnStartedAt,
                turnDeadline: payload.turnDeadline,
                turnTimerSeconds: payload.turnDurationMs / 1000 as TurnTimerSeconds,
                serverNow: payload.serverNow,
              },
            },
          }
        : current);
    };

    const controller = openRoomAccess(socket, roomId, initialCode, {
      onState: (access) => {
        setFlow({ roomId, access });
        if (access.status === 'member') {
          setCurrentPlayerId(socket.id ?? '');
          setJoinError(null);
          if (access.room.gameStatus === 'finished') setShowCelebration(true);
        }
      },
      onError: (error) => {
        if (error === 'SERVER_ERROR:invalidCode') setManualCodeRoomId(roomId);
        setJoinError({ roomId, message: error });
      },
    });
    controllerRef.current = controller;

    socket.on('secret_number_set', handleGameplayUpdate);
    socket.on('guess_made', handleGameplayUpdate);
    socket.on('game_won', handleGameplayUpdate);
    socket.on('player_left', handleGameplayUpdate);
    socket.on('turn_started', handleTurnStarted);
    socket.on('rematch_offer', handleRematchOffer);
    socket.on('rematch_offer_sent', handleRematchOfferSent);
    socket.on('rematch_declined', handleRematchDeclined);
    socket.on('rematch_room_ready', handleRematchReady);

    return () => {
      controller.destroy();
      if (controllerRef.current === controller) controllerRef.current = null;
      socket.off('secret_number_set', handleGameplayUpdate);
      socket.off('guess_made', handleGameplayUpdate);
      socket.off('game_won', handleGameplayUpdate);
      socket.off('player_left', handleGameplayUpdate);
      socket.off('turn_started', handleTurnStarted);
      socket.off('rematch_offer', handleRematchOffer);
      socket.off('rematch_offer_sent', handleRematchOfferSent);
      socket.off('rematch_declined', handleRematchDeclined);
      socket.off('rematch_room_ready', handleRematchReady);
    };
  }, [initialCode, roomId, locale, router]);

  const access = flow?.roomId === roomId ? flow.access : null;
  const digits = codeEntry.roomId === roomId ? codeEntry.digits : ['', '', ''];
  const error = joinError?.roomId === roomId ? translateServerError(joinError.message) : '';
  const showCodeEntry = access?.status === 'visitor-private' && (!hasValidInitialCode || manualCodeRoomId === roomId);

  const handleDigit = (index: number, value: string) => {
    const digit = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1);
    const next = [...digits];
    next[index] = digit;
    setCodeEntry({ roomId, digits: next });
    if (digit && index < 2) codeRefs.current[index + 1]?.focus();
  };

  const handleJoin = () => {
    const name = playerName.trim();
    if (!name) {
      setJoinError({ roomId, message: tLobby('errors.nameRequired') });
      return;
    }

    const code = digits.join('');
    if (showCodeEntry && code.length !== 3) {
      setJoinError({ roomId, message: tLobby('joinGame.errors.codeRequired') });
      return;
    }

    localStorage.setItem('playerName', name);
    setPlayerName(name);
    setJoinError(null);
    controllerRef.current?.join(name, showCodeEntry ? code : undefined);
  };

  if (!access) {
    return (
      <div className="container-fluid min-vh-100 d-flex justify-content-center align-items-center">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status"></div>
          <p className="text-muted fw-semibold">{t('loading.title')}</p>
          <p className="text-muted small mb-2">{t('loading.roomId')}: <code className="fs-5">{roomId}</code></p>
          <p className="text-muted small">{t('loading.shareMessage')}</p>
        </div>
      </div>
    );
  }

  if (access.status === 'not-found') {
    return (
      <div className="container-fluid min-vh-100 d-flex justify-content-center align-items-center">
        <div className="card p-4 shadow text-center">
          <h1 className="h3 mb-4">{t('notFound.title')}</h1>
          <button type="button" className="btn btn-primary" onClick={() => router.push(`/${locale}`)}>
            {t('notFound.backToLobby')}
          </button>
        </div>
      </div>
    );
  }

  if (access.status !== 'member') {
    return (
      <div className="container-fluid min-vh-100 d-flex justify-content-center align-items-center">
        <div className="card p-4 shadow w-100" style={{ maxWidth: '30rem' }}>
          <h1 className="h3 mb-4">{t('join.heading')}</h1>
          <form onSubmit={(event) => { event.preventDefault(); handleJoin(); }}>
            <div className="mb-3">
              <label className="form-label" htmlFor="join-room-name">{t('join.nameLabel')}</label>
              <input
                id="join-room-name"
                type="text"
                className="form-control form-control-lg"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder={t('join.namePlaceholder')}
                autoComplete="name"
              />
            </div>

            {showCodeEntry && (
              <fieldset className="mb-3">
                <legend className="form-label fs-6">{t('join.codeLabel')}</legend>
                <div className="d-flex justify-content-center gap-2">
                  {[0, 1, 2].map((index) => (
                    <input
                      key={index}
                      ref={(element) => { codeRefs.current[index] = element; }}
                      type="text"
                      inputMode="text"
                      aria-label={`${t('join.codeLabel')} ${index + 1}`}
                      value={digits[index]}
                      onChange={(event) => handleDigit(index, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Backspace' && !digits[index] && index > 0) codeRefs.current[index - 1]?.focus();
                      }}
                      maxLength={1}
                      className="form-control form-control-lg text-center text-uppercase"
                      style={{ width: '3.5rem', fontSize: '1.6rem', letterSpacing: '0.15em' }}
                    />
                  ))}
                </div>
              </fieldset>
            )}

            {error && <div className="alert alert-danger py-2" role="alert" aria-live="assertive">{error}</div>}
            <button type="submit" className="btn btn-primary btn-lg w-100">{t('join.button')}</button>
          </form>
        </div>
      </div>
    );
  }

  const room = access.room;
  const currentPlayer = room.players.find((player) => player.id === currentPlayerId);
  const isMyTurn = room.currentTurn === currentPlayerId;
  const opponent = room.players.find((player) => player.id !== currentPlayerId);
  const celebrationType = room.gameStatus === 'finished' && room.winner && currentPlayer?.name
    ? (room.winner === currentPlayer.name ? 'win' : 'lose')
    : null;

  const handleNewGame = () => {
    setShowCelebration(false);
    socketService.disconnect();
    router.push('/');
  };

  const handleRematchRequest = () => {
    socketService.getSocket()?.emit('rematch_request', roomId);
  };
  const handleRematchAccept = () => {
    socketService.getSocket()?.emit('rematch_accept', roomId);
  };
  const handleRematchDecline = () => {
    socketService.getSocket()?.emit('rematch_decline', roomId);
    setRematchStatus('idle'); // I declined the offer — return to idle
  };

  return (
    <div className="container p-2 p-md-4 min-vh-100 d-flex flex-column align-items-center">
      <div className="w-100">
        <div className="card p-4 mb-4 shadow position-relative">
          <div className="d-flex gap-2 position-absolute top-0 end-0 m-2">
            <SettingsCog />
          </div>
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
            <div className="text-center text-md-start">
              <h1 className="h2 fw-bold text-primary">
                Guess<span className="text-info">X</span>
              </h1>
              <p className="text-muted small mb-2">{t('header.room')}: {roomId}</p>
              {room.isPrivate && room.accessCode && (
                <div className="fs-5 fw-bold">
                  {t('accessCode.label')}: <span className="badge text-bg-warning text-dark">{room.accessCode}</span>
                </div>
              )}
            </div>

            <div className="d-flex flex-wrap gap-2 justify-content-center align-items-center w-100 w-md-auto">
              <ShareRoomButton roomId={roomId} accessCode={room.isPrivate ? room.accessCode : undefined} />
              <span className="badge text-bg-secondary fs-6">
                {t('header.digits')}: {room.numberLength}
              </span>

              {room.isPrivate && room.accessCode && (
                <span className="badge text-bg-info fs-6">
                  {t('header.code')}: {room.accessCode}
                </span>
              )}

              {room.gameStatus === 'playing' && (
                <span className={`badge fs-6 ${isMyTurn ? 'text-bg-success' : 'text-bg-warning'}`}>
                  {isMyTurn ? t('status.yourTurn') : t('status.playerTurn', { name: opponent?.name })}
                </span>
              )}

              {room.gameStatus === 'finished' && room.winner && (
                <span className="badge text-bg-info fs-6">
                  {t('status.winner')}: {room.winner}
                </span>
              )}
            </div>
          </div>
        </div>

        {error && <div className="alert alert-danger mb-4">{error}</div>}

        {room.gameStatus === 'playing' && (
          <TurnTimer
            currentTurn={room.currentTurn}
            durationMs={(room.turnTimerSeconds ?? 0) * 1000}
            prominent={isMyTurn}
            serverNow={room.serverNow}
            turnDeadline={room.turnDeadline}
          />
        )}

        <div className={settings.sideBySideBoard && opponent ? 'row row-cols-1 row-cols-md-2 g-3' : 'row row-cols-1 row-cols-lg-3 g-3'}>
          <div className="col">
            <PlayerList room={room} currentPlayerId={currentPlayerId} />
          </div>
          <div className="col">
            <div className="card p-4 shadow h-100">
              <GuessInput
                room={room}
                currentPlayer={currentPlayer}
                isMyTurn={isMyTurn}
                numberLength={room.numberLength}
                onNewGame={handleNewGame}
              />
              {room.gameStatus === 'finished' && (
                <div className="mt-3" aria-live="polite">
                  {rematchStatus === 'idle' && (
                    <button className="btn btn-primary btn-lg w-100" onClick={handleRematchRequest}>
                      {t('rematch.button')}
                    </button>
                  )}
                  {rematchStatus === 'sent' && (
                    <div className="alert alert-info mb-0">{t('rematch.waiting')}</div>
                  )}
                  {rematchStatus === 'declined' && (
                    <div>
                      <div className="alert alert-warning mb-2">{t('rematch.declined')}</div>
                      <button className="btn btn-primary btn-lg w-100" onClick={() => setRematchStatus('idle')}>
                        {t('rematch.button')}
                      </button>
                    </div>
                  )}
                  {rematchStatus === 'incoming' && (
                    <div>
                      <p className="mb-2">{t('rematch.incoming')}</p>
                      <div className="d-flex gap-2">
                        <button className="btn btn-success btn-lg flex-fill" onClick={handleRematchAccept}>
                          {t('rematch.accept')}
                        </button>
                        <button className="btn btn-secondary btn-lg flex-fill" onClick={handleRematchDecline}>
                          {t('rematch.decline')}
                        </button>
                      </div>
                    </div>
                  )}
                  {rematchStatus === 'ready' && rematchInfo?.solo && (
                    <div className="alert alert-info mb-0">
                      <p className="mb-1">{t('rematch.soloHint')}</p>
                      {rematchInfo.accessCode ? (
                        <p className="mb-0">{t('rematch.soloCode')}: <code className="fs-5">{rematchInfo.accessCode}</code></p>
                      ) : (
                        <p className="mb-0">{t('rematch.soloRoom')}: <code className="fs-5">{rematchInfo.roomId}</code></p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="col">
            <GameHistory gameHistory={room.gameHistory} currentPlayerName={currentPlayer?.name} />
          </div>

          {settings.sideBySideBoard && opponent && (
            <div className="col">
              <GameHistory
                gameHistory={room.gameHistory}
                currentPlayerName={opponent.name}
                title={t('opponentHistoryTitle', { name: opponent.name })}
              />
            </div>
          )}
        </div>
      </div>

      {celebrationType && showCelebration && <Celebration type={celebrationType} show={showCelebration} />}
    </div>
  );
}
