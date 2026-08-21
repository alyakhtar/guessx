const { Server } = require('socket.io');
const mongoose = require('mongoose');
const { attachRematch } = require('./rematch');

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
  for (let i = 0; i < guess.length; i++) { if (guess[i] === secret[i]) correct++; }
  return correct;
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Generate a 3-character alphanumeric access code (e.g. "A7K") for private rooms
function generateAccessCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit ambiguous 0/O/1/I
  let code = '';
  for (let i = 0; i < 3; i++) { code += alphabet[Math.floor(Math.random() * alphabet.length)]; }
  return code;
}

function generateBotSecretNumber(length) {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return (min + Math.floor(Math.random() * (max - min + 1))).toString();
}

function generateBotGuess(difficulty, length, gameHistory, minGuess = 10 ** (length - 1), maxGuess = 10 ** length - 1) {
  switch (difficulty) {
    case 'easy': return generateEasyBotGuess(length, gameHistory, minGuess, maxGuess);
    case 'medium': return generateMediumBotGuess(length, gameHistory, minGuess, maxGuess);
    case 'hard': return generateHardBotGuess(length, gameHistory, minGuess, maxGuess);
    default: return generateRandomGuess(length, gameHistory, minGuess, maxGuess);
  }
}

function generateRandomGuess(length, gameHistory, minGuess = 10 ** (length - 1), maxGuess = 10 ** length - 1) {
  const allPossible = [];
  for (let i = minGuess; i <= maxGuess; i++) {
    const numStr = i.toString().padStart(length, '0');
    if (!gameHistory.some(h => h.guess === numStr)) allPossible.push(numStr);
  }
  if (allPossible.length === 0) return Math.floor(Math.random() * (maxGuess - minGuess + 1) + minGuess).toString();
  return allPossible[Math.floor(Math.random() * allPossible.length)];
}

function generateEasyBotGuess(length, gameHistory, minGuess = 10 ** (length - 1), maxGuess = 10 ** length - 1) {
  let attempts = 0; let guess;
  do {
    const num = Math.floor(Math.random() * (maxGuess - minGuess + 1)) + minGuess;
    guess = num.toString().padStart(length, '0');
    attempts++;
  } while (attempts < 10 && gameHistory.some(h => h.guess === guess));
  return guess;
}

function generateMediumBotGuess(length, gameHistory, minGuess = 10 ** (length - 1), maxGuess = 10 ** length - 1) {
  if (Math.random() < 0.3) return generateRandomGuess(length, gameHistory, minGuess, maxGuess);
  const possible = [];
  for (let i = minGuess; i <= maxGuess; i++) {
    const numStr = i.toString().padStart(length, '0');
    if (gameHistory.every(h => h.guess !== numStr)) {
      if (isConsistentWithHistory(numStr, gameHistory)) possible.push(numStr);
    }
  }
  if (possible.length === 0) return generateRandomGuess(length, gameHistory, minGuess, maxGuess);
  return possible[Math.floor(Math.random() * possible.length)];
}

function generateHardBotGuess(length, gameHistory, minGuess, maxGuess) {
  let possibleCandidates = [];
  for (let i = minGuess; i <= maxGuess; i++) possibleCandidates.push(i.toString());
  gameHistory.forEach(history => {
    const guess = history.guess;
    const correctPos = history.correctPositions;
    possibleCandidates = possibleCandidates.filter(candidate => calculateCorrectPositions(guess, candidate) === correctPos);
  });
  if (possibleCandidates.length === 0) return generateRandomGuess(length, gameHistory, minGuess, maxGuess);
  return possibleCandidates[Math.floor(Math.random() * possibleCandidates.length)];
}

function isConsistentWithHistory(numStr, gameHistory) {
  return gameHistory.every(history => calculateCorrectPositions(history.guess, numStr) >= history.correctPositions);
}

let configsCache = {
  easy: { minGuesses: 11, maxGuesses: 13, numberLength: 4 },
  medium: { minGuesses: 8, maxGuesses: 10, numberLength: 4 },
  hard: { minGuesses: 6, maxGuesses: 7, numberLength: 4 }
};
let lastConfigLoad = 0;

async function buildConfigs() {
  try {
    const response = await fetch('http://localhost:8082/api/admin/configs');
    if (response.ok) {
      const data = await response.json();
      configsCache = { ...data };
    } else { console.debug('Failed to load configs, using defaults'); }
  } catch (error) { console.debug('Error loading configs:', error); }
}

async function getDifficultyConfig(difficulty, numberLength = 4) {
  const now = Date.now();
  if (now - lastConfigLoad > 5000 || lastConfigLoad === 0) { await buildConfigs(); lastConfigLoad = now; }
  const configKey = `${difficulty}_${numberLength}`;
  if (configsCache[configKey]) return { ...configsCache[configKey] };
  return { ...configsCache[difficulty] };
}

class GameServer {
  constructor(server) {
    this.io = new Server(server, {
      cors: { origin: '*', methods: ['GET', 'POST'], credentials: true }
    });
    this.rooms = new Map();
    this.playerRoomMap = new Map();
    this.roomTimers = new Map();
    this.setupSocketHandlers();
    this.broadcastRoomList();
    prodLog('GameServer initialized');
    initializeDatabase();
    setTimeout(buildConfigs, 1000);
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Player connected:', socket.id);
      socket.on('get_rooms', () => this.sendRoomList(socket));

      socket.on('create_room', async (playerName, numberLength = 4, spectatorModeEnabled = false, isSinglePlayer = false, botDifficulty = 'medium', isPrivate = false, turnTimerSeconds = 0) => {
        await this.createRoom(socket, playerName, numberLength, spectatorModeEnabled, isSinglePlayer, botDifficulty, isPrivate, turnTimerSeconds);
      });

      socket.on('join_room_by_code', (accessCode, playerName) => {
        this.joinRoomByCode(socket, accessCode, playerName);
      });

      socket.on('join_room', (roomId, playerName) => this.joinRoom(socket, roomId, playerName));

      socket.on('get_room_state', (roomId) => {
        const room = this.rooms.get(roomId);
        if (room) {
          socket.join(`${roomId}_spectators`);
          // Send the full room (incl. accessCode) only to members of this room.
          socket.emit('room_updated', this.withServerNow(this.sanitizeFor(room, socket.id)));
        }
      });

      socket.on('set_secret_number', (secretNumber) => this.setSecretNumber(socket, secretNumber));
      socket.on('make_guess', (guess) => this.handleGuess(socket, guess));
      socket.on('disconnect', (reason) => this.handleDisconnect(socket));
      socket.on('new_game', () => this.handleNewGame(socket));
      socket.emit('connected', { socketId: socket.id });
    });
    // Rematch handlers live in server/rematch.js (issue #4).
    attachRematch(this);
  }

  sanitizeFor(room, socketId) {
    if (!room) return room;
    const isMember = room.players.some(p => p.id === socketId);
    if (isMember) return room;
    const { accessCode, ...safe } = room;
    return { ...safe, hasAccessCode: !!accessCode };
  }

  withServerNow(room) {
    return { ...room, serverNow: Date.now() };
  }

  clearRoomTimer(roomId) {
    const entry = this.roomTimers.get(roomId);
    if (!entry) return;
    if (entry.handle) clearTimeout(entry.handle);
    entry.handle = null;
  }

  startTurn(room) {
    const entry = this.roomTimers.get(room.id) ?? { handle: null, generation: 0 };
    this.roomTimers.set(room.id, entry);
    this.clearRoomTimer(room.id);
    entry.generation += 1;
    const scheduledGeneration = entry.generation;
    if (room.turnTimerSeconds > 0) {
      room.turnStartedAt = Date.now();
      room.turnDeadline = room.turnStartedAt + room.turnTimerSeconds * 1000;
      entry.handle = setTimeout(
        () => this.expireTurn(room.id, scheduledGeneration),
        room.turnTimerSeconds * 1000
      );
    }

    const payload = {
      currentTurn: room.currentTurn,
      turnStartedAt: room.turnStartedAt,
      turnDeadline: room.turnDeadline,
      turnDurationMs: room.turnTimerSeconds * 1000,
      ...(room.turnTimerSeconds > 0 ? { serverNow: Date.now() } : {}),
    };
    this.io.to(room.id).emit('turn_started', payload);
    this.io.to(`${room.id}_spectators`).emit('turn_started', payload);
  }

  expireTurn(roomId, scheduledGeneration) {
    const room = this.rooms.get(roomId);
    if (!room || room.gameStatus !== 'playing' || this.roomTimers.get(roomId)?.generation !== scheduledGeneration) return;
    const idle = room.players.find(player => player.id === room.currentTurn);
    const opponent = room.players.find(player => player.id !== room.currentTurn);
    if (!idle || !opponent) return;

    room.gameStatus = 'finished';
    room.winner = opponent.name;
    room.gameEndReason = 'idle_forfeit';
    room.forfeitedBy = idle.id;
    saveGameResult(room);
    this.clearRoomTimer(roomId);
    this.io.to(roomId).emit('game_won', this.withServerNow(room), opponent.name);
    if (room.spectatorModeEnabled) {
      this.io.to(`${roomId}_spectators`).emit('game_won', this.withServerNow(this.sanitizeFor(room, null)), opponent.name);
    }
  }

  async createRoom(socket, playerName, numberLength, spectatorModeEnabled = false, isSinglePlayer = false, botDifficulty = 'medium', isPrivate = false, turnTimerSeconds = 0) {
    try {
      const roomId = generateRoomId();
      const player = { id: socket.id, name: playerName, isConnected: true, isReady: false };
      const players = [player];
      if (isSinglePlayer) {
        await buildConfigs();
        const botId = `bot_${roomId}`;
        const bot = { id: botId, name: 'Bot', isConnected: true, isReady: false, isBot: true, botDifficulty: botDifficulty, numberLength: numberLength, winThreshold: null };
        players.push(bot);
      }
      let accessCode;
      if (isPrivate) {
        do { accessCode = generateAccessCode(); } while (Array.from(this.rooms.values()).some(r => r.accessCode === accessCode));
      }
      const room = {
        id: roomId, players: players, currentTurn: socket.id, gameHistory: [],
        gameStatus: 'waiting', numberLength: numberLength, spectatorModeEnabled: spectatorModeEnabled,
        isSinglePlayer: isSinglePlayer, isPrivate: isPrivate, accessCode: isPrivate ? accessCode : undefined,
        rematchOffer: null,
        turnTimerSeconds: [0, 15, 30, 60].includes(turnTimerSeconds) ? turnTimerSeconds : 0
        // `type` is derived from `isPrivate` in the client; not stored (review: avoid duplicate state).
      };
      this.rooms.set(roomId, room);
      this.playerRoomMap.set(socket.id, roomId);
      socket.join(roomId);
      console.log(`Room ${roomId} created by ${playerName} (${isSinglePlayer ? 'single player' : 'multiplayer'}${isPrivate ? ', private ' + accessCode : ''})`);
      // Only the creator (a member) gets the access code back.
      socket.emit('room_created', roomId, this.withServerNow(room));
      this.broadcastRoomList();
    } catch (error) { console.error('Error creating room:', error); socket.emit('error', 'Failed to create room'); }
  }

  admitPlayer(room, socket, playerName, { byCode = false } = {}) {
    const existingPlayer = room.players.find(p => p.name === playerName);
    if (existingPlayer && existingPlayer.isConnected) {
      return { error: 'SERVER_ERROR:duplicateName' };
    }
    if (existingPlayer && !existingPlayer.isConnected) {
      const oldId = existingPlayer.id;
      existingPlayer.id = socket.id;
      existingPlayer.isConnected = true;
      if (room.currentTurn === oldId) room.currentTurn = socket.id;
      this.playerRoomMap.set(socket.id, room.id);
      socket.join(room.id);
      this.io.to(room.id).emit('player_reconnected', this.withServerNow(room));
      this.io.to(room.id).emit('room_updated', this.withServerNow(room));
      this.broadcastRoomList();
      return { reconnected: true };
    }
    if (room.players.length >= 2) {
      return { error: 'No space for new players. Only original players can rejoin.' };
    }
    if (room.players.filter(p => p.isConnected).length >= 2) {
      return { error: 'Room is full. Maximum 2 players allowed.' };
    }
    const player = { id: socket.id, name: playerName, isConnected: true, isReady: false };
    room.players.push(player);
    this.playerRoomMap.set(socket.id, room.id);
    socket.join(room.id);
    if (room.players.filter(p => p.isConnected).length === 2) room.gameStatus = 'setup';
    console.log(`Player ${playerName} joined room ${room.id}${byCode ? ' via code' : ''}`);
    this.io.to(room.id).emit('player_joined', this.withServerNow(room));
    this.io.to(room.id).emit('room_updated', this.withServerNow(room));
    this.broadcastRoomList();
    return { joined: true };
  }

  joinRoomByCode(socket, accessCode, playerName) {
    try {
      if (!accessCode || typeof accessCode !== 'string') { socket.emit('error', 'Please provide a valid access code.'); return; }
      const normalized = accessCode.trim().toUpperCase();
      const room = Array.from(this.rooms.values()).find(r => r.isPrivate && r.accessCode === normalized);
      if (!room) { socket.emit('error', 'SERVER_ERROR:invalidCode'); return; }
      const result = this.admitPlayer(room, socket, playerName, { byCode: true });
      if (result.error) { socket.emit('error', result.error); return; }
    } catch (error) { console.error('Error joining room by code:', error); socket.emit('error', 'Failed to join room'); }
  }

  joinRoom(socket, roomId, playerName) {
    try {
      const room = this.rooms.get(roomId);
      if (!room) { socket.emit('error', `Room "${roomId}" not found. Please check the room code.`); return; }
      if (room.isPrivate) { socket.emit('error', 'This is a private room. Join using its access code.'); return; }
      const result = this.admitPlayer(room, socket, playerName);
      if (result.error) { socket.emit('error', result.error); return; }
    } catch (error) { console.error('Error joining room:', error); socket.emit('error', 'Failed to join room'); }
  }

  setSecretNumber(socket, secretNumber) {
    const roomId = this.playerRoomMap.get(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    if (!validateNumber(secretNumber, room.numberLength)) { socket.emit('error', `Please enter a valid ${room.numberLength}-digit number`); return; }
    player.secretNumber = secretNumber;
    player.isReady = true;
    const bot = room.players.find(p => p.isBot);
    if (bot && !bot.secretNumber) { bot.secretNumber = generateBotSecretNumber(room.numberLength); bot.isReady = true; }
    const allReady = room.players.every(p => p.isReady);
    if (allReady && room.players.length === 2 && (room.gameStatus === 'waiting' || room.gameStatus === 'setup')) {
      room.gameStatus = 'setup';
      if (room.isSinglePlayer) { room.gameStatus = 'playing'; room.currentTurn = socket.id; }
      else { room.gameStatus = 'playing'; room.currentTurn = room.players[Math.floor(Math.random() * 2)].id; }
      this.startTurn(room);
    }
    this.io.to(roomId).emit('secret_number_set', this.withServerNow(room));
    this.io.to(roomId).emit('room_updated', this.withServerNow(room));
  }

  handleGuess(socket, guess) {
    const roomId = this.playerRoomMap.get(socket.id);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room || room.gameStatus !== 'playing') return;
    if (room.currentTurn !== socket.id) { socket.emit('error', "It's not your turn!"); return; }
    const guessingPlayer = room.players.find(p => p.id === socket.id);
    const opponent = room.players.find(p => p.id !== socket.id);
    if (!guessingPlayer || !opponent || !opponent.secretNumber) return;
    if (!validateNumber(guess, room.numberLength)) { socket.emit('error', `Please enter a valid ${room.numberLength}-digit number`); return; }
    this.clearRoomTimer(roomId);
    const correctPositions = calculateCorrectPositions(guess, opponent.secretNumber);
    const guessRecord = { playerName: guessingPlayer.name, guess, correctPositions, timestamp: new Date() };
    room.gameHistory.push(guessRecord);
    if (correctPositions === room.numberLength) {
      room.gameStatus = 'finished';
      room.winner = guessingPlayer.name;
      saveGameResult(room);
      this.io.to(roomId).emit('game_won', this.withServerNow(room), guessingPlayer.name);
      if (room.spectatorModeEnabled) this.io.to(`${roomId}_spectators`).emit('game_won', this.withServerNow(this.sanitizeFor(room, null)), guessingPlayer.name);
    } else {
      room.currentTurn = opponent.id;
      this.startTurn(room);
      this.io.to(roomId).emit('guess_made', this.withServerNow(room), guessRecord);
      if (room.spectatorModeEnabled) this.io.to(`${roomId}_spectators`).emit('guess_made', this.withServerNow(this.sanitizeFor(room, null)), guessRecord);
      const currentPlayer = room.players.find(p => p.id === room.currentTurn);
      if (currentPlayer && currentPlayer.isBot) {
        setTimeout(() => this.makeBotGuess(roomId), 1000);
        if (Date.now() - lastConfigLoad > 5000) buildConfigs().catch(console.error);
      }
    }
    this.io.to(roomId).emit('room_updated', this.withServerNow(room));
    if (room.spectatorModeEnabled) this.io.to(`${roomId}_spectators`).emit('room_updated', this.withServerNow(this.sanitizeFor(room, null)));
  }

  async makeBotGuess(roomId) {
    let room = this.rooms.get(roomId);
    if (!room || room.gameStatus !== 'playing') return;
    let bot = room.players.find(p => p.id === room.currentTurn && p.isBot);
    if (!bot) return;
    const botId = bot.id;
    const config = await getDifficultyConfig(bot.botDifficulty, bot.numberLength);
    room = this.rooms.get(roomId);
    if (!room || room.gameStatus !== 'playing' || room.currentTurn !== botId) return;
    bot = room.players.find(p => p.id === botId && p.isBot);
    const opponent = room.players.find(p => p.id !== botId);
    if (!bot || !opponent || !opponent.secretNumber) return;
    const botGuessCount = room.gameHistory.filter(g => g.playerName === bot.name).length;
    if (bot.winThreshold === null) {
      bot.winThreshold = Math.floor(Math.random() * (config.maxGuesses - config.minGuesses + 1)) + config.minGuesses;
      console.log(`Bot threshold set to: ${bot.winThreshold}`);
    }
    const currentGuessNumber = botGuessCount + 1;
    let guess;
    if (currentGuessNumber >= bot.winThreshold) guess = opponent.secretNumber;
    else guess = generateBotGuess(bot.botDifficulty, room.numberLength, room.gameHistory);
    console.log(`Bot ${bot.name} guesses: ${guess}`);
    this.clearRoomTimer(roomId);
    const correctPositions = calculateCorrectPositions(guess, opponent.secretNumber);
    const guessRecord = { playerName: bot.name, guess, correctPositions, timestamp: new Date() };
    room.gameHistory.push(guessRecord);
    if (correctPositions === room.numberLength) {
      room.gameStatus = 'finished'; room.winner = bot.name; saveGameResult(room);
      this.io.to(roomId).emit('game_won', this.withServerNow(room), bot.name);
      if (room.spectatorModeEnabled) this.io.to(`${roomId}_spectators`).emit('game_won', this.withServerNow(this.sanitizeFor(room, null)), bot.name);
    } else {
      room.currentTurn = opponent.id;
      this.startTurn(room);
      this.io.to(roomId).emit('guess_made', this.withServerNow(room), guessRecord);
      if (room.spectatorModeEnabled) this.io.to(`${roomId}_spectators`).emit('guess_made', this.withServerNow(this.sanitizeFor(room, null)), guessRecord);
    }
    this.io.to(roomId).emit('room_updated', this.withServerNow(room));
    if (room.spectatorModeEnabled) this.io.to(`${roomId}_spectators`).emit('room_updated', this.withServerNow(this.sanitizeFor(room, null)));
  }

  handleDisconnect(socket) {
    const roomId = this.playerRoomMap.get(socket.id);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          player.isConnected = false;
          this.io.to(roomId).emit('player_left', this.withServerNow(room));
          this.io.to(roomId).emit('room_updated', this.withServerNow(room));
        }
        if (room.players.every(p => !p.isConnected)) {
          this.clearRoomTimer(roomId);
          this.roomTimers.delete(roomId);
          this.rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (all disconnected)`);
        }
        else console.log(`Player disconnected from room ${roomId}. Connected: ${room.players.filter(p => p.isConnected).length}`);
      }
      this.playerRoomMap.delete(socket.id);
      this.broadcastRoomList();
    }
    console.log('Player disconnected:', socket.id);
  }

  handleNewGame(socket) {
    const roomId = this.playerRoomMap.get(socket.id);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.players.forEach(player => this.playerRoomMap.delete(player.id));
        this.clearRoomTimer(roomId);
        this.roomTimers.delete(roomId);
        this.rooms.delete(roomId);
        console.log(`Room ${roomId} deleted for new game`);
      }
    }
    socket.rooms.forEach(room => { if (room !== socket.id) socket.leave(room); });
    this.broadcastRoomList();
  }

  getOpenRooms() {
    return Array.from(this.rooms.values())
      .filter(room => {
        const connectedPlayersCount = room.players.filter(p => p.isConnected).length;
        const hasSpaceForJoin = connectedPlayersCount < 2;
        const canSpectate = connectedPlayersCount === 2 && room.spectatorModeEnabled;
        return (hasSpaceForJoin || canSpectate) &&
          (room.gameStatus === 'waiting' || room.gameStatus === 'setup' || room.gameStatus === 'playing');
      })
      .map(room => {
        const { accessCode, ...safeRoom } = room;
        return { ...safeRoom, hasAccessCode: !!accessCode };
      });
  }

  sendRoomList(socket) {
    socket.emit('room_list', this.getOpenRooms());
  }

  broadcastRoomList() {
    this.io.emit('room_list', this.getOpenRooms());
  }
}

module.exports = GameServer;
