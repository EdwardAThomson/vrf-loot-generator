"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomController = void 0;
class RoomController {
    constructor(playerService, roomService) {
        this.playerService = playerService;
        this.roomService = roomService;
        this.handleRoomCreate = (socket, roomName, isPrivate) => {
            try {
                const playerId = socket.data.playerId;
                if (!playerId) {
                    socket.emit('error', 'Player not authenticated');
                    return;
                }
                const room = this.roomService.createRoom(roomName, playerId, isPrivate);
                console.log(`Room ${room.name} (${room.id}) created by ${socket.data.playerName}`);
                // Auto-join the creator to the room
                this.handleRoomJoin(socket, room.id);
            }
            catch (error) {
                console.error('Error creating room:', error);
                socket.emit('error', 'Failed to create room');
            }
        };
        this.handleRoomJoin = (socket, roomId) => {
            try {
                const playerId = socket.data.playerId;
                if (!playerId) {
                    socket.emit('error', 'Player not authenticated');
                    return;
                }
                const player = this.playerService.getPlayer(playerId);
                const room = this.roomService.getRoom(roomId);
                if (!player || !room) {
                    socket.emit('error', 'Player or room not found');
                    return;
                }
                // Leave current room if in one
                if (player.roomId) {
                    this.handleRoomLeave(socket);
                }
                // Join the new room
                const success = this.roomService.joinRoom(roomId, player);
                if (!success) {
                    socket.emit('error', 'Failed to join room (room may be full)');
                    return;
                }
                // Update player's room
                this.playerService.joinRoom(playerId, roomId);
                socket.data.roomId = roomId;
                // Join socket room for broadcasting
                socket.join(roomId);
                // Notify player they joined
                socket.emit('room:joined', room);
                // Notify other players in the room
                socket.to(roomId).emit('player:joined', player);
                console.log(`Player ${player.name} joined room ${room.name}`);
            }
            catch (error) {
                console.error('Error joining room:', error);
                socket.emit('error', 'Failed to join room');
            }
        };
        this.handleRoomLeave = (socket) => {
            try {
                const playerId = socket.data.playerId;
                const roomId = socket.data.roomId;
                if (!playerId || !roomId) {
                    return; // Player not in a room
                }
                const player = this.playerService.getPlayer(playerId);
                if (!player)
                    return;
                // Cancel any active trades in this room
                const activeTrades = this.roomService.getActiveTradesForPlayer(playerId);
                activeTrades.forEach(trade => {
                    if (trade.roomId === roomId) {
                        this.roomService.cancelTrade(trade.id);
                        // Notify other player
                        const otherPlayerId = trade.initiatorId === playerId ? trade.targetId : trade.initiatorId;
                        const otherPlayer = this.playerService.getPlayer(otherPlayerId);
                        if (otherPlayer && otherPlayer.isOnline) {
                            socket.to(otherPlayer.socketId).emit('trade:cancelled', trade.id, 'Player left room');
                        }
                    }
                });
                // Leave the room
                this.roomService.leaveRoom(roomId, playerId);
                this.playerService.leaveRoom(playerId);
                // Leave socket room
                socket.leave(roomId);
                // Clear room data from socket
                socket.data.roomId = undefined;
                // Notify other players in the room
                socket.to(roomId).emit('player:left', playerId);
                // Notify the player they left
                socket.emit('room:left', roomId);
                console.log(`Player ${player.name} left room ${roomId}`);
            }
            catch (error) {
                console.error('Error leaving room:', error);
                socket.emit('error', 'Failed to leave room');
            }
        };
        this.handleRoomListRequest = (socket) => {
            try {
                const publicRooms = this.roomService.getPublicRooms();
                socket.emit('room:list', publicRooms);
            }
            catch (error) {
                console.error('Error getting room list:', error);
                socket.emit('error', 'Failed to get room list');
            }
        };
    }
}
exports.RoomController = RoomController;
//# sourceMappingURL=roomController.js.map