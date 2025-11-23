'use client';

import { useState, useEffect } from 'react';
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
      alert(`Please enter a valid ${numberLength}-digit number`);
      return;
    }

    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('set_secret_number', secretNumber);
    }
  };

  const handleMakeGuess = () => {
    if (!validateNumber(guess, numberLength)) {
      alert(`Please enter a valid ${numberLength}-digit number`);
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
    return (
      <div>
        <h2 className="h5 fw-semibold mb-3 text-center text-md-start">Set Your Secret Number</h2>

        <div className="mb-3">
          <label className="form-label fw-medium small">
            Your {numberLength}-digit secret number
          </label>
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={secretNumber}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '');
              if (value.length <= numberLength) {
                setSecretNumber(value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && secretNumber.length === numberLength) {
                handleSetSecretNumber();
              }
            }}
            className="form-control form-control-lg text-center font-monospace fs-5"
            placeholder={`Enter ${numberLength} digits`}
            maxLength={numberLength}
            min={10 ** (numberLength - 1)}
            max={10 ** numberLength - 1}
          />
          <div className="form-text text-center">
            Must be {numberLength} digits ({10 ** (numberLength - 1)} to {10 ** numberLength - 1})
          </div>
        </div>

        <button
          onClick={handleSetSecretNumber}
          disabled={secretNumber.length !== numberLength}
          className="btn btn-primary btn-lg w-100"
        >
          Set Secret Number & Start Game
        </button>

        <div className="card mt-3">
          <div className="card-body">
            <h3 className="card-title h6 fw-semibold">Game Rules</h3>
            <ul className="list-unstyled mb-0 small">
              <li className="d-flex">
                <span className="text-info">•</span>
                <span className="ms-2">Choose a {numberLength}-digit number between {10 ** (numberLength - 1)} and {10 ** numberLength - 1}</span>
              </li>
              <li className="d-flex mt-1">
                <span className="text-info">•</span>
                <span className="ms-2">Take turns guessing your opponent's number</span>
              </li>
              <li className="d-flex mt-1">
                <span className="text-info">•</span>
                <span className="ms-2">Get feedback on how many digits are in the correct position</span>
              </li>
              <li className="d-flex mt-1">
                <span className="text-info">•</span>
                <span className="ms-2">First to guess the exact number wins!</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Game is finished
  if (room.gameStatus === 'finished') {
    const opponent = room.players.find(p => p.id !== currentPlayer?.id);
    return (
      <div className="text-center">
        <div className="card bg-success text-white mb-3">
          <div className="card-body">
            <h2 className="card-title h4 fw-bold mb-2">Game Over!</h2>
            <p className="card-text fs-5">
              <span className="fw-bold">{room.winner}</span> won the game!
            </p>
          </div>
        </div>



        <button
          onClick={onNewGame}
          className="btn btn-success btn-lg w-100"
        >
          🎮 Start New Game
        </button>
      </div>
    );
  }

  // Game is in progress
  return (
    <div>
      <h2 className="h5 fw-semibold mb-3 text-center text-md-start">
        {isMyTurn ? (
          <span className="badge text-bg-success fs-6">🎯 Your Turn - Make a Guess!</span>
        ) : (
          <span className="badge text-bg-warning fs-6">⏳ Waiting for {room.players.find(p => p.id === room.currentTurn)?.name}</span>
        )}
      </h2>

      {isMyTurn ? (
        <div className="mb-3">
          <div className="mb-3">
            <label className="form-label fw-medium small text-center text-md-start">
              Enter your {numberLength}-digit guess
            </label>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={guess}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= numberLength) {
                  setGuess(value);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && guess.length === numberLength) {
                  handleMakeGuess();
                }
              }}
              className="form-control form-control-lg text-center font-monospace fs-5"
              placeholder={`Enter ${numberLength} digits`}
              maxLength={numberLength}
              min={10 ** (numberLength - 1)}
              max={10 ** numberLength - 1}
              autoFocus
            />
          </div>

          <button
            onClick={handleMakeGuess}
            disabled={guess.length !== numberLength}
            className="btn btn-success btn-lg w-100"
          >
            ✅ Submit Guess
          </button>
        </div>
      ) : (
        <div className="text-center py-4">
          <div className="spinner-border text-warning mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted fs-5">
            Waiting for {room.players.find(p => p.id === room.currentTurn)?.name} to make a guess...
          </p>
        </div>
      )}

      {/* Quick Stats */}
      <div className="card">
        <div className="card-body">
          <h3 className="card-title h6 fw-semibold mb-3 text-center text-md-start">Game Progress</h3>
          <div className="row text-center">
            <div className="col-6">
              <div className="display-6 fw-bold text-info">
                {room.gameHistory.filter(g => g.playerName === currentPlayer?.name).length}
              </div>
              <div className="text-muted small">Your Guesses</div>
            </div>
            <div className="col-6">
              <div className="display-6 fw-bold text-primary">
                {room.gameHistory.filter(g => g.playerName !== currentPlayer?.name).length}
              </div>
              <div className="text-muted small">Opponent's Guesses</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
