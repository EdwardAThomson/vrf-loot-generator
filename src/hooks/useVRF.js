// Custom hook for VRF operations
// Separates VRF logic from UI components

import { useState, useCallback } from 'react';
import { VRFService } from '../services/vrf/vrf.service.js';
import { toHexString, fromHexString } from '../utils/format.utils.js';

/**
 * Custom hook for VRF operations with loading states and error handling
 */
export const useVRF = () => {
  const [keyPair, setKeyPair] = useState({ privateKey: '', publicKey: '' });
  const [vrfResult, setVrfResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Generate new key pair
  const generateKeyPair = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const newKeyPair = VRFService.generateKeyPair();
      // Keys are already hex strings from the service
      setKeyPair(newKeyPair);
      return newKeyPair;
    } catch (err) {
      setError(`Failed to generate key pair: ${err.message}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Compute VRF output
  const computeVRF = useCallback(async (privateKey, message) => {
    if (!privateKey || !message) {
      setError('Private key and message are required');
      return null;
    }

    setIsLoading(true);
    setError(null);
    
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
      
      setVrfResult(formattedResult);
      return formattedResult;
    } catch (err) {
      setError(`VRF computation failed: ${err.message}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Verify VRF proof
  const verifyVRF = useCallback(async (publicKeyHex, proofHex, message, expectedVrfOutputHex) => {
    if (!publicKeyHex || !proofHex || !message || !expectedVrfOutputHex) {
      setError('All parameters are required for verification');
      return false;
    }

    setIsLoading(true);
    setError(null);
    
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
      setError(`VRF verification failed: ${err.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Convert proof to hash
  const proofToHash = useCallback((proof) => {
    try {
      setError(null);
      return VRFService.proofToHash(proof);
    } catch (err) {
      setError(`Proof to hash conversion failed: ${err.message}`);
      return null;
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Reset all state
  const reset = useCallback(() => {
    setKeyPair({ privateKey: '', publicKey: '' });
    setVrfResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

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
    setKeyPair // Allow manual key pair setting
  };
};
