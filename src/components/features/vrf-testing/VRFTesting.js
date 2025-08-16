// VRF Testing Component - Clean separation of concerns
import React, { useState } from 'react';
import { useVRF } from '../../../hooks/useVRF.js';
import { Card } from '../../ui/Card/Card.js';
import { Button } from '../../ui/Button/Button.js';
import { Input } from '../../ui/Input/Input.js';
import { VRFOutput } from './VRFOutput.js';
import { VRFVerification } from './VRFVerification.js';

/**
 * VRF Testing tab component - pure UI logic
 */
export const VRFTesting = () => {
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

  const [message, setMessage] = useState('');

  const handleGenerateKeys = async () => {
    try {
      await generateKeyPair();
    } catch (err) {
      // Error is handled by the hook
    }
  };

  const handleComputeVRF = async () => {
    if (!keyPair.privateKey || !message) {
      return;
    }

    try {
      await computeVRF(keyPair.privateKey, message);
    } catch (err) {
      // Error is handled by the hook
    }
  };

  const handlePrivateKeyChange = (e) => {
    setKeyPair(prev => ({ ...prev, privateKey: e.target.value }));
  };

  const handlePublicKeyChange = (e) => {
    setKeyPair(prev => ({ ...prev, publicKey: e.target.value }));
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
              value={keyPair.privateKey}
              onChange={handlePrivateKeyChange}
              placeholder="Private key will appear here..."
              className="mb-2"
            />

            <Input
              label="Public Key"
              value={keyPair.publicKey}
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
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter message to compute VRF..."
              className="mb-3"
            />

            <Button
              onClick={handleComputeVRF}
              loading={isLoading}
              disabled={!keyPair.privateKey || !message || isLoading}
            >
              Compute VRF
            </Button>
          </div>
        </div>

        {/* VRF Output Display */}
        {vrfResult && (
          <VRFOutput 
            result={vrfResult}
            publicKey={keyPair.publicKey}
          />
        )}

        {/* VRF Verification Section */}
        <VRFVerification />
      </Card>
    </div>
  );
};
