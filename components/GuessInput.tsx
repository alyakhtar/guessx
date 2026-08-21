'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { socketService } from '../lib/socket';
import { GameRoom, Player } from '../types/game';
import { validateNumber } from '../lib/gameLogic';

interface GuessInputProps {
  room: GameRoom;
  currentPlayer: Player | undefined;
  isMyTurn: boolean;
  numberLength: number;
  onNewGame: () => void;
}

export default function GuessInput({ room, currentPlayer, isMyTurn, numberLength, onNewGame }: GuessInputProps) {
  const t = useTranslations('guessInput');
  const [secretNumber, setSecretNumber] = useState('');
  const [guess, setGuess] = useState('');
  const [isSettingSecret, setIsSettingSecret] = useState(false);

  useEffect(() => {
    // Reset secret number input if player is already ready
    if (currentPlayer?.isReady) {
      setIsSettingSecret(false);
    }
  }, [currentPlayer?.isReady]);

  const handleSetSecretNumber = () => {
    if (!validateNumber(secretNumber, numberLength)) {
      alert(t('validation.invalidNumber', { length: numberLength }));
      return;
    }

    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('set_secret_number', secretNumber);
    }
  };

  const handleMakeGuess = () => {
    if (!validateNumber(guess, numberLength)) {
      alert(t('validation.invalidNumber', { length: numberLength }));
      return;
    }

    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('make_guess', guess);
      setGuess('');
    }
  };

  // Player hasn't set secret number yet
  if (!currentPlayer?.isReady && room.gameStatus !== 'finished') {
    const minNumber = 10 ** (numberLength - 1);
    const maxNumber = 10 ** numberLength - 1;

    return (
      <div>
        <h2 className="h5 fw-semibold mb-3 text-center text-md-start">{t('secretNumber.title')}</h2>

        <div className="mb-3">
          <label className="form-label fw-medium small">
            {t('secretNumber.label', { length: numberLength })}
          </label>
          <div className="d-flex justify-content-center gap-2 mb-3">
            {Array.from({ length: numberLength }, (_, i) => (
              <input
                key={i}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]"
                maxLength={1}
                value={secretNumber[i] || ''}
                onChange={(e) => {
                  const digit = e.target.value.replace(/\D/g, '');
                  const newSecret = secretNumber.split('');
                  newSecret[i] = digit;
                  const updatedSecret = newSecret.join('');

                  // Only allow updating if it's a valid digit
                  if (digit === '' || /\d/.test(digit)) {
                    setSecretNumber(updatedSecret);

                    // Auto-focus next box
                    if (digit !== '' && i < numberLength - 1) {
                      const nextInput = e.target.nextElementSibling as HTMLInputElement;
                      if (nextInput && nextInput.tagName === 'INPUT') {
                        nextInput.focus();
                      }
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !secretNumber[i] && i > 0) {
                    // Focus previous box on backspace
                    const target = e.target as HTMLElement;
                    if (target.previousElementSibling && target.previousElementSibling.tagName === 'INPUT') {
                      (target.previousElementSibling as HTMLInputElement).focus();
                    }
                  } else if (e.key === 'Enter' && secretNumber.length === numberLength) {
                    handleSetSecretNumber();
                  }
                }}
                className="form-control form-control-lg text-center font-monospace fs-5"
                style={{ width: '60px', height: '60px' }}
                required
              />
            ))}
          </div>
          <div className="form-text text-center">
            {t('secretNumber.help')}
          </div>
        </div>

        <button
          onClick={handleSetSecretNumber}
          disabled={secretNumber.length !== numberLength}
          className="btn btn-primary btn-lg w-100"
        >
          {t('secretNumber.button')}
        </button>

        <div className="card mt-3">
          <div className="card-body">
            <h3 className="card-title h6 fw-semibold">{t('gameRules.title')}</h3>
            <ul className="list-unstyled mb-0 small">
              <li className="d-flex">
                <span className="text-info">•</span>
                <span className="ms-2">{t('gameRules.rule1', { length: numberLength, min: minNumber, max: maxNumber })}</span>
              </li>
              <li className="d-flex mt-1">
                <span className="text-info">•</span>
                <span className="ms-2">{t('gameRules.rule2')}</span>
              </li>
              <li className="d-flex mt-1">
                <span className="text-info">•</span>
                <span className="ms-2">{t('gameRules.rule3')}</span>
              </li>
              <li className="d-flex mt-1">
                <span className="text-info">•</span>
                <span className="ms-2">{t('gameRules.rule4')}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Game is finished
  if (room.gameStatus === 'finished') {
    const forfeitedPlayerName = room.players.find(player => player.id === room.forfeitedBy)?.name ?? '';
    return (
      <div className="text-center">
        <div className="card bg-success text-white mb-3">
          <div className="card-body">
            <h2 className="card-title h4 fw-bold mb-2">{t('gameOver.title')}</h2>
            <p className="card-text fs-5">
              {room.gameEndReason === 'idle_forfeit'
                ? t('gameOver.forfeitIdle', { name: forfeitedPlayerName })
                : t('gameOver.winnerText', { name: room.winner })}
            </p>
          </div>
        </div>



        <button
          onClick={onNewGame}
          className="btn btn-success btn-lg w-100"
        >
          {t('gameOver.newGameButton')}
        </button>
      </div>
    );
  }

  // Game is in progress
  return (
    <div>
      <h2 className="h5 fw-semibold mb-3 text-center text-md-start">
        {isMyTurn ? (
          <span className="badge text-bg-success fs-6">{t('turn.yourTurn')}</span>
        ) : (
          <span className="badge text-bg-warning fs-6">{t('turn.waitingFor', { name: room.players.find(p => p.id === room.currentTurn)?.name })}</span>
        )}
      </h2>

      {isMyTurn ? (
        <div className="mb-3">
          <div className="mb-3">
            <label className="form-label fw-medium small text-center text-md-start">
              {t('turn.guessLabel', { length: numberLength })}
            </label>
            <div className="d-flex justify-content-center gap-2 mb-3">
              {Array.from({ length: numberLength }, (_, i) => (
                <input
                  key={i}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]"
                  maxLength={1}
                  value={guess[i] || ''}
                  onChange={(e) => {
                    const digit = e.target.value.replace(/\D/g, '');
                    const newGuess = guess.split('');
                    newGuess[i] = digit;
                    const updatedGuess = newGuess.join('');

                    // Only allow updating if it's a valid digit
                    if (digit === '' || /\d/.test(digit)) {
                      setGuess(updatedGuess);

                      // Auto-focus next box
                      if (digit !== '' && i < numberLength - 1) {
                        const nextInput = e.target.nextElementSibling as HTMLInputElement;
                        if (nextInput && nextInput.tagName === 'INPUT') {
                          nextInput.focus();
                        }
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !guess[i] && i > 0) {
                      // Focus previous box on backspace
                      const target = e.target as HTMLElement;
                      const prevInput = target.previousElementSibling as HTMLInputElement;
                      if (prevInput && prevInput.tagName === 'INPUT') {
                        prevInput.focus();
                      }
                    } else if (e.key === 'Enter' && guess.length === numberLength) {
                      handleMakeGuess();
                    }
                  }}
                  className="form-control form-control-lg text-center font-monospace fs-5"
                  style={{ width: '60px', height: '60px' }}
                  autoFocus={i === 0}
                  required
                />
              ))}
            </div>
            <div className="form-text text-center">
              {t('secretNumber.help')}
            </div>
          </div>

          <button
            onClick={handleMakeGuess}
            disabled={guess.length !== numberLength || room.gameStatus !== 'playing'}
            className="btn btn-success btn-lg w-100"
          >
            {room.gameStatus === 'playing' ? t('turn.submitGuess') : t('turn.waitingForBoth')}
          </button>
        </div>
      ) : (
        <div className="text-center py-4">
          <div className="spinner-border text-warning mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted fs-5">
            {t('turn.waitingForGuess', { name: room.players.find(p => p.id === room.currentTurn)?.name })}
          </p>
        </div>
      )}

      {/* Quick Stats */}
      <div className="card">
        <div className="card-body">
          <h3 className="card-title h6 fw-semibold mb-3 text-center text-md-start">{t('progress.title')}</h3>
          <div className="row text-center">
            <div className="col-6">
              <div className="display-6 fw-bold text-info">
                {room.gameHistory.filter(g => g.playerName === currentPlayer?.name).length}
              </div>
              <div className="text-muted small">{t('progress.yourGuesses')}</div>
            </div>
            <div className="col-6">
              <div className="display-6 fw-bold text-primary">
                {room.gameHistory.filter(g => g.playerName !== currentPlayer?.name).length}
              </div>
              <div className="text-muted small">{t('progress.opponentGuesses')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
