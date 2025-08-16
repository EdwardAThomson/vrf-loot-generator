import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useVRFStore = create(
  devtools(
    (set, get) => ({
      // State
      keyPair: null,
      vrfResults: [],
      isGenerating: false,
      error: null,
      
      // VRF Testing state
      testMessage: '',
      testResult: null,
      verificationResult: null,
      
      // Actions
      setKeyPair: (keyPair) => set({ keyPair }),
      
      setTestMessage: (message) => set({ testMessage: message }),
      
      setVRFResult: (result) => set((state) => ({
        testResult: result,
        vrfResults: [...state.vrfResults, result],
        error: null
      })),
      
      setVerificationResult: (result) => set({ verificationResult: result }),
      
      setGenerating: (isGenerating) => set({ isGenerating }),
      
      setError: (error) => set({ error }),
      
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
        return keyPair && keyPair.publicKey && keyPair.privateKey;
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
