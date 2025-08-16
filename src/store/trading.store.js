import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useTradingStore = create(
  devtools(
    (set, get) => ({
      // State
      isTradeActive: false,
      currentTrade: null,
      tradeRequests: [],
      connectedPlayers: [],
      playerId: null,
      playerName: '',
      
      // Trade phases
      tradePhase: 'idle', // 'idle', 'requesting', 'negotiating', 'committing', 'revealing', 'completed'
      
      // Commit-reveal protocol state
      commitment: null,
      reveal: null,
      partnerCommitment: null,
      partnerReveal: null,
      
      // Actions
      setPlayerId: (id) => set({ playerId: id }),
      setPlayerName: (name) => set({ playerName: name }),
      
      updateConnectedPlayers: (players) => set({ connectedPlayers: players }),
      
      initiateTradeWith: (targetPlayerId, targetPlayerName, offeredItems) => set((state) => {
        const newTrade = {
          id: Date.now(),
          initiator: state.playerId,
          target: targetPlayerId,
          targetName: targetPlayerName,
          offeredItems,
          requestedItems: [],
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        
        return {
          currentTrade: newTrade,
          tradePhase: 'requesting',
          isTradeActive: true
        };
      }),
      
      receiveTradeRequest: (tradeRequest) => set((state) => ({
        tradeRequests: [...state.tradeRequests, tradeRequest]
      })),
      
      acceptTradeRequest: (tradeId) => set((state) => {
        const request = state.tradeRequests.find(req => req.id === tradeId);
        if (!request) return state;
        
        return {
          currentTrade: { ...request, status: 'accepted' },
          tradeRequests: state.tradeRequests.filter(req => req.id !== tradeId),
          tradePhase: 'negotiating',
          isTradeActive: true
        };
      }),
      
      rejectTradeRequest: (tradeId) => set((state) => ({
        tradeRequests: state.tradeRequests.filter(req => req.id !== tradeId)
      })),
      
      updateTradeOffer: (offeredItems, requestedItems) => set((state) => ({
        currentTrade: state.currentTrade ? {
          ...state.currentTrade,
          offeredItems,
          requestedItems
        } : null
      })),
      
      commitToTrade: (commitment) => set((state) => ({
        commitment,
        tradePhase: 'committing'
      })),
      
      receivePartnerCommitment: (partnerCommitment) => set({
        partnerCommitment,
        tradePhase: 'revealing'
      }),
      
      revealTrade: (reveal) => set((state) => ({
        reveal,
        tradePhase: state.partnerReveal ? 'completed' : 'revealing'
      })),
      
      receivePartnerReveal: (partnerReveal) => set((state) => ({
        partnerReveal,
        tradePhase: state.reveal ? 'completed' : 'revealing'
      })),
      
      completeTrade: () => set((state) => {
        // Trade is completed, reset state
        return {
          isTradeActive: false,
          currentTrade: null,
          tradePhase: 'idle',
          commitment: null,
          reveal: null,
          partnerCommitment: null,
          partnerReveal: null
        };
      }),
      
      cancelTrade: () => set({
        isTradeActive: false,
        currentTrade: null,
        tradePhase: 'idle',
        commitment: null,
        reveal: null,
        partnerCommitment: null,
        partnerReveal: null
      }),
      
      clearTradeRequests: () => set({ tradeRequests: [] }),
      
      // Getters
      getActiveTradePartner: () => {
        const { currentTrade, playerId } = get();
        if (!currentTrade) return null;
        
        return currentTrade.initiator === playerId 
          ? { id: currentTrade.target, name: currentTrade.targetName }
          : { id: currentTrade.initiator, name: currentTrade.initiatorName };
      },
      
      isTradeReady: () => {
        const { currentTrade } = get();
        return currentTrade && 
               currentTrade.offeredItems.length > 0 && 
               currentTrade.requestedItems.length > 0;
      },
      
      canReveal: () => {
        const { tradePhase, commitment, partnerCommitment } = get();
        return tradePhase === 'revealing' && commitment && partnerCommitment;
      },
      
      isTradeCompleted: () => {
        const { reveal, partnerReveal } = get();
        return reveal && partnerReveal;
      }
    }),
    {
      name: 'trading-store'
    }
  )
);

export default useTradingStore;
