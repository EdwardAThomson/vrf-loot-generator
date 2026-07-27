// Tests for the deterministic dungeon layout service.
//
// Determinism is the contract: same tx_hash, byte-identical dungeon. These
// tests pin that down, plus the public item count formula
// (layout_seed[31] % MAX_ITEMS) + 1 and basic structural sanity
// (bounds, spot placement, entrance-to-exit reachability).

import * as sha256 from 'js-sha256';
import {
  DungeonService,
  DUNGEON_WIDTH,
  DUNGEON_HEIGHT,
} from '../dungeon.service';
import { TileType } from '../../../types/dungeon.types';
import { LOOT_CONSTANTS } from '../../../constants/loot.constants';
import { blockhashToBytes } from '../../../utils/message.utils';
import { toHexString } from '../../../utils/format.utils';

const TX_HASH =
  '0x4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b';
const OTHER_TX_HASH =
  '0x9b0fc92260312ce44e74ef369f5c66bbb85848f2eddd5a7a1cde251e54ccfdd5';

const MAX_ITEMS = LOOT_CONSTANTS.LIMITS.MAX_ITEMS;

/** A 32-byte seed of zeros with a chosen last byte. */
function craftedSeed(lastByte: number): Uint8Array {
  const seed = new Uint8Array(32);
  seed[31] = lastByte;
  return seed;
}

describe('DungeonService.deriveLayoutSeed', () => {
  it('is SHA-256 of the tx hash bytes (hex decoding via blockhashToBytes)', () => {
    const seed = DungeonService.deriveLayoutSeed(TX_HASH);
    expect(seed).toHaveLength(32);
    const expected = sha256.sha256(blockhashToBytes(TX_HASH));
    expect(toHexString(seed)).toBe(expected);
  });

  it('treats non-hex tx hashes as UTF-8, consistent with the VRF message layer', () => {
    const seed = DungeonService.deriveLayoutSeed('alice-demo-block');
    const expected = sha256.sha256('alice-demo-block');
    expect(toHexString(seed)).toBe(expected);
  });
});

describe('DungeonService.deriveItemCount', () => {
  it('matches (seed[31] % MAX_ITEMS) + 1 for boundary last bytes', () => {
    expect(DungeonService.deriveItemCount(craftedSeed(0))).toBe(1);
    expect(DungeonService.deriveItemCount(craftedSeed(MAX_ITEMS - 1))).toBe(MAX_ITEMS);
    expect(DungeonService.deriveItemCount(craftedSeed(MAX_ITEMS))).toBe(1);
    expect(DungeonService.deriveItemCount(craftedSeed(255))).toBe((255 % MAX_ITEMS) + 1);
  });

  it('only depends on the last seed byte', () => {
    const noisy = new Uint8Array(32).fill(0xab);
    noisy[31] = 7;
    expect(DungeonService.deriveItemCount(noisy)).toBe((7 % MAX_ITEMS) + 1);
  });

  it('rejects seeds that are not 32 bytes', () => {
    expect(() => DungeonService.deriveItemCount(new Uint8Array(31))).toThrow();
  });
});

describe('DungeonService.generateDungeon', () => {
  it('is byte-identical across two runs from the same tx hash', () => {
    const a = DungeonService.generateFromTxHash(TX_HASH);
    const b = DungeonService.generateFromTxHash(TX_HASH);
    // Deep-equal the full structure, then also compare the serialized form
    // so any structural drift (ordering, extra fields) fails loudly.
    expect(b).toEqual(a);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('produces different layouts for different tx hashes', () => {
    const a = DungeonService.generateFromTxHash(TX_HASH);
    const b = DungeonService.generateFromTxHash(OTHER_TX_HASH);
    expect(JSON.stringify(a.tiles)).not.toBe(JSON.stringify(b.tiles));
    expect(a.layoutSeedHex).not.toBe(b.layoutSeedHex);
  });

  it('spawns exactly deriveItemCount item spots with loot indices 0..count-1', () => {
    const seed = DungeonService.deriveLayoutSeed(TX_HASH);
    const dungeon = DungeonService.generateDungeon(seed);
    const expectedCount = DungeonService.deriveItemCount(seed);
    expect(dungeon.itemCount).toBe(expectedCount);
    expect(dungeon.itemSpots).toHaveLength(expectedCount);
    expect(dungeon.itemSpots.map((s) => s.lootIndex)).toEqual(
      Array.from({ length: expectedCount }, (_, i) => i)
    );
  });

  it('places item spots on distinct room floor tiles', () => {
    const dungeon = DungeonService.generateFromTxHash(TX_HASH);
    const seen = new Set<string>();
    for (const spot of dungeon.itemSpots) {
      const key = `${spot.x},${spot.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(dungeon.tiles[spot.y][spot.x]).toBe(TileType.Floor);
      const inSomeRoom = dungeon.rooms.some(
        (r) =>
          spot.x >= r.x &&
          spot.x < r.x + r.width &&
          spot.y >= r.y &&
          spot.y < r.y + r.height
      );
      expect(inSomeRoom).toBe(true);
    }
  });

  it('keeps all rooms and spots within grid bounds', () => {
    const dungeon = DungeonService.generateFromTxHash(TX_HASH);
    expect(dungeon.width).toBe(DUNGEON_WIDTH);
    expect(dungeon.height).toBe(DUNGEON_HEIGHT);
    expect(dungeon.tiles).toHaveLength(DUNGEON_HEIGHT);
    for (const row of dungeon.tiles) {
      expect(row).toHaveLength(DUNGEON_WIDTH);
    }
    for (const room of dungeon.rooms) {
      expect(room.x).toBeGreaterThanOrEqual(1);
      expect(room.y).toBeGreaterThanOrEqual(1);
      expect(room.x + room.width).toBeLessThan(DUNGEON_WIDTH);
      expect(room.y + room.height).toBeLessThan(DUNGEON_HEIGHT);
    }
    for (const spot of dungeon.itemSpots) {
      expect(spot.x).toBeGreaterThanOrEqual(0);
      expect(spot.x).toBeLessThan(DUNGEON_WIDTH);
      expect(spot.y).toBeGreaterThanOrEqual(0);
      expect(spot.y).toBeLessThan(DUNGEON_HEIGHT);
    }
  });

  it('marks entrance and exit tiles and keeps the exit reachable (BFS)', () => {
    // Check several seeds, not just one, since reachability must hold for
    // every layout the generator can emit.
    const hashes = [TX_HASH, OTHER_TX_HASH, 'alice-demo-block', 'bob-demo-block'];
    for (const hash of hashes) {
      const dungeon = DungeonService.generateFromTxHash(hash);
      expect(dungeon.tiles[dungeon.entrance.y][dungeon.entrance.x]).toBe(TileType.Entrance);
      expect(dungeon.tiles[dungeon.exit.y][dungeon.exit.x]).toBe(TileType.Exit);
      expect(DungeonService.isExitReachable(dungeon)).toBe(true);
    }
  });

  it('rejects seeds that are not 32 bytes', () => {
    expect(() => DungeonService.generateDungeon(new Uint8Array(16))).toThrow();
  });
});
