// Custom hook for loot generation
import { useState, useCallback } from 'react';
import { LootService } from '../services/loot/loot.service.js';
import { LOOT_CONSTANTS } from '../constants/loot.constants.js';

/**
 * Custom hook for loot generation with error handling and loading states
 */
export const useLootGeneration = () => {
  const [generatedItems, setGeneratedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Generate multiple loot items
  const generateLoot = useCallback(async (privateKey, blockhash, count = LOOT_CONSTANTS.LIMITS.DEFAULT_ITEMS) => {
    if (!privateKey || !blockhash) {
      setError('Private key and blockhash are required');
      return [];
    }

    if (count < LOOT_CONSTANTS.LIMITS.MIN_ITEMS || count > LOOT_CONSTANTS.LIMITS.MAX_ITEMS) {
      setError(`Item count must be between ${LOOT_CONSTANTS.LIMITS.MIN_ITEMS} and ${LOOT_CONSTANTS.LIMITS.MAX_ITEMS}`);
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const items = LootService.generateMultipleItems(privateKey, blockhash, count);
      setGeneratedItems(items);
      return items;
    } catch (err) {
      setError(`Loot generation failed: ${err.message}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Generate a single item
  const generateSingleItem = useCallback(async (vrfOutput, vrfData = null) => {
    setIsLoading(true);
    setError(null);

    try {
      const item = LootService.generateItem(vrfOutput, vrfData);
      setGeneratedItems(prev => [...prev, item]);
      return item;
    } catch (err) {
      setError(`Item generation failed: ${err.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Verify an item
  const verifyItem = useCallback(async (item, publicKey) => {
    if (!item || !publicKey) {
      setError('Item and public key are required for verification');
      return false;
    }

    try {
      setError(null);
      return LootService.verifyItem(item, publicKey);
    } catch (err) {
      setError(`Item verification failed: ${err.message}`);
      return false;
    }
  }, []);

  // Clear generated items
  const clearItems = useCallback(() => {
    setGeneratedItems([]);
    setError(null);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Get items by rarity
  const getItemsByRarity = useCallback((rarity) => {
    return generatedItems.filter(item => item.rarity === rarity);
  }, [generatedItems]);

  // Get rarity statistics
  const getRarityStats = useCallback(() => {
    const stats = {};
    Object.values(LOOT_CONSTANTS.RARITIES).forEach(rarity => {
      stats[rarity] = generatedItems.filter(item => item.rarity === rarity).length;
    });
    return stats;
  }, [generatedItems]);

  return {
    // State
    generatedItems,
    isLoading,
    error,
    
    // Actions
    generateLoot,
    generateSingleItem,
    verifyItem,
    clearItems,
    clearError,
    
    // Utilities
    getItemsByRarity,
    getRarityStats
  };
};
