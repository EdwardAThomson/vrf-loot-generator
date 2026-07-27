// Loot Service - Handles loot generation using VRF
import { VRFService } from '../vrf/vrf.service';
import { LOOT_CONSTANTS } from '../../constants/loot.constants';
import { toHexString, fromHexString } from '../../utils/format.utils';
import { buildItemMessage } from '../../utils/message.utils';
import { LootItem, VRFData } from '../../types/loot.types';

/** Constant-length byte-array equality check */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Loot Service class - handles loot generation and verification
 */
export class LootService {
  /**
   * Generate a single loot item from VRF output
   * @param vrfOutput - VRF output bytes
   * @param vrfData - Optional VRF verification data
   * @returns Generated loot item
   */
  static generateItem(vrfOutput: Uint8Array, vrfData?: VRFData): LootItem {
    try {
      // Hash the VRF output to get better byte distribution
      // Elliptic curve points often start with similar bytes (0x04 for uncompressed)
      const sha256 = require('js-sha256');
      const hashedOutput = sha256.array(vrfOutput);
      const bytes = new Uint8Array(hashedOutput);
      
      // Use different byte ranges for different properties to ensure independence
      const typeIndex = bytes[0] % Object.keys(LOOT_CONSTANTS.TYPES).length;
      const rarityValue = (bytes[1] << 8) | bytes[2]; // Use 2 bytes for better distribution
      const modifierIndex = bytes[3] % Object.keys(LOOT_CONSTANTS.MODIFIERS).length;
      
      // Determine rarity based on value ranges (higher values = rarer)
      let rarity: string;
      const rarityThreshold = rarityValue / 65535; // Normalize to 0-1
      
      if (rarityThreshold < 0.5) {
        rarity = LOOT_CONSTANTS.RARITIES.COMMON;
      } else if (rarityThreshold < 0.8) {
        rarity = LOOT_CONSTANTS.RARITIES.RARE;
      } else if (rarityThreshold < 0.95) {
        rarity = LOOT_CONSTANTS.RARITIES.EPIC;
      } else {
        rarity = LOOT_CONSTANTS.RARITIES.LEGENDARY;
      }
      
      const type = Object.values(LOOT_CONSTANTS.TYPES)[typeIndex];
      const modifier = Object.values(LOOT_CONSTANTS.MODIFIERS)[modifierIndex];
      
      // Generate unique ID using timestamp and random component
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Generate name and get icon
      const name = `${modifier} ${type}`;
      const icon = (LOOT_CONSTANTS.TYPE_ICONS as Record<string, string>)[type] || '⚔️';
      
      return {
        id,
        name,
        type,
        icon,
        rarity,
        modifier,
        vrfData,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to generate loot item: ${(error as Error).message}`);
    }
  }

  /**
   * Generate multiple loot items using VRF
   * @param privateKey - VRF private key
   * @param blockhash - Base message for VRF
   * @param count - Number of items to generate
   * @returns Array of generated loot items
   */
  static generateMultipleItems(privateKey: string, blockhash: string, count: number): LootItem[] {
    try {
      if (count < LOOT_CONSTANTS.LIMITS.MIN_ITEMS || count > LOOT_CONSTANTS.LIMITS.MAX_ITEMS) {
        throw new Error(`Item count must be between ${LOOT_CONSTANTS.LIMITS.MIN_ITEMS} and ${LOOT_CONSTANTS.LIMITS.MAX_ITEMS}`);
      }

      const items: LootItem[] = [];
      
      for (let i = 0; i < count; i++) {
        // Create unique message for each item: blockhash bytes || uint32 big-endian index
        const messageBuffer = buildItemMessage(blockhash, i);

        // Generate VRF for this specific message
        const vrfResult = VRFService.evaluate(privateKey, messageBuffer);

        // Create VRF data for verification
        const vrfData: VRFData = {
          publicKey: VRFService.getPublicKeyFromPrivate(privateKey),
          proof: vrfResult.proof,
          message: toHexString(messageBuffer), // hex representation for display/transport
          blockhash,
          itemIndex: i,
          index: vrfResult.index,
          vrfOutput: vrfResult.vrfOutput
        };
        
        // Generate loot item
        const item = this.generateItem(vrfResult.vrfOutput, vrfData);
        items.push(item);
      }
      
      return items;
    } catch (error) {
      throw new Error(`Failed to generate multiple items: ${(error as Error).message}`);
    }
  }

  /**
   * Verify that a loot item was generated correctly using VRF
   * @param item - Loot item to verify
   * @param publicKey - VRF public key
   * @returns True if item is valid, false otherwise
   */
  static verifyItem(item: LootItem, publicKey: string): boolean {
    try {
      if (!item.vrfData) {
        return false;
      }

      const { proof, vrfOutput, blockhash, itemIndex } = item.vrfData;

      if (!proof || !vrfOutput || !blockhash || typeof itemIndex !== 'number') {
        return false;
      }

      // Convert proof and vrfOutput to Uint8Array if they're strings
      const proofBytes = typeof proof === 'string' ? fromHexString(proof) : proof;
      const vrfOutputBytes = typeof vrfOutput === 'string' ? fromHexString(vrfOutput) : vrfOutput;

      // 1. Reconstruct the message from (blockhash, itemIndex) instead of
      //    trusting a free-form message string supplied with the item.
      const messageBuffer = buildItemMessage(blockhash, itemIndex);

      // 2. Verify the RFC 9381 VRF proof against the reconstructed message
      //    (throws if the proof is invalid) and get the verified output beta.
      const beta = VRFService.verify(publicKey, messageBuffer, proofBytes);

      // 3. Bind the supplied output to the proof: the claimed vrfOutput must
      //    equal proof_to_hash(pi) byte-for-byte. Without this, a valid proof
      //    could be paired with an unrelated output that happens to map to
      //    the claimed properties.
      if (!bytesEqual(beta, vrfOutputBytes)) {
        return false;
      }

      // 4. Generate item from the VRF output to check if properties match
      const verificationItem = this.generateItem(vrfOutputBytes);

      // Check if the item properties match
      return (
        item.type === verificationItem.type &&
        item.rarity === verificationItem.rarity &&
        item.modifier === verificationItem.modifier
      );
    } catch (error) {
      // If verification fails due to invalid VRF proof or other errors, item is invalid
      return false;
    }
  }

  /**
   * Get statistics about item rarity distribution
   * @param items - Array of loot items
   * @returns Statistics object
   */
  static getItemStatistics(items: LootItem[]): Record<string, number> {
    const stats: Record<string, number> = {};
    
    Object.values(LOOT_CONSTANTS.RARITIES).forEach(rarity => {
      stats[rarity] = 0;
    });
    
    items.forEach(item => {
      if (stats[item.rarity] !== undefined) {
        stats[item.rarity]++;
      }
    });
    
    return stats;
  }
}
