// Sealed Loot Display - face-down commitment cards with per-item reveal
import React from 'react';
import { Button } from '../../ui/Button/Button';
import { LootItem } from './LootItem';
import { truncateString } from '../../../utils/format.utils';
import { SealedLootManifest, SealedInventoryRecord } from '../../../types/loot.types';
import styles from './SealedLootDisplay.module.css';

interface SealedLootDisplayProps {
  manifest: SealedLootManifest;
  records: SealedInventoryRecord[];
  verifiedReveals: Record<number, boolean>;
  onReveal: (itemIndex: number) => void;
}

/**
 * Shows the public manifest (safe to share) and one card per loot slot.
 * Sealed slots render face-down: only the index and commitment hash are
 * shown. Revealing a slot flips it into a normal verified item card.
 */
export const SealedLootDisplay: React.FC<SealedLootDisplayProps> = ({
  manifest,
  records,
  verifiedReveals,
  onReveal,
}) => {
  const sealedCount = records.filter((r) => r.status === 'sealed').length;

  return (
    <div className={`${styles.sealedDisplay} mt-4`}>
      <div className={styles.manifestPanel}>
        <h3>Public Manifest ({sealedCount} of {manifest.count} still sealed)</h3>
        <p className={styles.manifestNote}>
          This is everything a third party sees at generation time: commitments only.
          VRF outputs, proofs, and item properties stay local until you reveal.
        </p>
        <div className={styles.manifestMeta}>
          <span className={styles.manifestField}>
            <strong>Blockhash:</strong> <code>{truncateString(manifest.blockhash, 24)}</code>
          </span>
          <span className={styles.manifestField}>
            <strong>Public key:</strong> <code>{truncateString(manifest.publicKey, 24)}</code>
          </span>
        </div>
      </div>

      <div className={styles.sealedGrid}>
        {records.map((record) =>
          record.status === 'sealed' ? (
            <div key={record.id} className={styles.sealedCard}>
              <div className={styles.sealedIcon}>?</div>
              <div className={styles.sealedTitle}>Sealed item #{record.itemIndex}</div>
              <div className={styles.commitmentRow}>
                <span className={styles.commitmentLabel}>Commitment</span>
                <code className={styles.commitmentValue}>
                  {truncateString(record.commitment, 20)}
                </code>
              </div>
              <Button size="sm" onClick={() => onReveal(record.itemIndex)}>
                Reveal
              </Button>
            </div>
          ) : (
            <div key={record.id} className={styles.revealedSlot}>
              <LootItem
                item={{ ...record.privateRecord.item, sealed: false }}
                publicKey={manifest.publicKey}
                showVerification={true}
              />
              {verifiedReveals[record.itemIndex] !== undefined && (
                <div
                  className={`${styles.revealBadge} ${
                    verifiedReveals[record.itemIndex] ? styles.revealValid : styles.revealInvalid
                  }`}
                >
                  {verifiedReveals[record.itemIndex]
                    ? 'Reveal verified against manifest'
                    : 'Reveal FAILED manifest verification'}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
};
