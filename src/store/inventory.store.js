import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useInventoryStore = create(
  devtools(
    (set, get) => ({
      // State
      items: [],
      selectedItems: [],
      totalItems: 0,
      
      // Actions
      addItem: (item) => set((state) => {
        const newItems = [...state.items, { ...item, id: Date.now() + Math.random() }];
        return {
          items: newItems,
          totalItems: newItems.length
        };
      }),
      
      addItems: (items) => set((state) => {
        const itemsWithIds = items.map(item => ({ 
          ...item, 
          id: Date.now() + Math.random() + Math.random() 
        }));
        const newItems = [...state.items, ...itemsWithIds];
        return {
          items: newItems,
          totalItems: newItems.length
        };
      }),
      
      removeItem: (itemId) => set((state) => {
        const newItems = state.items.filter(item => item.id !== itemId);
        return {
          items: newItems,
          selectedItems: state.selectedItems.filter(id => id !== itemId),
          totalItems: newItems.length
        };
      }),
      
      selectItem: (itemId) => set((state) => ({
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
      
      getItemsByRarity: (rarity) => {
        const { items } = get();
        return items.filter(item => item.rarity === rarity);
      },
      
      getItemStats: () => {
        const { items } = get();
        const stats = items.reduce((acc, item) => {
          acc[item.rarity] = (acc[item.rarity] || 0) + 1;
          return acc;
        }, {});
        
        return {
          total: items.length,
          byRarity: stats,
          rarityPercentages: Object.entries(stats).reduce((acc, [rarity, count]) => {
            acc[rarity] = ((count / items.length) * 100).toFixed(1);
            return acc;
          }, {})
        };
      }
    }),
    {
      name: 'inventory-store'
    }
  )
);

export default useInventoryStore;
