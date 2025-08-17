import { LootService } from '../loot.service';
import { LOOT_CONSTANTS } from '../../../constants/loot.constants';

// Simple tests that don't depend on VRF service
describe('LootService - Core Logic', () => {
  describe('generateItem', () => {
    test('should generate valid loot item from byte array', () => {
      // Create a predictable byte array for testing
      const mockVrfOutput = new Uint8Array([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16
      ]);
      
      const item = LootService.generateItem(mockVrfOutput);
      
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('rarity');
      expect(item).toHaveProperty('modifier');
      expect(item).toHaveProperty('icon');
      expect(item).toHaveProperty('createdAt');
      
      expect(typeof item.id).toBe('string');
      expect(typeof item.name).toBe('string');
      expect(Object.values(LOOT_CONSTANTS.TYPES)).toContain(item.type);
      expect(Object.values(LOOT_CONSTANTS.RARITIES)).toContain(item.rarity);
      expect(Object.values(LOOT_CONSTANTS.MODIFIERS)).toContain(item.modifier);
    });

    test('should generate consistent items for same input', () => {
      const mockVrfOutput = new Uint8Array([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16
      ]);
      
      const item1 = LootService.generateItem(mockVrfOutput);
      const item2 = LootService.generateItem(mockVrfOutput);
      
      expect(item1.type).toBe(item2.type);
      expect(item1.rarity).toBe(item2.rarity);
      expect(item1.modifier).toBe(item2.modifier);
      // IDs should be different due to timestamp/random component
      expect(item1.id).not.toBe(item2.id);
    });

    test('should generate different items for different inputs', () => {
      const mockVrfOutput1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const mockVrfOutput2 = new Uint8Array([255, 254, 253, 252, 251, 250, 249, 248]);
      
      const item1 = LootService.generateItem(mockVrfOutput1);
      const item2 = LootService.generateItem(mockVrfOutput2);
      
      // Items should likely be different (though theoretically could be same)
      const isDifferent = item1.type !== item2.type || 
                         item1.rarity !== item2.rarity || 
                         item1.modifier !== item2.modifier;
      expect(isDifferent).toBe(true);
    });
  });

  describe('getItemStatistics', () => {
    test('should count item rarities correctly', () => {
      const mockItems = [
        { rarity: LOOT_CONSTANTS.RARITIES.COMMON } as any,
        { rarity: LOOT_CONSTANTS.RARITIES.COMMON } as any,
        { rarity: LOOT_CONSTANTS.RARITIES.RARE } as any,
        { rarity: LOOT_CONSTANTS.RARITIES.EPIC } as any,
        { rarity: LOOT_CONSTANTS.RARITIES.LEGENDARY } as any,
      ];
      
      const stats = LootService.getItemStatistics(mockItems);
      
      expect(stats[LOOT_CONSTANTS.RARITIES.COMMON]).toBe(2);
      expect(stats[LOOT_CONSTANTS.RARITIES.RARE]).toBe(1);
      expect(stats[LOOT_CONSTANTS.RARITIES.EPIC]).toBe(1);
      expect(stats[LOOT_CONSTANTS.RARITIES.LEGENDARY]).toBe(1);
    });

    test('should handle empty array', () => {
      const stats = LootService.getItemStatistics([]);
      
      Object.values(LOOT_CONSTANTS.RARITIES).forEach(rarity => {
        expect(stats[rarity]).toBe(0);
      });
    });
  });
});
