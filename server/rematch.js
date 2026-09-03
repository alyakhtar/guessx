// Rematch flow for issue #4.
//
// Kept in its own module so the main server file stays small and edits are
// isolated. The initiator of a rematch sends `rematch_request`; the opponent
// gets an Accept/Decline prompt. A server-authoritative offer state means only
// one offer can be pending at a time, so the two players can't both see an
// accept/decline screen (the opponent's "Rematch" button is replaced by the
// prompt the moment the offer is made). On accept (or automatically when the
// opponent is disconnected / it's a bot room) a fresh room with identical
// config is created and connected players are auto-invited. A dropped player
// rejoins from the shared list (public) or the shown access code (private).

const { isValidRoomId } = require('./socketValidation.cjs');

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

function createRematch(gs, sourceRoomId) {
  const src = gs.rooms.get(sourceRoomId);
  if (!src || src.gameStatus !== 'finished') return;

  const connected = src.players.filter(p => gs.io.sockets.sockets.get(p.id));
  const newRoomId = generateRoomId();
  const players = connected.map(p => ({
    id: p.id, name: p.name, isConnected: true, isReady: false,
    ...(p.isBot ? { isBot: true, botDifficulty: p.botDifficulty, numberLength: src.numberLength, winThreshold: null } : {})
  }));

  let accessCode;
  if (src.isPrivate) {
    do { accessCode = generateAccessCode(); } while (Array.from(gs.rooms.values()).some(r => r.accessCode === accessCode));
  }

  const newRoom = {
    id: newRoomId, players, currentTurn: players[0] ? players[0].id : null, gameHistory: [],
    gameStatus: 'waiting', numberLength: src.numberLength, spectatorModeEnabled: src.spectatorModeEnabled,
    isSinglePlayer: src.isSinglePlayer, isPrivate: src.isPrivate, accessCode: src.isPrivate ? accessCode : undefined,
    rematchOffer: null,
    turnTimerSeconds: src.turnTimerSeconds || 0
  };
  gs.rooms.set(newRoomId, newRoom);

  // Tear down the old room's mappings FIRST (only those still pointing at the
  // source room), THEN re-point connected players to the new room. The previous
  // order deleted the freshly-set new-room mappings too, which broke
  // set_secret_number in the rematch room (game never started).
  src.players.forEach(p => { if (gs.playerRoomMap.get(p.id) === sourceRoomId) gs.playerRoomMap.delete(p.id); });
  gs.rooms.delete(sourceRoomId);
  if (gs.roomTimers) gs.roomTimers.delete(sourceRoomId);

  // Physically move each connected player's socket into the new room.
  connected.forEach(p => {
    const s = gs.io.sockets.sockets.get(p.id);
    if (s) { gs.playerRoomMap.set(p.id, newRoomId); s.join(newRoomId); }
  });

  gs.broadcastRoomList();

  const payload = { roomId: newRoomId, accessCode: src.isPrivate ? accessCode : undefined };
  if (connected.length >= 2) {
    // Both present -> auto-invite: each navigates to the fresh room.
    connected.forEach(p => {
      const s = gs.io.sockets.sockets.get(p.id);
      if (s) s.emit('rematch_room_ready', payload);
    });
  } else if (connected.length === 1) {
    // Only the requester is present -> show them the room id / code so the
    // other player can rejoin from the list or by code.
    const s = gs.io.sockets.sockets.get(connected[0].id);
    if (s) s.emit('rematch_room_ready', { ...payload, solo: true });
  }
}

function handleRematchRequest(gs, socket, sourceRoomId) {
  const src = gs.rooms.get(sourceRoomId);
  if (!src || src.gameStatus !== 'finished') return;
  // Authorize: only a current member of the finished room may start a rematch.
  if (!src.players.some(p => p.id === socket.id)) return;
  // Reject a second concurrent request — keeps the offer single-owner.
  if (src.rematchOffer && src.rematchOffer.pending) {
    socket.emit('error', 'A rematch is already pending for this room.');
    return;
  }
  // Bot / single-player rooms auto-accept (no human opponent to ask).
  if (src.isSinglePlayer) { createRematch(gs, sourceRoomId); return; }

  const opponent = src.players.find(p => p.id !== socket.id);
  const oppSocket = opponent ? gs.io.sockets.sockets.get(opponent.id) : null;
  // Opponent dropped: only the requester is present -> create immediately so
  // they get a fresh room + code and the other rejoins from list / code.
  if (!oppSocket) { createRematch(gs, sourceRoomId); return; }

  src.rematchOffer = { initiatedBy: socket.id, pending: true };
  socket.emit('rematch_offer_sent');                                   // lock requester's button
  oppSocket.emit('rematch_offer', { roomId: sourceRoomId, from: socket.id }); // opponent accepts/declines
}

function handleRematchAccept(gs, socket, sourceRoomId) {
  const src = gs.rooms.get(sourceRoomId);
  if (!src || !src.rematchOffer || !src.rematchOffer.pending) return;
  // Authorize: only a member (and not the initiator) may accept the offer.
  if (!src.players.some(p => p.id === socket.id)) return;
  if (src.rematchOffer.initiatedBy === socket.id) return;
  src.rematchOffer.pending = false;
  createRematch(gs, sourceRoomId);
}

function handleRematchDecline(gs, socket, sourceRoomId) {
  const src = gs.rooms.get(sourceRoomId);
  if (!src || !src.rematchOffer) return;
  // Authorize: only a member may decline the offer.
  if (!src.players.some(p => p.id === socket.id)) return;
  const initiatorId = src.rematchOffer.initiatedBy;
  src.rematchOffer = null;
  const initSocket = gs.io.sockets.sockets.get(initiatorId);
  if (initSocket) initSocket.emit('rematch_declined');
}

// Wire the rematch socket handlers onto a GameServer instance.
function attachRematch(gs) {
  gs.io.on('connection', (socket) => {
    socket.on('rematch_request', (sourceRoomId, ...extra) => {
      if (extra.length || !isValidRoomId(sourceRoomId)) return gs.reject(socket);
      if (!gs.allow(socket, 'rematch')) return;
      handleRematchRequest(gs, socket, sourceRoomId);
    });
    socket.on('rematch_accept', (sourceRoomId, ...extra) => {
      if (extra.length || !isValidRoomId(sourceRoomId)) return gs.reject(socket);
      if (!gs.allow(socket, 'rematch')) return;
      handleRematchAccept(gs, socket, sourceRoomId);
    });
    socket.on('rematch_decline', (sourceRoomId, ...extra) => {
      if (extra.length || !isValidRoomId(sourceRoomId)) return gs.reject(socket);
      if (!gs.allow(socket, 'rematch')) return;
      handleRematchDecline(gs, socket, sourceRoomId);
    });
  });
}

module.exports = { attachRematch };
