// Loot Statistics Component
import React from 'react';
import { LOOT_CONSTANTS } from '../../../constants/loot.constants';
import styles from './LootStats.module.css';

interface LootStatsProps {
  stats: Record<string, number>;
  totalItems: number;
}

/**
 * Component to display loot generation statistics
 */
export const LootStats: React.FC<LootStatsProps> = ({ stats, totalItems }) => {
  const getRarityColor = (rarity: string): string => {
    const colors: Record<string, string> = {
      'Common': 'var(--rarity-common)',
      'Rare': 'var(--rarity-rare)',
      'Epic': 'var(--rarity-epic)',
      'Legendary': 'var(--rarity-legendary)'
    };
    return colors[rarity] || 'var(--rarity-common)';
  };

  const getPercentage = (count: number): string => {
    return totalItems > 0 ? ((count / totalItems) * 100).toFixed(1) : '0';
  };

  return (
    <div className={styles.lootStats}>
      <h4 className={styles.statsTitle}>Rarity Distribution</h4>
      
      <div className={styles.statsGrid}>
        {Object.values(LOOT_CONSTANTS.RARITIES).map(rarity => {
          const count = stats[rarity] || 0;
          const percentage = getPercentage(count);
          
          return (
            <div key={rarity} className={styles.statItem}>
              <div className={styles.statHeader}>
                <span 
                  className={styles.statRarity}
                  style={{ color: getRarityColor(rarity) }}
                >
                  {rarity}
                </span>
                <span className={styles.statCount}>{count}</span>
              </div>
              
              <div className={styles.statBar}>
                <div 
                  className={styles.statFill}
                  style={{ 
                    width: `${percentage}%`,
                    backgroundColor: getRarityColor(rarity)
                  }}
                />
              </div>
              
              <div className={styles.statPercentage}>{percentage}%</div>
            </div>
          );
        })}
      </div>

      <div className={styles.statsSummary}>
        <strong>Total Items: {totalItems}</strong>
      </div>
    </div>
  );
};
