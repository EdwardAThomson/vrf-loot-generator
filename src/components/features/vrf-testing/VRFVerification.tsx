// VRF Verification Component
import React, { useState, ChangeEvent } from 'react';
import { useVRF } from '../../../hooks/useVRF';
import { Button } from '../../ui/Button/Button';
import { Input } from '../../ui/Input/Input';
import styles from './VRFVerification.module.css';

interface VerificationData {
  publicKey: string;
  proof: string;
  message: string;
  vrfOutput: string;
}

/**
 * Component for verifying VRF proofs
 */
export const VRFVerification: React.FC = () => {
  const { verifyVRF, isLoading } = useVRF();
  
  const [verificationData, setVerificationData] = useState<VerificationData>({
    publicKey: '',
    proof: '',
    message: '',
    vrfOutput: ''
  });
  
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);

  const handleInputChange = (field: keyof VerificationData) => (e: ChangeEvent<HTMLInputElement>) => {
    setVerificationData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    // Clear previous result when inputs change
    setVerificationResult(null);
  };

  const handleVerify = async (): Promise<void> => {
    const { publicKey, proof, message, vrfOutput } = verificationData;
    
    if (!publicKey || !proof || !message || !vrfOutput) {
      return;
    }

    try {
      const isValid = await verifyVRF(publicKey, proof, message, vrfOutput);
      setVerificationResult(isValid);
    } catch (err) {
      setVerificationResult(false);
    }
  };

  const isFormValid = Object.values(verificationData).every(value => value.trim() !== '');

  return (
    <div className="vrf-verification mt-4">
      <h3 className="mb-3">VRF Verification</h3>
      <p className="text-muted mb-3">
        Verify a VRF proof by providing the public key, proof, original message, and expected VRF output.
      </p>

      <div className="grid grid-2">
        <div>
          <Input
            label="Public Key"
            value={verificationData.publicKey}
            onChange={handleInputChange('publicKey')}
            placeholder="Enter public key..."
          />

          <Input
            label="Original Message"
            value={verificationData.message}
            onChange={handleInputChange('message')}
            placeholder="Enter original message..."
          />
        </div>

        <div>
          <Input
            label="VRF Proof"
            value={verificationData.proof}
            onChange={handleInputChange('proof')}
            placeholder="Enter VRF proof (JSON or string)..."
          />

          <Input
            label="Expected VRF Output (Index)"
            value={verificationData.vrfOutput}
            onChange={handleInputChange('vrfOutput')}
            placeholder="Enter expected VRF output..."
          />
        </div>
      </div>

      <div className={`${styles.verificationActions} mt-3`}>
        <Button
          onClick={handleVerify}
          loading={isLoading}
          disabled={!isFormValid || isLoading}
        >
          Verify Proof
        </Button>

        {verificationResult !== null && (
          <div className={`${styles.verificationResult} ${verificationResult ? styles.success : styles.failure}`}>
            <strong className={styles.resultTitle}>
              {verificationResult ? '✅ Verification Successful' : '❌ Verification Failed'}
            </strong>
            <p className={styles.resultText}>
              {verificationResult 
                ? 'The VRF proof is valid and matches the expected output.'
                : 'The VRF proof is invalid or does not match the expected output.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
