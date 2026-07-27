// VRF Service - Single source of truth for all VRF operations
//
// Backed by RFC 9381 ECVRF-EDWARDS25519-SHA512-TAI (see ./ecvrf.ts), which
// replaced the earlier ad-hoc Chaum-Pedersen construction over P-256.
//
// Sizes:
//   private key: 32 bytes (64 hex chars)
//   public key:  32 bytes (64 hex chars)
//   proof (pi):  80 bytes = Gamma(32) || c(16) || s(32)
//   vrfOutput:   64 bytes (beta = ECVRF_proof_to_hash)
//   index:       32 bytes = sha256(vrfOutput). beta is already uniformly
//                pseudorandom; the index is kept as a convenience/display
//                value for continuity with the previous API.

import { sha256, sha512 } from '@noble/hashes/sha2';
import * as ecvrf from './ecvrf';
import { VRFKeyPair, VRFResult } from '../../types/vrf.types';

export const VRF_PROOF_LENGTH = ecvrf.PROOF_LENGTH; // 80
export const VRF_OUTPUT_LENGTH = ecvrf.OUTPUT_LENGTH; // 64

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string, expectedBytes: number, what: string): Uint8Array {
  if (typeof hex !== 'string' || !/^[0-9a-fA-F]+$/.test(hex) || hex.length !== expectedBytes * 2) {
    throw new Error(`${what} must be a ${expectedBytes * 2}-character hex string`);
  }
  const out = new Uint8Array(expectedBytes);
  for (let i = 0; i < expectedBytes; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function assertMessage(message: Uint8Array): void {
  if (!ecvrf.isBytes(message) || message.length === 0) {
    throw new Error('Message must be a non-empty Uint8Array');
  }
}

/**
 * VRF Service class - handles all VRF operations
 */
export class VRFService {
  /**
   * Generate a new random key pair for VRF operations.
   * @returns Object containing privateKey and publicKey (hex strings)
   */
  static generateKeyPair(): VRFKeyPair {
    try {
      const secretKey = new Uint8Array(ecvrf.SECRET_KEY_LENGTH);
      crypto.getRandomValues(secretKey);
      return {
        privateKey: bytesToHex(secretKey),
        publicKey: bytesToHex(ecvrf.getPublicKey(secretKey)),
      };
    } catch (error) {
      throw new Error(`Failed to generate key pair: ${(error as Error).message}`);
    }
  }

  /**
   * Deterministically derive a key pair from a seed (e.g. a wallet signature).
   * A 32-byte seed is used directly as the secret key; any other length is
   * compressed to 32 bytes via SHA-512 truncation.
   * @param seed - Seed bytes (must be non-empty)
   */
  static keyPairFromSeed(seed: Uint8Array): VRFKeyPair {
    if (!ecvrf.isBytes(seed) || seed.length === 0) {
      throw new Error('Seed must be a non-empty Uint8Array');
    }
    const secretKey =
      seed.length === ecvrf.SECRET_KEY_LENGTH ? seed : sha512(seed).slice(0, ecvrf.SECRET_KEY_LENGTH);
    return {
      privateKey: bytesToHex(secretKey),
      publicKey: bytesToHex(ecvrf.getPublicKey(secretKey)),
    };
  }

  /**
   * Get public key from private key
   * @param privateKey - Private key in hex format (64 hex chars)
   * @returns Public key in hex format
   */
  static getPublicKeyFromPrivate(privateKey: string): string {
    try {
      const secretKey = hexToBytes(privateKey, ecvrf.SECRET_KEY_LENGTH, 'Private key');
      return bytesToHex(ecvrf.getPublicKey(secretKey));
    } catch (error) {
      throw new Error(`Failed to derive public key: ${(error as Error).message}`);
    }
  }

  /**
   * Evaluate the VRF for a given private key and message.
   * @param privateKey - Private key (64-char hex string)
   * @param message - Message to evaluate VRF for (non-empty)
   * @returns vrfOutput (64-byte beta), proof (80-byte pi), index (sha256(beta))
   */
  static evaluate(privateKey: string, message: Uint8Array): VRFResult {
    try {
      const secretKey = hexToBytes(privateKey, ecvrf.SECRET_KEY_LENGTH, 'Private key');
      assertMessage(message);

      const proof = ecvrf.prove(secretKey, message);
      const vrfOutput = ecvrf.proofToHash(proof);
      const index = sha256(vrfOutput);

      return { index, proof, vrfOutput };
    } catch (error) {
      throw new Error(`VRF evaluation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Verify a VRF proof against (publicKey, message) and return the 64-byte
   * VRF output beta. Throws if the proof is invalid. This is the RFC 9381
   * ECVRF_verify operation and the correct way to bind a claimed vrfOutput
   * to a proof: verify, then compare the returned beta to the claim.
   * @param publicKey - Public key (64-char hex string)
   * @param message - Original message
   * @param proof - 80-byte VRF proof (pi)
   * @returns The verified 64-byte VRF output (beta)
   */
  static verify(publicKey: string, message: Uint8Array, proof: Uint8Array): Uint8Array {
    try {
      const publicKeyBytes = hexToBytes(publicKey, ecvrf.PUBLIC_KEY_LENGTH, 'Public key');
      assertMessage(message);
      return ecvrf.verify(publicKeyBytes, message, proof);
    } catch (error) {
      throw new Error(`VRF verification failed: ${(error as Error).message}`);
    }
  }

  /**
   * Verify a VRF proof and return the 32-byte index (sha256 of the verified
   * VRF output). Kept for API continuity; throws if the proof is invalid.
   * @param publicKey - Public key (hex string)
   * @param message - Original message
   * @param proof - VRF proof as byte array
   * @returns Verified index if valid, throws error if invalid
   */
  static proofToHash(publicKey: string, message: Uint8Array, proof: Uint8Array): Uint8Array {
    return sha256(VRFService.verify(publicKey, message, proof));
  }
}

// Legacy exports for backward compatibility
export const generateKey = VRFService.generateKeyPair;
export const evaluate = VRFService.evaluate;
export const proofToHash = VRFService.proofToHash;
