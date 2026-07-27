import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Player } from '../types/websocket.types';
import { VRFService } from '../services/vrf/vrf.service';

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
      // Version 1: the VRF migrated from P-256 (64+ hex private key,
      // 130-hex uncompressed public key) to ed25519 (64-hex private and
      // public keys). Session blobs written by older builds may carry a
      // keypair in the old format, and zustand's default merge would
      // rehydrate it into the store where any later VRF call throws.
      version: 1,
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as Record<string, unknown>;
        // Drop any stored keypair that does not match the current ed25519
        // format so the UI prompts the user to regenerate keys instead of
        // failing mid-flow. A keypair in the current format is kept as-is.
        for (const field of ['keyPair', 'vrfKeyPair']) {
          if (field in state && state[field] != null && !VRFService.isValidKeyPair(state[field])) {
            state[field] = null;
          }
        }
        // Legacy blobs can carry extra fields; the persist typing only knows
        // about PlayerState, so cast after cleaning.
        return state as unknown as PlayerState;
      },
      partialize: (state) => ({
        playerName: state.playerName,
        isLoggedIn: state.isLoggedIn
      })
    }
  )
);
