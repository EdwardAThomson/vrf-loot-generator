import { LootService } from '../loot.service';
import { VRFService } from '../../vrf/vrf.service';
import { LOOT_CONSTANTS } from '../../../constants/loot.constants';
import { VRFKeyPair, VRFResult } from '../../../types/vrf.types';
import { toHexString } from '../../../utils/format.utils';

const sha256 = require('js-sha256');

// NOTE: this suite deliberately uses the REAL VRFService (no jest.mock).
// The old version mocked VRFService "to avoid crypto library issues in Jest",
// which meant the verifyItem rejection tests passed for the wrong reason
// (the mocked proofToHash never threw). The crypto issues are fixed by the
// polyfills in src/setupTests.ts, so these tests now exercise real keygen,
// real evaluate, and real proof verification.
describe('LootService', () => {
  let keyPair: VRFKeyPair;
  let testMessage: string;
  let testMessageBuffer: Uint8Array;
  let vrfResult: VRFResult;

  // Real EC operations are relatively slow; the fixtures are immutable, so
  // compute them once for the whole suite instead of per test.
  beforeAll(() => {
    keyPair = VRFService.generateKeyPair();
    testMessage = 'test-blockhash-123';
    testMessageBuffer = new TextEncoder().encode(testMessage);
    vrfResult = VRFService.evaluate(keyPair.privateKey, testMessageBuffer);
  });

  describe('generateItem', () => {
    test('should generate a valid loot item', () => {
      const item = LootService.generateItem(vrfResult.vrfOutput);

      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('rarity');
      expect(item).toHaveProperty('modifier');
      expect(item).toHaveProperty('vrfData');
      expect(item).toHaveProperty('createdAt');

      expect(typeof item.id).toBe('string');
      expect(Object.values(LOOT_CONSTANTS.TYPES)).toContain(item.type);
      expect(Object.values(LOOT_CONSTANTS.RARITIES)).toContain(item.rarity);
      expect(Object.values(LOOT_CONSTANTS.MODIFIERS)).toContain(item.modifier);
    });

    test('should generate consistent items for same VRF output', () => {
      const item1 = LootService.generateItem(vrfResult.vrfOutput);
      const item2 = LootService.generateItem(vrfResult.vrfOutput);

      expect(item1.type).toBe(item2.type);
      expect(item1.rarity).toBe(item2.rarity);
      expect(item1.modifier).toBe(item2.modifier);
      // IDs should be different due to timestamp
      expect(item1.id).not.toBe(item2.id);
    });

    test('should include VRF data when provided', () => {
      const vrfData = {
        publicKey: keyPair.publicKey,
        proof: vrfResult.proof,
        message: testMessage
      };

      const item = LootService.generateItem(vrfResult.vrfOutput, vrfData);

      expect(item.vrfData).toEqual(vrfData);
    });

    test('should generate different items for different VRF outputs', () => {
      const message2 = 'different-message';
      const messageBuffer2 = new TextEncoder().encode(message2);
      const vrfResult2 = VRFService.evaluate(keyPair.privateKey, messageBuffer2);

      const item1 = LootService.generateItem(vrfResult.vrfOutput);
      const item2 = LootService.generateItem(vrfResult2.vrfOutput);

      // Items should likely be different (though theoretically could be same)
      const isDifferent = item1.type !== item2.type ||
                         item1.rarity !== item2.rarity ||
                         item1.modifier !== item2.modifier;
      expect(isDifferent).toBe(true);
    });
  });

  describe('generateMultipleItems', () => {
    test('should generate specified number of items', () => {
      const count = 5;
      const items = LootService.generateMultipleItems(keyPair.privateKey, testMessage, count);

      expect(items).toHaveLength(count);
      items.forEach(item => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('rarity');
        expect(item).toHaveProperty('modifier');
      });
    });

    test('should generate items with different VRF seeds', () => {
      const items = LootService.generateMultipleItems(keyPair.privateKey, testMessage, 3);

      // Each item should have a distinct VRF output (compare by value, not by
      // object identity: a Set of distinct Uint8Array references would report
      // uniqueness even for identical bytes).
      const vrfOutputs = items.map(item =>
        toHexString(item.vrfData?.vrfOutput as Uint8Array)
      );
      const uniqueOutputs = new Set(vrfOutputs);
      expect(uniqueOutputs.size).toBe(3);
    });

    test('should respect minimum and maximum limits', () => {
      expect(() => {
        LootService.generateMultipleItems(keyPair.privateKey, testMessage, 0);
      }).toThrow();

      expect(() => {
        LootService.generateMultipleItems(
          keyPair.privateKey,
          testMessage,
          LOOT_CONSTANTS.LIMITS.MAX_ITEMS + 1
        );
      }).toThrow();
    });

    test('should generate deterministic items for same inputs', () => {
      const items1 = LootService.generateMultipleItems(keyPair.privateKey, testMessage, 3);
      const items2 = LootService.generateMultipleItems(keyPair.privateKey, testMessage, 3);

      expect(items1).toHaveLength(items2.length);
      items1.forEach((item1, index) => {
        const item2 = items2[index];
        expect(item1.type).toBe(item2.type);
        expect(item1.rarity).toBe(item2.rarity);
        expect(item1.modifier).toBe(item2.modifier);
      });
    });
  });

  describe('verifyItem (real crypto)', () => {
    let items: ReturnType<typeof LootService.generateMultipleItems>;

    beforeAll(() => {
      items = LootService.generateMultipleItems(keyPair.privateKey, testMessage, 3);
    });

    test('should verify valid items', () => {
      items.forEach(item => {
        expect(LootService.verifyItem(item, keyPair.publicKey)).toBe(true);
      });
    });

    test('should reject item with mismatched public key', () => {
      const otherKeyPair = VRFService.generateKeyPair();
      expect(LootService.verifyItem(items[0], otherKeyPair.publicKey)).toBe(false);
    });

    test('should reject item with invalid (wrong-length) proof', () => {
      const tampered = {
        ...items[0],
        vrfData: { ...items[0].vrfData!, proof: new Uint8Array(32).fill(0) }
      };
      expect(LootService.verifyItem(tampered, keyPair.publicKey)).toBe(false);
    });

    test('should reject item with a well-formed but bit-flipped proof', () => {
      const proof = new Uint8Array(items[0].vrfData!.proof as Uint8Array);
      proof[40] ^= 0x01; // flip a bit in the c component; length stays 80
      const tampered = {
        ...items[0],
        vrfData: { ...items[0].vrfData!, proof }
      };
      expect(LootService.verifyItem(tampered, keyPair.publicKey)).toBe(false);
    });

    test('should reject item without VRF data', () => {
      const item = LootService.generateItem(vrfResult.vrfOutput);
      expect(LootService.verifyItem(item, keyPair.publicKey)).toBe(false);
    });

    test('should reject forged item pairing a valid proof with an unrelated vrfOutput', () => {
      // Regression test for the verifyItem soundness gap: previously the
      // supplied vrfOutput was never bound to the proof (the embedded VRF
      // point and computedIndex were ignored), so a valid proof for message m
      // could be shipped alongside an arbitrary output. The forged output
      // must now be rejected.
      const forged = {
        ...items[0],
        vrfData: {
          ...items[0].vrfData!,
          vrfOutput: items[1].vrfData!.vrfOutput // valid output, wrong item
        }
      };
      expect(LootService.verifyItem(forged, keyPair.publicKey)).toBe(false);
    });

    test('should reject item claiming a different item index', () => {
      const tampered = {
        ...items[1],
        vrfData: { ...items[1].vrfData!, itemIndex: 0 }
      };
      expect(LootService.verifyItem(tampered, keyPair.publicKey)).toBe(false);
    });
  });

  describe('rarity distribution', () => {
    test('should follow expected rarity distribution over large sample', () => {
      // generateMultipleItems is capped at LOOT_CONSTANTS.LIMITS.MAX_ITEMS
      // (50) and each real VRF evaluation is expensive, so drive generateItem
      // (where the rarity mapping lives) directly with deterministic
      // pseudo-random outputs.
      const sampleSize = 1000;
      const rarityCount: Record<string, number> = {};
      Object.values(LOOT_CONSTANTS.RARITIES).forEach(rarity => {
        rarityCount[rarity] = 0;
      });

      for (let i = 0; i < sampleSize; i++) {
        const pseudoOutput = new Uint8Array(sha256.array(`rarity-sample-${i}`));
        const item = LootService.generateItem(pseudoOutput);
        rarityCount[item.rarity]++;
      }

      // Common should be most frequent
      expect(rarityCount[LOOT_CONSTANTS.RARITIES.COMMON]).toBeGreaterThan(rarityCount[LOOT_CONSTANTS.RARITIES.RARE]);
      expect(rarityCount[LOOT_CONSTANTS.RARITIES.RARE]).toBeGreaterThan(rarityCount[LOOT_CONSTANTS.RARITIES.EPIC]);
      expect(rarityCount[LOOT_CONSTANTS.RARITIES.EPIC]).toBeGreaterThan(rarityCount[LOOT_CONSTANTS.RARITIES.LEGENDARY]);

      // Legendary is nominally 5%; allow statistical headroom (8% of sample)
      expect(rarityCount[LOOT_CONSTANTS.RARITIES.LEGENDARY]).toBeLessThan(sampleSize * 0.08);
    });
  });
});
