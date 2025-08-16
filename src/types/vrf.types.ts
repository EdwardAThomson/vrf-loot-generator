// VRF-related type definitions

export interface VRFKeyPair {
  publicKey: string;
  privateKey: string;
}

export interface VRFResult {
  vrfOutput: Uint8Array;
  proof: Uint8Array;
  index: Uint8Array;
}

export interface VRFFormattedResult {
  vrfOutput: string;
  proof: string;
  index: string;
  message: string;
  messageHex: string;
}

export interface VRFData {
  publicKey: string;
  proof: Uint8Array | string;
  message: string;
  vrfOutput?: Uint8Array | string;
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
