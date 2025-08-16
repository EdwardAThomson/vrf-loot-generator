import { renderHook, act } from '@testing-library/react';
import useInventoryStore from '../inventory.store.ts';

describe('useInventoryStore', () => {
  beforeEach(() => {
    // Reset store before each test
    act(() => {
      useInventoryStore.getState().clearInventory();
    });
  });

  test('should initialize with empty inventory', () => {
    const { result } = renderHook(() => useInventoryStore());
    
    expect(result.current.items).toEqual([]);
    expect(result.current.selectedItems).toEqual([]);
    expect(result.current.totalItems).toBe(0);
  });

  test('should add single item to inventory', () => {
    const { result } = renderHook(() => useInventoryStore());
    const testItem = { type: 'Sword', rarity: 'Common', modifier: 'Sharp' };
    
    act(() => {
      result.current.addItem(testItem);
    });
    
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject(testItem);
    expect(result.current.items[0]).toHaveProperty('id');
    expect(result.current.totalItems).toBe(1);
  });

  test('should add multiple items to inventory', () => {
    const { result } = renderHook(() => useInventoryStore());
    const testItems = [
      { type: 'Sword', rarity: 'Common', modifier: 'Sharp' },
      { type: 'Axe', rarity: 'Rare', modifier: 'Heavy' }
    ];
    
    act(() => {
      result.current.addItems(testItems);
    });
    
    expect(result.current.items).toHaveLength(2);
    expect(result.current.totalItems).toBe(2);
    result.current.items.forEach(item => {
      expect(item).toHaveProperty('id');
    });
  });

  test('should remove item from inventory', () => {
    const { result } = renderHook(() => useInventoryStore());
    const testItem = { type: 'Sword', rarity: 'Common', modifier: 'Sharp' };
    
    act(() => {
      result.current.addItem(testItem);
    });
    
    const itemId = result.current.items[0].id;
    
    act(() => {
      result.current.removeItem(itemId);
    });
    
    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalItems).toBe(0);
  });

  test('should select and deselect items', () => {
    const { result } = renderHook(() => useInventoryStore());
    const testItem = { type: 'Sword', rarity: 'Common', modifier: 'Sharp' };
    
    act(() => {
      result.current.addItem(testItem);
    });
    
    const itemId = result.current.items[0].id;
    
    // Select item
    act(() => {
      result.current.selectItem(itemId);
    });
    
    expect(result.current.selectedItems).toContain(itemId);
    
    // Deselect item
    act(() => {
      result.current.selectItem(itemId);
    });
    
    expect(result.current.selectedItems).not.toContain(itemId);
  });

  test('should get selected items', () => {
    const { result } = renderHook(() => useInventoryStore());
    const testItems = [
      { type: 'Sword', rarity: 'Common', modifier: 'Sharp' },
      { type: 'Axe', rarity: 'Rare', modifier: 'Heavy' }
    ];
    
    act(() => {
      result.current.addItems(testItems);
    });
    
    const firstItemId = result.current.items[0].id;
    
    act(() => {
      result.current.selectItem(firstItemId);
    });
    
    const selectedItems = result.current.getSelectedItems();
    expect(selectedItems).toHaveLength(1);
    expect(selectedItems[0].id).toBe(firstItemId);
  });

  test('should get items by rarity', () => {
    const { result } = renderHook(() => useInventoryStore());
    const testItems = [
      { type: 'Sword', rarity: 'Common', modifier: 'Sharp' },
      { type: 'Axe', rarity: 'Rare', modifier: 'Heavy' },
      { type: 'Shield', rarity: 'Common', modifier: 'Sturdy' }
    ];
    
    act(() => {
      result.current.addItems(testItems);
    });
    
    const commonItems = result.current.getItemsByRarity('Common');
    expect(commonItems).toHaveLength(2);
    
    const rareItems = result.current.getItemsByRarity('Rare');
    expect(rareItems).toHaveLength(1);
  });

  test('should calculate item statistics', () => {
    const { result } = renderHook(() => useInventoryStore());
    const testItems = [
      { type: 'Sword', rarity: 'Common', modifier: 'Sharp' },
      { type: 'Axe', rarity: 'Rare', modifier: 'Heavy' },
      { type: 'Shield', rarity: 'Common', modifier: 'Sturdy' },
      { type: 'Bow', rarity: 'Epic', modifier: 'Precise' }
    ];
    
    act(() => {
      result.current.addItems(testItems);
    });
    
    const stats = result.current.getItemStats();
    
    expect(stats.total).toBe(4);
    expect(stats.byRarity.Common).toBe(2);
    expect(stats.byRarity.Rare).toBe(1);
    expect(stats.byRarity.Epic).toBe(1);
    expect(stats.rarityPercentages.Common).toBe('50.0');
    expect(stats.rarityPercentages.Rare).toBe('25.0');
  });

  test('should clear inventory', () => {
    const { result } = renderHook(() => useInventoryStore());
    const testItems = [
      { type: 'Sword', rarity: 'Common', modifier: 'Sharp' },
      { type: 'Axe', rarity: 'Rare', modifier: 'Heavy' }
    ];
    
    act(() => {
      result.current.addItems(testItems);
    });
    
    act(() => {
      result.current.selectItem(result.current.items[0].id);
    });
    
    act(() => {
      result.current.clearInventory();
    });
    
    expect(result.current.items).toHaveLength(0);
    expect(result.current.selectedItems).toHaveLength(0);
    expect(result.current.totalItems).toBe(0);
  });
});
