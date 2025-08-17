// VRF Type definitions

export interface VRFKeyPair {
  privateKey: string;
  publicKey: string;
}

export interface VRFResult {
  vrfOutput: Uint8Array;
  proof: Uint8Array;
  index: Uint8Array;
}

export interface VRFFormattedResult {
  vrfOutput: string;
  proof: VRFProof;
  index: string;
  message: string;
  publicKey: string;
}

export interface VRFProof {
  gamma: string;
  c: string;
  s: string;
}

export interface VRFVerificationParams {
  publicKey: string;
  proof: VRFProof | string;
  message: Uint8Array;
  vrfOutput: string;
}

export interface VRFStoreState {
  keyPair: VRFKeyPair | null;
  vrfResults: VRFFormattedResult[];
  isGenerating: boolean;
  error: string | null;
  testMessage: string;
  testResult: VRFFormattedResult | null;
  verificationResult: boolean | null;
}

export interface VRFStoreActions {
  setKeyPair: (keyPair: VRFKeyPair) => void;
  setTestMessage: (message: string) => void;
  setVRFResult: (result: VRFFormattedResult) => void;
  setVerificationResult: (result: boolean) => void;
  setGenerating: (isGenerating: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  clearResults: () => void;
  clearAll: () => void;
  hasKeyPair: () => boolean;
  getLatestResult: () => VRFFormattedResult | null;
  getResultsCount: () => number;
}
