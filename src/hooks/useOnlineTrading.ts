import { useState, useEffect, useCallback, useRef } from 'react';
import { socketService } from '../services/websocket/socket.service';
import { 
  TradeSession, 
  LootItem 
} from '../types/websocket.types';

interface OnlineTradingState {
  activeTrades: TradeSession[];
  pendingTradeRequests: TradeSession[];
  currentTrade: TradeSession | null;
  isTrading: boolean;
  tradeError: string | null;
}

export const useOnlineTrading = () => {
  const [state, setState] = useState<OnlineTradingState>({
    activeTrades: [],
    pendingTradeRequests: [],
    currentTrade: null,
    isTrading: false,
    tradeError: null
  });

  const eventListenersRef = useRef<Map<string, Function>>(new Map());

  // Trading methods
  const initiateTrade = useCallback((targetPlayerId: string, offeredItems: LootItem[]) => {
    if (!socketService.isConnected) {
      setState(prev => ({ ...prev, tradeError: 'Not connected to server' }));
      return;
    }

    socketService.initiateTrade(targetPlayerId, offeredItems);
    setState(prev => ({ ...prev, isTrading: true, tradeError: null }));
  }, []);

  const commitToTrade = useCallback((tradeId: string, commitment: string) => {
    if (!socketService.isConnected) {
      setState(prev => ({ ...prev, tradeError: 'Not connected to server' }));
      return;
    }

    socketService.commitTrade(tradeId, commitment);
  }, []);

  const revealTrade = useCallback((tradeId: string, nonce: string, items: LootItem[]) => {
    if (!socketService.isConnected) {
      setState(prev => ({ ...prev, tradeError: 'Not connected to server' }));
      return;
    }

    socketService.revealTrade(tradeId, nonce, items);
  }, []);

  const acceptTrade = useCallback((tradeId: string) => {
    if (!socketService.isConnected) {
      setState(prev => ({ ...prev, tradeError: 'Not connected to server' }));
      return;
    }

    socketService.acceptTrade(tradeId);
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
      setState(prev => {
        const updatedTrades = [...prev.activeTrades, trade];
        const isPendingRequest = trade.status === 'INITIATED' && 
          // This is a request TO us (we're the target)
          socketService.isConnected;
        
        return {
          ...prev,
          activeTrades: updatedTrades,
          pendingTradeRequests: isPendingRequest 
            ? [...prev.pendingTradeRequests, trade]
            : prev.pendingTradeRequests,
          currentTrade: trade,
          isTrading: true,
          tradeError: null
        };
      });
    };

    // Trade committed
    const onTradeCommitted = ({ tradeId, playerId }: { tradeId: string, playerId: string }) => {
      setState(prev => ({
        ...prev,
        activeTrades: prev.activeTrades.map(trade => 
          trade.id === tradeId 
            ? { ...trade, status: 'COMMITTED' as const }
            : trade
        ),
        currentTrade: prev.currentTrade?.id === tradeId 
          ? { ...prev.currentTrade, status: 'COMMITTED' as const }
          : prev.currentTrade
      }));
    };

    // Trade revealed
    const onTradeRevealed = ({ tradeId, playerId, items }: { 
      tradeId: string, 
      playerId: string, 
      items: LootItem[] 
    }) => {
      setState(prev => ({
        ...prev,
        activeTrades: prev.activeTrades.map(trade => 
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
        ),
        currentTrade: prev.currentTrade?.id === tradeId 
          ? { 
              ...prev.currentTrade, 
              status: 'REVEALED' as const,
              ...(prev.currentTrade.initiatorId === playerId 
                ? { initiatorItems: items }
                : { targetItems: items }
              )
            }
          : prev.currentTrade
      }));
    };

    // Trade completed
    const onTradeCompleted = (trade: TradeSession) => {
      setState(prev => ({
        ...prev,
        activeTrades: prev.activeTrades.filter(t => t.id !== trade.id),
        pendingTradeRequests: prev.pendingTradeRequests.filter(t => t.id !== trade.id),
        currentTrade: prev.currentTrade?.id === trade.id ? null : prev.currentTrade,
        isTrading: prev.currentTrade?.id === trade.id ? false : prev.isTrading,
        tradeError: null
      }));
    };

    // Trade cancelled
    const onTradeCancelled = ({ tradeId, reason }: { tradeId: string, reason: string }) => {
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
    
    // Computed values
    hasActiveTrades: state.activeTrades.length > 0,
    hasPendingRequests: state.pendingTradeRequests.length > 0,
    canInitiateTrade: socketService.isConnected && !state.isTrading,
    
    // Clear error manually
    clearError: () => setState(prev => ({ ...prev, tradeError: null }))
  };
};
