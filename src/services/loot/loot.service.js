// Loot Generation Service
// Consolidated from original TradeVRF.js and item generation logic

import { VRFService } from '../vrf/vrf.service.js';
import { LOOT_CONSTANTS } from '../../constants/loot.constants.js';

/**
 * Service for generating loot items using VRF
 */
export class LootService {
  /**
   * Generate a single loot item from VRF output
   * @param {string} vrfOutput - VRF output hash
   * @param {Object} vrfData - Original VRF data for verification
   * @returns {Object} Generated loot item
   */
  static generateItem(vrfOutput, vrfData = null) {
    try {
      if (!vrfOutput) {
        throw new Error('VRF output is required');
      }

      // Normalize vrfOutput to hex string if it's a byte array
      const vrfOutputHex = typeof vrfOutput === 'string'
        ? vrfOutput
        : this._bytesToHex(vrfOutput);

      // Convert VRF output to deterministic properties
      const properties = this._determineItemProperties(vrfOutputHex);
      
      // Create unique item ID
      const itemId = this._generateItemId(vrfOutputHex, vrfData);
      
      return {
        id: itemId,
        ...properties,
        vrfData: vrfData ? {
          // Ensure vrfOutput in vrfData is a hex string for UI display
          vrfOutput: vrfOutputHex,
          ...vrfData
        } : null,
        createdAt: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to generate loot item: ${error.message}`);
    }
  }

  /**
   * Generate multiple loot items using VRF
   * @param {string} privateKey - Private key for VRF
   * @param {string} blockhash - Base blockhash for generation
   * @param {number} count - Number of items to generate
   * @returns {Array} Array of generated loot items
   */
  static generateMultipleItems(privateKey, blockhash, count = 5) {
    try {
      if (!privateKey || !blockhash) {
        throw new Error('Private key and blockhash are required');
      }

      if (count < 1 || count > 50) {
        throw new Error('Count must be between 1 and 50');
      }

      const items = [];

      for (let i = 0; i < count; i++) {
        // Create unique message for each item
        const message = blockhash + i.toString(16);
        const msgBuffer = new TextEncoder().encode(message);
        
        // Generate VRF for this item
        const vrfResult = VRFService.evaluate(privateKey, msgBuffer);
        
        // Generate item from VRF result
        const item = this.generateItem(vrfResult.vrfOutput, {
          blockhash,
          index: i,
          ...vrfResult
        });
        
        items.push(item);
      }

      return items;
    } catch (error) {
      throw new Error(`Failed to generate multiple items: ${error.message}`);
    }
  }

  /**
   * Verify that a loot item was generated correctly
   * @param {Object} item - Loot item to verify
   * @param {string} publicKey - Public key for verification
   * @returns {boolean} True if item is valid
   */
  static verifyItem(item, publicKey) {
    try {
      if (!item || !item.vrfData || !publicKey) {
        return false;
      }

      const { blockhash, index, vrfOutput, proof } = item.vrfData;
      
      // Reconstruct the original message
      const message = blockhash + index.toString(16);
      const msgBuffer = new TextEncoder().encode(message);
      
      // Verify the VRF proof by recomputing the index from the proof
      // and ensuring it matches the stored index
      const verifiedIndex = VRFService.proofToHash(publicKey, msgBuffer, proof);
      const storedIndex = item.vrfData.index;
      if (!Array.isArray(verifiedIndex) || !Array.isArray(storedIndex) || verifiedIndex.length !== storedIndex.length) {
        return false;
      }
      for (let i = 0; i < verifiedIndex.length; i++) {
        if (verifiedIndex[i] !== storedIndex[i]) {
          return false;
        }
      }
      
      // Verify the item properties match the VRF output
      const expectedProperties = this._determineItemProperties(vrfOutput);
      
      return (
        item.name === expectedProperties.name &&
        item.type === expectedProperties.type &&
        item.rarity === expectedProperties.rarity &&
        item.modifier === expectedProperties.modifier
      );
    } catch (error) {
      console.error('Item verification failed:', error);
      return false;
    }
  }

  // Private helper methods
  static _determineItemProperties(vrfOutput) {
    // Convert VRF output to bytes for deterministic property selection
    // VRF output is an uncompressed EC point starting with 0x04 (prefix).
    // Skip the first byte to avoid biasing rarity toward 'Common'.
    const bytes = this._hexToBytes(vrfOutput.substring(2, 34)); // Skip '04', take next 32 hex chars (16 bytes)
    
    // Determine rarity (first 2 bytes)
    const rarityValue = (bytes[0] << 8) | bytes[1];
    const rarity = this._determineRarity(rarityValue);
    
    // Determine type (next 2 bytes)
    const typeValue = (bytes[2] << 8) | bytes[3];
    const type = this._determineType(typeValue);
    
    // Determine modifier (next 2 bytes)
    const modifierValue = (bytes[4] << 8) | bytes[5];
    const modifier = this._determineModifier(modifierValue);
    
    // Generate name
    const name = this._generateName(type, modifier, rarity);
    
    // Get visual properties
    const visual = this._getVisualProperties(type, rarity);
    
    return {
      name,
      type,
      rarity,
      modifier,
      ...visual
    };
  }

  static _determineRarity(value) {
    const normalized = value / 65535; // Normalize to 0-1
    
    if (normalized < 0.5) return LOOT_CONSTANTS.RARITIES.COMMON;
    if (normalized < 0.8) return LOOT_CONSTANTS.RARITIES.RARE;
    if (normalized < 0.95) return LOOT_CONSTANTS.RARITIES.EPIC;
    return LOOT_CONSTANTS.RARITIES.LEGENDARY;
  }

  static _determineType(value) {
    const types = Object.values(LOOT_CONSTANTS.TYPES);
    const index = value % types.length;
    return types[index];
  }

  static _determineModifier(value) {
    const modifiers = Object.values(LOOT_CONSTANTS.MODIFIERS);
    const index = value % modifiers.length;
    return modifiers[index];
  }

  static _generateName(type, modifier, rarity) {
    return `${modifier} ${type}`;
  }

  static _getVisualProperties(type, rarity) {
    const typeIcons = {
      [LOOT_CONSTANTS.TYPES.SWORD]: '⚔️',
      [LOOT_CONSTANTS.TYPES.AXE]: '🪓',
      [LOOT_CONSTANTS.TYPES.SHIELD]: '🛡️',
      [LOOT_CONSTANTS.TYPES.BOW]: '🏹',
      [LOOT_CONSTANTS.TYPES.STAFF]: '🔮',
      [LOOT_CONSTANTS.TYPES.DAGGER]: '🗡️'
    };

    const rarityColors = {
      [LOOT_CONSTANTS.RARITIES.COMMON]: '#9e9e9e',
      [LOOT_CONSTANTS.RARITIES.RARE]: '#2196f3',
      [LOOT_CONSTANTS.RARITIES.EPIC]: '#9c27b0',
      [LOOT_CONSTANTS.RARITIES.LEGENDARY]: '#ff9800'
    };

    return {
      icon: typeIcons[type] || '❓',
      color: rarityColors[rarity] || '#9e9e9e'
    };
  }

  static _generateItemId(vrfOutput, vrfData) {
    const timestamp = Date.now();
    const hash = vrfOutput.substring(0, 8);
    const index = vrfData?.index || 0;
    return `item_${timestamp}_${hash}_${index}`;
  }

  static _hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
  }

  static _bytesToHex(bytes) {
    if (!bytes) return '';
    // Support both Uint8Array and regular arrays
    const arr = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
    let hex = '';
    for (let i = 0; i < arr.length; i++) {
      const h = arr[i].toString(16).padStart(2, '0');
      hex += h;
    }
    return hex;
  }
}
