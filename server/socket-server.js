const { Server } = require('socket.io');
const mongoose = require('mongoose');

const isDevelopment = process.env.NODE_ENV === 'development';
const debugLog = (...args) => { if (isDevelopment) console.debug(...args); };
const prodLog = (...args) => { console.log(...args); };

let GameResultModel = null;
async function initializeDatabase() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) throw new Error('MONGODB_URI environment variable is not set');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB for game results');
    GameResultModel = require('../lib/models/GameResult.model.js');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    try { GameResultModel = require('../lib/models/GameResult.model.js'); } catch (e) { console.error('Failed to load GameResult model:', e); }
  }
}

async function saveGameResult(room) {
  if (!GameResultModel) { console.log('GameResultModel not initialized, skipping save'); return; }
  try {
    const players = room.players;
    const player1 = players[0].name;
    const player2 = players[1].name;
    const winner = room.winner;
    const totalGuesses = room.gameHistory.length;
    const isVsBot = players.some(p => p.isBot);
    const botPlayer = players.find(p => p.isBot);
    const difficulty = botPlayer ? botPlayer.botDifficulty : undefined;
    let gameDuration = undefined;
    if (room.gameHistory.length > 0) {
      const firstGuess = room.gameHistory[0].timestamp;
      const lastGuess = room.gameHistory[room.gameHistory.length - 1].timestamp;
      gameDuration = new Date(lastGuess) - new Date(firstGuess);
    }
    const gameResult = new GameResultModel({ player1, player2, winner, gameDuration, totalGuesses, numberLength: room.numberLength, difficulty, isVsBot });
    await gameResult.save();
    console.log(`Game result saved: ${player1} vs ${player2}, winner: ${winner}`);
  } catch (error) { console.error('Error saving game result:', error); }
}

function validateNumber(number, length = 4) {
  if (number.length !== length) return false;
  if (!/^\d+$/.test(number)) return false;
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const num = parseInt(number);
  return num >= min && num <= max;
}

function calculateCorrectPositions(guess, secret) {
  if (guess.length !== secret.length) return 0;
  let correct = 0;
  for (let i = 0; i < guess.length; i++) { if (guess(...) [FILE TRUNCATED - 22296 chars omitted]