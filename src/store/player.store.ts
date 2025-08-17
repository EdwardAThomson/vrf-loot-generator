import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Player } from '../types/websocket.types';

interface PlayerState {
  // Session data
  playerName: string | null;
  isLoggedIn: boolean;
  currentPlayer: Player | null;
  
  // Actions
  setPlayerName: (name: string) => void;
  setCurrentPlayer: (player: Player | null) => void;
  login: (name: string) => void;
  logout: () => void;
  clearSession: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      // Initial state
      playerName: null,
      isLoggedIn: false,
      currentPlayer: null,

      // Actions
      setPlayerName: (name: string) => {
        set({ playerName: name });
      },

      setCurrentPlayer: (player: Player | null) => {
        set({ currentPlayer: player });
      },

      login: (name: string) => {
        set({ 
          playerName: name, 
          isLoggedIn: true 
        });
      },

      logout: () => {
        set({ 
          isLoggedIn: false,
          currentPlayer: null
        });
      },

      clearSession: () => {
        set({
          playerName: null,
          isLoggedIn: false,
          currentPlayer: null
        });
      }
    }),
    {
      name: 'vrf-player-session', // localStorage key
      partialize: (state) => ({
        playerName: state.playerName,
        isLoggedIn: state.isLoggedIn
      })
    }
  )
);
