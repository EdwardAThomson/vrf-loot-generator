import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const usePlayersStore = create(
  devtools(
    (set, get) => ({
      // State
      currentPlayer: {
        id: null,
        name: '',
        isOnline: false,
        lastSeen: null
      },
      onlinePlayers: [],
      allPlayers: [],
      
      // Actions
      setCurrentPlayer: (player) => set((state) => ({
        currentPlayer: { ...state.currentPlayer, ...player }
      })),
      
      setPlayerOnline: (isOnline) => set((state) => ({
        currentPlayer: { 
          ...state.currentPlayer, 
          isOnline,
          lastSeen: isOnline ? new Date().toISOString() : state.currentPlayer.lastSeen
        }
      })),
      
      updateOnlinePlayers: (players) => set({ onlinePlayers: players }),
      
      addPlayer: (player) => set((state) => {
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
      
      removePlayer: (playerId) => set((state) => ({
        onlinePlayers: state.onlinePlayers.filter(p => p.id !== playerId),
        allPlayers: state.allPlayers.map(p => 
          p.id === playerId ? { ...p, isOnline: false, lastSeen: new Date().toISOString() } : p
        )
      })),
      
      updatePlayerStatus: (playerId, status) => set((state) => ({
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
      getPlayerById: (playerId) => {
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
      
      isPlayerOnline: (playerId) => {
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
