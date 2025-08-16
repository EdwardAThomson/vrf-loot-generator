import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { TradingStoreState, TradingStoreActions, TradeRequest, Player, TradePhase } from '../types/trading.types';
import { LootItem } from '../types/loot.types';

type TradingStore = TradingStoreState & TradingStoreActions;

const useTradingStore = create<TradingStore>()(
  devtools(
    (set, get) => ({
      // State
      isTradeActive: false,
      currentTrade: null,
      tradeRequests: [],
      connectedPlayers: [],
      playerId: null,
      playerName: '',
      tradePhase: 'idle',
      commitment: null,
      reveal: null,
      partnerCommitment: null,
      partnerReveal: null,
      
      // Actions
      setPlayerId: (id: string) => set({ playerId: id }),
      setPlayerName: (name: string) => set({ playerName: name }),
      
      updateConnectedPlayers: (players: Player[]) => set({ connectedPlayers: players }),
      
      initiateTradeWith: (targetPlayerId: string, targetPlayerName: string, offeredItems: LootItem[]) => set((state) => {
        const newTrade: TradeRequest = {
          id: Date.now(),
          initiator: state.playerId || '',
          target: targetPlayerId,
          targetName: targetPlayerName,
          offeredItems,
          requestedItems: [],
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        
        return {
          currentTrade: newTrade,
          tradePhase: 'requesting' as TradePhase,
          isTradeActive: true
        };
      }),
      
      receiveTradeRequest: (tradeRequest: TradeRequest) => set((state) => ({
        tradeRequests: [...state.tradeRequests, tradeRequest]
      })),
      
      acceptTradeRequest: (tradeId: number) => set((state) => {
        const request = state.tradeRequests.find(req => req.id === tradeId);
        if (!request) return state;
        
        return {
          currentTrade: { ...request, status: 'accepted' as const },
          tradeRequests: state.tradeRequests.filter(req => req.id !== tradeId),
          tradePhase: 'negotiating' as TradePhase,
          isTradeActive: true
        };
      }),
      
      rejectTradeRequest: (tradeId: number) => set((state) => ({
        tradeRequests: state.tradeRequests.filter(req => req.id !== tradeId)
      })),
      
      updateTradeOffer: (offeredItems: LootItem[], requestedItems: LootItem[]) => set((state) => ({
        currentTrade: state.currentTrade ? {
          ...state.currentTrade,
          offeredItems,
          requestedItems
        } : null
      })),
      
      commitToTrade: (commitment: string) => set({
        commitment,
        tradePhase: 'committing' as TradePhase
      }),
      
      receivePartnerCommitment: (partnerCommitment: string) => set({
        partnerCommitment,
        tradePhase: 'revealing' as TradePhase
      }),
      
      revealTrade: (reveal: string) => set((state) => ({
        reveal,
        tradePhase: state.partnerReveal ? 'completed' as TradePhase : 'revealing' as TradePhase
      })),
      
      receivePartnerReveal: (partnerReveal: string) => set((state) => ({
        partnerReveal,
        tradePhase: state.reveal ? 'completed' as TradePhase : 'revealing' as TradePhase
      })),
      
      completeTrade: () => set({
        isTradeActive: false,
        currentTrade: null,
        tradePhase: 'idle' as TradePhase,
        commitment: null,
        reveal: null,
        partnerCommitment: null,
        partnerReveal: null
      }),
      
      cancelTrade: () => set({
        isTradeActive: false,
        currentTrade: null,
        tradePhase: 'idle' as TradePhase,
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
          : { id: currentTrade.initiator, name: currentTrade.targetName };
      },
      
      isTradeReady: () => {
        const { currentTrade } = get();
        return currentTrade !== null && 
               currentTrade.offeredItems.length > 0 && 
               currentTrade.requestedItems.length > 0;
      },
      
      canReveal: () => {
        const { tradePhase, commitment, partnerCommitment } = get();
        return tradePhase === 'revealing' && commitment !== null && partnerCommitment !== null;
      },
      
      isTradeCompleted: () => {
        const { reveal, partnerReveal } = get();
        return reveal !== null && partnerReveal !== null;
      }
    }),
    {
      name: 'trading-store'
    }
  )
);

export default useTradingStore;
