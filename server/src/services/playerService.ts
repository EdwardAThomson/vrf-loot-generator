import { v4 as uuidv4 } from 'uuid';
import { Player, PlayerSession } from '../types/player.types';

export class PlayerService {
  private static instance: PlayerService;
  private players: Map<string, Player> = new Map();
  private sessions: Map<string, PlayerSession> = new Map(); // socketId -> session

  private constructor() {}

  public static getInstance(): PlayerService {
    if (!PlayerService.instance) {
      PlayerService.instance = new PlayerService();
    }
    return PlayerService.instance;
  }

  createPlayer(name: string, socketId: string): Player {
    const player: Player = {
      id: uuidv4(),
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

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  getPlayerBySocketId(socketId: string): Player | undefined {
    const session = this.sessions.get(socketId);
    if (!session) return undefined;
    return this.players.get(session.playerId);
  }

  updatePlayerSocket(playerId: string, newSocketId: string): void {
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

  removePlayer(socketId: string): Player | undefined {
    const session = this.sessions.get(socketId);
    if (!session) return undefined;

    const player = this.players.get(session.playerId);
    if (player) {
      player.isOnline = false;
      player.lastSeen = new Date();
    }

    this.sessions.delete(socketId);
    return player;
  }

  getOnlinePlayers(): Player[] {
    return Array.from(this.players.values()).filter(player => player.isOnline);
  }

  getPlayersInRoom(roomId: string): Player[] {
    return Array.from(this.players.values()).filter(
      player => player.isOnline && player.roomId === roomId
    );
  }

  joinRoom(playerId: string, roomId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    player.roomId = roomId;
    return true;
  }

  leaveRoom(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    player.roomId = undefined;
    return true;
  }

  updatePlayerInventory(playerId: string, inventory: any[]): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    player.inventory = inventory;
    return true;
  }

  // Cleanup inactive players (optional - for production)
  cleanupInactivePlayers(maxInactiveMinutes: number = 30): void {
    const cutoff = new Date(Date.now() - maxInactiveMinutes * 60 * 1000);
    
    for (const [playerId, player] of this.players.entries()) {
      if (!player.isOnline && player.lastSeen < cutoff) {
        this.players.delete(playerId);
      }
    }
  }
}
