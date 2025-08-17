import { Player } from './player.types';
import { TradingRoom, TradeSession } from './trading.types';

export interface SocketMessage {
  type: 'PLAYER_JOIN' | 'PLAYER_LEAVE' | 'ROOM_JOIN' | 'ROOM_LEAVE' | 
        'TRADE_INITIATE' | 'TRADE_COMMIT' | 'TRADE_REVEAL' | 'TRADE_COMPLETE' |
        'TRADE_CANCEL' | 'PLAYER_LIST_REQUEST' | 'ROOM_LIST_REQUEST';
  playerId: string;
  roomId?: string;
  payload: any;
  timestamp: number;
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
  'trade:revealed': (tradeId: string, playerId: string, items: any[]) => void;
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
  'trade:initiate': (targetPlayerId: string, offeredItems: any[]) => void;
  'trade:commit': (tradeId: string, commitment: string) => void;
  'trade:reveal': (tradeId: string, nonce: string, items: any[]) => void;
  'trade:accept': (tradeId: string) => void;
  'trade:cancel': (tradeId: string) => void;
  'player:list': () => void;
  'room:list': () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  playerId: string;
  playerName: string;
  roomId?: string;
}
