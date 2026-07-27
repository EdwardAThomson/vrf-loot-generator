// Dungeon Demo: public dungeon layout from SHA-256(tx_hash), tied to the
// private sealed loot flow.
//
// Two layers, one tx_hash:
//   - PUBLIC layer: layout_seed = SHA-256(tx_hash) determines the dungeon
//     (rooms, corridors, entrance, exit) and the item count
//     (layout_seed[31] % MAX_ITEMS) + 1. Anyone can recompute all of it.
//   - PRIVATE layer: the loot at each item spot comes from the player's VRF
//     over (tx_hash, lootIndex) and stays sealed (commitments only) until
//     the player chooses to reveal each item.
import React, { useState } from 'react';
import { Card } from '../../ui/Card/Card';
import { Button } from '../../ui/Button/Button';
import { Input } from '../../ui/Input/Input';
import { DungeonService } from '../../../services/dungeon/dungeon.service';
import { Dungeon, TileType } from '../../../types/dungeon.types';
import { LootItem } from '../../../types/loot.types';
import { useVRF } from '../../../hooks/useVRF';
import { useSealedLoot } from '../../../hooks/useSealedLoot';
import { toHexString, truncateString } from '../../../utils/format.utils';
import styles from './DungeonDemo.module.css';

const SAMPLE_TX_HASH =
  '0x4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b';

/** Random sample tx hash for the demo input (not part of dungeon generation). */
function randomTxHash(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return '0x' + toHexString(bytes);
}

const TILE_CLASS: Record<TileType, string> = {
  [TileType.Wall]: styles.tileWall,
  [TileType.Floor]: styles.tileFloor,
  [TileType.Corridor]: styles.tileCorridor,
  [TileType.Entrance]: styles.tileEntrance,
  [TileType.Exit]: styles.tileExit,
};

export const DungeonDemo: React.FC = () => {
  const [txHash, setTxHash] = useState<string>(SAMPLE_TX_HASH);
  const [dungeon, setDungeon] = useState<Dungeon | null>(null);
  const [dungeonTxHash, setDungeonTxHash] = useState<string>('');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [revealedItems, setRevealedItems] = useState<Record<number, LootItem>>({});

  const { keyPair, generateKeyPair, isLoading: vrfLoading } = useVRF();
  const {
    sealedManifest,
    sealedRecords,
    verifiedReveals,
    isLoading: sealedLoading,
    error: sealedError,
    generateSealedLoot,
    reveal,
    clearSealed,
  } = useSealedLoot();

  const handleGenerateDungeon = (hash: string) => {
    setGenerationError(null);
    try {
      const next = DungeonService.generateFromTxHash(hash);
      setDungeon(next);
      setDungeonTxHash(hash);
      // A new dungeon means a new tx_hash context; drop any old sealed batch
      // so counts and commitments always match the layout shown.
      clearSealed();
      setRevealedItems({});
    } catch (err) {
      setGenerationError(`Dungeon generation failed: ${(err as Error).message}`);
    }
  };

  const handleRandomTxHash = () => {
    const hash = randomTxHash();
    setTxHash(hash);
    handleGenerateDungeon(hash);
  };

  const handleSealLoot = async () => {
    if (!dungeon || !keyPair?.privateKey) return;
    await generateSealedLoot(keyPair.privateKey, dungeonTxHash, dungeon.itemCount);
    setRevealedItems({});
  };

  const handleReveal = (lootIndex: number) => {
    const item = reveal(lootIndex);
    if (item) {
      setRevealedItems((prev) => ({ ...prev, [lootIndex]: item }));
    }
  };

  // Fast lookup of item spots while rendering the grid.
  const spotByCell: Record<string, number> = {};
  if (dungeon) {
    for (const spot of dungeon.itemSpots) {
      spotByCell[`${spot.x},${spot.y}`] = spot.lootIndex;
    }
  }

  const manifestMatchesDungeon =
    dungeon !== null &&
    sealedManifest !== null &&
    sealedManifest.blockhash === dungeonTxHash &&
    sealedManifest.commitments.length === dungeon.itemCount;

  return (
    <Card
      title="Dungeon Demo"
      description="Public dungeon layout from SHA-256(tx_hash), private loot via sealed VRF"
    >
      <p className={styles.explainer}>
        One tx_hash drives both layers. The PUBLIC layer is the dungeon:
        layout_seed = SHA-256(tx_hash) deterministically produces the rooms,
        corridors, entrance, exit and the item count
        ((layout_seed[31] % MAX_ITEMS) + 1), so anyone can verify the map.
        The PRIVATE layer is the loot: each item spot's contents come from the
        player's VRF over (tx_hash, lootIndex) and stay sealed as commitments
        until revealed.
      </p>

      <div className={styles.controls}>
        <div className={styles.txInput}>
          <Input
            label="Transaction hash (hex or free-form text)"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="0x..."
          />
        </div>
        <Button onClick={() => handleGenerateDungeon(txHash)} disabled={!txHash}>
          Generate Dungeon
        </Button>
        <Button variant="secondary" onClick={handleRandomTxHash}>
          Random Sample Hash
        </Button>
      </div>

      {generationError && <p className={styles.error}>{generationError}</p>}

      {dungeon && (
        <>
          <div className={styles.derived}>
            <div className={styles.derivedField}>
              <span className={styles.derivedLabel}>Layout seed (SHA-256 of tx_hash, public)</span>
              <span className={styles.seedHex}>{dungeon.layoutSeedHex}</span>
            </div>
            <div className={styles.derivedField}>
              <span className={styles.derivedLabel}>Item count</span>
              <span>
                (seed[31] % MAX_ITEMS) + 1 = {dungeon.itemCount}
              </span>
            </div>
            <div className={styles.derivedField}>
              <span className={styles.derivedLabel}>Rooms</span>
              <span>{dungeon.rooms.length}</span>
            </div>
          </div>

          <div className={styles.gridWrapper}>
            <div
              className={styles.grid}
              style={{ gridTemplateColumns: `repeat(${dungeon.width}, 16px)` }}
            >
              {dungeon.tiles.map((row, y) =>
                row.map((tile, x) => {
                  const lootIndex = spotByCell[`${x},${y}`];
                  const hasSpot = lootIndex !== undefined;
                  return (
                    <div
                      key={`${x}-${y}`}
                      className={`${styles.tile} ${TILE_CLASS[tile]}`}
                      title={
                        hasSpot
                          ? `Loot slot ${lootIndex}`
                          : tile === TileType.Entrance
                          ? 'Entrance'
                          : tile === TileType.Exit
                          ? 'Exit'
                          : undefined
                      }
                    >
                      {tile === TileType.Entrance && 'E'}
                      {tile === TileType.Exit && 'X'}
                      {hasSpot && <span className={styles.itemMarker} />}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles.tileFloor}`} /> Room floor
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles.tileCorridor}`} /> Corridor
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles.tileEntrance}`} /> Entrance (E)
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles.tileExit}`} /> Exit (X)
            </span>
            <span className={styles.legendItem}>
              <span className={styles.itemMarker} /> Item spot (public location, private contents)
            </span>
          </div>

          <div className={styles.lootSection}>
            <h3 className={styles.lootHeader}>Sealed loot for this dungeon</h3>
            <p className={styles.hint}>
              The layout above fixes {dungeon.itemCount} loot slot
              {dungeon.itemCount === 1 ? '' : 's'}. The same tx_hash now feeds
              the private layer: your VRF seals exactly that many items, one
              per spot, publishing only commitments.
            </p>

            <div className={styles.lootActions}>
              {!keyPair?.privateKey ? (
                <Button onClick={() => generateKeyPair()} loading={vrfLoading}>
                  Generate VRF Keypair
                </Button>
              ) : (
                <Button onClick={handleSealLoot} loading={sealedLoading}>
                  Seal {dungeon.itemCount} Loot Item{dungeon.itemCount === 1 ? '' : 's'}
                </Button>
              )}
              {manifestMatchesDungeon && (
                <Button variant="secondary" onClick={() => { clearSealed(); setRevealedItems({}); }}>
                  Clear Sealed Batch
                </Button>
              )}
            </div>

            {sealedError && <p className={styles.error}>{sealedError}</p>}

            {manifestMatchesDungeon && sealedManifest && (
              <>
                <p className={styles.hint}>
                  Manifest published for tx_hash {truncateString(sealedManifest.blockhash, 20)}:{' '}
                  {sealedManifest.commitments.length} commitments, matching the public item count.
                </p>
                <div className={styles.slotList}>
                  {sealedRecords.map((record) => {
                    const revealed = revealedItems[record.itemIndex];
                    return (
                      <div
                        key={record.itemIndex}
                        className={`${styles.slot} ${record.status === 'sealed' ? styles.slotSealed : ''}`}
                      >
                        <span className={styles.slotTitle}>Slot {record.itemIndex}</span>
                        <span className={styles.slotCommitment}>
                          C = {truncateString(record.commitment, 18)}
                        </span>
                        {record.status === 'sealed' ? (
                          <Button size="sm" onClick={() => handleReveal(record.itemIndex)}>
                            Reveal
                          </Button>
                        ) : (
                          <>
                            <span>
                              {revealed ? `${revealed.rarity} ${revealed.name}` : 'Revealed'}
                            </span>
                            {verifiedReveals[record.itemIndex] !== undefined && (
                              <span
                                className={
                                  verifiedReveals[record.itemIndex]
                                    ? styles.verifiedBadge
                                    : styles.failedBadge
                                }
                              >
                                {verifiedReveals[record.itemIndex]
                                  ? 'Verified against manifest'
                                  : 'Verification FAILED'}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </Card>
  );
};
