// Dungeon layout types.
//
// Per docs/BLOCKCHAIN_ROGUELIKE_ARCHITECTURE.md ("Step 2: Dungeon Layout"),
// the dungeon layout is PUBLIC and fully deterministic:
//
//   layout_seed = SHA-256(tx_hash)
//   item_count  = (layout_seed[31] % MAX_ITEMS) + 1
//
// Anyone who knows the tx_hash can reconstruct the exact same dungeon. Only
// the loot contents stay private (sealed VRF flow); the layout, including
// where the item spots are, is verifiable by everyone.

/** Tile kinds in the dungeon grid. */
export enum TileType {
  Wall = 0,
  Floor = 1,
  Corridor = 2,
  Entrance = 3,
  Exit = 4,
}

/** A grid position (x = column, y = row). */
export interface GridPoint {
  x: number;
  y: number;
}

/** A rectangular room. Interior floor spans [x, x + width) by [y, y + height). */
export interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A loot spawn location inside a room. `lootIndex` is the public loot slot
 * index in 0..item_count-1 and is the same index used as the VRF input index
 * for the sealed loot at this spot.
 */
export interface ItemSpot extends GridPoint {
  lootIndex: number;
}

/** Fully deterministic dungeon derived from a 32-byte layout seed. */
export interface Dungeon {
  /** Grid width in tiles. */
  width: number;
  /** Grid height in tiles. */
  height: number;
  /** Row-major tile grid: tiles[y][x]. */
  tiles: TileType[][];
  /** Rooms in placement order. */
  rooms: Room[];
  /** Entrance tile (inside the first room). */
  entrance: GridPoint;
  /** Exit tile (inside the last room). */
  exit: GridPoint;
  /** Public item count: (layout_seed[31] % MAX_ITEMS) + 1. */
  itemCount: number;
  /** One spawn location per loot slot, itemSpots.length === itemCount. */
  itemSpots: ItemSpot[];
  /** Lowercase hex of the 32-byte layout seed this dungeon was derived from. */
  layoutSeedHex: string;
}
