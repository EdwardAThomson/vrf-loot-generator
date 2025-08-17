"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerService = void 0;
const uuid_1 = require("uuid");
class PlayerService {
    constructor() {
        this.players = new Map();
        this.sessions = new Map(); // socketId -> session
    }
    createPlayer(name, socketId) {
        const player = {
            id: (0, uuid_1.v4)(),
            name,
            socketId,
            isOnline: true,
            joinedAt: new Date(),
            lastSeen: new Date(),
            inventory: []
        };
        this.players.set(player.id, player);
        this.sessions.set(socketId, {
            playerId: player.id,
            socketId,
            connectedAt: new Date()
        });
        return player;
    }
    getPlayer(playerId) {
        return this.players.get(playerId);
    }
    getPlayerBySocketId(socketId) {
        const session = this.sessions.get(socketId);
        if (!session)
            return undefined;
        return this.players.get(session.playerId);
    }
    updatePlayerSocket(playerId, newSocketId) {
        const player = this.players.get(playerId);
        if (player) {
            // Remove old session
            this.sessions.delete(player.socketId);
            // Update player and create new session
            player.socketId = newSocketId;
            player.isOnline = true;
            player.lastSeen = new Date();
            this.sessions.set(newSocketId, {
                playerId,
                socketId: newSocketId,
                connectedAt: new Date()
            });
        }
    }
    removePlayer(socketId) {
        const session = this.sessions.get(socketId);
        if (!session)
            return undefined;
        const player = this.players.get(session.playerId);
        if (player) {
            player.isOnline = false;
            player.lastSeen = new Date();
        }
        this.sessions.delete(socketId);
        return player;
    }
    getOnlinePlayers() {
        return Array.from(this.players.values()).filter(player => player.isOnline);
    }
    getPlayersInRoom(roomId) {
        return Array.from(this.players.values()).filter(player => player.isOnline && player.roomId === roomId);
    }
    joinRoom(playerId, roomId) {
        const player = this.players.get(playerId);
        if (!player)
            return false;
        player.roomId = roomId;
        return true;
    }
    leaveRoom(playerId) {
        const player = this.players.get(playerId);
        if (!player)
            return false;
        player.roomId = undefined;
        return true;
    }
    updatePlayerInventory(playerId, inventory) {
        const player = this.players.get(playerId);
        if (!player)
            return false;
        player.inventory = inventory;
        return true;
    }
    // Cleanup inactive players (optional - for production)
    cleanupInactivePlayers(maxInactiveMinutes = 30) {
        const cutoff = new Date(Date.now() - maxInactiveMinutes * 60 * 1000);
        for (const [playerId, player] of this.players.entries()) {
            if (!player.isOnline && player.lastSeen < cutoff) {
                this.players.delete(playerId);
            }
        }
    }
}
exports.PlayerService = PlayerService;
//# sourceMappingURL=playerService.js.map