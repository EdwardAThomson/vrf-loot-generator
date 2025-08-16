import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { PlayersStoreState, PlayersStoreActions, Player } from '../types/trading.types';

type PlayersStore = PlayersStoreState & PlayersStoreActions;

const usePlayersStore = create<PlayersStore>()(
  devtools(
    (set, get) => ({
      // State
      currentPlayer: {
        id: '',
        name: '',
        isOnline: false,
        lastSeen: null
      },
      onlinePlayers: [],
      allPlayers: [],
      
      // Actions
      setCurrentPlayer: (player: Partial<Player>) => set((state) => ({
        currentPlayer: { ...state.currentPlayer, ...player }
      })),
      
      setPlayerOnline: (isOnline: boolean) => set((state) => ({
        currentPlayer: { 
          ...state.currentPlayer, 
          isOnline,
          lastSeen: isOnline ? new Date().toISOString() : state.currentPlayer.lastSeen
        }
      })),
      
      updateOnlinePlayers: (players: Player[]) => set({ onlinePlayers: players }),
      
      addPlayer: (player: Player) => set((state) => {
        const existingPlayer = state.allPlayers.find(p => p.id === player.id);
        if (existingPlayer) {
          return {
            allPlayers: state.allPlayers.map(p => 
              p.id === player.id ? { ...p, ...player } : p
            )
          };
        }
        
        return {
          allPlayers: [...state.allPlayers, player]
        };
      }),
      
      removePlayer: (playerId: string) => set((state) => ({
        onlinePlayers: state.onlinePlayers.filter(p => p.id !== playerId),
        allPlayers: state.allPlayers.map(p => 
          p.id === playerId ? { ...p, isOnline: false, lastSeen: new Date().toISOString() } : p
        )
      })),
      
      updatePlayerStatus: (playerId: string, status: Partial<Player>) => set((state) => ({
        onlinePlayers: state.onlinePlayers.map(p => 
          p.id === playerId ? { ...p, ...status } : p
        ),
        allPlayers: state.allPlayers.map(p => 
          p.id === playerId ? { ...p, ...status } : p
        )
      })),
      
      clearAllPlayers: () => set({
        onlinePlayers: [],
        allPlayers: []
      }),
      
      // Getters
      getPlayerById: (playerId: string) => {
        const { allPlayers } = get();
        return allPlayers.find(p => p.id === playerId);
      },
      
      getOnlinePlayersCount: () => {
        const { onlinePlayers } = get();
        return onlinePlayers.length;
      },
      
      getAvailablePlayersForTrade: () => {
        const { onlinePlayers, currentPlayer } = get();
        return onlinePlayers.filter(p => 
          p.id !== currentPlayer.id && 
          p.isOnline && 
          !p.inTrade
        );
      },
      
      isPlayerOnline: (playerId: string) => {
        const { onlinePlayers } = get();
        return onlinePlayers.some(p => p.id === playerId);
      }
    }),
    {
      name: 'players-store'
    }
  )
);

export default usePlayersStore;
