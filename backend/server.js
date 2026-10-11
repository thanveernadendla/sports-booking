try {
  require('dns').setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { PORT } = require('./config/constants');
const { connectDB } = require('./config/db');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});

app.set('io', io);

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config/constants');

io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
    } catch (err) {
      console.log('[Socket.io] Handshake token verification failed:', err.message);
    }
  }
  next();
});

io.on('connection', (socket) => {
  if (socket.user) {
    socket.join(`user_${socket.user.id}`);
    if (socket.user.role === 'admin') {
      socket.join('admin_room');
    }
    console.log(`[Socket.io] Authenticated client connected: ${socket.id} (User: ${socket.user.id}, Role: ${socket.user.role})`);
  } else {
    console.log('[Socket.io] Public client connected:', socket.id);
  }

  socket.on('authenticate', (data) => {
    if (data && data.token) {
      try {
        const decoded = jwt.verify(data.token, JWT_SECRET);
        socket.user = decoded;
        socket.join(`user_${decoded.id}`);
        if (decoded.role === 'admin') {
          socket.join('admin_room');
        }
        socket.emit('authenticated', { success: true, userId: decoded.id, role: decoded.role });
        console.log(`[Socket.io] Socket ${socket.id} dynamically authenticated as User: ${decoded.id}, Role: ${decoded.role}`);
      } catch (err) {
        socket.emit('auth_error', { message: 'Invalid or expired token' });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('[Socket.io] Client disconnected:', socket.id);
  });
});

if (require.main === module) {
  connectDB().then(() => {
    server.listen(PORT, () => {
      console.log(`SportZone Server with Socket.io is running on http://localhost:${PORT}`);
    });
  }).catch(err => {
    console.error('Failed to start server due to MongoDB connection error:', err);
    process.exit(1);
  });
}

module.exports = app;


