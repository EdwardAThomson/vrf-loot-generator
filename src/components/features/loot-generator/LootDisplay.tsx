// Loot Display Component
import React, { useState, ChangeEvent } from 'react';
import { Button } from '../../ui/Button/Button';
import { LootItem } from './LootItem';
import { LOOT_CONSTANTS } from '../../../constants/loot.constants';
import { LootItem as LootItemType } from '../../../types/loot.types';
import styles from './LootDisplay.module.css';

interface LootDisplayProps {
  items: LootItemType[];
  publicKey: string;
}

/**
 * Component to display generated loot items with filtering
 */
export const LootDisplay: React.FC<LootDisplayProps> = ({ items, publicKey }) => {
  const [selectedRarity, setSelectedRarity] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created');

  // Filter items by rarity
  const filteredItems = selectedRarity === 'all' 
    ? items 
    : items.filter(item => item.rarity === selectedRarity);

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case 'rarity':
        const rarityOrder = Object.values(LOOT_CONSTANTS.RARITIES);
        return rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
      case 'type':
        return a.type.localeCompare(b.type);
      case 'name':
        return a.name.localeCompare(b.name);
      case 'created':
      default:
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    }
  });

  // Get rarity counts for filter buttons
  const rarityCounts: Record<string, number> = Object.values(LOOT_CONSTANTS.RARITIES).reduce((acc, rarity) => {
    acc[rarity] = items.filter(item => item.rarity === rarity).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className={`${styles.lootDisplay} mt-4`}>
      <div className={styles.lootDisplayHeader}>
        <h3>Generated Items ({items.length})</h3>
        
        <div className={styles.lootControls}>
          {/* Rarity Filter */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Filter by Rarity:</label>
            <div className="btn-group">
              <Button
                variant={selectedRarity === 'all' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setSelectedRarity('all')}
              >
                All ({items.length})
              </Button>
              {Object.values(LOOT_CONSTANTS.RARITIES).map(rarity => (
                <Button
                  key={rarity}
                  variant={selectedRarity === rarity ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setSelectedRarity(rarity)}
                  disabled={rarityCounts[rarity] === 0}
                >
                  {rarity} ({rarityCounts[rarity]})
                </Button>
              ))}
            </div>
          </div>

          {/* Sort Options */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Sort by:</label>
            <select 
              className={`form-input ${styles.sortSelect}`}
              value={sortBy}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value)}
            >
              <option value="created">Creation Order</option>
              <option value="rarity">Rarity</option>
              <option value="type">Type</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Items Grid */}
      <div className={styles.lootGrid}>
        {sortedItems.map((item, index) => (
          <LootItem
            key={item.id || index}
            item={item}
            publicKey={publicKey}
            showVerification={true}
            onSelect={() => {}}
          />
        ))}
      </div>

      {filteredItems.length === 0 && selectedRarity !== 'all' && (
        <div className={styles.noItems}>
          <p>No items found with rarity: <strong>{selectedRarity}</strong></p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedRarity('all')}
          >
            Show All Items
          </Button>
        </div>
      )}
    </div>
  );
};
