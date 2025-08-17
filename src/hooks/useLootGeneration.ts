// Custom hook for loot generation
import { useState, useCallback } from 'react';
import { LootService } from '../services/loot/loot.service';
import { LOOT_CONSTANTS } from '../constants/loot.constants';
import { useInventoryStore } from '../store/index';
import { LootItem, VRFData } from '../types/loot.types';

/**
 * Custom hook for loot generation with error handling and loading states
 */
export const useLootGeneration = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use Zustand store for inventory management
  const { addItems, items: generatedItems, clearInventory } = useInventoryStore();

  // Generate multiple loot items
  const generateLoot = useCallback(async (privateKey: string, blockhash: string, count: number = LOOT_CONSTANTS.LIMITS.DEFAULT_ITEMS): Promise<LootItem[]> => {
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
      addItems(items);
      return items;
    } catch (err) {
      const error = err as Error;
      setError(`Loot generation failed: ${error.message}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [addItems]);

  // Generate a single item
  const generateSingleItem = useCallback(async (vrfOutput: Uint8Array, vrfData?: VRFData): Promise<LootItem | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const item = LootService.generateItem(vrfOutput, vrfData);
      addItems([item]);
      return item;
    } catch (err) {
      const error = err as Error;
      setError(`Item generation failed: ${error.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [addItems]);

  // Verify an item
  const verifyItem = useCallback(async (item: LootItem, publicKey: string): Promise<boolean> => {
    if (!item || !publicKey) {
      setError('Item and public key are required for verification');
      return false;
    }

    try {
      setError(null);
      return LootService.verifyItem(item, publicKey);
    } catch (err) {
      const error = err as Error;
      setError(`Item verification failed: ${error.message}`);
      return false;
    }
  }, []);

  // Clear generated items
  const clearItems = useCallback(() => {
    clearInventory();
    setError(null);
  }, [clearInventory]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Get items by rarity
  const getItemsByRarity = useCallback((rarity: string): LootItem[] => {
    return generatedItems.filter(item => item.rarity === rarity);
  }, [generatedItems]);

  // Get rarity statistics
  const getRarityStats = useCallback((): Record<string, number> => {
    const stats: Record<string, number> = {};
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
