'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { socketService, TurnStartedPayload } from '../lib/socket';
import { useUserSettings } from '../lib/useUserSettings';
import { shouldRevealSecret } from '../lib/userSettings';
import { GameRoom, TurnTimerSeconds } from '../types/game';
import TurnTimer from './TurnTimer';
import SettingsCog from './SettingsCog';

export default function Spectator() {
    const params = useParams();
    const router = useRouter();
    const roomId = params.routeId as string;
    const t = useTranslations('spectator');
    const settings = useUserSettings();

    const [room, setRoom] = useState<GameRoom | null>(null);
    const [error, setError] = useState<string>('');
    const [darkMode, setDarkMode] = useState(true);

    useEffect(() => {
        document.documentElement.setAttribute('data-bs-theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

    useEffect(() => {
        const socket = socketService.getSocket();
        if (!socket) {
            router.push('/');
            return;
        }

        // Socket event listeners
        const handleRoomUpdated = (updatedRoom: GameRoom) => {
            // Check if spectator mode is enabled for this room
            if (!updatedRoom.spectatorModeEnabled) {
                setError(t('access.disabled'));
                return;
            }

            setRoom(updatedRoom);
            setError('');
        };

        const handleError = (errorMessage: string) => {
            setError(errorMessage);
        };

        const handleTurnStarted = (payload: TurnStartedPayload) => {
            setRoom(currentRoom => currentRoom ? {
                ...currentRoom,
                currentTurn: payload.currentTurn,
                turnStartedAt: payload.turnStartedAt,
                turnDeadline: payload.turnDeadline,
                turnTimerSeconds: payload.turnDurationMs / 1000 as TurnTimerSeconds,
                serverNow: payload.serverNow,
            } : currentRoom);
        };

        socket.on('room_updated', handleRoomUpdated);
        socket.on('secret_number_set', handleRoomUpdated);
        socket.on('guess_made', handleRoomUpdated);
        socket.on('game_won', handleRoomUpdated);
        socket.on('player_joined', handleRoomUpdated);
        socket.on('player_left', handleRoomUpdated);
        socket.on('player_reconnected', handleRoomUpdated);
        socket.on('turn_started', handleTurnStarted);
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
            socket.off('player_reconnected', handleRoomUpdated);
            socket.off('turn_started', handleTurnStarted);
            socket.off('error', handleError);
        };
    }, [roomId, router]);

    // Check for spectator mode access
    if (error) {
        return (
            <div className="container p-4 min-vh-100 d-flex justify-content-center align-items-center">
                <div className="card p-4 shadow text-center">
                    <div className="card-body">
                        <h2 className="card-title text-danger">{t('access.denied')}</h2>
                        <p className="card-text">{error}</p>
                        <button
                            className="btn btn-primary"
                            onClick={() => router.push('/')}
                        >
                            {t('access.backHome')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Show loading only if room doesn't exist yet
    if (!room) {
        return (
            <div className="container-fluid min-vh-100 d-flex justify-content-center align-items-center">
                <div className="text-center">
                    <div className="spinner-border text-primary mb-3" role="status"></div>
                    <p className="text-muted fw-semibold">{t('loading.title')}</p>
                    <p className="text-muted small mb-2">{t('loading.roomId')}: <code className="fs-5">{roomId}</code></p>
                </div>
            </div>
        );
    }

    const p1 = room.players[0];
    const p2 = room.players[1];
    const currentPlayerName = room.players.find(p => p.id === room.currentTurn)?.name;
    const revealSecret = shouldRevealSecret(settings, room.gameStatus);

    return (
        <div className="container p-2 p-md-4 min-vh-100 d-flex flex-column align-items-center">
            <div className="w-100">
                {/* Header */}
                <div className="card p-4 mb-4 shadow position-relative">
                    <div className="d-flex gap-2 position-absolute top-0 end-0 m-2">
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setDarkMode(!darkMode)}>
                            {darkMode ? '🌞' : '🌙'}
                        </button>
                        <SettingsCog />
                    </div>
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                        <div className="text-center text-md-start">
                            <div
                                className="h2 fw-bold text-primary mb-2"
                                style={{ cursor: 'pointer' }}
                                onClick={() => router.push('/')}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        router.push('/');
                                    }
                                }}
                            >
                                Guess<span className="text-info">X</span>
                            </div>
                            <div className="d-flex flex-column gap-2">
                                <p className="text-muted small mb-0">{t('header.room')}: {roomId}</p>
                                <span className="badge text-bg-info fs-6">{t('header.mode')}</span>
                            </div>
                        </div>

                        <div className="d-flex flex-wrap gap-2 justify-content-center w-100 w-md-auto">
                            <span className="badge text-bg-secondary fs-6">
                                {t('header.digits')}: {room.numberLength}
                            </span>

                            {(room.turnTimerSeconds ?? 0) > 0 && (
                                <span className="badge text-bg-warning fs-6">
                                    {t('header.timer')}: {room.turnTimerSeconds}s
                                </span>
                            )}

                            {room.gameStatus === 'playing' && currentPlayerName && (
                                <span className="badge text-bg-warning fs-6">
                                    {t('header.turn', { name: currentPlayerName })}
                                </span>
                            )}

                            {room.gameStatus === 'finished' && room.winner && (
                                <span className="badge text-bg-info fs-6">
                                    {t('header.winner')}: {room.winner}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {room.gameStatus === 'playing' && (
                    <TurnTimer
                        currentTurn={room.currentTurn}
                        durationMs={(room.turnTimerSeconds ?? 0) * 1000}
                        serverNow={room.serverNow}
                        turnDeadline={room.turnDeadline}
                    />
                )}

                {/* Player Boxes */}
                <div className="row g-3 mb-4">
                    {/* Player 1 Box */}
                    <div className="col-12 col-md-6">
                        <div className="card shadow h-100">
                            <div className="card-header text-center">
                                <h3 className="card-title h5 mb-0">
                                    {p1?.name} {p1?.isConnected ? '' : t('player.status.disconnected')}
                                </h3>
                                {!p1?.isReady && room.gameStatus !== 'waiting' && (
                                    <span className="badge text-bg-warning mt-1">{t('player.status.settingUp')}</span>
                                )}
                            </div>
                            <div className="card-body">
                                {/* Secret Number Boxes */}
                                <div className="mb-3">
                                    <div className="d-flex justify-content-center gap-2 mb-3">
                                        {Array.from({ length: room.numberLength }, (_, i) => {
                                            // Show correctly guessed digits
                                            const playerGuessesFromOpponent = room.gameHistory
                                                .filter(g => g.playerName !== p1?.name)
                                                .map(g => g.guess);

                                            const guessedDigits = new Set();
                                            playerGuessesFromOpponent.forEach(guess => {
                                                for (let j = 0; j < room.numberLength; j++) {
                                                    if (p1?.secretNumber && guess[j] === p1.secretNumber[j]) {
                                                        guessedDigits.add(j);
                                                    }
                                                }
                                            });

                                            const isGuessed = guessedDigits.has(i);
                                            const digit = p1?.secretNumber ? p1.secretNumber[i] : '';

                                            return (
                                                <div
                                                    key={i}
                                                    className="border border-secondary rounded d-flex align-items-center justify-content-center"
                                                    style={{ width: '40px', height: '40px', fontSize: '1.2rem', fontWeight: 'bold' }}
                                                >
                                                    {isGuessed || revealSecret ? digit : ''}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="text-center small text-muted">{t('player.secretNumber')}</div>
                                </div>

                                {/* Player's History */}
                                <div className="card">
                                    <div className="card-header">
                                        <h4 className="card-title h6 mb-0">{t('player.guesses')}</h4>
                                    </div>
                                    <div className="card-body p-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                        {room.gameHistory.filter(g => g.playerName === p1?.name).length === 0 ? (
                                            <p className="text-muted small text-center mb-0">{t('player.noGuesses')}</p>
                                        ) : (
                                            room.gameHistory
                                                .filter(g => g.playerName === p1?.name)
                                                .map((guess, index) => (
                                                    <div key={index} className="d-flex justify-content-between align-items-center small mb-1">
                                                        <span className="font-monospace">{guess.guess}</span>
                                                        <span className="badge bg-primary">{guess.correctPositions} {t('player.correct')}</span>
                                                    </div>
                                                ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Player 2 Box */}
                    <div className="col-12 col-md-6">
                        <div className="card shadow h-100">
                            <div className="card-header text-center">
                                <h3 className="card-title h5 mb-0">
                                    {p2?.name} {p2?.isConnected ? '' : t('player.status.disconnected')}
                                </h3>
                                {!p2?.isReady && room.gameStatus !== 'waiting' && (
                                    <span className="badge text-bg-warning mt-1">{t('player.status.settingUp')}</span>
                                )}
                            </div>
                            <div className="card-body">
                                {/* Secret Number Boxes */}
                                <div className="mb-3">
                                    <div className="d-flex justify-content-center gap-2 mb-3">
                                        {Array.from({ length: room.numberLength }, (_, i) => {
                                            // Show correctly guessed digits
                                            const playerGuessesFromOpponent = room.gameHistory
                                                .filter(g => g.playerName !== p2?.name)
                                                .map(g => g.guess);

                                            const guessedDigits = new Set();
                                            playerGuessesFromOpponent.forEach(guess => {
                                                for (let j = 0; j < room.numberLength; j++) {
                                                    if (p2?.secretNumber && guess[j] === p2.secretNumber[j]) {
                                                        guessedDigits.add(j);
                                                    }
                                                }
                                            });

                                            const isGuessed = guessedDigits.has(i);
                                            const digit = p2?.secretNumber ? p2.secretNumber[i] : '';

                                            return (
                                                <div
                                                    key={i}
                                                    className="border border-secondary rounded d-flex align-items-center justify-content-center"
                                                    style={{ width: '40px', height: '40px', fontSize: '1.2rem', fontWeight: 'bold' }}
                                                >
                                                    {isGuessed || revealSecret ? digit : ''}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="text-center small text-muted">{t('player.secretNumber')}</div>
                                </div>

                                {/* Player's History */}
                                <div className="card">
                                    <div className="card-header">
                                        <h4 className="card-title h6 mb-0">{t('player.guesses')}</h4>
                                    </div>
                                    <div className="card-body p-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                        {room.gameHistory.filter(g => g.playerName === p2?.name).length === 0 ? (
                                            <p className="text-muted small text-center mb-0">{t('player.noGuesses')}</p>
                                        ) : (
                                            room.gameHistory
                                                .filter(g => g.playerName === p2?.name)
                                                .map((guess, index) => (
                                                    <div key={index} className="d-flex justify-content-between align-items-center small mb-1">
                                                        <span className="font-monospace">{guess.guess}</span>
                                                        <span className="badge bg-primary">{guess.correctPositions} {t('player.correct')}</span>
                                                    </div>
                                                ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


            </div>
        </div>
    );
}
