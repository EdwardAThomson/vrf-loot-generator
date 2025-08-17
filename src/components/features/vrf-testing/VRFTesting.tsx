// VRF Testing Component - Clean separation of concerns
import React, { useState, ChangeEvent } from 'react';
import { useVRF } from '../../../hooks/useVRF';
import { Card } from '../../ui/Card/Card';
import { Button } from '../../ui/Button/Button';
import { Input } from '../../ui/Input/Input';
import { VRFOutput } from './VRFOutput';
import { VRFVerification } from './VRFVerification';
import { VRFKeyPair } from '../../../types/vrf.types';

/**
 * VRF Testing tab component - pure UI logic
 */
export const VRFTesting: React.FC = () => {
  const {
    keyPair,
    vrfResult,
    isLoading,
    error,
    generateKeyPair,
    computeVRF,
    clearError,
    setKeyPair
  } = useVRF();

  const [message, setMessage] = useState<string>('');

  const handleGenerateKeys = async (): Promise<void> => {
    try {
      await generateKeyPair();
    } catch (err) {
      // Error is handled by the hook
    }
  };

  const handleComputeVRF = async (): Promise<void> => {
    if (!keyPair?.privateKey || !message) {
      return;
    }

    try {
      await computeVRF(keyPair.privateKey, message);
    } catch (err) {
      // Error is handled by the hook
    }
  };

  const handlePrivateKeyChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const newKeyPair: VRFKeyPair = { 
      ...keyPair || { privateKey: '', publicKey: '' }, 
      privateKey: e.target.value 
    };
    setKeyPair(newKeyPair);
  };

  const handlePublicKeyChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const newKeyPair: VRFKeyPair = { 
      ...keyPair || { privateKey: '', publicKey: '' }, 
      publicKey: e.target.value 
    };
    setKeyPair(newKeyPair);
  };

  return (
    <div className="vrf-testing">
      <Card
        title="VRF Testing"
        description="Generate key pairs, compute VRF outputs, and verify proofs using Verifiable Random Functions."
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
            <h3 className="mb-3">Key Generation</h3>
            <Button
              onClick={handleGenerateKeys}
              loading={isLoading}
              disabled={isLoading}
              className="mb-3"
            >
              Generate Key Pair
            </Button>

            <Input
              label="Private Key"
              value={keyPair?.privateKey || ''}
              onChange={handlePrivateKeyChange}
              placeholder="Private key will appear here..."
              className="mb-2"
            />

            <Input
              label="Public Key"
              value={keyPair?.publicKey || ''}
              onChange={handlePublicKeyChange}
              placeholder="Public key will appear here..."
            />
          </div>

          {/* VRF Computation Section */}
          <div>
            <h3 className="mb-3">VRF Computation</h3>
            <Input
              label="Message"
              value={message}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setMessage(e.target.value)}
              placeholder="Enter message to compute VRF..."
              className="mb-3"
            />

            <Button
              onClick={handleComputeVRF}
              loading={isLoading}
              disabled={!keyPair?.privateKey || !message || isLoading}
            >
              Compute VRF
            </Button>
          </div>
        </div>

        {/* VRF Output Display */}
        {vrfResult && (
          <VRFOutput 
            result={vrfResult}
            publicKey={keyPair?.publicKey || ''}
          />
        )}

        {/* VRF Verification Section */}
        <VRFVerification />
      </Card>
    </div>
  );
};
