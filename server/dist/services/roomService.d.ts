import { TradingRoom, TradeSession } from '../types/trading.types';
import { Player } from '../types/player.types';
export declare class RoomService {
    private rooms;
    private activeTrades;
    createRoom(name: string, createdBy: string, isPrivate?: boolean, maxPlayers?: number): TradingRoom;
    getRoom(roomId: string): TradingRoom | undefined;
    getAllRooms(): TradingRoom[];
    getPublicRooms(): TradingRoom[];
    joinRoom(roomId: string, player: Player): boolean;
    leaveRoom(roomId: string, playerId: string): boolean;
    createTrade(roomId: string, initiatorId: string, targetId: string, initiatorItems: any[]): TradeSession | null;
    getTrade(tradeId: string): TradeSession | undefined;
    updateTradeStatus(tradeId: string, status: TradeSession['status']): boolean;
    commitTrade(tradeId: string, playerId: string, commitment: string): boolean;
    revealTrade(tradeId: string, playerId: string, nonce: string, items: any[]): boolean;
    completeTrade(tradeId: string): boolean;
    cancelTrade(tradeId: string): boolean;
    getActiveTradesForPlayer(playerId: string): TradeSession[];
    cleanupExpiredTrades(): void;
}
//# sourceMappingURL=roomService.d.ts.map