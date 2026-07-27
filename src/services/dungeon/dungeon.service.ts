// Dungeon layout service.
//
// Implements "Step 2: Dungeon Layout (Public Derivation)" from
// docs/BLOCKCHAIN_ROGUELIKE_ARCHITECTURE.md:
//
//   layout_seed = SHA-256(tx_hash)
//   item_count  = (layout_seed[31] % MAX_ITEMS) + 1
//
// The layout seed is PUBLIC: anyone who knows the tx_hash can recompute it
// and reconstruct the exact same dungeon, tile for tile. This is the whole
// point of the design: spectators and verifiers can check that a player
// actually faced the dungeon they claim to have explored, while the loot
// itself stays private behind the sealed VRF commitment flow.
//
// Determinism is the contract of this module:
//   - The same tx_hash always yields a byte-identical Dungeon structure.
//   - No Math.random anywhere. All randomness comes from a local seeded PRNG
//     (sfc32, see below) initialized purely from the 32-byte layout seed.

import * as sha256 from 'js-sha256';
import { blockhashToBytes } from '../../utils/message.utils';
import { toHexString } from '../../utils/format.utils';
import { LOOT_CONSTANTS } from '../../constants/loot.constants';
import {
  Dungeon,
  GridPoint,
  ItemSpot,
  Room,
  TileType,
} from '../../types/dungeon.types';

/** Fixed grid size for the demo dungeon. */
export const DUNGEON_WIDTH = 40;
export const DUNGEON_HEIGHT = 25;

// Room generation parameters. Minimum room interior is 5x4 = 20 floor tiles;
// with at least MIN_ROOMS rooms the dungeon always has enough distinct floor
// tiles for MAX_ITEMS item spots plus the entrance and exit.
const MIN_ROOMS = 4;
const MAX_ROOMS = 8;
const ROOM_MIN_W = 5;
const ROOM_MAX_W = 9;
const ROOM_MIN_H = 4;
const ROOM_MAX_H = 7;
const PLACEMENT_ATTEMPTS = 500;

/**
 * sfc32 ("Small Fast Counter") PRNG.
 *
 * A well known public-domain 128-bit-state generator (from Chris Doty-Humphrey's
 * PractRand suite) chosen here because it is tiny, fast, has good statistical
 * quality for layout generation, and is trivially seeded from four 32-bit
 * words. It is NOT cryptographic and does not need to be: the layout seed is
 * public, the PRNG only spreads those public bytes over placement decisions.
 *
 * Returns a function producing uint32 values. Deterministic for a given
 * (a, b, c, d) seed on every JS engine (only >>> , | , + on uint32).
 */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  return function next(): number {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const out = (t + d) | 0;
    c = (c + out) | 0;
    return out >>> 0;
  };
}

/** Read a big-endian uint32 from 4 seed bytes. */
function beWord(seed: Uint8Array, offset: number): number {
  return (
    ((seed[offset] << 24) |
      (seed[offset + 1] << 16) |
      (seed[offset + 2] << 8) |
      seed[offset + 3]) >>>
    0
  );
}

/**
 * Build the seeded PRNG from the 32-byte layout seed.
 *
 * The four sfc32 state words are seeded from seed bytes 0..15 XOR bytes
 * 16..31 (so every seed byte influences the state), then the generator is
 * warmed up for 12 rounds, the customary sfc32 mixing run.
 */
function prngFromSeed(seed: Uint8Array): () => number {
  const rand = sfc32(
    beWord(seed, 0) ^ beWord(seed, 16),
    beWord(seed, 4) ^ beWord(seed, 20),
    beWord(seed, 8) ^ beWord(seed, 24),
    beWord(seed, 12) ^ beWord(seed, 28)
  );
  for (let i = 0; i < 12; i++) rand();
  return rand;
}

/** Uniform-enough integer in [0, n) from a uint32 draw (n is tiny here). */
function randInt(rand: () => number, n: number): number {
  return rand() % n;
}

function roomsOverlap(a: Room, b: Room): boolean {
  // 1-tile margin so rooms never share a wall.
  return (
    a.x - 1 < b.x + b.width &&
    a.x + a.width + 1 > b.x &&
    a.y - 1 < b.y + b.height &&
    a.y + a.height + 1 > b.y
  );
}

function roomCenter(room: Room): GridPoint {
  return {
    x: room.x + Math.floor(room.width / 2),
    y: room.y + Math.floor(room.height / 2),
  };
}

export class DungeonService {
  /**
   * layout_seed = SHA-256(tx_hash).
   *
   * The tx hash string is decoded exactly like the VRF message layer does
   * (blockhashToBytes): hex strings (optionally 0x-prefixed) become hex
   * bytes, anything else is hashed as UTF-8. This keeps the public layout
   * derivation byte-consistent with the private loot derivation for the same
   * tx_hash string.
   */
  static deriveLayoutSeed(txHash: string): Uint8Array {
    return new Uint8Array(sha256.sha256.array(blockhashToBytes(txHash)));
  }

  /**
   * Public item count: (layout_seed[31] % MAX_ITEMS) + 1.
   * MAX_ITEMS comes from LOOT_CONSTANTS.LIMITS so the layout layer and the
   * sealed loot layer agree on the bound.
   */
  static deriveItemCount(seed: Uint8Array): number {
    if (seed.length !== 32) {
      throw new Error(`Layout seed must be 32 bytes, got ${seed.length}`);
    }
    return (seed[31] % LOOT_CONSTANTS.LIMITS.MAX_ITEMS) + 1;
  }

  /** Convenience: deriveLayoutSeed + generateDungeon in one call. */
  static generateFromTxHash(txHash: string): Dungeon {
    return DungeonService.generateDungeon(DungeonService.deriveLayoutSeed(txHash));
  }

  /**
   * Generate the full dungeon from a 32-byte layout seed.
   *
   * Algorithm (every step draws only from the seeded PRNG):
   *   1. Start from an all-Wall 40x25 grid.
   *   2. Place up to MAX_ROOMS non-overlapping rectangular rooms by rejection
   *      sampling (bounded attempts; the loop keeps going until at least
   *      MIN_ROOMS rooms are placed, which the grid size makes certain well
   *      within the attempt budget). Carve them as Floor.
   *   3. Connect each room to the previous one with an L-shaped corridor
   *      between room centers; the PRNG picks horizontal-first or
   *      vertical-first. Corridors only carve Wall tiles, so rooms stay Floor.
   *      Chaining consecutive rooms guarantees full connectivity.
   *   4. Entrance = center of the first room, Exit = center of the last room.
   *   5. Draw item spots for itemCount loot slots: candidate cells are all
   *      room Floor tiles (excluding entrance and exit) in scan order, and
   *      each spot is removed from the candidate list when drawn, so spots
   *      are distinct. Spot i carries lootIndex i, the same index used as the
   *      VRF input index for the sealed loot item at that spot.
   */
  static generateDungeon(seed: Uint8Array): Dungeon {
    if (seed.length !== 32) {
      throw new Error(`Layout seed must be 32 bytes, got ${seed.length}`);
    }
    const rand = prngFromSeed(seed);
    const itemCount = DungeonService.deriveItemCount(seed);

    // 1. All walls.
    const tiles: TileType[][] = [];
    for (let y = 0; y < DUNGEON_HEIGHT; y++) {
      tiles.push(new Array<TileType>(DUNGEON_WIDTH).fill(TileType.Wall));
    }

    // 2. Rooms by rejection sampling.
    const rooms: Room[] = [];
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
      if (rooms.length >= MAX_ROOMS) break;
      const width = ROOM_MIN_W + randInt(rand, ROOM_MAX_W - ROOM_MIN_W + 1);
      const height = ROOM_MIN_H + randInt(rand, ROOM_MAX_H - ROOM_MIN_H + 1);
      const x = 1 + randInt(rand, DUNGEON_WIDTH - width - 2);
      const y = 1 + randInt(rand, DUNGEON_HEIGHT - height - 2);
      const candidate: Room = { x, y, width, height };
      if (rooms.some((r) => roomsOverlap(r, candidate))) continue;
      rooms.push(candidate);
      // Keep sampling after MIN_ROOMS too, up to MAX_ROOMS, but never exit
      // the attempt budget below MIN_ROOMS (grid capacity makes this sure).
    }
    if (rooms.length < MIN_ROOMS) {
      // Practically unreachable with these parameters; fail loudly rather
      // than emit a degenerate dungeon.
      throw new Error(
        `Room placement produced ${rooms.length} rooms, need at least ${MIN_ROOMS}`
      );
    }

    for (const room of rooms) {
      for (let ry = room.y; ry < room.y + room.height; ry++) {
        for (let rx = room.x; rx < room.x + room.width; rx++) {
          tiles[ry][rx] = TileType.Floor;
        }
      }
    }

    // 3. L-shaped corridors chaining consecutive rooms.
    const carveCorridor = (x: number, y: number): void => {
      if (tiles[y][x] === TileType.Wall) {
        tiles[y][x] = TileType.Corridor;
      }
    };
    for (let i = 1; i < rooms.length; i++) {
      const from = roomCenter(rooms[i - 1]);
      const to = roomCenter(rooms[i]);
      const horizontalFirst = randInt(rand, 2) === 0;
      const corner: GridPoint = horizontalFirst
        ? { x: to.x, y: from.y }
        : { x: from.x, y: to.y };
      const carveH = (y: number, x1: number, x2: number): void => {
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) carveCorridor(x, y);
      };
      const carveV = (x: number, y1: number, y2: number): void => {
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) carveCorridor(x, y);
      };
      if (horizontalFirst) {
        carveH(from.y, from.x, corner.x);
        carveV(corner.x, corner.y, to.y);
      } else {
        carveV(from.x, from.y, corner.y);
        carveH(corner.y, corner.x, to.x);
      }
    }

    // 4. Entrance and exit.
    const entrance = roomCenter(rooms[0]);
    const exit = roomCenter(rooms[rooms.length - 1]);
    tiles[entrance.y][entrance.x] = TileType.Entrance;
    tiles[exit.y][exit.x] = TileType.Exit;

    // 5. Item spots on distinct room floor tiles.
    const candidates: GridPoint[] = [];
    for (const room of rooms) {
      for (let ry = room.y; ry < room.y + room.height; ry++) {
        for (let rx = room.x; rx < room.x + room.width; rx++) {
          if (tiles[ry][rx] === TileType.Floor) {
            candidates.push({ x: rx, y: ry });
          }
        }
      }
    }
    if (candidates.length < itemCount) {
      throw new Error(
        `Not enough room floor for ${itemCount} item spots (${candidates.length} available)`
      );
    }
    const itemSpots: ItemSpot[] = [];
    for (let lootIndex = 0; lootIndex < itemCount; lootIndex++) {
      const pick = randInt(rand, candidates.length);
      const spot = candidates.splice(pick, 1)[0];
      itemSpots.push({ x: spot.x, y: spot.y, lootIndex });
    }

    return {
      width: DUNGEON_WIDTH,
      height: DUNGEON_HEIGHT,
      tiles,
      rooms,
      entrance,
      exit,
      itemCount,
      itemSpots,
      layoutSeedHex: toHexString(seed),
    };
  }

  /** Walkable tiles for pathing/reachability checks. */
  static isWalkable(tile: TileType): boolean {
    return tile !== TileType.Wall;
  }

  /**
   * BFS reachability from entrance to exit over walkable tiles
   * (4-neighborhood). Used by tests and the headless harness to prove the
   * generated dungeon is traversable.
   */
  static isExitReachable(dungeon: Dungeon): boolean {
    const { width, height, tiles, entrance, exit } = dungeon;
    const visited: boolean[][] = tiles.map((row) => row.map(() => false));
    const queue: GridPoint[] = [entrance];
    visited[entrance.y][entrance.x] = true;
    while (queue.length > 0) {
      const { x, y } = queue.shift()!;
      if (x === exit.x && y === exit.y) return true;
      const neighbors = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 },
      ];
      for (const n of neighbors) {
        if (n.x < 0 || n.y < 0 || n.x >= width || n.y >= height) continue;
        if (visited[n.y][n.x]) continue;
        if (!DungeonService.isWalkable(tiles[n.y][n.x])) continue;
        visited[n.y][n.x] = true;
        queue.push(n);
      }
    }
    return false;
  }
}
