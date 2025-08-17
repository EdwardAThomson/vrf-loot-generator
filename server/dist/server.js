"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const playerService_1 = require("./services/playerService");
const roomService_1 = require("./services/roomService");
const playerController_1 = require("./controllers/playerController");
const roomController_1 = require("./controllers/roomController");
const tradingController_1 = require("./controllers/tradingController");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
// CORS configuration for production
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? process.env.CORS_ORIGIN || "https://localhost:3000"
        : process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true
};
app.use((0, cors_1.default)(corsOptions));
// Initialize Socket.IO with proper typing
const io = new socket_io_1.Server(server, {
    cors: {
        origin: corsOptions.origin,
        methods: ['GET', 'POST'],
        credentials: true
    }
});
// Initialize services
const playerService = new playerService_1.PlayerService();
const roomService = new roomService_1.RoomService();
// Initialize controllers
const playerController = new playerController_1.PlayerController(playerService, roomService);
const roomController = new roomController_1.RoomController(playerService, roomService);
const tradingController = new tradingController_1.TradingController(playerService, roomService);
// Create a default public room
const defaultRoom = roomService.createRoom('General Trading', 'system', false, 50);
console.log(`Created default room: ${defaultRoom.name} (${defaultRoom.id})`);
// Socket connection handling
io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    // Player events
    socket.on('player:join', (playerName) => {
        playerController.handlePlayerJoin(socket, playerName);
    });
    socket.on('player:leave', () => {
        playerController.handlePlayerLeave(socket);
    });
    socket.on('player:list', () => {
        playerController.handlePlayerListRequest(socket);
    });
    // Room events
    socket.on('room:create', (roomName, isPrivate) => {
        roomController.handleRoomCreate(socket, roomName, isPrivate);
    });
    socket.on('room:join', (roomId) => {
        roomController.handleRoomJoin(socket, roomId);
    });
    socket.on('room:leave', () => {
        roomController.handleRoomLeave(socket);
    });
    socket.on('room:list', () => {
        roomController.handleRoomListRequest(socket);
    });
    // Trading events
    socket.on('trade:initiate', (targetPlayerId, offeredItems) => {
        tradingController.handleTradeInitiate(socket, targetPlayerId, offeredItems);
    });
    socket.on('trade:commit', (tradeId, commitment) => {
        tradingController.handleTradeCommit(socket, tradeId, commitment);
    });
    socket.on('trade:reveal', (tradeId, nonce, items) => {
        tradingController.handleTradeReveal(socket, tradeId, nonce, items);
    });
    socket.on('trade:accept', (tradeId) => {
        tradingController.handleTradeAccept(socket, tradeId);
    });
    socket.on('trade:cancel', (tradeId) => {
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
    console.log(`🏠 Default room created: ${defaultRoom.name}`);
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
//# sourceMappingURL=server.js.map