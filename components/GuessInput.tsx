'use client';

import { useState, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useTranslations } from 'next-intl';
import { socketService } from '../lib/socket';
import { showToast } from '../lib/toast';
import { GameRoom, Player } from '../types/game';
import { validateNumber } from '../lib/gameLogic';
import { areDigitBoxesComplete, emptyDigitBoxes, fillDigitBoxes } from '../lib/digitInput';

interface GuessInputProps {
  room: GameRoom;
  currentPlayer: Player | undefined;
  isMyTurn: boolean;
  numberLength: number;
  onNewGame: () => void;
}

export default function GuessInput({ room, currentPlayer, isMyTurn, numberLength, onNewGame }: GuessInputProps) {
  const t = useTranslations('guessInput');
  const [secretDigits, setSecretDigits] = useState(() => emptyDigitBoxes(numberLength));
  const [guessDigits, setGuessDigits] = useState(() => emptyDigitBoxes(numberLength));
  const [isSettingSecret, setIsSettingSecret] = useState(false);
  const [duplicateGuess, setDuplicateGuess] = useState(false);
  const secretRefs = useRef<Array<HTMLInputElement | null>>([]);
  const guessRefs = useRef<Array<HTMLInputElement | null>>([]);

  const secretNumber = secretDigits.join('');
  const guess = guessDigits.join('');
  const secretComplete = areDigitBoxesComplete(secretDigits);
  const guessComplete = areDigitBoxesComplete(guessDigits);

  const applyDigits = (
    current: string[],
    setDigits: Dispatch<SetStateAction<string[]>>,
    refs: MutableRefObject<Array<HTMLInputElement | null>>,
    index: number,
    rawValue: string,
  ) => {
    const result = fillDigitBoxes(current, index, rawValue);
    setDigits(result.digits);
    if (result.filled > 0) refs.current[Math.min(index + result.filled, numberLength - 1)]?.focus();
  };

  useEffect(() => {
    // Reset secret number input if player is already ready
    if (currentPlayer?.isReady) {
      setIsSettingSecret(false);
    }
  }, [currentPlayer?.isReady]);

  const handleSetSecretNumber = () => {
    if (!validateNumber(secretNumber, numberLength)) {
      showToast(t('validation.invalidNumber', { length: numberLength }));
      return;
    }

    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('set_secret_number', secretNumber);
    }
  };

  const handleMakeGuess = () => {
    if (!validateNumber(guess, numberLength)) {
      showToast(t('validation.invalidNumber', { length: numberLength }));
      return;
    }

    if (room.gameHistory.some((previousGuess) => (
      previousGuess.playerName === currentPlayer?.name && previousGuess.guess === guess
    ))) {
      // Reset first so a repeated submit restarts the CSS animation.
      setDuplicateGuess(false);
      window.requestAnimationFrame(() => setDuplicateGuess(true));
      return;
    }

    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('make_guess', guess);
      setGuessDigits(emptyDigitBoxes(numberLength));
    }
  };

  const handleGuessDigitChange = (index: number, rawValue: string) => {
    setDuplicateGuess(false);
    applyDigits(guessDigits, setGuessDigits, guessRefs, index, rawValue);
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
                pattern="[0-9]*"
                maxLength={1}
                ref={(element) => { secretRefs.current[i] = element; }}
                value={secretDigits[i]}
                onChange={(e) => applyDigits(secretDigits, setSecretDigits, secretRefs, i, e.target.value)}
                onPaste={(e) => {
                  e.preventDefault();
                  applyDigits(secretDigits, setSecretDigits, secretRefs, i, e.clipboardData.getData('text'));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !secretDigits[i] && i > 0) {
                    secretRefs.current[i - 1]?.focus();
                  } else if (e.key === 'Enter' && secretComplete) {
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
          disabled={!secretComplete}
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
            <div className={`d-flex justify-content-center gap-2 mb-2 guess-digit-inputs${duplicateGuess ? ' guess-digit-inputs--duplicate' : ''}`}>
              {Array.from({ length: numberLength }, (_, i) => (
                <input
                  key={i}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  ref={(element) => { guessRefs.current[i] = element; }}
                  value={guessDigits[i]}
                  onChange={(e) => handleGuessDigitChange(i, e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault();
                    handleGuessDigitChange(i, e.clipboardData.getData('text'));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !guessDigits[i] && i > 0) {
                      guessRefs.current[i - 1]?.focus();
                    } else if (e.key === 'Enter' && guessComplete) {
                      handleMakeGuess();
                    }
                  }}
                  className="form-control form-control-lg text-center font-monospace fs-5"
                  style={{ width: '60px', height: '60px' }}
                  autoFocus={i === 0}
                  aria-invalid={duplicateGuess}
                  aria-describedby={duplicateGuess ? 'duplicate-guess-message' : undefined}
                  required
                />
              ))}
            </div>
            {duplicateGuess && (
              <p id="duplicate-guess-message" className="small text-danger fw-semibold text-center mb-2" role="alert">
                {t('validation.duplicateGuess')}
              </p>
            )}
            <div className="form-text text-center">
              {t('secretNumber.help')}
            </div>
          </div>

          <button
            onClick={handleMakeGuess}
            disabled={!guessComplete || room.gameStatus !== 'playing'}
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

    </div>
  );
}
