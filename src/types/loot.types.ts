// Loot-related type definitions

export interface LootItem {
  id: string;
  name: string;
  type: string;
  icon: string;
  rarity: string;
  modifier: string;
  vrfData?: VRFData;
  createdAt: string;
  /**
   * True while the item is in the sealed (committed, unrevealed) state.
   * Sealed items must never carry vrfData across the wire and are rejected
   * by the trading paths. Absent/false means revealed (tradeable).
   */
  sealed?: boolean;
}

export interface VRFData {
  publicKey: string;
  proof: Uint8Array | string;
  /** Hex representation of the VRF input message (display only; verification reconstructs it from blockhash + itemIndex) */
  message: string;
  blockhash?: string;
  /** Numeric per-item index used to build the VRF message (uint32, big-endian in the message) */
  itemIndex?: number;
  index?: Uint8Array | string;
  vrfOutput?: Uint8Array | string;
}

// ---------------------------------------------------------------------------
// Sealed loot (commitment/reveal layer). See
// src/services/loot/loot-commitment.service.ts for the exact commitment
// preimage and docs/BLOCKCHAIN_ROGUELIKE_ARCHITECTURE.md ("Selective Reveal").
// ---------------------------------------------------------------------------

/**
 * Public manifest published at generation time. Contains ONLY commitments:
 * no VRF outputs, no proofs, no item properties. Safe to share.
 */
export interface SealedLootManifest {
  v: number;
  blockhash: string;
  publicKey: string;
  count: number;
  /** Per-item commitment hashes C_i (lowercase hex), indexed by itemIndex. */
  commitments: string[];
}

/**
 * Private per-item record kept locally by the player until reveal.
 * Never serialize or transmit this structure.
 */
export interface SealedPrivateRecord {
  itemIndex: number;
  blockhash: string;
  publicKey: string;
  vrfOutput: Uint8Array;
  proof: Uint8Array;
  /** The fully derived local item (includes vrfData; local only). */
  item: LootItem;
}

/** Claimed item properties carried in a reveal package. */
export interface RevealedItemProperties {
  name: string;
  type: string;
  rarity: string;
  modifier: string;
}

/**
 * Wire-shaped reveal package for one item: the only structure that carries
 * the VRF output and proof off the local machine, and only at reveal time.
 */
export interface LootRevealPackage {
  v: number;
  blockhash: string;
  itemIndex: number;
  publicKey: string;
  /** Hex-encoded 64-byte beta. */
  vrfOutput: string;
  /** Hex-encoded 80-byte pi. */
  proof: string;
  claimedProperties: RevealedItemProperties;
}

/** Inventory-store entry for one sealed slot. */
export interface SealedInventoryRecord {
  id: string;
  status: 'sealed' | 'revealed';
  itemIndex: number;
  commitment: string;
  /** Local-only. In-memory (the inventory store is not persisted). */
  privateRecord: SealedPrivateRecord;
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
  /** Manifest for the current sealed batch (public-safe), or null. */
  sealedManifest: SealedLootManifest | null;
  /** Sealed slots (private records are local, in-memory only). */
  sealedRecords: SealedInventoryRecord[];
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
  /** Replace the sealed batch with a freshly generated one. */
  sealLoot: (manifest: SealedLootManifest, privateRecords: SealedPrivateRecord[]) => void;
  /**
   * Reveal one sealed slot: mark it revealed and move the full item (with
   * vrfData) into the tradeable inventory. Returns the revealed item or null.
   */
  revealSealedItem: (itemIndex: number) => LootItem | null;
  clearSealedLoot: () => void;
}
