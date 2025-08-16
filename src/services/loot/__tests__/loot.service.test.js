import { LootService } from '../loot.service.ts';
import { VRFService } from '../../vrf/vrf.service.ts';
import { LOOT_CONSTANTS } from '../../../constants/loot.constants';

describe('LootService', () => {
  let keyPair;
  let testMessage;
  let vrfResult;

  beforeEach(() => {
    keyPair = VRFService.generateKeyPair();
    testMessage = 'test-blockhash-123';
    const messageBuffer = new TextEncoder().encode(testMessage);
    vrfResult = VRFService.evaluate(keyPair.privateKey, messageBuffer);
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
      
      // Each item should have different VRF data
      const vrfOutputs = items.map(item => item.vrfData.vrfOutput);
      const uniqueOutputs = new Set(vrfOutputs);
      expect(uniqueOutputs.size).toBe(3);
    });

    test('should respect minimum and maximum limits', () => {
      expect(() => {
        LootService.generateMultipleItems(keyPair.privateKey, testMessage, 0);
      }).toThrow();

      expect(() => {
        LootService.generateMultipleItems(keyPair.privateKey, testMessage, 101);
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

  describe('verifyItem', () => {
    test('should verify valid item', () => {
      const vrfData = {
        publicKey: keyPair.publicKey,
        proof: vrfResult.proof,
        message: testMessage,
        vrfOutput: vrfResult.vrfOutput
      };
      
      const item = LootService.generateItem(vrfResult.vrfOutput, vrfData);
      const isValid = LootService.verifyItem(item, keyPair.publicKey);
      
      expect(isValid).toBe(true);
    });

    test('should reject item with invalid VRF data', () => {
      const invalidVrfData = {
        publicKey: keyPair.publicKey,
        proof: new Uint8Array(32).fill(0), // Invalid proof
        message: testMessage,
        vrfOutput: vrfResult.vrfOutput
      };
      
      const item = LootService.generateItem(vrfResult.vrfOutput, invalidVrfData);
      const isValid = LootService.verifyItem(item, keyPair.publicKey);
      
      expect(isValid).toBe(false);
    });

    test('should reject item without VRF data', () => {
      const item = LootService.generateItem(vrfResult.vrfOutput);
      const isValid = LootService.verifyItem(item, keyPair.publicKey);
      
      expect(isValid).toBe(false);
    });

    test('should reject item with mismatched public key', () => {
      const otherKeyPair = VRFService.generateKeyPair();
      const vrfData = {
        publicKey: keyPair.publicKey,
        proof: vrfResult.proof,
        message: testMessage,
        vrfOutput: vrfResult.vrfOutput
      };
      
      const item = LootService.generateItem(vrfResult.vrfOutput, vrfData);
      const isValid = LootService.verifyItem(item, otherKeyPair.publicKey);
      
      expect(isValid).toBe(false);
    });
  });

  describe('rarity distribution', () => {
    test('should follow expected rarity distribution over large sample', () => {
      const sampleSize = 1000;
      const items = LootService.generateMultipleItems(keyPair.privateKey, testMessage, sampleSize);
      
      const rarityCount = {};
      Object.values(LOOT_CONSTANTS.RARITIES).forEach(rarity => {
        rarityCount[rarity] = 0;
      });
      
      items.forEach(item => {
        rarityCount[item.rarity]++;
      });
      
      // Common should be most frequent
      expect(rarityCount[LOOT_CONSTANTS.RARITIES.COMMON]).toBeGreaterThan(rarityCount[LOOT_CONSTANTS.RARITIES.RARE]);
      expect(rarityCount[LOOT_CONSTANTS.RARITIES.RARE]).toBeGreaterThan(rarityCount[LOOT_CONSTANTS.RARITIES.EPIC]);
      expect(rarityCount[LOOT_CONSTANTS.RARITIES.EPIC]).toBeGreaterThan(rarityCount[LOOT_CONSTANTS.RARITIES.LEGENDARY]);
      
      // Legendary should be very rare (less than 5% in large sample)
      expect(rarityCount[LOOT_CONSTANTS.RARITIES.LEGENDARY]).toBeLessThan(sampleSize * 0.05);
    });
  });
});
