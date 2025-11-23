'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { socketService } from '../lib/socket';
import { GameRoom as GameRoomType, Player } from '../types/game';
import PlayerList from './PlayerList';
import GuessInput from './GuessInput';
import GameHistory from './GameHistory';

export default function GameRoom() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.routeId as string;

  const [room, setRoom] = useState<GameRoomType | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [darkMode, setDarkMode] = useState(true);

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
    };

    const handleError = (errorMessage: string) => {
      setError(errorMessage);
    };

    socket.on('room_updated', handleRoomUpdated);
    socket.on('secret_number_set', handleRoomUpdated);
    socket.on('guess_made', handleRoomUpdated);
    socket.on('game_won', handleRoomUpdated);
    socket.on('player_joined', handleRoomUpdated);
    socket.on('player_left', handleRoomUpdated);
    socket.on('player_reconnected', handleRoomUpdated);
    socket.on('error', handleError);

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
      socket.off('error', handleError);
    };
  }, [roomId, router]);

  const currentPlayer = room?.players.find(p => p.id === currentPlayerId);
  const isMyTurn = room?.currentTurn === currentPlayerId;
  const opponent = room?.players.find(p => p.id !== currentPlayerId);

  // Show loading only if room doesn't exist yet
  if (!room) {
    return (
      <div className="container-fluid min-vh-100 d-flex justify-content-center align-items-center">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status"></div>
          <p className="text-muted fw-semibold">Loading game room...</p>
          <p className="text-muted small mb-2">Room ID: <code className="fs-5">{roomId}</code></p>
          <p className="text-muted small">Share this ID with your friend!</p>
        </div>
      </div>
    );
  }

  const handleNewGame = () => {
    socketService.disconnect();
    router.push('/');
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
              <p className="text-muted small">Room: {roomId}</p>
            </div>

            <div className="d-flex flex-wrap gap-2 justify-content-center w-100 w-md-auto">
              <span className="badge text-bg-secondary fs-6">
                Digits: {room.numberLength}
              </span>

              {room.gameStatus === 'playing' && (
                <span className={`badge fs-6 ${isMyTurn ? 'text-bg-success' : 'text-bg-warning'}`}>
                  {isMyTurn ? 'Your Turn!' : `${opponent?.name}'s Turn`}
                </span>
              )}

              {room.gameStatus === 'finished' && room.winner && (
                <span className="badge text-bg-info fs-6">
                  Winner: {room.winner}
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
    </div>
  );
}
