import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { VRFStoreState, VRFStoreActions, VRFKeyPair, VRFFormattedResult } from '../types/vrf.types';

type VRFStore = VRFStoreState & VRFStoreActions;

const useVRFStore = create<VRFStore>()(
  devtools(
    (set, get) => ({
      // State
      keyPair: { privateKey: '', publicKey: '' },
      vrfResults: [],
      isGenerating: false,
      error: null,
      testMessage: '',
      testResult: null,
      verificationResult: null,
      
      // Actions
      setKeyPair: (keyPair: VRFKeyPair) => set({ keyPair }),
      
      setTestMessage: (message: string) => set({ testMessage: message }),
      
      setVRFResult: (result: VRFFormattedResult) => set((state) => ({
        testResult: result,
        vrfResults: [...state.vrfResults, result],
        error: null
      })),
      
      setVerificationResult: (result: boolean) => set({ verificationResult: result }),
      
      setGenerating: (isGenerating: boolean) => set({ isGenerating }),
      
      setError: (error: string | null) => set({ error }),
      
      clearError: () => set({ error: null }),
      
      clearResults: () => set({ 
        vrfResults: [],
        testResult: null,
        verificationResult: null,
        error: null
      }),
      
      clearAll: () => set({
        keyPair: null,
        vrfResults: [],
        testMessage: '',
        testResult: null,
        verificationResult: null,
        isGenerating: false,
        error: null
      }),
      
      // Getters
      hasKeyPair: () => {
        const { keyPair } = get();
        return keyPair !== null && keyPair.publicKey !== '' && keyPair.privateKey !== '';
      },
      
      getLatestResult: () => {
        const { vrfResults } = get();
        return vrfResults.length > 0 ? vrfResults[vrfResults.length - 1] : null;
      },
      
      getResultsCount: () => {
        const { vrfResults } = get();
        return vrfResults.length;
      }
    }),
    {
      name: 'vrf-store'
    }
  )
);

export default useVRFStore;
