import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
// Security middleware
app.use(helmet());
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Port configuration
const PORT = process.env.PORT || 3001;

// Global State
let matchmakingQueue = [];
const rooms = new Map(); // roomId -> roomState
const customRooms = new Map(); // roomCode -> customRoomState
const tournaments = new Map(); // tournamentCode -> tournamentState

// Helper functions
const log = (...args) => console.log(`[MOG-SERVER]`, ...args);

function advanceTournamentRound(tourney) {
  if (tourney.currentRound === 1) {
    // Semifinals complete -> Advance to Finals
    const semi1Winner = tourney.brackets[0].matches[0].winner;
    const semi2Winner = tourney.brackets[0].matches[1].winner;
    
    const finalsBracket = tourney.brackets.find(b => b.round === 2);
    if (finalsBracket) {
      finalsBracket.matches[0].p1 = semi1Winner;
      finalsBracket.matches[0].p2 = semi2Winner;
      finalsBracket.matches[0].state = 'ACTIVE';
    }
    
    tourney.currentRound = 2;
    log(`Tournament ${tourney.code} advancing to Finals. Matchup: ${semi1Winner?.username} vs ${semi2Winner?.username}`);
    io.to(tourney.code).emit('tournament_updated', tourney);
    
    // Launch Finals match
    const finalsMatchId = `tourney_${tourney.code}_R2_M1`;
    rooms.set(finalsMatchId, {
      roomId: finalsMatchId,
      state: 'WAITING',
      player1: { socketId: semi1Winner.socketId, username: semi1Winner.username, elo: semi1Winner.elo, joined: false, ready: false, score: 0, scoreSubmitted: false },
      player2: { socketId: semi2Winner.socketId, username: semi2Winner.username, elo: semi2Winner.elo, joined: false, ready: false, score: 0, scoreSubmitted: false }
    });
    
    // Direct finalist sockets to join room
    io.to(semi1Winner.socketId).emit('tournament_match_ready', { roomId: finalsMatchId, role: 'player1', opponent: { username: semi2Winner.username, elo: semi2Winner.elo } });
    io.to(semi2Winner.socketId).emit('tournament_match_ready', { roomId: finalsMatchId, role: 'player2', opponent: { username: semi1Winner.username, elo: semi1Winner.elo } });
    
  } else if (tourney.currentRound === 2) {
    // Finals complete -> Declare Champion
    const finalsMatch = tourney.brackets[1].matches[0];
    const champion = finalsMatch.winner;
    tourney.state = 'FINISHED';
    tourney.winner = champion;
    
    log(`Tournament ${tourney.code} complete! Champion: ${champion?.username}`);
    io.to(tourney.code).emit('tournament_finished', { champion });
  }
}

io.on('connection', (socket) => {
  log(`Client connected: ${socket.id}`);

  // Handle Matchmaking request
  socket.on('join_queue', (userData) => {
    // Remove if already in queue
    matchmakingQueue = matchmakingQueue.filter(u => u.socketId !== socket.id);
    
    const queueUser = {
      socketId: socket.id,
      username: userData.username || `Mogger_${socket.id.slice(0, 4)}`,
      rank: userData.rank || 'GYMCEL',
      elo: userData.elo || 1000,
    };
    
    matchmakingQueue.push(queueUser);
    log(`User joined queue: ${queueUser.username} (${socket.id}). Queue size: ${matchmakingQueue.length}`);
    
    socket.emit('queue_joined', { position: matchmakingQueue.length });
    
    processMatchmaking();
  });

  socket.on('leave_queue', () => {
    matchmakingQueue = matchmakingQueue.filter(u => u.socketId !== socket.id);
    log(`User left queue. Queue size: ${matchmakingQueue.length}`);
    socket.emit('queue_left');
  });

  // Join designated battle room
  socket.on('join_room', ({ roomId }) => {
    socket.join(roomId);
    log(`Client ${socket.id} joined room ${roomId}`);

    const room = rooms.get(roomId);
    if (!room) return;

    // Set player socket IDs and mark them joined
    if (room.player1.socketId === socket.id) {
      room.player1.joined = true;
    } else if (room.player2.socketId === socket.id) {
      room.player2.joined = true;
    }

    // When both are joined, start the game countdown sync
    if (room.player1.joined && room.player2.joined && room.state === 'WAITING') {
      room.state = 'COUNTDOWN';
      log(`Room ${roomId} both players joined, starting countdown`);
      io.to(roomId).emit('battle_countdown_start', {
        player1: room.player1,
        player2: room.player2,
        customDuration: room.duration || 10
      });
    }
  });

  // Signaling Relay for WebRTC
  socket.on('signal', ({ roomId, signal }) => {
    // Forward signaling payload directly to other peer in the room
    socket.to(roomId).emit('signal', { signal, sender: socket.id });
  });

  // Battle Event Syncs
  socket.on('ready_to_battle', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.player1.socketId === socket.id) {
      room.player1.ready = true;
    } else if (room.player2.socketId === socket.id) {
      room.player2.ready = true;
    }

    if (room.player1.ready && room.player2.ready && room.state === 'COUNTDOWN') {
      room.state = 'FIGHTING';
      log(`Room ${roomId} is FIGHTING!`);
      io.to(roomId).emit('battle_start');
    }
  });

  // Handle Score Updates and Final Scores
  socket.on('submit_final_score', ({ roomId, scores, combatType, fraudAlerts }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    log(`Score submitted by ${socket.id} in room ${roomId}: ${scores.finalScore} (${combatType})`);

    let isPlayer1 = room.player1.socketId === socket.id;
    const player = isPlayer1 ? room.player1 : room.player2;
    
    player.score = scores.finalScore;
    player.details = scores;
    player.combatType = combatType;
    player.fraudAlerts = fraudAlerts;
    player.scoreSubmitted = true;

    // When both scores are in, compute battle outcome
    if (room.player1.scoreSubmitted && room.player2.scoreSubmitted && room.state === 'FIGHTING') {
      room.state = 'FINISHED';
      
      const p1Score = room.player1.score;
      const p2Score = room.player2.score;
      
      let winnerSocketId = null;
      let reason = 'Normal Decision';

      // Check severe fraud disqualification
      const p1Disqualified = room.player1.fraudAlerts && room.player1.fraudAlerts.disqualified;
      const p2Disqualified = room.player2.fraudAlerts && room.player2.fraudAlerts.disqualified;

      if (p1Disqualified && p2Disqualified) {
        reason = 'Mutual Disqualification (Fraud)';
      } else if (p1Disqualified) {
        winnerSocketId = room.player2.socketId;
        reason = 'Player 1 Disqualified for Fraud';
      } else if (p2Disqualified) {
        winnerSocketId = room.player1.socketId;
        reason = 'Player 2 Disqualified for Fraud';
      } else {
        if (p1Score > p2Score) {
          winnerSocketId = room.player1.socketId;
        } else if (p2Score > p1Score) {
          winnerSocketId = room.player2.socketId;
        } else {
          reason = 'Tie Game';
        }
      }

      const result = {
        winner: winnerSocketId,
        reason,
        player1: {
          socketId: room.player1.socketId,
          username: room.player1.username,
          score: room.player1.score,
          details: room.player1.details,
          combatType: room.player1.combatType,
          fraudAlerts: room.player1.fraudAlerts,
          eloChange: winnerSocketId === room.player1.socketId ? 25 : (winnerSocketId === null ? 0 : -20)
        },
        player2: {
          socketId: room.player2.socketId,
          username: room.player2.username,
          score: room.player2.score,
          details: room.player2.details,
          combatType: room.player2.combatType,
          fraudAlerts: room.player2.fraudAlerts,
          eloChange: winnerSocketId === room.player2.socketId ? 25 : (winnerSocketId === null ? 0 : -20)
        }
      };

      log(`Room ${roomId} battle resolved. Winner: ${winnerSocketId}. Reason: ${reason}`);
      io.to(roomId).emit('battle_result', result);
      rooms.delete(roomId); // Clean up immediately to prevent room memory leaks!

      // Check if this was a Custom Room battle
      if (roomId.startsWith('custom_')) {
        const customCode = roomId.substring(7);
        const customRoom = customRooms.get(customCode);
        if (customRoom) {
          customRoom.state = 'LOBBY'; // Reset back to lobby so they can play again!
          io.to(customCode).emit('custom_room_updated', customRoom);
        }
      }

      // Check if this was a Tournament battle
      if (roomId.startsWith('tourney_')) {
        const matchParse = roomId.match(/^tourney_([A-Z0-9]+)_R(\d+)_M(\d+)$/);
        if (matchParse) {
          const tCode = matchParse[1];
          const roundNum = parseInt(matchParse[2]);
          const matchIdx = parseInt(matchParse[3]) - 1;
          const tourney = tournaments.get(tCode);
          if (tourney) {
            const winnerPlayer = winnerSocketId === room.player1.socketId
              ? tourney.players.find(p => p.socketId === room.player1.socketId)
              : (winnerSocketId === room.player2.socketId ? tourney.players.find(p => p.socketId === room.player2.socketId) : null);
            
            const roundBracket = tourney.brackets.find(b => b.round === roundNum);
            if (roundBracket && roundBracket.matches[matchIdx]) {
              roundBracket.matches[matchIdx].winner = winnerPlayer;
              roundBracket.matches[matchIdx].state = 'RESOLVED';
            }
            
            io.to(tCode).emit('tournament_updated', tourney);
            
            const roundComplete = roundBracket.matches.every(m => m.winner !== null || m.state === 'RESOLVED');
            if (roundComplete) {
              advanceTournamentRound(tourney);
            }
          }
        }
      }
    }
  });

  // Client disconnected
  socket.on('disconnect', () => {
    log(`Client disconnected: ${socket.id}`);
    
    // Remove from queue
    matchmakingQueue = matchmakingQueue.filter(u => u.socketId !== socket.id);
    
    // 1. Sweep Custom Rooms
    for (const [code, customRoom] of customRooms.entries()) {
      const initialLength = customRoom.players.length;
      customRoom.players = customRoom.players.filter(p => p.socketId !== socket.id);
      if (customRoom.players.length === 0) {
        customRooms.delete(code);
        log(`Custom Room ${code} empty. Closed.`);
      } else if (customRoom.players.length < initialLength) {
        if (customRoom.hostId === socket.id) {
          customRooms.delete(code);
          io.to(code).emit('custom_room_error', { message: 'Host left the room. Room closed.' });
          log(`Host left Custom Room ${code}. Closed.`);
        } else {
          io.to(code).emit('custom_room_updated', customRoom);
          log(`Player left Custom Room ${code}. Syncing.`);
        }
      }
    }

    // 2. Sweep Tournaments
    for (const [code, tourney] of tournaments.entries()) {
      const initialLength = tourney.players.length;
      tourney.players = tourney.players.filter(p => p.socketId !== socket.id);
      if (tourney.players.length === 0) {
        tournaments.delete(code);
        log(`Tournament ${code} empty. Closed.`);
      } else if (tourney.players.length < initialLength) {
        if (tourney.state === 'LOBBY') {
          if (tourney.hostId === socket.id) {
            tournaments.delete(code);
            io.to(code).emit('tournament_error', { message: 'Host left the lobby. Tournament closed.' });
            log(`Host left Tournament ${code} in LOBBY. Closed.`);
          } else {
            io.to(code).emit('tournament_updated', tourney);
            log(`Player left Tournament ${code} in LOBBY. Syncing.`);
          }
        }
      }
    }

    // 3. Sweep active rooms
    for (const [roomId, room] of rooms.entries()) {
      if (room.player1.socketId === socket.id || room.player2.socketId === socket.id) {
        log(`Player in room ${roomId} disconnected.`);
        const peerSocketId = room.player1.socketId === socket.id ? room.player2.socketId : room.player1.socketId;
        
        io.to(peerSocketId).emit('opponent_disconnected', { reason: 'Opponent disconnected from the network.' });
        rooms.delete(roomId);

        // If it was a tournament match, reward the remaining player the win by forfeit
        if (roomId.startsWith('tourney_')) {
          const matchParse = roomId.match(/^tourney_([A-Z0-9]+)_R(\d+)_M(\d+)$/);
          if (matchParse) {
            const tCode = matchParse[1];
            const roundNum = parseInt(matchParse[2]);
            const matchIdx = parseInt(matchParse[3]) - 1;
            const tourney = tournaments.get(tCode);
            if (tourney) {
              const winnerPlayer = tourney.players.find(p => p.socketId === peerSocketId);
              
              const roundBracket = tourney.brackets.find(b => b.round === roundNum);
              if (roundBracket && roundBracket.matches[matchIdx] && roundBracket.matches[matchIdx].winner === null) {
                roundBracket.matches[matchIdx].winner = winnerPlayer;
                roundBracket.matches[matchIdx].state = 'RESOLVED';
                
                io.to(tCode).emit('tournament_updated', tourney);
                
                const roundComplete = roundBracket.matches.every(m => m.winner !== null || m.state === 'RESOLVED');
                if (roundComplete) {
                  advanceTournamentRound(tourney);
                }
              }
            }
          }
        }
        break;
      }
    }
  });

  // --- Custom Room Sockets ---
  socket.on('create_custom_room', (userData) => {
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const customRoom = {
      code: roomCode,
      hostId: socket.id,
      players: [{ socketId: socket.id, username: userData.username || 'Host', rank: userData.rank || 'GYMCEL', elo: userData.elo || 1000 }],
      duration: 10,
      state: 'LOBBY'
    };
    customRooms.set(roomCode, customRoom);
    socket.join(roomCode);
    log(`Custom Room Created: ${roomCode} by ${socket.id}`);
    socket.emit('custom_room_created', customRoom);
  });

  socket.on('join_custom_room', ({ code, userData }) => {
    const rCode = code?.toUpperCase();
    const customRoom = customRooms.get(rCode);
    if (!customRoom) {
      socket.emit('custom_room_error', { message: 'Room not found.' });
      return;
    }
    if (customRoom.players.length >= 2) {
      socket.emit('custom_room_error', { message: 'Room is full.' });
      return;
    }
    customRoom.players.push({
      socketId: socket.id,
      username: userData.username || 'Guest',
      rank: userData.rank || 'GYMCEL',
      elo: userData.elo || 1000
    });
    socket.join(rCode);
    log(`Client ${socket.id} joined Custom Room ${rCode}`);
    io.to(rCode).emit('custom_room_updated', customRoom);
  });

  socket.on('update_custom_settings', ({ code, duration }) => {
    const rCode = code?.toUpperCase();
    const customRoom = customRooms.get(rCode);
    if (customRoom && customRoom.hostId === socket.id) {
      customRoom.duration = parseInt(duration) || 10;
      io.to(rCode).emit('custom_room_updated', customRoom);
      log(`Custom Room ${rCode} updated duration to ${duration}`);
    }
  });

  socket.on('start_custom_battle', ({ code }) => {
    const rCode = code?.toUpperCase();
    const customRoom = customRooms.get(rCode);
    if (customRoom && customRoom.hostId === socket.id && customRoom.players.length === 2) {
      customRoom.state = 'FIGHTING';
      const player1 = customRoom.players[0];
      const player2 = customRoom.players[1];
      const battleRoomId = `custom_${rCode}`;
      
      const roomState = {
        roomId: battleRoomId,
        state: 'WAITING',
        duration: customRoom.duration,
        player1: { ...player1, joined: false, ready: false, score: 0, scoreSubmitted: false, details: null, combatType: '' },
        player2: { ...player2, joined: false, ready: false, score: 0, scoreSubmitted: false, details: null, combatType: '' }
      };
      
      rooms.set(battleRoomId, roomState);
      
      // Notify both players in room
      io.to(player1.socketId).emit('match_found', {
        roomId: battleRoomId,
        role: 'player1',
        opponent: { username: player2.username, rank: player2.rank, elo: player2.elo },
        customDuration: customRoom.duration
      });
      io.to(player2.socketId).emit('match_found', {
        roomId: battleRoomId,
        role: 'player2',
        opponent: { username: player1.username, rank: player1.rank, elo: player1.elo },
        customDuration: customRoom.duration
      });
    }
  });

  // --- Tournament Sockets ---
  socket.on('create_tournament', (userData) => {
    const tCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const tournament = {
      code: tCode,
      hostId: socket.id,
      players: [{ socketId: socket.id, username: userData.username || 'Host', elo: userData.elo || 1000 }],
      brackets: [],
      currentRound: 0,
      state: 'LOBBY',
      winner: null
    };
    tournaments.set(tCode, tournament);
    socket.join(tCode);
    log(`Tournament Created: ${tCode} by ${socket.id}`);
    socket.emit('tournament_created', tournament);
  });

  socket.on('join_tournament', ({ code, userData }) => {
    const tCode = code?.toUpperCase();
    const tournament = tournaments.get(tCode);
    if (!tournament) {
      socket.emit('tournament_error', { message: 'Tournament lobby not found.' });
      return;
    }
    if (tournament.players.length >= 4) {
      socket.emit('tournament_error', { message: 'Tournament is full (Max 4 players).' });
      return;
    }
    tournament.players.push({
      socketId: socket.id,
      username: userData.username || 'Guest',
      elo: userData.elo || 1000
    });
    socket.join(tCode);
    log(`Client ${socket.id} joined Tournament ${tCode}`);
    io.to(tCode).emit('tournament_updated', tournament);
  });

  socket.on('start_tournament', ({ code }) => {
    const tCode = code?.toUpperCase();
    const tournament = tournaments.get(tCode);
    if (!tournament) return;
    if (tournament.hostId !== socket.id) return;
    if (tournament.players.length < 4) {
      socket.emit('tournament_error', { message: 'Tournament requires exactly 4 players to start!' });
      return;
    }

    tournament.state = 'RUNNING';
    tournament.currentRound = 1;
    tournament.brackets = [
      {
        round: 1,
        label: 'Semifinals',
        matches: [
          { id: `tourney_${tCode}_R1_M1`, p1: tournament.players[0], p2: tournament.players[1], winner: null, state: 'ACTIVE' },
          { id: `tourney_${tCode}_R1_M2`, p1: tournament.players[2], p2: tournament.players[3], winner: null, state: 'ACTIVE' }
        ]
      },
      {
        round: 2,
        label: 'Finals',
        matches: [
          { id: `tourney_${tCode}_R2_M1`, p1: null, p2: null, winner: null, state: 'WAITING' }
        ]
      }
    ];

    io.to(tCode).emit('tournament_updated', tournament);

    // Initialize the two Semifinal matches on server rooms map
    tournament.brackets[0].matches.forEach(m => {
      rooms.set(m.id, {
        roomId: m.id,
        state: 'WAITING',
        duration: 10,
        player1: { socketId: m.p1.socketId, username: m.p1.username, elo: m.p1.elo, joined: false, ready: false, score: 0, scoreSubmitted: false },
        player2: { socketId: m.p2.socketId, username: m.p2.username, elo: m.p2.elo, joined: false, ready: false, score: 0, scoreSubmitted: false }
      });

      // Direct player client actions
      io.to(m.p1.socketId).emit('tournament_match_ready', { roomId: m.id, role: 'player1', opponent: { username: m.p2.username, elo: m.p2.elo } });
      io.to(m.p2.socketId).emit('tournament_match_ready', { roomId: m.id, role: 'player2', opponent: { username: m.p1.username, elo: m.p1.elo } });
    });
    log(`Tournament ${tCode} started seminals.`);
  });
});

// Simple Matchmaker Loop
function processMatchmaking() {
  if (matchmakingQueue.length < 2) return;

  log(`Processing matchmaking queue. Queue size: ${matchmakingQueue.length}`);
  
  // Take first 2 players
  const player1 = matchmakingQueue.shift();
  const player2 = matchmakingQueue.shift();

  const roomId = `room_${player1.socketId.slice(0, 4)}_${player2.socketId.slice(0, 4)}_${Date.now()}`;
  
  const roomState = {
    roomId,
    state: 'WAITING', // WAITING, COUNTDOWN, FIGHTING, FINISHED
    player1: {
      ...player1,
      joined: false,
      ready: false,
      score: 0,
      scoreSubmitted: false,
      details: null,
      combatType: '',
    },
    player2: {
      ...player2,
      joined: false,
      ready: false,
      score: 0,
      scoreSubmitted: false,
      details: null,
      combatType: '',
    }
  };

  rooms.set(roomId, roomState);
  log(`Match found! Room: ${roomId}. ${player1.username} vs ${player2.username}`);

  // Emit to specific client socket IDs
  io.to(player1.socketId).emit('match_found', {
    roomId,
    role: 'player1',
    opponent: { username: player2.username, rank: player2.rank, elo: player2.elo }
  });

  io.to(player2.socketId).emit('match_found', {
    roomId,
    role: 'player2',
    opponent: { username: player1.username, rank: player1.rank, elo: player1.elo }
  });
}

// Start HTTP Server
httpServer.listen(PORT, () => {
  log(`Express Signaling server running on port ${PORT}`);
  // In development, Vite's mkcert already provides HTTPS for frontend.
});
