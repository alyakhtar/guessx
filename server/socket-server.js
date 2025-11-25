const { Server } = require('socket.io');

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
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) correct++;
  }
  return correct;
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateBotSecretNumber(length) {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return (min + Math.floor(Math.random() * (max - min + 1))).toString();
}

function generateBotGuess(difficulty, length, gameHistory) {
  switch (difficulty) {
    case 'easy':
      return generateRandomGuess(length, gameHistory);
    case 'medium':
      return generateMediumBotGuess(length, gameHistory);
    case 'hard':
      return generateHardBotGuess(length, gameHistory);
    default:
      return generateRandomGuess(length, gameHistory);
  }
}

function generateRandomGuess(length, gameHistory) {
  const allPossible = [];
  const max = Math.pow(10, length);
  for (let i = Math.pow(10, length - 1); i < max; i++) {
    const numStr = i.toString().padStart(length, '0');
    if (!gameHistory.some(h => h.guess === numStr)) {
      allPossible.push(numStr);
    }
  }
  if (allPossible.length === 0) {
    // Fallback to any random number
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }
  return allPossible[Math.floor(Math.random() * allPossible.length)];
}

function generateMediumBotGuess(length, gameHistory) {
  if (Math.random() < 0.3) {
    // 30% chance for random guess
    return generateRandomGuess(length, gameHistory);
  }

  // Simple elimination: avoid previously guessed numbers, prefer numbers consistent with history
  const possible = [];
  const max = Math.pow(10, length);
  for (let i = Math.pow(10, length - 1); i < max; i++) {
    const numStr = i.toString().padStart(length, '0');
    if (gameHistory.every(h => h.guess !== numStr)) {
      if (isConsistentWithHistory(numStr, gameHistory)) {
        possible.push(numStr);
      }
    }
  }
  if (possible.length === 0) {
    return generateRandomGuess(length, gameHistory);
  }
  return possible[Math.floor(Math.random() * possible.length)];
}

function generateHardBotGuess(length, gameHistory) {
  // Maintain full list of possible candidates
  let possibleCandidates = [];
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  for (let i = min; i <= max; i++) {
    possibleCandidates.push(i.toString());
  }

  // Filter based on all previous guesses
  gameHistory.forEach(history => {
    const guess = history.guess;
    const correctPos = history.correctPositions;
    possibleCandidates = possibleCandidates.filter(candidate =>
      calculateCorrectPositions(guess, candidate) === correctPos
    );
  });

  if (possibleCandidates.length === 0) {
    // If no candidates left (unlikely), fallback
    return generateRandomGuess(length, gameHistory);
  }

  // Choose one randomly from remaining
  return possibleCandidates[Math.floor(Math.random() * possibleCandidates.length)];
}

function isConsistentWithHistory(numStr, gameHistory) {
  // Simple check: for each previous guess, this number would give same or better feedback
  // This is a simplification for medium difficulty
  return gameHistory.every(history => {
    const correctPosForThis = calculateCorrectPositions(history.guess, numStr);
    return correctPosForThis >= history.correctPositions; // Not worse than actual
  });
}

class GameServer {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
      }
    });
    this.rooms = new Map();
    this.playerRoomMap = new Map();
    this.setupSocketHandlers();
    this.broadcastRoomList();

    console.log('GameServer initialized');
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Player connected:', socket.id);
      console.log('Total rooms:', this.rooms.size);
      console.log('Total players:', this.playerRoomMap.size);

      socket.on('get_rooms', () => {
        console.log('Get rooms request');
        this.sendRoomList(socket);
      });

      socket.on('create_room', (playerName, numberLength = 4, spectatorModeEnabled = false, isSinglePlayer = false, botDifficulty = 'medium') => {
        console.log('Create room request:', playerName, numberLength, spectatorModeEnabled, isSinglePlayer, botDifficulty);
        this.createRoom(socket, playerName, numberLength, spectatorModeEnabled, isSinglePlayer, botDifficulty);
      });

      socket.on('join_room', (roomId, playerName) => {
        console.log('Join room request:', roomId, playerName);
        console.log('Available rooms:', Array.from(this.rooms.keys()));
        this.joinRoom(socket, roomId, playerName);
      });

      socket.on('get_room_state', (roomId) => {
        const room = this.rooms.get(roomId);
        if (room) {
          // Join spectator channel for this room
          const spectatorRoomId = `${roomId}_spectators`;
          socket.join(spectatorRoomId);
          socket.emit('room_updated', room);
        }
      });

      socket.on('set_secret_number', (secretNumber) => {
        console.log('Set secret number:', socket.id, secretNumber);
        this.setSecretNumber(socket, secretNumber);
      });

      socket.on('make_guess', (guess) => {
        console.log('Make guess:', socket.id, guess);
        this.handleGuess(socket, guess);
      });

      socket.on('disconnect', (reason) => {
        console.log('Player disconnected:', socket.id, reason);
        this.handleDisconnect(socket);
      });

      socket.on('new_game', () => {
        this.handleNewGame(socket);
      });

      // Send immediate connection confirmation
      socket.emit('connected', { socketId: socket.id });
    });
  }

  createRoom(socket, playerName, numberLength, spectatorModeEnabled = false, isSinglePlayer = false, botDifficulty = 'medium') {
    try {
      const roomId = generateRoomId();
      const player = {
        id: socket.id,
        name: playerName,
        isConnected: true,
        isReady: false
      };

      const players = [player];

      if (isSinglePlayer) {
        const botId = `bot_${roomId}`;
        const bot = {
          id: botId,
          name: 'Bot',
          isConnected: true,
          isReady: false,
          isBot: true,
          botDifficulty: botDifficulty
        };
        players.push(bot);
      }

      const room = {
        id: roomId,
        players: players,
        currentTurn: socket.id,
        gameHistory: [],
        gameStatus: isSinglePlayer ? 'waiting' : 'waiting',
        numberLength: numberLength,
        spectatorModeEnabled: spectatorModeEnabled,
        isSinglePlayer: isSinglePlayer
      };

      this.rooms.set(roomId, room);
      this.playerRoomMap.set(socket.id, roomId);

      socket.join(roomId);

      console.log(`Room ${roomId} created by ${playerName} (${isSinglePlayer ? 'single player' : 'multiplayer'})`);
      console.log('Room details:', room);
      console.log('Total rooms after creation:', this.rooms.size);

      // Send confirmation back to creator
      socket.emit('room_created', roomId, room);

      this.broadcastRoomList();

    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', 'Failed to create room');
    }
  }

  joinRoom(socket, roomId, playerName) {
    try {
      console.log('Looking for room:', roomId);
      console.log('Available rooms:', Array.from(this.rooms.keys()));

      const room = this.rooms.get(roomId);

      if (!room) {
        console.log('Room not found:', roomId);
        socket.emit('error', `Room "${roomId}" not found. Please check the room code.`);
        return;
      }

      // Check if trying to rejoin
      const existingPlayer = room.players.find(p => p.name === playerName);
      if (existingPlayer) {
        if (existingPlayer.isConnected) {
          socket.emit('error', 'Player with this name is already in the room.');
          return;
        } else {
          // Reconnect
          const oldId = existingPlayer.id;
          existingPlayer.id = socket.id;
          existingPlayer.isConnected = true;
          if (room.currentTurn === oldId) {
            room.currentTurn = socket.id;
          }
          this.playerRoomMap.set(socket.id, roomId);
          socket.join(roomId);
          this.io.to(roomId).emit('player_reconnected', room);
          this.io.to(roomId).emit('room_updated', room);
          this.broadcastRoomList();
          console.log(`Player ${playerName} reconnected to room ${roomId}`);
          return;
        }
      }

      // New player join
      if (room.players.length >= 2) {
        socket.emit('error', 'No space for new players. Only original players can rejoin.');
        return;
      }
      if (room.players.filter(p => p.isConnected).length >= 2) {
        socket.emit('error', 'Room is full. Maximum 2 players allowed.');
        return;
      }

      const player = {
        id: socket.id,
        name: playerName,
        isConnected: true,
        isReady: false
      };

      room.players.push(player);
      this.playerRoomMap.set(socket.id, roomId);

      socket.join(roomId);

      // If we now have 2 players, start the setup phase
      if (room.players.filter(p => p.isConnected).length === 2) {
        room.gameStatus = 'setup';
      }

      console.log(`Player ${playerName} joined room ${roomId}`);
      console.log('Room details after join:', room);

      this.io.to(roomId).emit('player_joined', room);
      this.io.to(roomId).emit('room_updated', room);
      this.broadcastRoomList();

    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', 'Failed to join room');
    }
  }

  setSecretNumber(socket, secretNumber) {
    const roomId = this.playerRoomMap.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    if (!validateNumber(secretNumber, room.numberLength)) {
      socket.emit('error', `Please enter a valid ${room.numberLength}-digit number`);
      return;
    }

    player.secretNumber = secretNumber;
    player.isReady = true;

    // Set bot's secret number if it exists
    const bot = room.players.find(p => p.isBot);
    if (bot && !bot.secretNumber) {
      bot.secretNumber = generateBotSecretNumber(room.numberLength);
      bot.isReady = true;
    }

    // Check if both players are ready
    const allReady = room.players.every(p => p.isReady);
    if (allReady && room.players.length === 2) {
      room.gameStatus = 'setup'; // Already set to setup or change to playing?
      // For single player, start playing immediately
      if (room.isSinglePlayer) {
        room.gameStatus = 'playing';
        // Always let human go first in single player
        room.currentTurn = socket.id;
        console.log(`Single player game started in room ${roomId}. First turn: ${room.currentTurn}`);
      } else {
        room.gameStatus = 'playing';
        // Randomize who starts first
        room.currentTurn = room.players[Math.floor(Math.random() * 2)].id;
        console.log(`Game started in room ${roomId}. First turn: ${room.currentTurn}`);
      }
    }

    this.io.to(roomId).emit('secret_number_set', room);
    this.io.to(roomId).emit('room_updated', room);
  }

  handleGuess(socket, guess) {
    const roomId = this.playerRoomMap.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room || room.gameStatus !== 'playing') return;

    // Check if it's player's turn
    if (room.currentTurn !== socket.id) {
      socket.emit('error', "It's not your turn!");
      return;
    }

    const guessingPlayer = room.players.find(p => p.id === socket.id);
    const opponent = room.players.find(p => p.id !== socket.id);

    if (!guessingPlayer || !opponent || !opponent.secretNumber) return;

    if (!validateNumber(guess, room.numberLength)) {
      socket.emit('error', `Please enter a valid ${room.numberLength}-digit number`);
      return;
    }

    const correctPositions = calculateCorrectPositions(guess, opponent.secretNumber);

    const guessRecord = {
      playerName: guessingPlayer.name,
      guess,
      correctPositions,
      timestamp: new Date()
    };

    room.gameHistory.push(guessRecord);

    // Check for win condition
    if (correctPositions === room.numberLength) {
      room.gameStatus = 'finished';
      room.winner = guessingPlayer.name;
      this.io.to(roomId).emit('game_won', room, guessingPlayer.name);
      // Also emit to spectators if spectator mode is enabled
      if (room.spectatorModeEnabled) {
        this.io.to(`${roomId}_spectators`).emit('game_won', room, guessingPlayer.name);
      }
    } else {
      // Switch turns
      room.currentTurn = opponent.id;
      this.io.to(roomId).emit('guess_made', room, guessRecord);
      // Also emit to spectators if spectator mode is enabled
      if (room.spectatorModeEnabled) {
        this.io.to(`${roomId}_spectators`).emit('guess_made', room, guessRecord);
      }

      // If it's bot's turn, make bot guess immediately
      const currentPlayer = room.players.find(p => p.id === room.currentTurn);
      if (currentPlayer && currentPlayer.isBot) {
        setTimeout(() => {
          this.makeBotGuess(roomId);
        }, 1000); // Delay for better UX
      }
    }

    this.io.to(roomId).emit('room_updated', room);
    // Also emit to spectators if spectator mode is enabled
    if (room.spectatorModeEnabled) {
      this.io.to(`${roomId}_spectators`).emit('room_updated', room);
    }
  }

  makeBotGuess(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.gameStatus !== 'playing') return;

    const bot = room.players.find(p => p.id === room.currentTurn && p.isBot);
    if (!bot) return;

    const opponent = room.players.find(p => p.id !== bot.id);
    if (!opponent || !opponent.secretNumber) return;

    const botGuessCount = room.gameHistory.filter(g => g.playerName === bot.name).length;

    // Check for forced win based on difficulty
    let guess;
    const forceWinThresholds = { easy: 12, medium: 9, hard: 6 }; // After this many guesses, force win
    if (botGuessCount >= forceWinThresholds[bot.botDifficulty]) {
      console.log(`Forcing bot win on guess ${botGuessCount + 1}`);
      guess = opponent.secretNumber;
    } else {
      // Generate bot's guess
      guess = generateBotGuess(bot.botDifficulty, room.numberLength, room.gameHistory, botGuessCount);
    }

    console.log(`Bot ${bot.name} guesses: ${guess}`);

    const correctPositions = calculateCorrectPositions(guess, opponent.secretNumber);

    const guessRecord = {
      playerName: bot.name,
      guess,
      correctPositions,
      timestamp: new Date()
    };

    room.gameHistory.push(guessRecord);

    // Check for win condition
    if (correctPositions === room.numberLength) {
      room.gameStatus = 'finished';
      room.winner = bot.name;
      this.io.to(roomId).emit('game_won', room, bot.name);
      // Also emit to spectators if spectator mode is enabled
      if (room.spectatorModeEnabled) {
        this.io.to(`${roomId}_spectators`).emit('game_won', room, bot.name);
      }
    } else {
      // Switch turns back to human
      room.currentTurn = opponent.id;
      this.io.to(roomId).emit('guess_made', room, guessRecord);
      // Also emit to spectators if spectator mode is enabled
      if (room.spectatorModeEnabled) {
        this.io.to(`${roomId}_spectators`).emit('guess_made', room, guessRecord);
      }
    }

    this.io.to(roomId).emit('room_updated', room);
    // Also emit to spectators if spectator mode is enabled
    if (room.spectatorModeEnabled) {
      this.io.to(`${roomId}_spectators`).emit('room_updated', room);
    }
  }

  handleDisconnect(socket) {
    const roomId = this.playerRoomMap.get(socket.id);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          player.isConnected = false;
          this.io.to(roomId).emit('player_left', room);
          this.io.to(roomId).emit('room_updated', room);
        }
        if (room.players.every(p => !p.isConnected)) {
          this.rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (all disconnected)`);
        } else {
          console.log(`Player disconnected from room ${roomId}. Connected: ${room.players.filter(p => p.isConnected).length}`);
        }
      }
      this.playerRoomMap.delete(socket.id);
      this.broadcastRoomList();
    }
    console.log('Player disconnected:', socket.id);
    console.log('Total rooms after disconnect:', this.rooms.size);
    console.log('Total players after disconnect:', this.playerRoomMap.size);
  }

  handleNewGame(socket) {
    const roomId = this.playerRoomMap.get(socket.id);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        // Remove all players from the room
        room.players.forEach(player => {
          this.playerRoomMap.delete(player.id);
        });
        // Delete the room
        this.rooms.delete(roomId);
        console.log(`Room ${roomId} deleted for new game`);
      }
    }

    // Leave all rooms
    socket.rooms.forEach(room => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });
    this.broadcastRoomList();
  }

  sendRoomList(socket) {
    const openRooms = Array.from(this.rooms.values()).filter(room => {
      const connectedPlayersCount = room.players.filter(p => p.isConnected).length;
      const hasSpaceForJoin = connectedPlayersCount < 2;
      const canSpectate = connectedPlayersCount === 2 && room.spectatorModeEnabled;
      return (hasSpaceForJoin || canSpectate) &&
        (room.gameStatus === 'waiting' || room.gameStatus === 'setup' || room.gameStatus === 'playing');
    });
    socket.emit('room_list', openRooms);
  }

  broadcastRoomList() {
    const openRooms = Array.from(this.rooms.values()).filter(room => {
      const connectedPlayersCount = room.players.filter(p => p.isConnected).length;
      const hasSpaceForJoin = connectedPlayersCount < 2;
      const canSpectate = connectedPlayersCount === 2 && room.spectatorModeEnabled;
      return (hasSpaceForJoin || canSpectate) &&
        (room.gameStatus === 'waiting' || room.gameStatus === 'setup' || room.gameStatus === 'playing');
    });
    this.io.emit('room_list', openRooms);
  }
}

module.exports = GameServer;
