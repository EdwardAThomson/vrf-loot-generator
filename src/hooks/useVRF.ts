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
      // RFC 9381 proof layout: Gamma (32 bytes) || c (16 bytes) || s (32 bytes)
      const formattedResult: VRFFormattedResult = {
        vrfOutput: toHexString(result.vrfOutput),
        proof: {
          gamma: toHexString(result.proof.slice(0, 32)), // Gamma point (32 bytes)
          c: toHexString(result.proof.slice(32, 48)),    // challenge c (16 bytes)
          s: toHexString(result.proof.slice(48, 80))     // scalar s (32 bytes)
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
          // The display format is gamma-c-s, matching the RFC 9381 proof
          // layout: Gamma (32 bytes) || c (16 bytes) || s (32 bytes)
          const gamma = fromHexString(parts[0]); // Gamma point (32 bytes)
          const c = fromHexString(parts[1]);     // challenge c (16 bytes)
          const s = fromHexString(parts[2]);     // scalar s (32 bytes)

          proof = new Uint8Array([...gamma, ...c, ...s]);
        } else {
          throw new Error('Invalid proof format. Expected gamma-c-s format.');
        }
      } else {
        // Assume it's a raw hex string
        proof = fromHexString(proofInput);
      }

      // Verify the proof (throws if invalid) and get the verified VRF output
      // beta = proof_to_hash(pi), plus its sha256 index for display parity.
      const beta = VRFService.verify(publicKeyHex, msgBuffer, proof);
      const betaHex = toHexString(beta);
      const sha256 = require('js-sha256');
      const computedIndexHex = toHexString(new Uint8Array(sha256.array(beta)));

      // Bind the expected output to the verified proof: accept either the
      // 64-byte VRF output beta or its sha256 index; both are derived from
      // the verified proof, so an unrelated output value cannot pass.
      const expected = expectedVrfOutputHex.trim().toLowerCase().replace(/^0x/, '');

      return expected === betaHex || expected === computedIndexHex;
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
