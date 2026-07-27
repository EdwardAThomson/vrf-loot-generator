// Custom hook for sealed loot generation and selective reveal.
//
// Sealed mode keeps VRF outputs and proofs local: only the public manifest
// (blockhash, publicKey, count, per-item commitments) is safe to share at
// generation time. Each item is revealed individually, producing a reveal
// package that is verified against the manifest before display.
import { useState, useCallback } from 'react';
import { LootCommitmentService } from '../services/loot/loot-commitment.service';
import { LOOT_CONSTANTS } from '../constants/loot.constants';
import { useInventoryStore } from '../store/index';
import { LootItem } from '../types/loot.types';

export const useSealedLoot = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  /** Per-index verification result for revealed items (true = verified). */
  const [verifiedReveals, setVerifiedReveals] = useState<Record<number, boolean>>({});

  const {
    sealedManifest,
    sealedRecords,
    sealLoot,
    revealSealedItem,
    clearSealedLoot,
  } = useInventoryStore();

  const generateSealedLoot = useCallback(
    async (privateKey: string, blockhash: string, count: number): Promise<boolean> => {
      if (!privateKey || !blockhash) {
        setError('Private key and blockhash are required');
        return false;
      }
      if (count < LOOT_CONSTANTS.LIMITS.MIN_ITEMS || count > LOOT_CONSTANTS.LIMITS.MAX_ITEMS) {
        setError(
          `Item count must be between ${LOOT_CONSTANTS.LIMITS.MIN_ITEMS} and ${LOOT_CONSTANTS.LIMITS.MAX_ITEMS}`
        );
        return false;
      }

      setIsLoading(true);
      setError(null);
      try {
        const { manifest, privateRecords } = LootCommitmentService.generateSealedLoot(
          privateKey,
          blockhash,
          count
        );
        sealLoot(manifest, privateRecords);
        setVerifiedReveals({});
        return true;
      } catch (err) {
        setError(`Sealed loot generation failed: ${(err as Error).message}`);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [sealLoot]
  );

  const reveal = useCallback(
    (itemIndex: number): LootItem | null => {
      setError(null);
      const record = sealedRecords.find(
        (r) => r.itemIndex === itemIndex && r.status === 'sealed'
      );
      if (!record || !sealedManifest) {
        setError('No sealed item at that index');
        return null;
      }

      // Build the reveal package and verify it against the public manifest,
      // exactly as a counterparty would.
      const pkg = LootCommitmentService.revealItem(record.privateRecord);
      const verified = LootCommitmentService.verifyRevealedItem(pkg, sealedManifest);
      setVerifiedReveals((prev) => ({ ...prev, [itemIndex]: verified }));

      return revealSealedItem(itemIndex);
    },
    [sealedRecords, sealedManifest, revealSealedItem]
  );

  const clearSealed = useCallback(() => {
    clearSealedLoot();
    setVerifiedReveals({});
    setError(null);
  }, [clearSealedLoot]);

  return {
    sealedManifest,
    sealedRecords,
    verifiedReveals,
    isLoading,
    error,
    generateSealedLoot,
    reveal,
    clearSealed,
    clearError: useCallback(() => setError(null), []),
  };
};
