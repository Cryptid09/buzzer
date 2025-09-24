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
  adminLoggedIn: false
};

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
      gameState.adminLoggedIn = true;
      io.emit('state', gameState);
      socket.emit('admin-login-success');
    } else {
      socket.emit('admin-login-fail');
    }
  });

  // Start buzzer
  socket.on('start-buzzer', () => {
    if (gameState.adminLoggedIn) {
      gameState.buzzersLocked = false;
      gameState.startTime = Date.now();
      io.emit('state', gameState);
    }
  });

  // Lock buzzers
  socket.on('lock-buzzers', () => {
    if (gameState.adminLoggedIn) {
      gameState.buzzersLocked = true;
      io.emit('state', gameState);
    }
  });

  // Reset buzzers
  socket.on('reset-buzzers', () => {
    if (gameState.adminLoggedIn) {
      gameState.buzzersLocked = true;
      gameState.winner = null;
      for (const player in gameState.players) {
        gameState.players[player].buzzTime = Infinity;
      }
      io.emit('state', gameState);
    }
  });

  // Handle buzzer press
  socket.on('buzz', (name) => {
    if (!gameState.buzzersLocked && gameState.startTime && name) {
      const reactionTime = (Date.now() - gameState.startTime) / 1000;
      if (!gameState.players[name]) {
        gameState.players[name] = { buzzTime: reactionTime, connected: true };
      } else if (reactionTime < gameState.players[name].buzzTime) {
        gameState.players[name].buzzTime = reactionTime;
      }
      // Determine winner
      let isWinner = true;
      for (const player in gameState.players) {
        if (gameState.players[player].buzzTime < reactionTime) {
          isWinner = false;
          break;
        }
      }
      if (isWinner) {
        gameState.winner = name;
      }
      gameState.buzzersLocked = true;
      io.emit('state', gameState);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    // Optionally handle player disconnects
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
