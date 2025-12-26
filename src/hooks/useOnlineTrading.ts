import { useState, useEffect, useCallback, useRef } from 'react';
import { socketService } from '../services/websocket/socket.service';
import { 
  TradeSession, 
  LootItem 
} from '../types/websocket.types';
import useInventoryStore from '../store/inventory.store';
import { usePlayerStore } from '../store/player.store';
import { LootService } from '../services/loot/loot.service';

interface TradeLogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface VerificationResult {
  itemName: string;
  valid: boolean;
  reason?: string;
}

interface OnlineTradingState {
  activeTrades: TradeSession[];
  pendingTradeRequests: TradeSession[];
  currentTrade: TradeSession | null;
  isTrading: boolean;
  tradeError: string | null;
  tradeLog: TradeLogEntry[];
  verificationResults: VerificationResult[];
  // Track commitments for verification
  commitments: Map<string, { commitment: string; playerId: string }>;
}

export const useOnlineTrading = () => {
  const [state, setState] = useState<OnlineTradingState>({
    activeTrades: [],
    pendingTradeRequests: [],
    currentTrade: null,
    isTrading: false,
    tradeError: null,
    tradeLog: [],
    verificationResults: [],
    commitments: new Map()
  });
  
  // Helper to add log entries
  const addLogEntry = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setState(prev => ({
      ...prev,
      tradeLog: [...prev.tradeLog, { timestamp, message, type }]
    }));
    console.log(`[${type.toUpperCase()}] ${message}`);
  }, []);
  
  // Clear trade log
  const clearTradeLog = useCallback(() => {
    setState(prev => ({ ...prev, tradeLog: [], verificationResults: [] }));
  }, []);

  const eventListenersRef = useRef<Map<string, Function>>(new Map());
  
  // Access inventory and player stores
  const { removeItem, addItems } = useInventoryStore();
  const { playerName, currentPlayer } = usePlayerStore();
  
  // Get player ID - use currentPlayer.id if available, otherwise fall back to playerName
  const playerId = currentPlayer?.id || playerName;

  // Trading methods
  const initiateTrade = useCallback((targetPlayerId: string, offeredItems: LootItem[]) => {
    if (!socketService.isConnected) {
      setState(prev => ({ ...prev, tradeError: 'Not connected to server' }));
      return;
    }

    socketService.initiateTrade(targetPlayerId, offeredItems);
    setState(prev => ({ ...prev, isTrading: true, tradeError: null }));
    addLogEntry(`📤 Initiating trade with ${targetPlayerId}`, 'info');
    addLogEntry(`  Offering ${offeredItems.length} items`, 'info');
  }, []);

  const commitToTrade = useCallback((tradeId: string, commitment: string) => {
    if (!socketService.isConnected) {
      setState(prev => ({ ...prev, tradeError: 'Not connected to server' }));
      return;
    }

    socketService.commitTrade(tradeId, commitment);
    addLogEntry(`🔒 Committing to trade ${tradeId.substring(0, 8)}...`, 'info');
    addLogEntry(`  Commitment: ${commitment.substring(0, 20)}...`, 'info');
  }, []);

  const revealTrade = useCallback((tradeId: string, nonce: string, items: LootItem[]) => {
    if (!socketService.isConnected) {
      setState(prev => ({ ...prev, tradeError: 'Not connected to server' }));
      return;
    }

    socketService.revealTrade(tradeId, nonce, items);
    addLogEntry(`🔓 Revealing items for trade ${tradeId.substring(0, 8)}...`, 'info');
    addLogEntry(`  Nonce: ${nonce}`, 'info');
    addLogEntry(`  Items: ${items.map(i => i.name).join(', ')}`, 'info');
  }, []);

  const acceptTrade = useCallback((tradeId: string) => {
    if (!socketService.isConnected) {
      setState(prev => ({ ...prev, tradeError: 'Not connected to server' }));
      return;
    }

    socketService.acceptTrade(tradeId);
    addLogEntry(`✅ Accepting trade ${tradeId.substring(0, 8)}...`, 'info');
  }, []);

  const cancelTrade = useCallback((tradeId: string) => {
    if (!socketService.isConnected) {
      setState(prev => ({ ...prev, tradeError: 'Not connected to server' }));
      return;
    }

    socketService.cancelTrade(tradeId);
    setState(prev => ({ 
      ...prev, 
      isTrading: false,
      currentTrade: prev.currentTrade?.id === tradeId ? null : prev.currentTrade
    }));
  }, []);

  // Helper methods
  const getTradeById = useCallback((tradeId: string): TradeSession | undefined => {
    return state.activeTrades.find(trade => trade.id === tradeId);
  }, [state.activeTrades]);

  const isPlayerInTrade = useCallback((playerId: string): boolean => {
    return state.activeTrades.some(trade => 
      trade.initiatorId === playerId || trade.targetId === playerId
    );
  }, [state.activeTrades]);

  const getTradesForPlayer = useCallback((playerId: string): TradeSession[] => {
    return state.activeTrades.filter(trade => 
      trade.initiatorId === playerId || trade.targetId === playerId
    );
  }, [state.activeTrades]);

  // Setup event listeners
  useEffect(() => {
    const listeners = new Map<string, Function>();

    // Trade initiated
    const onTradeInitiated = (trade: TradeSession) => {
      // Add to log
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = { timestamp, message: `📤 Trade initiated: ${trade.id.substring(0, 8)}...`, type: 'info' as const };
      
      setState(prev => {
        const updatedTrades = [...prev.activeTrades, trade];
        const isPendingRequest = trade.status === 'INITIATED' && 
          trade.targetId === playerId;
        
        const newLog = [...prev.tradeLog, logEntry];
        
        // If we're the initiator, we need to commit our items
        if (trade.initiatorId === playerId) {
          newLog.push({ timestamp, message: `  We are the initiator, preparing commitment...`, type: 'info' as const });
          
          const storedItems = sessionStorage.getItem('pending_trade_items');
          if (storedItems) {
            const items = JSON.parse(storedItems);
            
            const CryptoJS = require('crypto-js');
            const nonce = Math.random().toString(36).substring(2, 15);
            const itemsString = JSON.stringify(items);
            const commitment = CryptoJS.SHA256(itemsString + nonce).toString();
            
            // Store commitment for verification later
            sessionStorage.setItem(`trade_nonce_${trade.id}`, nonce);
            sessionStorage.setItem(`trade_items_${trade.id}`, itemsString);
            sessionStorage.setItem(`trade_commitment_${trade.id}`, commitment);
            sessionStorage.removeItem('pending_trade_items');
            
            newLog.push({ timestamp, message: `  Nonce: ${nonce}`, type: 'info' as const });
            newLog.push({ timestamp, message: `  Commitment: ${commitment.substring(0, 20)}...`, type: 'info' as const });
            
            setTimeout(() => {
              commitToTrade(trade.id, commitment);
            }, 500);
          }
        } else {
          newLog.push({ timestamp, message: `  Trade request from ${trade.initiatorId}`, type: 'info' as const });
          newLog.push({ timestamp, message: `  They are offering ${trade.initiatorItems.length} items`, type: 'info' as const });
        }
        
        return {
          ...prev,
          activeTrades: updatedTrades,
          pendingTradeRequests: isPendingRequest 
            ? [...prev.pendingTradeRequests, trade]
            : prev.pendingTradeRequests,
          currentTrade: trade,
          isTrading: true,
          tradeError: null,
          tradeLog: newLog
        };
      });
    };

    // Trade committed
    const onTradeCommitted = ({ tradeId, playerId: committingPlayerId, commitment }: { tradeId: string, playerId: string, commitment?: string }) => {
      const timestamp = new Date().toLocaleTimeString();
      const isUs = committingPlayerId === playerId;
      
      // Track who has committed using sessionStorage
      if (isUs) {
        sessionStorage.setItem(`trade_our_committed_${tradeId}`, 'true');
      } else {
        sessionStorage.setItem(`trade_their_committed_${tradeId}`, 'true');
        if (commitment) {
          sessionStorage.setItem(`trade_other_commitment_${tradeId}`, commitment);
        }
      }
      
      // Check if BOTH players have now committed
      const ourCommitted = sessionStorage.getItem(`trade_our_committed_${tradeId}`) === 'true';
      const theirCommitted = sessionStorage.getItem(`trade_their_committed_${tradeId}`) === 'true';
      const bothCommitted = ourCommitted && theirCommitted;
      
      setState(prev => {
        const updatedTrades = prev.activeTrades.map(trade => 
          trade.id === tradeId 
            ? { ...trade, status: bothCommitted ? 'COMMITTED' as const : trade.status }
            : trade
        );
        
        const updatedCurrentTrade = prev.currentTrade?.id === tradeId 
          ? { ...prev.currentTrade, status: bothCommitted ? 'COMMITTED' as const : prev.currentTrade.status }
          : prev.currentTrade;
        
        const newLog = [...prev.tradeLog];
        newLog.push({ 
          timestamp, 
          message: `🔒 ${isUs ? 'We' : 'Other player'} committed to trade`, 
          type: 'info' as const 
        });
        
        // Log the other player's commitment hash
        if (!isUs && commitment) {
          newLog.push({ timestamp, message: `  Their commitment: ${commitment.substring(0, 20)}...`, type: 'info' as const });
        }
        
        // Only proceed to reveal when BOTH players have committed
        if (bothCommitted) {
          newLog.push({ timestamp, message: `✅ Both players committed! Proceeding to reveal...`, type: 'success' as const });
          
          const storedNonce = sessionStorage.getItem(`trade_nonce_${tradeId}`);
          const storedItems = sessionStorage.getItem(`trade_items_${tradeId}`);
          
          if (storedNonce && storedItems) {
            const items = JSON.parse(storedItems);
            setTimeout(() => {
              revealTrade(tradeId, storedNonce, items);
            }, 500);
          }
        } else {
          newLog.push({ timestamp, message: `  Waiting for ${isUs ? 'other player' : 'us'} to commit...`, type: 'info' as const });
        }
        
        return {
          ...prev,
          activeTrades: updatedTrades,
          currentTrade: updatedCurrentTrade,
          tradeLog: newLog
        };
      });
    };

    // Trade revealed
    const onTradeRevealed = ({ tradeId, playerId: revealingPlayerId, items, nonce }: { 
      tradeId: string, 
      playerId: string, 
      items: LootItem[],
      nonce?: string
    }) => {
      const timestamp = new Date().toLocaleTimeString();
      const isUs = revealingPlayerId === playerId;
      
      setState(prev => {
        const newLog = [...prev.tradeLog];
        newLog.push({ 
          timestamp, 
          message: `🔓 ${isUs ? 'We' : 'Other player'} revealed items`, 
          type: 'info' as const 
        });
        newLog.push({ timestamp, message: `  Items: ${items.map(i => i.name).join(', ')}`, type: 'info' as const });
        
        // COMMITMENT VERIFICATION - verify the other player's reveal matches their commitment
        if (!isUs && nonce) {
          const otherCommitment = sessionStorage.getItem(`trade_other_commitment_${tradeId}`);
          if (otherCommitment) {
            const CryptoJS = require('crypto-js');
            const itemsString = JSON.stringify(items);
            const recomputedCommitment = CryptoJS.SHA256(itemsString + nonce).toString();
            
            if (recomputedCommitment === otherCommitment) {
              newLog.push({ timestamp, message: `  ✅ Commitment VERIFIED!`, type: 'success' as const });
            } else {
              newLog.push({ timestamp, message: `  ❌ Commitment MISMATCH! Trade may be fraudulent!`, type: 'error' as const });
              newLog.push({ timestamp, message: `    Expected: ${otherCommitment.substring(0, 20)}...`, type: 'error' as const });
              newLog.push({ timestamp, message: `    Got: ${recomputedCommitment.substring(0, 20)}...`, type: 'error' as const });
            }
          }
        }
        
        const updatedTrades = prev.activeTrades.map(trade => 
          trade.id === tradeId 
            ? { 
                ...trade, 
                status: 'REVEALED' as const,
                ...(trade.initiatorId === playerId 
                  ? { initiatorItems: items }
                  : { targetItems: items }
                )
              }
            : trade
        );
        
        const updatedCurrentTrade = prev.currentTrade?.id === tradeId 
          ? { 
              ...prev.currentTrade, 
              status: 'REVEALED' as const,
              ...(prev.currentTrade.initiatorId === playerId 
                ? { initiatorItems: items }
                : { targetItems: items }
              )
            }
          : prev.currentTrade;
        
        // Check if both players have revealed
        const trade = updatedTrades.find(t => t.id === tradeId);
        if (trade && trade.status === 'REVEALED' && 
            trade.initiatorItems.length > 0 && trade.targetItems.length > 0) {
          newLog.push({ timestamp, message: `✅ Both players revealed! Proceeding to complete trade...`, type: 'success' as const });
          
          setTimeout(() => {
            acceptTrade(tradeId);
            sessionStorage.removeItem(`trade_nonce_${tradeId}`);
            sessionStorage.removeItem(`trade_items_${tradeId}`);
            sessionStorage.removeItem(`trade_commitment_${tradeId}`);
            sessionStorage.removeItem(`trade_other_commitment_${tradeId}`);
          }, 500);
        }
        
        return {
          ...prev,
          activeTrades: updatedTrades,
          currentTrade: updatedCurrentTrade,
          tradeLog: newLog
        };
      });
    };

    // Trade completed
    const onTradeCompleted = (trade: TradeSession) => {
      const timestamp = new Date().toLocaleTimeString();
      
      // Clean up sessionStorage for this trade
      sessionStorage.removeItem(`trade_nonce_${trade.id}`);
      sessionStorage.removeItem(`trade_items_${trade.id}`);
      sessionStorage.removeItem(`trade_commitment_${trade.id}`);
      sessionStorage.removeItem(`trade_other_commitment_${trade.id}`);
      sessionStorage.removeItem(`trade_our_committed_${trade.id}`);
      sessionStorage.removeItem(`trade_their_committed_${trade.id}`);
      
      // Determine which items we're giving and receiving
      const isInitiator = trade.initiatorId === playerId;
      const itemsToRemove = isInitiator ? trade.initiatorItems : trade.targetItems;
      const itemsToReceive = isInitiator ? trade.targetItems : trade.initiatorItems;
      
      // Build log entries and verification results
      const newLogEntries: { timestamp: string; message: string; type: 'info' | 'success' | 'error' | 'warning' }[] = [];
      const newVerificationResults: VerificationResult[] = [];
      
      newLogEntries.push({ timestamp, message: `🎉 Trade completed! Processing item exchange...`, type: 'success' });
      newLogEntries.push({ timestamp, message: `📤 Removing ${itemsToRemove.length} items from inventory...`, type: 'info' });
      
      // STEP 1: Remove items we traded away
      itemsToRemove.forEach(item => {
        removeItem(item.id);
        newLogEntries.push({ timestamp, message: `  ✓ Removed: ${item.name}`, type: 'info' });
      });
      
      // STEP 2: Verify received items using VRF proofs (CLIENT-SIDE VERIFICATION)
      newLogEntries.push({ timestamp, message: `📥 Verifying ${itemsToReceive.length} received items with VRF...`, type: 'info' });
      let allItemsValid = true;
      
      itemsToReceive.forEach(item => {
        if (!item.vrfProof) {
          newLogEntries.push({ timestamp, message: `  ⚠️ ${item.name}: No VRF proof - cannot verify`, type: 'warning' });
          newVerificationResults.push({ itemName: item.name, valid: false, reason: 'No VRF proof provided' });
          allItemsValid = false;
          return;
        }
        
        try {
          const isValid = LootService.verifyItem(
            {
              id: item.id,
              name: item.name,
              type: item.type,
              icon: '🗡️',
              rarity: item.rarity,
              modifier: item.modifier || '',
              createdAt: new Date().toISOString(),
              vrfData: {
                publicKey: item.vrfProof.publicKey,
                proof: item.vrfProof.proof,
                message: item.vrfProof.message,
                vrfOutput: item.vrfProof.hash
              }
            },
            item.vrfProof.publicKey
          );
          
          if (isValid) {
            newLogEntries.push({ timestamp, message: `  ✅ ${item.name}: VRF proof VALID`, type: 'success' });
            newVerificationResults.push({ itemName: item.name, valid: true });
          } else {
            newLogEntries.push({ timestamp, message: `  ❌ ${item.name}: VRF proof INVALID`, type: 'error' });
            newVerificationResults.push({ itemName: item.name, valid: false, reason: 'VRF proof verification failed' });
            allItemsValid = false;
          }
        } catch (error) {
          newLogEntries.push({ timestamp, message: `  ❌ ${item.name}: Verification error`, type: 'error' });
          newVerificationResults.push({ itemName: item.name, valid: false, reason: `Error: ${(error as Error).message}` });
          allItemsValid = false;
        }
      });
      
      // STEP 3: Add verified items to inventory
      // Convert WebSocket LootItems to inventory LootItems
      const inventoryItems = itemsToReceive.map(item => ({
        name: item.name,
        type: item.type,
        icon: '🗡️', // Default icon
        rarity: item.rarity,
        modifier: item.modifier || '',
        createdAt: new Date().toISOString(),
        vrfData: item.vrfProof ? {
          publicKey: item.vrfProof.publicKey,
          proof: item.vrfProof.proof,
          message: item.vrfProof.message,
          vrfOutput: item.vrfProof.hash
        } : undefined
      }));
      
      addItems(inventoryItems);
      newLogEntries.push({ timestamp, message: `✓ Added ${itemsToReceive.length} items to inventory`, type: 'info' });
      
      // STEP 4: Show verification summary
      if (allItemsValid) {
        newLogEntries.push({ timestamp, message: `✅ All received items passed VRF verification!`, type: 'success' });
      } else {
        newLogEntries.push({ timestamp, message: `⚠️ Some items failed VRF verification!`, type: 'warning' });
        newVerificationResults.forEach(result => {
          if (!result.valid) {
            newLogEntries.push({ timestamp, message: `  - ${result.itemName}: ${result.reason}`, type: 'error' });
          }
        });
      }
      
      newLogEntries.push({ timestamp, message: `📦 Inventory updated!`, type: 'success' });
      
      // Update state
      setState(prev => ({
        ...prev,
        activeTrades: prev.activeTrades.filter(t => t.id !== trade.id),
        pendingTradeRequests: prev.pendingTradeRequests.filter(t => t.id !== trade.id),
        currentTrade: prev.currentTrade?.id === trade.id ? null : prev.currentTrade,
        isTrading: prev.currentTrade?.id === trade.id ? false : prev.isTrading,
        tradeError: allItemsValid ? null : 'Warning: Some received items failed VRF verification',
        tradeLog: [...prev.tradeLog, ...newLogEntries],
        verificationResults: newVerificationResults
      }));
    };

    // Trade cancelled
    const onTradeCancelled = ({ tradeId, reason }: { tradeId: string, reason: string }) => {
      // Clean up sessionStorage for this trade
      sessionStorage.removeItem(`trade_nonce_${tradeId}`);
      sessionStorage.removeItem(`trade_items_${tradeId}`);
      sessionStorage.removeItem(`trade_commitment_${tradeId}`);
      sessionStorage.removeItem(`trade_other_commitment_${tradeId}`);
      sessionStorage.removeItem(`trade_our_committed_${tradeId}`);
      sessionStorage.removeItem(`trade_their_committed_${tradeId}`);
      
      setState(prev => ({
        ...prev,
        activeTrades: prev.activeTrades.filter(t => t.id !== tradeId),
        pendingTradeRequests: prev.pendingTradeRequests.filter(t => t.id !== tradeId),
        currentTrade: prev.currentTrade?.id === tradeId ? null : prev.currentTrade,
        isTrading: prev.currentTrade?.id === tradeId ? false : prev.isTrading,
        tradeError: `Trade cancelled: ${reason}`
      }));
    };

    // Error handling
    const onError = (message: string) => {
      setState(prev => ({ 
        ...prev, 
        tradeError: message,
        isTrading: false
      }));
    };

    // Register listeners
    listeners.set('trade:initiated', onTradeInitiated);
    listeners.set('trade:committed', onTradeCommitted);
    listeners.set('trade:revealed', onTradeRevealed);
    listeners.set('trade:completed', onTradeCompleted);
    listeners.set('trade:cancelled', onTradeCancelled);
    listeners.set('error', onError);

    // Attach listeners to socket service
    listeners.forEach((callback, event) => {
      socketService.on(event, callback);
    });

    eventListenersRef.current = listeners;

    // Cleanup on unmount
    return () => {
      listeners.forEach((callback, event) => {
        socketService.off(event, callback);
      });
    };
  }, []);

  // Clear error after some time
  useEffect(() => {
    if (state.tradeError) {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, tradeError: null }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [state.tradeError]);

  return {
    // State
    ...state,
    
    // Trading methods
    initiateTrade,
    commitToTrade,
    revealTrade,
    acceptTrade,
    cancelTrade,
    
    // Helper methods
    getTradeById,
    isPlayerInTrade,
    getTradesForPlayer,
    
    // Log methods
    clearTradeLog,
    
    // Computed values
    hasActiveTrades: state.activeTrades.length > 0,
    hasPendingRequests: state.pendingTradeRequests.length > 0,
    canInitiateTrade: socketService.isConnected && !state.isTrading,
    
    // Clear error manually
    clearError: () => setState(prev => ({ ...prev, tradeError: null }))
  };
};
