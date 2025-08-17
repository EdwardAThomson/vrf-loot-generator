// Inventory View Component for Trading System
import React from 'react';
import { useInventory } from '../../../hooks/useInventory';
import { LootItem } from '../../../types/loot.types';
import styles from './TradingSystem.module.css';

/**
 * Component for viewing and managing player inventory
 */
export const InventoryView: React.FC = () => {
  const { 
    items, 
    selectedItems, 
    toggleItemSelection, 
    getTradeableItems, 
    getNonTradeableItems,
    getInventoryStats,
    clearSelection 
  } = useInventory();

  const stats = getInventoryStats();
  const tradeableItems = getTradeableItems();
  const nonTradeableItems = getNonTradeableItems();

  const renderItem = (item: LootItem, isSelectable: boolean = true) => (
    <div 
      key={item.id}
      className={`${styles.inventoryItem} ${
        selectedItems.some(selected => selected.id === item.id) ? styles.selected : ''
      } ${!isSelectable ? styles.nonTradeable : ''}`}
      onClick={() => isSelectable && toggleItemSelection(item.id)}
    >
      <div className={styles.itemIcon}>{item.icon}</div>
      <div className={styles.itemDetails}>
        <div className={styles.itemName}>{item.name}</div>
        <div className={styles.itemType}>{item.type}</div>
        <div className={`${styles.itemRarity} ${styles[item.rarity.toLowerCase()]}`}>
          {item.rarity}
        </div>
        {item.modifier && (
          <div className={styles.itemModifier}>{item.modifier}</div>
        )}
      </div>
      {!isSelectable && (
        <div className={styles.nonTradeableLabel}>
          ⚠️ No VRF Data
        </div>
      )}
    </div>
  );

  if (items.length === 0) {
    return (
      <div className={styles.emptyInventory}>
        <h3>📦 Empty Inventory</h3>
        <p>You don't have any items yet.</p>
        <p>Use the <strong>Loot Generator</strong> tab to create some items first!</p>
      </div>
    );
  }

  return (
    <div className={styles.inventoryView}>
      {/* Inventory Stats */}
      <div className={styles.inventoryStats}>
        <h3>📦 Your Inventory</h3>
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.total}</span>
            <span className={styles.statLabel}>Total Items</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.tradeable}</span>
            <span className={styles.statLabel}>Tradeable</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.selected}</span>
            <span className={styles.statLabel}>Selected</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.totalValue}</span>
            <span className={styles.statLabel}>Total Value</span>
          </div>
        </div>
      </div>

      {/* Selection Controls */}
      {selectedItems.length > 0 && (
        <div className={styles.selectionControls}>
          <span>{selectedItems.length} item(s) selected</span>
          <button 
            onClick={clearSelection}
            className={styles.secondaryButton}
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Tradeable Items */}
      {tradeableItems.length > 0 && (
        <div className={styles.itemSection}>
          <h4>✅ Tradeable Items ({tradeableItems.length})</h4>
          <div className={styles.itemGrid}>
            {tradeableItems.map(item => renderItem(item, true))}
          </div>
        </div>
      )}

      {/* Non-Tradeable Items */}
      {nonTradeableItems.length > 0 && (
        <div className={styles.itemSection}>
          <h4>⚠️ Non-Tradeable Items ({nonTradeableItems.length})</h4>
          <p className={styles.sectionNote}>
            These items don't have VRF verification data and cannot be traded.
          </p>
          <div className={styles.itemGrid}>
            {nonTradeableItems.map(item => renderItem(item, false))}
          </div>
        </div>
      )}

      {/* Rarity Breakdown */}
      <div className={styles.rarityBreakdown}>
        <h4>📊 Rarity Breakdown</h4>
        <div className={styles.rarityStats}>
          {Object.entries(stats.byRarity).map(([rarity, count]) => (
            <div key={rarity} className={styles.rarityItem}>
              <span className={`${styles.rarityDot} ${styles[rarity.toLowerCase()]}`}></span>
              <span>{rarity}: {count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
