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
  };
}

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

export interface ServerToClientEvents {
  'player:joined': (player: Player) => void;
  'player:left': (playerId: string) => void;
  'player:list': (players: Player[]) => void;
  'room:joined': (room: TradingRoom) => void;
  'room:left': (roomId: string) => void;
  'room:list': (rooms: TradingRoom[]) => void;
  'trade:initiated': (trade: TradeSession) => void;
  'trade:committed': (tradeId: string, playerId: string) => void;
  'trade:revealed': (tradeId: string, playerId: string, items: LootItem[]) => void;
  'trade:completed': (trade: TradeSession) => void;
  'trade:cancelled': (tradeId: string, reason: string) => void;
  'error': (message: string) => void;
}

export interface ClientToServerEvents {
  'player:join': (playerName: string) => void;
  'player:leave': () => void;
  'room:join': (roomId: string) => void;
  'room:leave': () => void;
  'room:create': (roomName: string, isPrivate: boolean) => void;
  'trade:initiate': (targetPlayerId: string, offeredItems: LootItem[]) => void;
  'trade:commit': (tradeId: string, commitment: string) => void;
  'trade:reveal': (tradeId: string, nonce: string, items: LootItem[]) => void;
  'trade:accept': (tradeId: string) => void;
  'trade:cancel': (tradeId: string) => void;
  'player:list': () => void;
  'room:list': () => void;
}

export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  currentPlayer: Player | null;
  currentRoom: TradingRoom | null;
  onlinePlayers: Player[];
  availableRooms: TradingRoom[];
  activeTrades: TradeSession[];
}
