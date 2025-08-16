// Loot Generation Constants
// Centralized constants for consistent loot generation

export const LOOT_CONSTANTS = {
  // Item rarities
  RARITIES: {
    COMMON: 'Common',
    RARE: 'Rare',
    EPIC: 'Epic',
    LEGENDARY: 'Legendary'
  },

  // Item types
  TYPES: {
    SWORD: 'Sword',
    AXE: 'Axe',
    SHIELD: 'Shield',
    BOW: 'Bow',
    STAFF: 'Staff',
    DAGGER: 'Dagger'
  },

  // Item modifiers
  MODIFIERS: {
    FLAMING: 'Flaming',
    ICY: 'Icy',
    LIGHTNING: 'Lightning',
    POISONOUS: 'Poisonous',
    HOLY: 'Holy',
    SHADOW: 'Shadow'
  },

  // Generation limits
  LIMITS: {
    MIN_ITEMS: 1,
    MAX_ITEMS: 50,
    DEFAULT_ITEMS: 5
  },

  // Rarity probabilities (for reference)
  RARITY_PROBABILITIES: {
    COMMON: 0.5,    // 50%
    RARE: 0.3,      // 30% (cumulative 80%)
    EPIC: 0.15,     // 15% (cumulative 95%)
    LEGENDARY: 0.05 // 5%
  }
};
