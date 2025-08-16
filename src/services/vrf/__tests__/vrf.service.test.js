import { VRFService } from '../vrf.service';

describe('VRFService', () => {
  let keyPair;
  let testMessage;
  let testMessageBuffer;

  beforeEach(() => {
    keyPair = VRFService.generateKeyPair();
    testMessage = 'test message';
    testMessageBuffer = new TextEncoder().encode(testMessage);
  });

  describe('generateKeyPair', () => {
    test('should generate a valid key pair', () => {
      const newKeyPair = VRFService.generateKeyPair();
      
      expect(newKeyPair).toHaveProperty('privateKey');
      expect(newKeyPair).toHaveProperty('publicKey');
      expect(typeof newKeyPair.privateKey).toBe('string');
      expect(typeof newKeyPair.publicKey).toBe('string');
      expect(newKeyPair.privateKey.length).toBeGreaterThan(0);
      expect(newKeyPair.publicKey.length).toBeGreaterThan(0);
    });

    test('should generate different key pairs on each call', () => {
      const keyPair1 = VRFService.generateKeyPair();
      const keyPair2 = VRFService.generateKeyPair();
      
      expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
    });
  });

  describe('evaluate', () => {
    test('should generate VRF output for valid inputs', () => {
      const result = VRFService.evaluate(keyPair.privateKey, testMessageBuffer);
      
      expect(result).toHaveProperty('vrfOutput');
      expect(result).toHaveProperty('proof');
      expect(result).toHaveProperty('index');
      expect(result.vrfOutput).toBeInstanceOf(Uint8Array);
      expect(result.proof).toBeInstanceOf(Uint8Array);
      expect(result.index).toBeInstanceOf(Uint8Array);
    });

    test('should generate consistent output for same inputs', () => {
      const result1 = VRFService.evaluate(keyPair.privateKey, testMessageBuffer);
      const result2 = VRFService.evaluate(keyPair.privateKey, testMessageBuffer);
      
      expect(result1.vrfOutput).toEqual(result2.vrfOutput);
      expect(result1.proof).toEqual(result2.proof);
      expect(result1.index).toEqual(result2.index);
    });

    test('should generate different output for different messages', () => {
      const message1 = new TextEncoder().encode('message1');
      const message2 = new TextEncoder().encode('message2');
      
      const result1 = VRFService.evaluate(keyPair.privateKey, message1);
      const result2 = VRFService.evaluate(keyPair.privateKey, message2);
      
      expect(result1.vrfOutput).not.toEqual(result2.vrfOutput);
      expect(result1.index).not.toEqual(result2.index);
    });

    test('should throw error for invalid private key', () => {
      expect(() => {
        VRFService.evaluate('invalid-key', testMessageBuffer);
      }).toThrow();
    });

    test('should throw error for empty message', () => {
      expect(() => {
        VRFService.evaluate(keyPair.privateKey, new Uint8Array(0));
      }).toThrow();
    });
  });

  describe('proofToHash', () => {
    test('should verify valid proof and return correct hash', () => {
      const vrfResult = VRFService.evaluate(keyPair.privateKey, testMessageBuffer);
      const computedHash = VRFService.proofToHash(keyPair.publicKey, testMessageBuffer, vrfResult.proof);
      
      expect(computedHash).toBeInstanceOf(Uint8Array);
      expect(computedHash).toEqual(vrfResult.index);
    });

    test('should throw error for invalid proof', () => {
      const invalidProof = new Uint8Array(32).fill(0);
      
      expect(() => {
        VRFService.proofToHash(keyPair.publicKey, testMessageBuffer, invalidProof);
      }).toThrow();
    });

    test('should throw error for mismatched public key', () => {
      const otherKeyPair = VRFService.generateKeyPair();
      const vrfResult = VRFService.evaluate(keyPair.privateKey, testMessageBuffer);
      
      expect(() => {
        VRFService.proofToHash(otherKeyPair.publicKey, testMessageBuffer, vrfResult.proof);
      }).toThrow();
    });
  });
});
