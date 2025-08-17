import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import { PlayerService } from './services/playerService';
import { RoomService } from './services/roomService';
import { PlayerController } from './controllers/playerController';
import { RoomController } from './controllers/roomController';
import { TradingController } from './controllers/tradingController';

import { 
  ServerToClientEvents, 
  ClientToServerEvents, 
  InterServerEvents, 
  SocketData 
} from './types/socket.types';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

// CORS configuration for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CORS_ORIGIN || "https://localhost:3000"
    : process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
};

app.use(cors(corsOptions));

// Initialize Socket.IO with proper typing
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server, {
  cors: {
    origin: corsOptions.origin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Initialize services
const playerService = PlayerService.getInstance();
const roomService = RoomService.getInstance();

// Initialize controllers
const playerController = new PlayerController(io, playerService, roomService);
const roomController = new RoomController(io, playerService, roomService);
const tradingController = new TradingController(io, playerService, roomService);

// Default room is created within the RoomService constructor.

// Socket connection handling
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Player events
  socket.on('player:join', (playerName: string) => {
    playerController.handlePlayerJoin(socket, playerName);
  });

  socket.on('player:leave', () => {
    playerController.handlePlayerLeave(socket);
  });

  socket.on('player:list', () => {
    playerController.handlePlayerListRequest(socket);
  });

  // Room events
  socket.on('room:create', (roomName: string, isPrivate: boolean) => {
    roomController.handleRoomCreate(socket, roomName, isPrivate);
  });

  socket.on('room:join', (roomId: string) => {
    roomController.handleRoomJoin(socket, roomId);
  });

  socket.on('room:leave', () => {
    roomController.handleRoomLeave(socket);
  });

  socket.on('room:list', () => {
    roomController.handleRoomListRequest(socket);
  });

  // Trading events
  socket.on('trade:initiate', (targetPlayerId: string, offeredItems: any[]) => {
    tradingController.handleTradeInitiate(socket, targetPlayerId, offeredItems);
  });

  socket.on('trade:commit', (tradeId: string, commitment: string) => {
    tradingController.handleTradeCommit(socket, tradeId, commitment);
  });

  socket.on('trade:reveal', (tradeId: string, nonce: string, items: any[]) => {
    tradingController.handleTradeReveal(socket, tradeId, nonce, items);
  });

  socket.on('trade:accept', (tradeId: string) => {
    tradingController.handleTradeAccept(socket, tradeId);
  });

  socket.on('trade:cancel', (tradeId: string) => {
    tradingController.handleTradeCancel(socket, tradeId);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    playerController.handleDisconnect(socket);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    players: playerService.getOnlinePlayers().length,
    rooms: roomService.getAllRooms().length
  });
});

// Basic info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'VRF Loot Trading Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      websocket: 'ws://localhost:3001'
    }
  });
});

// Cleanup tasks (run every 5 minutes)
setInterval(() => {
  playerService.cleanupInactivePlayers(30); // Remove players inactive for 30+ minutes
  roomService.cleanupExpiredTrades(); // Remove expired trades
}, 5 * 60 * 1000);

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 VRF Loot Trading Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`🌐 CORS origin: ${corsOptions.origin}`);
  // console.log(`🏠 Default room created: ${defaultRoom.name}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
