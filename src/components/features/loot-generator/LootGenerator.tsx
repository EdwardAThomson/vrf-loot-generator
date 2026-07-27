// Loot Generator Component - Clean separation of concerns
import React, { useState, ChangeEvent } from 'react';
import { useVRF } from '../../../hooks/useVRF';
import { useLootGeneration } from '../../../hooks/useLootGeneration';
import { useSealedLoot } from '../../../hooks/useSealedLoot';
import { Card } from '../../ui/Card/Card';
import { Button } from '../../ui/Button/Button';
import { Input } from '../../ui/Input/Input';
import { LootDisplay } from './LootDisplay';
import { LootStats } from './LootStats';
import { SealedLootDisplay } from './SealedLootDisplay';
import { LOOT_CONSTANTS } from '../../../constants/loot.constants';

type GenerationMode = 'transparent' | 'sealed';

/**
 * Loot Generator tab component - pure UI logic
 */
export const LootGenerator: React.FC = () => {
  const { keyPair, generateKeyPair, isLoading: vrfLoading } = useVRF();
  const { 
    generatedItems, 
    isLoading: lootLoading, 
    error, 
    generateLoot, 
    clearItems, 
    clearError,
    getRarityStats 
  } = useLootGeneration();

  const {
    sealedManifest,
    sealedRecords,
    verifiedReveals,
    isLoading: sealedLoading,
    error: sealedError,
    generateSealedLoot,
    reveal,
    clearSealed,
    clearError: clearSealedError,
  } = useSealedLoot();

  const [blockhash, setBlockhash] = useState('');
  const [itemCount, setItemCount] = useState(LOOT_CONSTANTS.LIMITS.DEFAULT_ITEMS);
  const [mode, setMode] = useState<GenerationMode>('transparent');

  const isLoading = vrfLoading || lootLoading || sealedLoading;

  const handleGenerateKeys = async () => {
    try {
      await generateKeyPair();
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleGenerateLoot = async () => {
    if (!keyPair?.privateKey || !blockhash) {
      return;
    }

    try {
      if (mode === 'sealed') {
        await generateSealedLoot(keyPair.privateKey, blockhash, itemCount);
      } else {
        await generateLoot(keyPair.privateKey, blockhash, itemCount);
      }
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleItemCountChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (value >= LOOT_CONSTANTS.LIMITS.MIN_ITEMS && value <= LOOT_CONSTANTS.LIMITS.MAX_ITEMS) {
      setItemCount(value);
    }
  };

  const canGenerateLoot = keyPair?.privateKey && blockhash && !isLoading;
  const rarityStats = getRarityStats();

  return (
    <div className="loot-generator">
      <Card
        title="Loot Generator"
        description="Generate multiple loot items using VRF for deterministic, verifiable randomness."
      >
        {error && (
          <div className="alert alert-danger">
            <strong>Error:</strong> {error}
            <Button
              variant="secondary"
              size="sm"
              onClick={clearError}
              className="ml-2"
            >
              Dismiss
            </Button>
          </div>
        )}

        {sealedError && (
          <div className="alert alert-danger">
            <strong>Error:</strong> {sealedError}
            <Button
              variant="secondary"
              size="sm"
              onClick={clearSealedError}
              className="ml-2"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Key Generation Section */}
        <div className="grid grid-2">
          <div>
            <h3 className="mb-3">Setup</h3>
            
            {!keyPair?.privateKey ? (
              <div className="mb-3">
                <p className="text-muted mb-2">First, generate a key pair for VRF operations:</p>
                <Button
                  onClick={handleGenerateKeys}
                  loading={vrfLoading}
                  disabled={isLoading}
                >
                  Generate Key Pair
                </Button>
              </div>
            ) : (
              <div className="mb-3">
                <p className="text-success mb-2">✅ Key pair generated</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleGenerateKeys}
                  loading={vrfLoading}
                  disabled={isLoading}
                >
                  Generate New Keys
                </Button>
              </div>
            )}

            <Input
              label="Blockhash"
              value={blockhash}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setBlockhash(e.target.value)}
              placeholder="Enter blockhash or any string..."
              className="mb-3"
            />

            <Input
              label="Number of Items"
              type="number"
              value={itemCount}
              onChange={handleItemCountChange}
              min={LOOT_CONSTANTS.LIMITS.MIN_ITEMS}
              max={LOOT_CONSTANTS.LIMITS.MAX_ITEMS}
              className="mb-3"
            />
          </div>

          <div>
            <h3 className="mb-3">Generation</h3>

            <div className="mb-3">
              <div className="btn-group">
                <Button
                  variant={mode === 'transparent' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setMode('transparent')}
                >
                  Transparent
                </Button>
                <Button
                  variant={mode === 'sealed' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setMode('sealed')}
                >
                  Sealed
                </Button>
              </div>
              <p className="text-muted mt-2">
                {mode === 'sealed'
                  ? 'Sealed mode publishes only per-item commitments; VRF outputs and proofs stay local until you reveal each item.'
                  : 'Transparent mode shows items and their VRF data immediately (educational demo).'}
              </p>
            </div>

            <Button
              onClick={handleGenerateLoot}
              loading={lootLoading || sealedLoading}
              disabled={!canGenerateLoot}
              size="lg"
              className="mb-3"
            >
              Generate {itemCount} {mode === 'sealed' ? 'Sealed' : 'Loot'} Item{itemCount !== 1 ? 's' : ''}
            </Button>

            {mode === 'sealed' && sealedRecords.length > 0 && (
              <Button
                variant="secondary"
                onClick={clearSealed}
                disabled={isLoading}
                className="mb-3"
              >
                Clear Sealed Batch
              </Button>
            )}

            {generatedItems.length > 0 && (
              <div>
                <Button
                  variant="secondary"
                  onClick={clearItems}
                  disabled={isLoading}
                  className="mb-3"
                >
                  Clear Items
                </Button>
                
                <LootStats stats={rarityStats} totalItems={generatedItems.length} />
              </div>
            )}
          </div>
        </div>

        {/* Sealed Batch Display (face-down commitments, per-item reveal) */}
        {sealedManifest && sealedRecords.length > 0 && (
          <SealedLootDisplay
            manifest={sealedManifest}
            records={sealedRecords}
            verifiedReveals={verifiedReveals}
            onReveal={reveal}
          />
        )}

        {/* Generated Items Display */}
        {generatedItems.length > 0 && (
          <LootDisplay 
            items={generatedItems}
            publicKey={keyPair?.publicKey || ''}
          />
        )}
      </Card>
    </div>
  );
};
