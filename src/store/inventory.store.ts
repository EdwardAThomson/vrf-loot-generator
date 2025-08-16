import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { InventoryStoreState, InventoryStoreActions, LootItem, LootStats } from '../types/loot.types';

type InventoryStore = InventoryStoreState & InventoryStoreActions;

const useInventoryStore = create<InventoryStore>()(
  devtools(
    (set, get) => ({
      // State
      items: [],
      selectedItems: [],
      totalItems: 0,
      
      // Actions
      addItem: (item: Omit<LootItem, 'id'>) => set((state) => {
        const newItem: LootItem = { ...item, id: Date.now() + Math.random().toString() };
        const newItems = [...state.items, newItem];
        return {
          items: newItems,
          totalItems: newItems.length
        };
      }),
      
      addItems: (items: Omit<LootItem, 'id'>[]) => set((state) => {
        const itemsWithIds: LootItem[] = items.map(item => ({ 
          ...item, 
          id: Date.now() + Math.random().toString() + Math.random().toString()
        }));
        const newItems = [...state.items, ...itemsWithIds];
        return {
          items: newItems,
          totalItems: newItems.length
        };
      }),
      
      removeItem: (itemId: string) => set((state) => {
        const newItems = state.items.filter(item => item.id !== itemId);
        return {
          items: newItems,
          selectedItems: state.selectedItems.filter(id => id !== itemId),
          totalItems: newItems.length
        };
      }),
      
      selectItem: (itemId: string) => set((state) => ({
        selectedItems: state.selectedItems.includes(itemId)
          ? state.selectedItems.filter(id => id !== itemId)
          : [...state.selectedItems, itemId]
      })),
      
      clearSelection: () => set({ selectedItems: [] }),
      
      clearInventory: () => set({ 
        items: [], 
        selectedItems: [], 
        totalItems: 0 
      }),
      
      // Getters
      getSelectedItems: () => {
        const { items, selectedItems } = get();
        return items.filter(item => selectedItems.includes(item.id));
      },
      
      getItemsByRarity: (rarity: string) => {
        const { items } = get();
        return items.filter(item => item.rarity === rarity);
      },
      
      getItemStats: (): LootStats => {
        const { items } = get();
        const stats = items.reduce((acc, item) => {
          acc[item.rarity] = (acc[item.rarity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        return {
          total: items.length,
          byRarity: stats,
          rarityPercentages: Object.entries(stats).reduce((acc, [rarity, count]) => {
            acc[rarity] = ((count / items.length) * 100).toFixed(1);
            return acc;
          }, {} as Record<string, string>)
        };
      }
    }),
    {
      name: 'inventory-store'
    }
  )
);

export default useInventoryStore;
