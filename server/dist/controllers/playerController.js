"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerController = void 0;
class PlayerController {
    constructor(playerService, roomService) {
        this.playerService = playerService;
        this.roomService = roomService;
        this.handlePlayerJoin = (socket, playerName) => {
            try {
                // Create or reconnect player
                const player = this.playerService.createPlayer(playerName, socket.id);
                // Store player data in socket
                socket.data.playerId = player.id;
                socket.data.playerName = player.name;
                // Notify the player they've joined
                socket.emit('player:joined', player);
                // Broadcast to all other clients that a new player joined
                socket.broadcast.emit('player:joined', player);
                console.log(`Player ${player.name} (${player.id}) joined`);
                // Send current online players list to the new player
                const onlinePlayers = this.playerService.getOnlinePlayers();
                socket.emit('player:list', onlinePlayers);
            }
            catch (error) {
                console.error('Error handling player join:', error);
                socket.emit('error', 'Failed to join the game');
            }
        };
        this.handlePlayerLeave = (socket) => {
            try {
                const player = this.playerService.removePlayer(socket.id);
                if (player) {
                    // Leave any room the player was in
                    if (player.roomId) {
                        this.roomService.leaveRoom(player.roomId, player.id);
                        socket.leave(player.roomId);
                    }
                    // Cancel any active trades
                    const activeTrades = this.roomService.getActiveTradesForPlayer(player.id);
                    activeTrades.forEach(trade => {
                        this.roomService.cancelTrade(trade.id);
                        // Notify other player in the trade
                        const otherPlayerId = trade.initiatorId === player.id ? trade.targetId : trade.initiatorId;
                        const otherPlayer = this.playerService.getPlayer(otherPlayerId);
                        if (otherPlayer && otherPlayer.isOnline) {
                            socket.to(otherPlayer.socketId).emit('trade:cancelled', trade.id, 'Other player disconnected');
                        }
                    });
                    // Broadcast to all clients that player left
                    socket.broadcast.emit('player:left', player.id);
                    console.log(`Player ${player.name} (${player.id}) left`);
                }
            }
            catch (error) {
                console.error('Error handling player leave:', error);
            }
        };
        this.handlePlayerListRequest = (socket) => {
            try {
                const onlinePlayers = this.playerService.getOnlinePlayers();
                socket.emit('player:list', onlinePlayers);
            }
            catch (error) {
                console.error('Error handling player list request:', error);
                socket.emit('error', 'Failed to get player list');
            }
        };
        this.handleDisconnect = (socket) => {
            this.handlePlayerLeave(socket);
        };
    }
}
exports.PlayerController = PlayerController;
//# sourceMappingURL=playerController.js.map