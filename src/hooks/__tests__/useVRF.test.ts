import { renderHook, act } from '@testing-library/react';
import { useVRF } from '../useVRF';
import { VRFService } from '../../services/vrf/vrf.service';

// Mock VRF Service
jest.mock('../../services/vrf/vrf.service', () => ({
  VRFService: {
    generateKeyPair: jest.fn(() => ({
      privateKey: 'mock-private-key',
      publicKey: 'mock-public-key'
    })),
    evaluate: jest.fn(() => ({
      vrfOutput: new Uint8Array([1, 2, 3, 4]),
      proof: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
      index: new Uint8Array([1, 2, 3, 4])
    })),
    proofToHash: jest.fn(() => new Uint8Array([1, 2, 3, 4]))
  }
}));

// Mock Zustand store
jest.mock('../../store/index', () => ({
  useVRFStore: () => ({
    keyPair: null,
    testResult: null,
    isGenerating: false,
    error: null,
    setKeyPair: jest.fn(),
    setVRFResult: jest.fn(),
    setGenerating: jest.fn(),
    setError: jest.fn(),
    clearError: jest.fn()
  })
}));

describe('useVRF', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should provide VRF operations', () => {
    const { result } = renderHook(() => useVRF());
    
    expect(result.current).toHaveProperty('generateKeyPair');
    expect(result.current).toHaveProperty('computeVRF');
    expect(result.current).toHaveProperty('verifyVRF');
    expect(result.current).toHaveProperty('proofToHash');
    expect(result.current).toHaveProperty('clearError');
    expect(result.current).toHaveProperty('reset');
  });

  test('should provide state properties', () => {
    const { result } = renderHook(() => useVRF());
    
    expect(result.current).toHaveProperty('keyPair');
    expect(result.current).toHaveProperty('vrfResult');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
  });

  test('generateKeyPair should call VRF service', async () => {
    const { result } = renderHook(() => useVRF());
    
    await act(async () => {
      await result.current.generateKeyPair();
    });
    
    expect(VRFService.generateKeyPair).toHaveBeenCalled();
  });

  test('computeVRF should call VRF service with correct parameters', async () => {
    const { result } = renderHook(() => useVRF());
    
    await act(async () => {
      await result.current.computeVRF('test-private-key', 'test-message');
    });
    
    expect(VRFService.evaluate).toHaveBeenCalled();
  });

  test('verifyVRF should call VRF service for verification', async () => {
    const { result } = renderHook(() => useVRF());
    
    await act(async () => {
      await result.current.verifyVRF(
        'test-public-key',
        'test-proof',
        'test-message',
        'test-expected-output'
      );
    });
    
    expect(VRFService.proofToHash).toHaveBeenCalled();
  });

  test('should handle empty parameters gracefully', async () => {
    const { result } = renderHook(() => useVRF());
    
    await act(async () => {
      const vrfResult = await result.current.computeVRF('', '');
      expect(vrfResult).toBeNull();
    });
    
    await act(async () => {
      const verifyResult = await result.current.verifyVRF('', '', '', '');
      expect(verifyResult).toBe(false);
    });
  });
});
