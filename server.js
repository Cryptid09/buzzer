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

// Function to clear leaderboard (reset all buzz times)
function clearLeaderboard() {
  for (const player in gameState.players) {
    gameState.players[player].buzzTime = Infinity;
  }
  gameState.winner = null;
}

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
      // Clear previous round's results when starting new round
      clearLeaderboard();
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
      // Clear leaderboard - reset all buzz times to Infinity
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
      
      // Update or add player with their buzz time
      if (!gameState.players[name]) {
        gameState.players[name] = { buzzTime: reactionTime, connected: true };
      } else {
        gameState.players[name].buzzTime = reactionTime;
      }
      
      // Find the current winner (fastest time)
      let fastestTime = Infinity;
      let currentWinner = null;
      
      for (const player in gameState.players) {
        if (gameState.players[player].buzzTime < fastestTime) {
          fastestTime = gameState.players[player].buzzTime;
          currentWinner = player;
        }
      }
      
      gameState.winner = currentWinner;
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
  // Clear leaderboard on server start/restart
  clearLeaderboard();
  console.log('Leaderboard cleared for new session');
});
