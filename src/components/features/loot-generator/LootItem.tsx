// Individual Loot Item Component
import React, { useState } from 'react';
import { Button } from '../../ui/Button/Button';
import { useLootGeneration } from '../../../hooks/useLootGeneration';
import { toHexString, truncateString } from '../../../utils/format.utils';
import { LootItem as LootItemType } from '../../../types/loot.types';
import styles from './LootItem.module.css';

interface LootItemProps {
  item: LootItemType;
  publicKey: string;
  showVerification?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (item: LootItemType) => void;
}

/**
 * Component to display a single loot item
 */
export const LootItem: React.FC<LootItemProps> = ({ 
  item, 
  publicKey, 
  showVerification = false, 
  selectable = false, 
  selected = false, 
  onSelect 
}) => {
  const { verifyItem } = useLootGeneration();
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);

  const toHexMaybe = (val: unknown): string => {
    if (typeof val === 'string') return val;
    if (val && (val instanceof Uint8Array || Array.isArray(val))) return toHexString(val as Uint8Array | number[]);
    return val != null ? String(val) : '';
  };

  const handleVerify = async (): Promise<void> => {
    if (!publicKey || !item.vrfData) {
      return;
    }

    setIsVerifying(true);
    try {
      const isValid = await verifyItem(item, publicKey);
      setVerificationResult(isValid);
    } catch (err) {
      setVerificationResult(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSelect = (): void => {
    if (onSelect) {
      onSelect(item);
    }
  };

  const getRarityClass = (rarity: string): string => {
    const map: Record<string, string> = {
      'Common': styles.rarityCommon,
      'Rare': styles.rarityRare,
      'Epic': styles.rarityEpic,
      'Legendary': styles.rarityLegendary,
    };
    return map[rarity] || styles.rarityCommon;
  };

  return (
    <div 
      className={`${styles.lootItem} ${getRarityClass(item.rarity)} ${selectable ? styles.selectable : ''} ${selected ? styles.selected : ''}`}
      onClick={selectable ? handleSelect : undefined}
    >
      <div className={styles.itemHeader}>
        <div className={styles.itemIcon}>{item.icon}</div>
        <div className={styles.itemInfo}>
          <h4 className={styles.itemName}>{item.name}</h4>
          <div className={styles.itemMeta}>
            <span className={styles.itemType}>{item.type}</span>
            <span 
              className={styles.itemRarity}
            >
              {item.rarity}
            </span>
          </div>
        </div>
        {selectable && (
          <div className={styles.selectionIndicator}>
            {selected ? '✓' : '○'}
          </div>
        )}
      </div>

      {item.vrfData && (
        <div className={styles.itemDetails}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Blockhash:</span>
            <span className={styles.detailValue}>{truncateString(String(item.vrfData.blockhash), 16)}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Index:</span>
            <span className={styles.detailValue}>{truncateString(toHexMaybe(item.vrfData.index), 16)}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>VRF Output:</span>
            <span className={styles.detailValue}>{truncateString(toHexMaybe(item.vrfData.vrfOutput), 16)}</span>
          </div>
        </div>
      )}

      {showVerification && item.vrfData && publicKey && (
        <div className={styles.itemVerification}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleVerify}
            loading={isVerifying}
            disabled={isVerifying}
          >
            Verify Item
          </Button>
          
          {verificationResult !== null && (
            <div className={`${styles.verificationBadge} ${verificationResult ? styles.valid : styles.invalid}`}>
              {verificationResult ? '✅ Valid' : '❌ Invalid'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
