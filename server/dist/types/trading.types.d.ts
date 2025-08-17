import { Player, LootItem } from './player.types';
export interface TradingRoom {
    id: string;
    name: string;
    players: Player[];
    maxPlayers: number;
    isPrivate: boolean;
    activeTrades: TradeSession[];
    createdAt: Date;
    createdBy: string;
}
export interface TradeSession {
    id: string;
    roomId: string;
    initiatorId: string;
    targetId: string;
    status: 'INITIATED' | 'COMMITTED' | 'REVEALED' | 'COMPLETED' | 'CANCELLED';
    initiatorItems: LootItem[];
    targetItems: LootItem[];
    initiatorCommitment?: string;
    targetCommitment?: string;
    initiatorNonce?: string;
    targetNonce?: string;
    createdAt: Date;
    completedAt?: Date;
    timeoutAt: Date;
}
export interface TradeCommitment {
    tradeId: string;
    playerId: string;
    commitment: string;
    timestamp: Date;
}
export interface TradeReveal {
    tradeId: string;
    playerId: string;
    nonce: string;
    items: LootItem[];
    timestamp: Date;
}
export interface TradeOffer {
    fromPlayerId: string;
    toPlayerId: string;
    offeredItems: LootItem[];
    requestedItems?: LootItem[];
    message?: string;
}
//# sourceMappingURL=trading.types.d.ts.map