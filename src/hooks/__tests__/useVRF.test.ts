import { renderHook, act } from '@testing-library/react';
import { useVRF } from '../useVRF';
import { VRFService } from '../../services/vrf/vrf.service';

// Mock VRF Service. IMPORTANT: react-scripts runs jest with `resetMocks: true`,
// which wipes any implementation given inside the jest.mock factory before
// each test. So the factory only creates the jest.fn() shells, and the
// implementations are (re)installed in beforeEach below.
jest.mock('../../services/vrf/vrf.service', () => ({
  VRFService: {
    generateKeyPair: jest.fn(),
    getPublicKeyFromPrivate: jest.fn(),
    evaluate: jest.fn(),
    proofToHash: jest.fn(),
    verify: jest.fn()
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
    // resetMocks has already cleared implementations; reinstall them.
    (VRFService.generateKeyPair as jest.Mock).mockReturnValue({
      privateKey: 'mock-private-key',
      publicKey: 'mock-public-key'
    });
    (VRFService.getPublicKeyFromPrivate as jest.Mock).mockReturnValue('mock-public-key');
    (VRFService.evaluate as jest.Mock).mockReturnValue({
      vrfOutput: new Uint8Array(64).fill(2),
      proof: new Uint8Array(80).fill(1),
      index: new Uint8Array(32).fill(3)
    });
    (VRFService.proofToHash as jest.Mock).mockReturnValue(new Uint8Array(32).fill(3));
    (VRFService.verify as jest.Mock).mockReturnValue(new Uint8Array(64).fill(2));
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
      // NOTE: the proof must be a plain hex string. A value containing '-'
      // (like the old 'test-proof') is parsed as the gamma-c-s display format
      // and throws before VRFService.verify is ever reached.
      await result.current.verifyVRF(
        'aabbccdd', // public key (hex)
        'deadbeef', // proof (raw hex string)
        'test-message',
        'cafebabe' // expected VRF output (hex)
      );
    });

    expect(VRFService.verify).toHaveBeenCalled();
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
