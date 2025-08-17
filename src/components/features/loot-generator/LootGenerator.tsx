// Loot Generator Component - Clean separation of concerns
import React, { useState, ChangeEvent } from 'react';
import { useVRF } from '../../../hooks/useVRF';
import { useLootGeneration } from '../../../hooks/useLootGeneration';
import { Card } from '../../ui/Card/Card';
import { Button } from '../../ui/Button/Button';
import { Input } from '../../ui/Input/Input';
import { LootDisplay } from './LootDisplay';
import { LootStats } from './LootStats';
import { LOOT_CONSTANTS } from '../../../constants/loot.constants';

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

  const [blockhash, setBlockhash] = useState('');
  const [itemCount, setItemCount] = useState(LOOT_CONSTANTS.LIMITS.DEFAULT_ITEMS);

  const isLoading = vrfLoading || lootLoading;

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
      await generateLoot(keyPair.privateKey, blockhash, itemCount);
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
            
            <Button
              onClick={handleGenerateLoot}
              loading={lootLoading}
              disabled={!canGenerateLoot}
              size="lg"
              className="mb-3"
            >
              Generate {itemCount} Loot Item{itemCount !== 1 ? 's' : ''}
            </Button>

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
