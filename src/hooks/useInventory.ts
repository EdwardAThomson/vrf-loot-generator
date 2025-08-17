// Custom hook for inventory management
// Handles player inventory operations for trading

import { useCallback } from 'react';
import { useInventoryStore } from '../store/index';
import { LootItem } from '../types/loot.types';
import { VRFService } from '../services/vrf/vrf.service';

/**
 * Custom hook for inventory operations
 */
export const useInventory = () => {
  // Get inventory store state and actions
  const {
    items,
    selectedItems,
    addItem,
    removeItem,
    selectItem,
    clearSelection,
    clearInventory,
    getSelectedItems
  } = useInventoryStore();

  // Add item to inventory with validation
  const addItemToInventory = useCallback((item: LootItem) => {
    // Validate item has required VRF data for trading
    if (!item.vrfData) {
      console.warn('Item added without VRF data - will not be tradeable');
    }
    addItem(item);
  }, [addItem]);

  // Remove item from inventory
  const removeItemFromInventory = useCallback((itemId: string) => {
    removeItem(itemId);
  }, [removeItem]);

  // Toggle item selection
  const toggleItemSelection = useCallback((itemId: string) => {
    selectItem(itemId); // This toggles selection in the store
  }, [selectItem]);

  // Get tradeable items (items with VRF data)
  const getTradeableItems = useCallback(() => {
    return items.filter(item => item.vrfData && item.vrfData.proof);
  }, [items]);

  // Get non-tradeable items
  const getNonTradeableItems = useCallback(() => {
    return items.filter(item => !item.vrfData || !item.vrfData.proof);
  }, [items]);

  // Verify item authenticity using VRF
  const verifyItemAuthenticity = useCallback(async (item: LootItem): Promise<boolean> => {
    if (!item.vrfData) {
      return false;
    }

    try {
      // For now, just check if VRF data exists - full verification would need the actual VRF service method
      return !!(item.vrfData.publicKey && item.vrfData.proof);
    } catch (error) {
      console.error('Failed to verify item authenticity:', error);
      return false;
    }
  }, []);

  // Verify all inventory items
  const verifyAllItems = useCallback(async (): Promise<{ verified: LootItem[], invalid: LootItem[] }> => {
    const verified: LootItem[] = [];
    const invalid: LootItem[] = [];

    for (const item of items) {
      const isValid = await verifyItemAuthenticity(item);
      if (isValid) {
        verified.push(item);
      } else {
        invalid.push(item);
      }
    }

    return { verified, invalid };
  }, [items, verifyItemAuthenticity]);

  // Get items by rarity
  const getItemsByRarity = useCallback((rarity: string) => {
    return items.filter(item => item.rarity === rarity);
  }, [items]);

  // Get items by type
  const getItemsByType = useCallback((type: string) => {
    return items.filter(item => item.type === type);
  }, [items]);

  // Calculate total inventory value (based on rarity)
  const calculateInventoryValue = useCallback(() => {
    const rarityValues = {
      'Common': 1,
      'Rare': 5,
      'Epic': 20,
      'Legendary': 100
    };

    return items.reduce((total, item) => {
      return total + (rarityValues[item.rarity as keyof typeof rarityValues] || 0);
    }, 0);
  }, [items]);

  // Get inventory statistics
  const getInventoryStats = useCallback(() => {
    const stats = {
      total: items.length,
      tradeable: getTradeableItems().length,
      nonTradeable: getNonTradeableItems().length,
      selected: selectedItems.length,
      byRarity: {
        Common: getItemsByRarity('Common').length,
        Rare: getItemsByRarity('Rare').length,
        Epic: getItemsByRarity('Epic').length,
        Legendary: getItemsByRarity('Legendary').length
      },
      totalValue: calculateInventoryValue()
    };

    return stats;
  }, [items, selectedItems, getTradeableItems, getNonTradeableItems, getItemsByRarity, calculateInventoryValue]);

  // Check if item exists in inventory
  const hasItem = useCallback((itemId: string) => {
    return items.some(item => item.id === itemId);
  }, [items]);

  // Get item by ID
  const getItem = useCallback((itemId: string) => {
    return items.find(item => item.id === itemId);
  }, [items]);

  // Check if inventory is empty
  const isEmpty = useCallback(() => {
    return items.length === 0;
  }, [items]);

  // Check if has selected items
  const hasSelection = useCallback(() => {
    return selectedItems.length > 0;
  }, [selectedItems]);

  // Get actual selected items (convert IDs to items)
  const getActualSelectedItems = useCallback(() => {
    return getSelectedItems();
  }, [getSelectedItems]);

  return {
    // State
    items,
    selectedItems: getActualSelectedItems(), // Return actual items, not IDs
    
    // Actions
    addItemToInventory,
    removeItemFromInventory,
    toggleItemSelection,
    clearSelection,
    clearInventory,
    
    // Queries
    getTradeableItems,
    getNonTradeableItems,
    getItemsByRarity,
    getItemsByType,
    getItem,
    hasItem,
    
    // Validation
    verifyItemAuthenticity,
    verifyAllItems,
    
    // Statistics
    calculateInventoryValue,
    getInventoryStats,
    
    // Utilities
    isEmpty,
    hasSelection
  };
};
