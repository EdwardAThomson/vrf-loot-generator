import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { TradingStoreState, TradingStoreActions, TradeRequest, Player, TradePhase } from '../types/trading.types';
import { LootItem } from '../types/loot.types';
import { TradingService } from '../services/trading/trading.service';
import { CommitRevealService, Commitment, Reveal } from '../services/trading/commit-reveal.service';

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
      tradeSessionId: null,
      tradeCommitment: null,
      validationErrors: [],
      fairnessAssessment: null,
      
      // Actions
      setPlayerId: (id: string) => set({ playerId: id }),
      setPlayerName: (name: string) => set({ playerName: name }),
      
      updateConnectedPlayers: (players: Player[]) => set({ connectedPlayers: players }),
      
      initiateTradeWith: (targetPlayerId: string, targetPlayerName: string, offeredItems: LootItem[], initiatorPublicKey: string) => set((state) => {
        // Validate trade request using service
        const tradeResult = TradingService.createTradeRequest(
          state.playerId || '',
          state.playerName,
          targetPlayerId,
          targetPlayerName,
          offeredItems,
          initiatorPublicKey
        );
        
        if (!tradeResult) {
          return {
            ...state,
            validationErrors: ['Failed to create trade request - items validation failed']
          };
        }
        
        const sessionId = TradingService.createTradeSession(state.playerId || '', targetPlayerId);
        
        return {
          currentTrade: tradeResult.tradeRequest,
          tradePhase: 'requesting' as TradePhase,
          isTradeActive: true,
          tradeSessionId: sessionId,
          validationErrors: tradeResult.errors
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
      
      updateTradeOffer: (offeredItems: LootItem[], requestedItems: LootItem[]) => set((state) => {
        if (!state.currentTrade) return state;
        
        // Assess trade fairness
        const fairness = TradingService.assessTradeFairness(offeredItems, requestedItems);
        
        return {
          currentTrade: {
            ...state.currentTrade,
            offeredItems,
            requestedItems
          },
          fairnessAssessment: fairness
        };
      }),
      
      commitToTrade: (offeredItems: LootItem[]) => set((state) => {
        if (!state.playerId) return state;
        
        // Create cryptographic commitment using service
        const tradeCommitment = CommitRevealService.createTradeCommitment(state.playerId, offeredItems);
        const publicCommitment = CommitRevealService.getPublicCommitment(tradeCommitment);
        
        return {
          tradeCommitment,
          commitment: JSON.stringify(publicCommitment.commitment),
          tradePhase: 'committing' as TradePhase
        };
      }),
      
      receivePartnerCommitment: (partnerCommitment: string) => set({
        partnerCommitment,
        tradePhase: 'revealing' as TradePhase
      }),
      
      revealTrade: () => set((state) => {
        if (!state.tradeCommitment?.reveal) return state;
        
        const revealData = JSON.stringify(state.tradeCommitment.reveal);
        
        return {
          reveal: revealData,
          tradePhase: state.partnerReveal ? 'completed' as TradePhase : 'revealing' as TradePhase
        };
      }),
      
      receivePartnerReveal: (partnerReveal: string) => set((state) => ({
        partnerReveal,
        tradePhase: state.reveal ? 'completed' as TradePhase : 'revealing' as TradePhase
      })),
      
      completeTrade: () => set((state) => {
        // Validate and execute trade using service
        if (state.commitment && state.reveal && state.partnerCommitment && state.partnerReveal && state.playerId) {
          try {
            const player1Commitment: Commitment = JSON.parse(state.commitment);
            const player1Reveal: Reveal = JSON.parse(state.reveal);
            const player2Commitment: Commitment = JSON.parse(state.partnerCommitment);
            const player2Reveal: Reveal = JSON.parse(state.partnerReveal);
            
            const completedTrade = TradingService.executeTrade(
              state.playerId,
              player1Commitment,
              player1Reveal,
              'partner-id', // TODO: Get from partner
              player2Commitment,
              player2Reveal,
              state.tradeSessionId || ''
            );
            
            if (completedTrade) {
              // Trade completed successfully
              console.log('Trade completed:', completedTrade);
            }
          } catch (error) {
            console.error('Failed to complete trade:', error);
          }
        }
        
        return {
          isTradeActive: false,
          currentTrade: null,
          tradePhase: 'idle' as TradePhase,
          commitment: null,
          reveal: null,
          partnerCommitment: null,
          partnerReveal: null,
          tradeSessionId: null,
          tradeCommitment: null,
          validationErrors: [],
          fairnessAssessment: null
        };
      }),
      
      cancelTrade: () => set({
        isTradeActive: false,
        currentTrade: null,
        tradePhase: 'idle' as TradePhase,
        commitment: null,
        reveal: null,
        partnerCommitment: null,
        partnerReveal: null,
        tradeSessionId: null,
        tradeCommitment: null,
        validationErrors: [],
        fairnessAssessment: null
      }),
      
      clearTradeRequests: () => set({ tradeRequests: [] }),
      
      // Getters
      getActiveTradePartner: () => {
        const { currentTrade, playerId } = get();
        if (!currentTrade) return null;
        
        return currentTrade.initiator === playerId 
          ? { id: currentTrade.target, name: currentTrade.targetPlayerName }
          : { id: currentTrade.initiator, name: currentTrade.initiatorPlayerName };
      },
      
      isTradeReady: () => {
        const { currentTrade } = get();
        return currentTrade !== null && 
               currentTrade.offeredItems.length > 0 && 
               currentTrade.requestedItems.length > 0;
      },
      
      canReveal: () => {
        const { tradePhase, commitment, partnerCommitment } = get();
        return tradePhase === 'committed' && commitment && partnerCommitment !== null;
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
