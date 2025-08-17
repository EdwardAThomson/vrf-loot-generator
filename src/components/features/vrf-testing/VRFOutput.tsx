// VRF Output Display Component
import React, { useState } from 'react';
import { Button } from '../../ui/Button/Button';
import { VRFFormattedResult } from '../../../types/vrf.types';
import styles from './VRFOutput.module.css';

interface VRFOutputProps {
  result: VRFFormattedResult;
  publicKey: string;
}

/**
 * Component to display VRF computation results
 */
export const VRFOutput: React.FC<VRFOutputProps> = ({ result, publicKey }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, fieldName: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const formatProof = (proof: any): string => {
    if (typeof proof === 'object' && proof !== null) {
      return `${proof.gamma || ''}-${proof.c || ''}-${proof.s || ''}`;
    }
    return proof || 'No proof available';
  };

  return (
    <div className="vrf-output mt-4">
      <h3 className="mb-3">VRF Output</h3>
      
      <div className="grid grid-2">
        <div>
          <div className="form-group">
            <label className="form-label">Message (Original)</label>
            <div className={styles.outputField}>
              <code className={styles.outputText}>{result.message}</code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyToClipboard(result.message, 'message')}
              >
                {copiedField === 'message' ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">VRF Output</label>
            <div className={styles.outputField}>
              <code className={styles.outputText}>{result.vrfOutput}</code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyToClipboard(result.vrfOutput, 'vrfOutput')}
              >
                {copiedField === 'vrfOutput' ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>
        </div>

        <div>
          <div className="form-group">
            <label className="form-label">VRF Proof</label>
            <div className={styles.outputField}>
              <code className={`${styles.outputText} ${styles.proofText}`}>{formatProof(result.proof)}</code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyToClipboard(formatProof(result.proof), 'proof')}
              >
                {copiedField === 'proof' ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Index</label>
            <div className={styles.outputField}>
              <code className={styles.outputText}>{result.index}</code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyToClipboard(result.index, 'index')}
              >
                {copiedField === 'index' ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>

          {publicKey && (
            <div className="form-group">
              <label className="form-label">Public Key (for verification)</label>
              <div className={styles.outputField}>
                <code className={styles.outputText}>{publicKey}</code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(publicKey, 'publicKey')}
                >
                  {copiedField === 'publicKey' ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
