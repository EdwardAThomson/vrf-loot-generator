// Loot-related type definitions

export interface LootItem {
  id: string;
  type: string;
  rarity: string;
  modifier: string;
  vrfData?: VRFData;
  createdAt: string;
}

export interface VRFData {
  publicKey: string;
  proof: Uint8Array | string;
  message: string;
  vrfOutput?: Uint8Array | string;
}

export interface LootStats {
  total: number;
  byRarity: Record<string, number>;
  rarityPercentages: Record<string, string>;
}

export interface InventoryStoreState {
  items: LootItem[];
  selectedItems: string[];
  totalItems: number;
}

export interface InventoryStoreActions {
  addItem: (item: Omit<LootItem, 'id'>) => void;
  addItems: (items: Omit<LootItem, 'id'>[]) => void;
  removeItem: (itemId: string) => void;
  selectItem: (itemId: string) => void;
  clearSelection: () => void;
  clearInventory: () => void;
  getSelectedItems: () => LootItem[];
  getItemsByRarity: (rarity: string) => LootItem[];
  getItemStats: () => LootStats;
}
