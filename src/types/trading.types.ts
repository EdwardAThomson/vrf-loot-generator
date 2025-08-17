// Trading-related type definitions

import { LootItem } from './loot.types';
import { TradeCommitment } from '../services/trading/commit-reveal.service';

export interface Player {
  id: string;
  name: string;
  isOnline: boolean;
  lastSeen: string | null;
  inTrade?: boolean;
}

export interface TradeRequest {
  id: number;
  initiator: string;
  initiatorPlayerId: string;
  initiatorPlayerName: string;
  target: string;
  targetPlayerId: string;
  targetPlayerName: string;
  offeredItems: LootItem[];
  requestedItems: LootItem[];
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  createdAt: string;
  timestamp: number;
}

export type TradePhase = 'idle' | 'requesting' | 'negotiating' | 'committed' | 'revealed' | 'completed';

export interface TradingStoreState {
  isTradeActive: boolean;
  currentTrade: TradeRequest | null;
  tradeRequests: TradeRequest[];
  connectedPlayers: Player[];
  playerId: string | null;
  playerName: string;
  tradePhase: TradePhase;
  commitment: string | null;
  reveal: string | null;
  partnerCommitment: string | null;
  partnerReveal: string | null;
  tradeSessionId: string | null;
  tradeCommitment: TradeCommitment | null;
  validationErrors: string[];
  fairnessAssessment: {
    isFair: boolean;
    player1Value: number;
    player2Value: number;
    suggestion?: string;
  } | null;
}

export interface TradingStoreActions {
  setPlayerId: (id: string) => void;
  setPlayerName: (name: string) => void;
  updateConnectedPlayers: (players: Player[]) => void;
  initiateTradeWith: (targetPlayerId: string, targetPlayerName: string, offeredItems: LootItem[], initiatorPublicKey: string) => void;
  receiveTradeRequest: (tradeRequest: TradeRequest) => void;
  acceptTradeRequest: (tradeId: number) => void;
  rejectTradeRequest: (tradeId: number) => void;
  updateTradeOffer: (offeredItems: LootItem[], requestedItems: LootItem[]) => void;
  commitToTrade: (offeredItems: LootItem[]) => void;
  receivePartnerCommitment: (partnerCommitment: string) => void;
  revealTrade: () => void;
  receivePartnerReveal: (partnerReveal: string) => void;
  completeTrade: () => void;
  cancelTrade: () => void;
  clearTradeRequests: () => void;
  getActiveTradePartner: () => { id: string; name: string } | null;
  isTradeReady: () => boolean;
  canReveal: () => boolean;
  isTradeCompleted: () => boolean;
}

export interface PlayersStoreState {
  currentPlayer: Player;
  onlinePlayers: Player[];
  allPlayers: Player[];
}

export interface PlayersStoreActions {
  setCurrentPlayer: (player: Partial<Player>) => void;
  setPlayerOnline: (isOnline: boolean) => void;
  updateOnlinePlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  updatePlayerStatus: (playerId: string, status: Partial<Player>) => void;
  clearAllPlayers: () => void;
  getPlayerById: (playerId: string) => Player | undefined;
  getOnlinePlayersCount: () => number;
  getAvailablePlayersForTrade: () => Player[];
  isPlayerOnline: (playerId: string) => boolean;
}
