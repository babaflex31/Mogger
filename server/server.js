import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
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

// Helper functions
const log = (...args) => console.log(`[MOG-SERVER]`, ...args);

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
    }
  });

  // Client disconnected
  socket.on('disconnect', () => {
    log(`Client disconnected: ${socket.id}`);
    
    // Remove from queue
    matchmakingQueue = matchmakingQueue.filter(u => u.socketId !== socket.id);
    
    // Find room the user was in
    for (const [roomId, room] of rooms.entries()) {
      if (room.player1.socketId === socket.id || room.player2.socketId === socket.id) {
        log(`Player in room ${roomId} disconnected.`);
        const peerSocketId = room.player1.socketId === socket.id ? room.player2.socketId : room.player1.socketId;
        
        io.to(peerSocketId).emit('opponent_disconnected', { reason: 'Opponent disconnected from the network.' });
        rooms.delete(roomId);
        break;
      }
    }
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
});
