// Custom hook for VRF operations
// Separates VRF logic from UI components

import { useCallback } from 'react';
import { VRFService } from '../services/vrf/vrf.service';
import { toHexString, fromHexString } from '../utils/format.utils';
import { useVRFStore } from '../store/index';
import { VRFKeyPair, VRFFormattedResult } from '../types/vrf.types';

/**
 * Custom hook for VRF operations with loading states and error handling
 */
export const useVRF = () => {
  // Use Zustand store for VRF state management
  const { 
    keyPair, 
    testResult: vrfResult, 
    isGenerating: isLoading, 
    error,
    setKeyPair: setStoreKeyPair,
    setVRFResult,
    setGenerating,
    setError: setStoreError,
    clearError
  } = useVRFStore();

  // Generate new key pair
  const generateKeyPair = useCallback(async (): Promise<VRFKeyPair> => {
    setGenerating(true);
    setStoreError(null);
    
    try {
      const newKeyPair = VRFService.generateKeyPair();
      // Keys are already hex strings from the service
      setStoreKeyPair(newKeyPair);
      return newKeyPair;
    } catch (err) {
      const error = err as Error;
      setStoreError(`Failed to generate key pair: ${error.message}`);
      throw err;
    } finally {
      setGenerating(false);
    }
  }, [setGenerating, setStoreError, setStoreKeyPair]);

  // Compute VRF output
  const computeVRF = useCallback(async (privateKey: string, message: string): Promise<VRFFormattedResult | null> => {
    if (!privateKey || !message) {
      setStoreError('Private key and message are required');
      return null;
    }

    setGenerating(true);
    setStoreError(null);
    
    try {
      const msgBuffer = new TextEncoder().encode(message);
      const result = VRFService.evaluate(privateKey, msgBuffer);
      
      // Convert arrays to hex strings for display
      // Proof format: [s, t, vrf] where s=32 bytes, t=32 bytes, vrf=65 bytes
      const formattedResult: VRFFormattedResult = {
        vrfOutput: toHexString(result.vrfOutput),
        proof: {
          gamma: toHexString(result.proof.slice(64)), // VRF point (65 bytes)
          c: toHexString(result.proof.slice(0, 32)),   // s value (32 bytes)
          s: toHexString(result.proof.slice(32, 64))   // t value (32 bytes)
        },
        index: toHexString(result.index),
        message,
        publicKey: keyPair?.publicKey || ''
      };
      
      setVRFResult(formattedResult);
      return formattedResult;
    } catch (err) {
      const error = err as Error;
      setStoreError(`VRF computation failed: ${error.message}`);
      throw err;
    } finally {
      setGenerating(false);
    }
  }, [setGenerating, setStoreError, setVRFResult]);

  // Verify VRF proof
  const verifyVRF = useCallback(async (publicKeyHex: string, proofInput: string, message: string, expectedVrfOutputHex: string): Promise<boolean> => {
    if (!publicKeyHex || !proofInput || !message || !expectedVrfOutputHex) {
      setStoreError('All parameters are required for verification');
      return false;
    }

    setGenerating(true);
    setStoreError(null);
    
    try {
      const msgBuffer = new TextEncoder().encode(message);
      
      // Handle different proof formats
      let proof: Uint8Array;
      
      // Check if proof is in formatted object format (gamma-c-s)
      if (proofInput.includes('-')) {
        const parts = proofInput.split('-');
        if (parts.length === 3) {
          // The display format is gamma-c-s, where:
          // gamma = VRF point (65 bytes), c = s value (32 bytes), s = t value (32 bytes)
          // Reconstruct original proof format: [s, t, vrf]
          const s = fromHexString(parts[1]); // c field = s value (32 bytes)
          const t = fromHexString(parts[2]); // s field = t value (32 bytes)  
          const vrf = fromHexString(parts[0]); // gamma field = VRF point (65 bytes)
          
          proof = new Uint8Array([...s, ...t, ...vrf]);
        } else {
          throw new Error('Invalid proof format. Expected gamma-c-s format.');
        }
      } else {
        // Assume it's a raw hex string
        proof = fromHexString(proofInput);
      }
      
      // Use proofToHash to verify and get the computed index
      const computedIndex = VRFService.proofToHash(publicKeyHex, msgBuffer, proof);
      const computedIndexHex = toHexString(computedIndex);
      
      // Compare with expected VRF output (which should be the index)
      return computedIndexHex === expectedVrfOutputHex;
    } catch (err) {
      const error = err as Error;
      setStoreError(`VRF verification failed: ${error.message}`);
      return false;
    } finally {
      setGenerating(false);
    }
  }, [setGenerating, setStoreError]);

  // Convert proof to hash
  const proofToHash = useCallback((publicKey: string, message: Uint8Array, proof: Uint8Array): Uint8Array | null => {
    try {
      setStoreError(null);
      return VRFService.proofToHash(publicKey, message, proof);
    } catch (err) {
      const error = err as Error;
      setStoreError(`Proof to hash conversion failed: ${error.message}`);
      return null;
    }
  }, [setStoreError]);

  // Reset all state
  const reset = useCallback(() => {
    setStoreKeyPair({ privateKey: '', publicKey: '' });
    clearError();
    setGenerating(false);
  }, [setStoreKeyPair, clearError, setGenerating]);

  return {
    // State
    keyPair,
    vrfResult,
    isLoading,
    error,
    
    // Actions
    generateKeyPair,
    computeVRF,
    verifyVRF,
    proofToHash,
    clearError,
    reset,
    
    // Utilities
    setKeyPair: setStoreKeyPair // Allow manual key pair setting
  };
};
