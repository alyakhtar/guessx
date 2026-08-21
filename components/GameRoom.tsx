'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { socketService } from '../lib/socket';
import { GameRoom as GameRoomType } from '../types/game';
import PlayerList from './PlayerList';
import GuessInput from './GuessInput';
import GameHistory from './GameHistory';
import Celebration from './Celebration';

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
  const locale = useLocale();
  const roomId = params.routeId as string;
  const t = useTranslations('gameRoom');

  const [room, setRoom] = useState<GameRoomType | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [darkMode, setDarkMode] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [rematchStatus, setRematchStatus] = useState<RematchStatus>('idle');
  const [rematchInfo, setRematchInfo] = useState<RematchInfo | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) {
      // Redirect to home if no socket connection
      router.push('/');
      return;
    }

    // Set current player ID
    setCurrentPlayerId(socket.id);

    // Socket event listeners
    const handleRoomUpdated = (updatedRoom: GameRoomType) => {
      setRoom(updatedRoom);
      setError('');

      // Show celebration when game ends
      if (updatedRoom.gameStatus === 'finished') {
        setShowCelebration(true);
      }
    };

    const handleError = (errorMessage: string) => {
      setError(errorMessage);
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

    socket.on('room_updated', handleRoomUpdated);
    socket.on('secret_number_set', handleRoomUpdated);
    socket.on('guess_made', handleRoomUpdated);
    socket.on('game_won', handleRoomUpdated);
    socket.on('player_joined', handleRoomUpdated);
    socket.on('player_left', handleRoomUpdated);
    socket.on('player_reconnected', handleRoomUpdated);
    socket.on('error', handleError);
    socket.on('rematch_offer', handleRematchOffer);
    socket.on('rematch_offer_sent', handleRematchOfferSent);
    socket.on('rematch_declined', handleRematchDeclined);
    socket.on('rematch_room_ready', handleRematchReady);

    // Request current room state
    socket.emit('get_room_state', roomId);

    // Cleanup
    return () => {
      socket.off('room_updated', handleRoomUpdated);
      socket.off('secret_number_set', handleRoomUpdated);
      socket.off('guess_made', handleRoomUpdated);
      socket.off('game_won', handleRoomUpdated);
      socket.off('player_joined', handleRoomUpdated);
      socket.off('player_left', handleRoomUpdated);
      socket.off('player_reconnected', handleRoomUpdated);
      socket.off('error', handleError);
      socket.off('rematch_offer', handleRematchOffer);
      socket.off('rematch_offer_sent', handleRematchOfferSent);
      socket.off('rematch_declined', handleRematchDeclined);
      socket.off('rematch_room_ready', handleRematchReady);
    };
  }, [roomId, locale, router]);

  const currentPlayer = room?.players.find(p => p.id === currentPlayerId);
  const isMyTurn = room?.currentTurn === currentPlayerId;
  const opponent = room?.players.find(p => p.id !== currentPlayerId);

  // Show loading only if room doesn't exist yet
  if (!room) {
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

  // Determine celebration type
  const celebrationType = room?.gameStatus === 'finished' && room?.winner && currentPlayer?.name
    ? (room.winner === currentPlayer.name ? 'win' : 'lose')
    : null;

  const handleNewGame = () => {
    setShowCelebration(false); // Hide celebration before starting new game
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
        {/* Header */}
        <div className="card p-4 mb-4 shadow position-relative">
          <button className="btn btn-sm btn-outline-secondary position-absolute top-0 end-0 m-2" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? '🌞' : '🌙'}
          </button>
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
            <div className="text-center text-md-start">
              <h1 className="h2 fw-bold text-primary">
                Guess<span className="text-info">X</span>
              </h1>
              <p className="text-muted small">{t('header.room')}: {roomId}</p>
            </div>

            <div className="d-flex flex-wrap gap-2 justify-content-center w-100 w-md-auto">
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

        {error && (
          <div className="alert alert-danger mb-4">{error}</div>
        )}

        <div className="row row-cols-1 row-cols-lg-3 g-3">
          {/* Left Column - Players */}
          <div className="col">
            <PlayerList
              room={room}
              currentPlayerId={currentPlayerId}
            />
          </div>

          {/* Middle Column - Game Input/Status */}
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

          {/* Right Column - Game History */}
          <div className="col">
            <GameHistory
              gameHistory={room.gameHistory}
              currentPlayerName={currentPlayer?.name}
            />
          </div>
        </div>
      </div>

      {/* Celebration Animation */}
      {celebrationType && showCelebration && (
        <Celebration type={celebrationType} show={showCelebration} />
      )}
    </div>
  );
}
