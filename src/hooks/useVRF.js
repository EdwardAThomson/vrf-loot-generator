// Custom hook for VRF operations
// Separates VRF logic from UI components

import { useState, useCallback } from 'react';
import { VRFService } from '../services/vrf/vrf.service.ts';
import { toHexString, fromHexString } from '../utils/format.utils.js';
import { useVRFStore } from '../store/index.ts';

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
  const generateKeyPair = useCallback(async () => {
    setGenerating(true);
    setStoreError(null);
    
    try {
      const newKeyPair = VRFService.generateKeyPair();
      // Keys are already hex strings from the service
      setStoreKeyPair(newKeyPair);
      return newKeyPair;
    } catch (err) {
      setStoreError(`Failed to generate key pair: ${err.message}`);
      throw err;
    } finally {
      setGenerating(false);
    }
  }, []);

  // Compute VRF output
  const computeVRF = useCallback(async (privateKey, message) => {
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
      const formattedResult = {
        vrfOutput: toHexString(result.vrfOutput),
        proof: toHexString(result.proof),
        index: toHexString(result.index),
        message,
        messageHex: toHexString(msgBuffer)
      };
      
      setVRFResult(formattedResult);
      return formattedResult;
    } catch (err) {
      setStoreError(`VRF computation failed: ${err.message}`);
      throw err;
    } finally {
      setGenerating(false);
    }
  }, []);

  // Verify VRF proof
  const verifyVRF = useCallback(async (publicKeyHex, proofHex, message, expectedVrfOutputHex) => {
    if (!publicKeyHex || !proofHex || !message || !expectedVrfOutputHex) {
      setStoreError('All parameters are required for verification');
      return false;
    }

    setGenerating(true);
    setStoreError(null);
    
    try {
      const msgBuffer = new TextEncoder().encode(message);
      
      // Convert hex strings back to proper format
      const publicKey = publicKeyHex; // Keep as hex for now
      const proof = fromHexString(proofHex);
      
      // Use proofToHash to verify and get the computed index
      const computedIndex = VRFService.proofToHash(publicKey, msgBuffer, proof);
      const computedIndexHex = toHexString(computedIndex);
      
      // Compare with expected VRF output (which should be the index)
      return computedIndexHex === expectedVrfOutputHex;
    } catch (err) {
      setStoreError(`VRF verification failed: ${err.message}`);
      return false;
    } finally {
      setGenerating(false);
    }
  }, []);

  // Convert proof to hash
  const proofToHash = useCallback((proof) => {
    try {
      setStoreError(null);
      return VRFService.proofToHash(proof);
    } catch (err) {
      setStoreError(`Proof to hash conversion failed: ${err.message}`);
      return null;
    }
  }, []);

  // Reset all state
  const reset = useCallback(() => {
    setStoreKeyPair({ privateKey: '', publicKey: '' });
    setVRFResult(null);
    setStoreError(null);
    setGenerating(false);
  }, [setStoreKeyPair, setVRFResult, setStoreError, setGenerating]);

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
