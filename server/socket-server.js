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

      socket.on('create_room', (playerName, numberLength = 4) => {
        console.log('Create room request:', playerName, numberLength);
        this.createRoom(socket, playerName, numberLength);
      });

      socket.on('join_room', (roomId, playerName) => {
        console.log('Join room request:', roomId, playerName);
        console.log('Available rooms:', Array.from(this.rooms.keys()));
        this.joinRoom(socket, roomId, playerName);
      });

      socket.on('get_room_state', (roomId) => {
        const room = this.rooms.get(roomId);
        if (room) {
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

  createRoom(socket, playerName, numberLength) {
    try {
      const roomId = generateRoomId();
      const player = {
        id: socket.id,
        name: playerName,
        isConnected: true,
        isReady: false
      };

      const room = {
        id: roomId,
        players: [player],
        currentTurn: socket.id,
        gameHistory: [],
        gameStatus: 'waiting',
        numberLength: numberLength
      };

      this.rooms.set(roomId, room);
      this.playerRoomMap.set(socket.id, roomId);

      socket.join(roomId);

      console.log(`Room ${roomId} created by ${playerName}`);
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

    // Check if both players are ready
    const allReady = room.players.every(p => p.isReady);
    if (allReady && room.players.length === 2) {
      room.gameStatus = 'playing';
      // Randomize who starts first
      room.currentTurn = room.players[Math.floor(Math.random() * 2)].id;
      console.log(`Game started in room ${roomId}. First turn: ${room.currentTurn}`);
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
    } else {
      // Switch turns
      room.currentTurn = opponent.id;
      this.io.to(roomId).emit('guess_made', room, guessRecord);
    }

    this.io.to(roomId).emit('room_updated', room);
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
    const openRooms = Array.from(this.rooms.values()).filter(room =>
      room.players.filter(p => p.isConnected).length < 2 &&
      (room.gameStatus === 'waiting' || room.gameStatus === 'setup' || room.gameStatus === 'playing')
    );
    socket.emit('room_list', openRooms);
  }

  broadcastRoomList() {
    const openRooms = Array.from(this.rooms.values()).filter(room =>
      room.players.filter(p => p.isConnected).length < 2 &&
      (room.gameStatus === 'waiting' || room.gameStatus === 'setup' || room.gameStatus === 'playing')
    );
    this.io.emit('room_list', openRooms);
  }
}

module.exports = GameServer;
