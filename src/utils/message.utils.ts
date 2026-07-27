// Message construction utilities for VRF loot generation.
//
// Per docs/BLOCKCHAIN_ROGUELIKE_ARCHITECTURE.md ("Index Encoding"), the per-item
// VRF input message is `tx_hash bytes || uint32 big-endian index`. Using a
// fixed-width binary index (instead of string concatenation like
// `${blockhash}-${i}`) makes the encoding unambiguous: distinct
// (blockhash, index) pairs always produce distinct messages, and a chain
// verifier can reconstruct the exact bytes.

import { fromHexString } from './format.utils';

const HEX_RE = /^[0-9a-fA-F]+$/;

/**
 * Decode a blockhash string to bytes.
 *
 * Encoding choice (documented deliberately): if the string, after stripping an
 * optional `0x` prefix, is a non-empty even-length hex string, it is decoded as
 * hex bytes (the normal case for real transaction/block hashes). Otherwise it
 * is encoded as UTF-8 bytes (demo/test blockhashes like "alice-demo-...").
 */
export function blockhashToBytes(blockhash: string): Uint8Array {
  const stripped = blockhash.startsWith('0x') || blockhash.startsWith('0X')
    ? blockhash.slice(2)
    : blockhash;

  if (stripped.length > 0 && stripped.length % 2 === 0 && HEX_RE.test(stripped)) {
    return fromHexString(stripped);
  }

  return new TextEncoder().encode(blockhash);
}

/**
 * Build the per-item VRF input message: blockhash bytes || uint32 big-endian index.
 *
 * @param blockhash - Blockhash / tx hash (hex or free-form string, see blockhashToBytes)
 * @param index - Item index (non-negative integer, must fit in uint32)
 * @returns Message bytes to feed to the VRF
 */
export function buildItemMessage(blockhash: string, index: number): Uint8Array {
  if (!Number.isInteger(index) || index < 0 || index > 0xffffffff) {
    throw new Error(`Item index must be an integer in [0, 2^32): got ${index}`);
  }

  const hashBytes = blockhashToBytes(blockhash);
  const message = new Uint8Array(hashBytes.length + 4);
  message.set(hashBytes, 0);
  message[hashBytes.length] = (index >>> 24) & 0xff;
  message[hashBytes.length + 1] = (index >>> 16) & 0xff;
  message[hashBytes.length + 2] = (index >>> 8) & 0xff;
  message[hashBytes.length + 3] = index & 0xff;
  return message;
}
