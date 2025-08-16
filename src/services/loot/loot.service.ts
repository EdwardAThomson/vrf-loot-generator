// Loot Service - Handles loot generation using VRF
import { VRFService } from '../vrf/vrf.service';
import { LOOT_CONSTANTS } from '../../constants/loot.constants';
import { toHexString } from '../../utils/format.utils';
import { LootItem, VRFData } from '../../types/loot.types';

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
        // Create unique message for each item by appending index
        const message = `${blockhash}-${i}`;
        const messageBuffer = new TextEncoder().encode(message);
        
        // Generate VRF for this specific message
        const vrfResult = VRFService.evaluate(privateKey, messageBuffer);
        
        // Create VRF data for verification
        const vrfData: VRFData = {
          publicKey: VRFService.getPublicKeyFromPrivate(privateKey),
          proof: vrfResult.proof,
          message,
          blockhash,
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

      const { message, proof, vrfOutput } = item.vrfData;
      
      if (!message || !proof || !vrfOutput) {
        return false;
      }

      // Convert message to buffer
      const messageBuffer = new TextEncoder().encode(message);
      
      // Convert proof and vrfOutput to Uint8Array if they're strings
      const proofBytes = typeof proof === 'string' ? 
        new Uint8Array(proof.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []) : 
        proof;
      
      const vrfOutputBytes = typeof vrfOutput === 'string' ?
        new Uint8Array(vrfOutput.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []) :
        vrfOutput;

      // Verify the VRF proof
      const computedIndex = VRFService.proofToHash(publicKey, messageBuffer, proofBytes);
      
      // Generate item from the VRF output to check if properties match
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
