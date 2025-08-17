import { v4 as uuidv4 } from 'uuid';
import { TradingRoom, TradeSession } from '../types/trading.types';
import { Player } from '../types/player.types';

export class RoomService {
  private rooms: Map<string, TradingRoom> = new Map();
  private activeTrades: Map<string, TradeSession> = new Map();

  createRoom(name: string, createdBy: string, isPrivate: boolean = false, maxPlayers: number = 10): TradingRoom {
    const room: TradingRoom = {
      id: uuidv4(),
      name,
      players: [],
      maxPlayers,
      isPrivate,
      activeTrades: [],
      createdAt: new Date(),
      createdBy
    };

    this.rooms.set(room.id, room);
    return room;
  }

  getRoom(roomId: string): TradingRoom | undefined {
    return this.rooms.get(roomId);
  }

  getAllRooms(): TradingRoom[] {
    return Array.from(this.rooms.values());
  }

  getPublicRooms(): TradingRoom[] {
    return Array.from(this.rooms.values()).filter(room => !room.isPrivate);
  }

  joinRoom(roomId: string, player: Player): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    // Check if room is full
    if (room.players.length >= room.maxPlayers) return false;

    // Check if player is already in room
    if (room.players.some(p => p.id === player.id)) return true;

    room.players.push(player);
    return true;
  }

  leaveRoom(roomId: string, playerId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return false;

    room.players.splice(playerIndex, 1);

    // Remove empty rooms (except if they have active trades)
    if (room.players.length === 0 && room.activeTrades.length === 0) {
      this.rooms.delete(roomId);
    }

    return true;
  }

  createTrade(roomId: string, initiatorId: string, targetId: string, initiatorItems: any[]): TradeSession | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    // Check if both players are in the room
    const initiator = room.players.find(p => p.id === initiatorId);
    const target = room.players.find(p => p.id === targetId);
    if (!initiator || !target) return null;

    // Check if players are already in a trade
    const existingTrade = this.activeTrades.get(`${initiatorId}-${targetId}`) || 
                         this.activeTrades.get(`${targetId}-${initiatorId}`);
    if (existingTrade) return null;

    const trade: TradeSession = {
      id: uuidv4(),
      roomId,
      initiatorId,
      targetId,
      status: 'INITIATED',
      initiatorItems,
      targetItems: [],
      createdAt: new Date(),
      timeoutAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minute timeout
    };

    this.activeTrades.set(trade.id, trade);
    room.activeTrades.push(trade);

    return trade;
  }

  getTrade(tradeId: string): TradeSession | undefined {
    return this.activeTrades.get(tradeId);
  }

  updateTradeStatus(tradeId: string, status: TradeSession['status']): boolean {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) return false;

    trade.status = status;
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      trade.completedAt = new Date();
    }

    return true;
  }

  commitTrade(tradeId: string, playerId: string, commitment: string): boolean {
    const trade = this.activeTrades.get(tradeId);
    if (!trade || trade.status !== 'INITIATED') return false;

    if (trade.initiatorId === playerId) {
      trade.initiatorCommitment = commitment;
    } else if (trade.targetId === playerId) {
      trade.targetCommitment = commitment;
    } else {
      return false;
    }

    // If both players have committed, move to COMMITTED status
    if (trade.initiatorCommitment && trade.targetCommitment) {
      trade.status = 'COMMITTED';
    }

    return true;
  }

  revealTrade(tradeId: string, playerId: string, nonce: string, items: any[]): boolean {
    const trade = this.activeTrades.get(tradeId);
    if (!trade || trade.status !== 'COMMITTED') return false;

    if (trade.initiatorId === playerId) {
      trade.initiatorNonce = nonce;
      // Items were already set during initiation for initiator
    } else if (trade.targetId === playerId) {
      trade.targetNonce = nonce;
      trade.targetItems = items;
    } else {
      return false;
    }

    // If both players have revealed, move to REVEALED status
    if (trade.initiatorNonce && trade.targetNonce) {
      trade.status = 'REVEALED';
    }

    return true;
  }

  completeTrade(tradeId: string): boolean {
    const trade = this.activeTrades.get(tradeId);
    if (!trade || trade.status !== 'REVEALED') return false;

    trade.status = 'COMPLETED';
    trade.completedAt = new Date();

    // Remove from active trades
    this.activeTrades.delete(tradeId);

    // Remove from room's active trades
    const room = this.rooms.get(trade.roomId);
    if (room) {
      const tradeIndex = room.activeTrades.findIndex(t => t.id === tradeId);
      if (tradeIndex !== -1) {
        room.activeTrades.splice(tradeIndex, 1);
      }
    }

    return true;
  }

  cancelTrade(tradeId: string): boolean {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) return false;

    trade.status = 'CANCELLED';
    trade.completedAt = new Date();

    // Remove from active trades
    this.activeTrades.delete(tradeId);

    // Remove from room's active trades
    const room = this.rooms.get(trade.roomId);
    if (room) {
      const tradeIndex = room.activeTrades.findIndex(t => t.id === tradeId);
      if (tradeIndex !== -1) {
        room.activeTrades.splice(tradeIndex, 1);
      }
    }

    return true;
  }

  getActiveTradesForPlayer(playerId: string): TradeSession[] {
    return Array.from(this.activeTrades.values()).filter(
      trade => trade.initiatorId === playerId || trade.targetId === playerId
    );
  }

  // Cleanup expired trades
  cleanupExpiredTrades(): void {
    const now = new Date();
    
    for (const [tradeId, trade] of this.activeTrades.entries()) {
      if (trade.timeoutAt < now && trade.status !== 'COMPLETED') {
        this.cancelTrade(tradeId);
      }
    }
  }
}
