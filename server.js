// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (HTML, CSS, JS)
app.use(express.static(__dirname));

// Game state
let gameState = {
  buzzersLocked: true,
  players: {},
  winner: null,
  startTime: null,
  adminLoggedIn: false,
  leaderboard: [] // Add leaderboard array
};

let adminSockets = new Set();

// Socket.IO events
io.on('connection', (socket) => {
  // Send initial state
  socket.emit('state', gameState);

  // Player registration
  socket.on('register', (name) => {
    if (!gameState.players[name]) {
      gameState.players[name] = { buzzTime: Infinity, connected: true };
      io.emit('state', gameState);
    }
  });

  // Admin login
  socket.on('admin-login', ({ username, password }) => {
    if (username === 'Admin' && password === 'Admin@#@#') {
      adminSockets.add(socket.id);
      gameState.adminLoggedIn = true;
      io.emit('state', gameState);
      socket.emit('admin-login-success');
    } else {
      socket.emit('admin-login-fail');
    }
  });

  // Start buzzer
  socket.on('start-buzzer', () => {
    if (adminSockets.has(socket.id)) {
      gameState.buzzersLocked = false;
      gameState.winner = null;
      for (const player in gameState.players) {
        gameState.players[player].buzzTime = Infinity;
        gameState.players[player].locked = false; // unlock all players
      }
      gameState.leaderboard = [];
      gameState.startTime = Date.now();
      io.emit('state', gameState);
    }
  });

  // Handle buzzer press
  socket.on('buzz', (name) => {
    if (!gameState.buzzersLocked && gameState.startTime && name) {
      // Register player if not already present
      if (!gameState.players[name]) {
        gameState.players[name] = { buzzTime: Infinity, connected: true, locked: false };
      }
      // If player already buzzed/locked, ignore
      if (gameState.players[name].locked) return;

      const reactionTime = (Date.now() - gameState.startTime) / 1000;
      gameState.players[name].buzzTime = reactionTime;
      gameState.players[name].locked = true;

      // Update leaderboard: remove old entry if exists, then add new
      gameState.leaderboard = gameState.leaderboard.filter(entry => entry.name !== name);
      gameState.leaderboard.push({ name, buzzTime: reactionTime });

      // Set winner if not already set (first buzz)
      if (!gameState.winner) {
        gameState.winner = name;
      }

      io.emit('state', gameState);
    }
  });

  // Lock buzzers (admin)
  socket.on('lock-buzzers', () => {
    if (adminSockets.has(socket.id)) {
      gameState.buzzersLocked = true;
      io.emit('state', gameState);
    }
  });

  // Reset buzzers
  socket.on('reset-buzzers', () => {
    if (adminSockets.has(socket.id)) {
      gameState.buzzersLocked = true;
      gameState.winner = null;
      for (const player in gameState.players) {
        gameState.players[player].buzzTime = Infinity;
      }
      io.emit('state', gameState);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    adminSockets.delete(socket.id);
    if (adminSockets.size === 0) {
      gameState.adminLoggedIn = false;
      io.emit('state', gameState);
    }
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
