import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  InventoryStoreState,
  InventoryStoreActions,
  LootItem,
  SealedLootManifest,
  SealedPrivateRecord,
  SealedInventoryRecord,
} from '../types/loot.types';

type InventoryStore = InventoryStoreState & InventoryStoreActions;

const useInventoryStore = create<InventoryStore>()(
  devtools(
    (set, get) => ({
      // State
      items: [],
      selectedItems: [],
      totalItems: 0,
      // Sealed loot slice. This store is NOT persisted (no zustand persist
      // middleware here), so private records live in memory only and are
      // lost on refresh. That is deliberate for the demo; a real client
      // would encrypt-at-rest before persisting private records.
      sealedManifest: null,
      sealedRecords: [],

      // Actions
      addItem: (item: Omit<LootItem, 'id'>) => set((state) => {
        const newItems = [...state.items, { ...item, id: (Date.now() + Math.random()).toString() }];
        return {
          items: newItems,
          totalItems: newItems.length
        };
      }),
      
      addItems: (items: Omit<LootItem, 'id'>[]) => set((state) => {
        const itemsWithIds = items.map(item => ({ 
          ...item, 
          id: (Date.now() + Math.random() + Math.random()).toString() 
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

      sealLoot: (manifest: SealedLootManifest, privateRecords: SealedPrivateRecord[]) => set(() => ({
        sealedManifest: manifest,
        sealedRecords: privateRecords.map((record): SealedInventoryRecord => ({
          id: `sealed-${manifest.blockhash}-${record.itemIndex}`,
          status: 'sealed',
          itemIndex: record.itemIndex,
          commitment: manifest.commitments[record.itemIndex],
          privateRecord: record
        }))
      })),

      revealSealedItem: (itemIndex: number): LootItem | null => {
        const { sealedRecords } = get();
        const record = sealedRecords.find(
          r => r.itemIndex === itemIndex && r.status === 'sealed'
        );
        if (!record) {
          return null;
        }
        // The revealed item enters the normal (tradeable) inventory with its
        // full vrfData; the sealed flag is explicitly cleared.
        const revealedItem: LootItem = { ...record.privateRecord.item, sealed: false };
        set((state) => {
          const newItems = [...state.items, revealedItem];
          return {
            items: newItems,
            totalItems: newItems.length,
            sealedRecords: state.sealedRecords.map(r =>
              r.itemIndex === itemIndex ? { ...r, status: 'revealed' as const } : r
            )
          };
        });
        return revealedItem;
      },

      clearSealedLoot: () => set({ sealedManifest: null, sealedRecords: [] }),
      
      // Getters
      getSelectedItems: () => {
        const { items, selectedItems } = get();
        return items.filter(item => selectedItems.includes(item.id));
      },
      
      getItemsByRarity: (rarity: string) => {
        const { items } = get();
        return items.filter(item => item.rarity === rarity);
      },
      
      getItemStats: () => {
        const { items } = get();
        const stats: Record<string, number> = items.reduce((acc, item) => {
          acc[item.rarity] = (acc[item.rarity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        return {
          total: items.length,
          byRarity: stats,
          rarityPercentages: Object.entries(stats).reduce((acc, [rarity, count]) => {
            acc[rarity] = ((count as number / items.length) * 100).toFixed(1);
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
