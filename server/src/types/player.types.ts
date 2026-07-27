export interface Player {
  id: string;
  name: string;
  socketId: string;
  roomId?: string;
  isOnline: boolean;
  joinedAt: Date;
  lastSeen: Date;
  inventory?: LootItem[];
}

export interface LootItem {
  id: string;
  name: string;
  type: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  modifier?: string;
  vrfProof: {
    publicKey: string;
    proof: string;
    message: string;
    hash: string;
    blockhash?: string;
    itemIndex?: number;
  };
}

export interface PlayerSession {
  playerId: string;
  socketId: string;
  connectedAt: Date;
  roomId?: string;
}
