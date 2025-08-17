// Custom hook for trading operations
// Separates trading logic from UI components

import { useCallback } from 'react';
import useTradingStore from '../store/trading.store';
import { useInventoryStore } from '../store/index';
import { LootItem } from '../types/loot.types';
import { Player, TradeRequest } from '../types/trading.types';
import { TradingService } from '../services/trading/trading.service';

/**
 * Custom hook for trading operations with clean API
 */
export const useTrading = () => {
  // Get trading store state and actions
  const {
    isTradeActive,
    currentTrade,
    tradeRequests,
    connectedPlayers,
    playerId,
    playerName,
    tradePhase,
    validationErrors,
    fairnessAssessment,
    tradeSessionId,
    // Actions
    setPlayerId,
    setPlayerName,
    updateConnectedPlayers,
    initiateTradeWith,
    receiveTradeRequest,
    acceptTradeRequest,
    rejectTradeRequest,
    updateTradeOffer,
    commitToTrade,
    receivePartnerCommitment,
    revealTrade,
    receivePartnerReveal,
    completeTrade,
    cancelTrade,
    clearTradeRequests,
    // Getters
    getActiveTradePartner,
    isTradeReady,
    canReveal,
    isTradeCompleted
  } = useTradingStore();

  // Get inventory for trading
  const { items: inventoryItems } = useInventoryStore();

  // Initialize player
  const initializePlayer = useCallback((id: string, name: string) => {
    setPlayerId(id);
    setPlayerName(name);
  }, [setPlayerId, setPlayerName]);

  // Start a new trade
  const startTrade = useCallback((
    targetPlayer: Player, 
    offeredItems: LootItem[], 
    publicKey: string
  ) => {
    if (!TradingService.canInitiateTrade(
      { id: playerId || '', name: playerName, isOnline: true, lastSeen: null },
      targetPlayer
    )) {
      return false;
    }

    initiateTradeWith(targetPlayer.id, targetPlayer.name, offeredItems, publicKey);
    return true;
  }, [playerId, playerName, initiateTradeWith]);

  // Accept incoming trade request
  const acceptTrade = useCallback((tradeId: number) => {
    acceptTradeRequest(tradeId);
  }, [acceptTradeRequest]);

  // Reject incoming trade request
  const rejectTrade = useCallback((tradeId: number) => {
    rejectTradeRequest(tradeId);
  }, [rejectTradeRequest]);

  // Update trade offer (items being offered/requested)
  const updateOffer = useCallback((offeredItems: LootItem[], requestedItems: LootItem[]) => {
    updateTradeOffer(offeredItems, requestedItems);
  }, [updateTradeOffer]);

  // Commit to current trade offer
  const commitToCurrentTrade = useCallback((offeredItems: LootItem[]) => {
    commitToTrade(offeredItems);
  }, [commitToTrade]);

  // Reveal committed trade
  const revealCurrentTrade = useCallback(() => {
    revealTrade();
  }, [revealTrade]);

  // Complete the trade
  const finalizeTrade = useCallback(() => {
    completeTrade();
  }, [completeTrade]);

  // Cancel current trade
  const cancelCurrentTrade = useCallback(() => {
    cancelTrade();
  }, [cancelTrade]);

  // Get available items for trading (from inventory)
  const getAvailableItems = useCallback(() => {
    return inventoryItems.filter(item => item.vrfData); // Only tradeable items with VRF data
  }, [inventoryItems]);

  // Get trade partner info
  const getTradePartner = useCallback(() => {
    return getActiveTradePartner();
  }, [getActiveTradePartner]);

  // Check if player can make a move
  const canPlayerAct = useCallback(() => {
    return !isTradeActive || tradePhase === 'negotiating';
  }, [isTradeActive, tradePhase]);

  // Get trade status summary
  const getTradeStatus = useCallback(() => {
    return {
      phase: tradePhase,
      isActive: isTradeActive,
      isReady: isTradeReady(),
      canReveal: canReveal(),
      isCompleted: isTradeCompleted(),
      hasErrors: validationErrors.length > 0,
      fairness: fairnessAssessment
    };
  }, [tradePhase, isTradeActive, isTradeReady, canReveal, isTradeCompleted, validationErrors, fairnessAssessment]);

  // Get pending trade requests count
  const getPendingRequestsCount = useCallback(() => {
    return tradeRequests.length;
  }, [tradeRequests]);

  return {
    // State
    isTradeActive,
    currentTrade,
    tradeRequests,
    connectedPlayers,
    playerId,
    playerName,
    tradePhase,
    validationErrors,
    fairnessAssessment,
    tradeSessionId,
    
    // Actions
    initializePlayer,
    updateConnectedPlayers,
    startTrade,
    acceptTrade,
    rejectTrade,
    updateOffer,
    commitToCurrentTrade,
    revealCurrentTrade,
    finalizeTrade,
    cancelCurrentTrade,
    clearTradeRequests,
    
    // Utilities
    getAvailableItems,
    getTradePartner,
    canPlayerAct,
    getTradeStatus,
    getPendingRequestsCount,
    
    // WebSocket handlers (for future use)
    receiveTradeRequest,
    receivePartnerCommitment,
    receivePartnerReveal
  };
};
