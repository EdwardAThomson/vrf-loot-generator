import { VRFService } from '../vrf.service';
import { VRFKeyPair, VRFResult } from '../../../types/vrf.types';

describe('VRFService', () => {
  let keyPair: VRFKeyPair;
  let testMessage: string;
  let testMessageBuffer: Uint8Array;

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

    test('keyPairFromSeed is deterministic and validates input', () => {
      const seed = new Uint8Array(32).fill(7);
      const a = VRFService.keyPairFromSeed(seed);
      const b = VRFService.keyPairFromSeed(seed);
      expect(a).toEqual(b);
      // A 32-byte seed is used directly as the secret key
      expect(a.privateKey).toBe('07'.repeat(32));
      expect(a.publicKey).toBe(VRFService.getPublicKeyFromPrivate(a.privateKey));

      // Non-32-byte seeds (e.g. wallet signatures) derive deterministically
      const sig = new TextEncoder().encode('wallet-signature-bytes');
      expect(VRFService.keyPairFromSeed(sig)).toEqual(VRFService.keyPairFromSeed(sig));
      expect(VRFService.keyPairFromSeed(sig).privateKey).not.toBe(a.privateKey);

      expect(() => VRFService.keyPairFromSeed(new Uint8Array(0))).toThrow();
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

      // RFC 9381 ECVRF is fully deterministic for (key, message): the nonce
      // is derived from the secret key and message, so output, index, AND
      // proof are all byte-for-byte reproducible.
      expect(result1.vrfOutput).toEqual(result2.vrfOutput);
      expect(result1.index).toEqual(result2.index);
      expect(result1.proof).toEqual(result2.proof);

      const hash1 = VRFService.proofToHash(keyPair.publicKey, testMessageBuffer, result1.proof);
      const hash2 = VRFService.proofToHash(keyPair.publicKey, testMessageBuffer, result2.proof);
      expect(hash1).toEqual(result1.index);
      expect(hash2).toEqual(result1.index);
    });

    test('should produce RFC 9381 sizes (80-byte proof, 64-byte output, 32-byte index)', () => {
      const result = VRFService.evaluate(keyPair.privateKey, testMessageBuffer);
      expect(result.proof.length).toBe(80);
      expect(result.vrfOutput.length).toBe(64);
      expect(result.index.length).toBe(32);
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
      // Wrong length (valid hex but not 32 bytes) must also be rejected
      expect(() => {
        VRFService.evaluate('deadbeef', testMessageBuffer);
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

    test('should throw error for a different message than the one proven', () => {
      const vrfResult = VRFService.evaluate(keyPair.privateKey, testMessageBuffer);
      const otherMessage = new TextEncoder().encode('a different message');

      expect(() => {
        VRFService.proofToHash(keyPair.publicKey, otherMessage, vrfResult.proof);
      }).toThrow();
    });
  });

  describe('tampered proof rejection', () => {
    // A well-formed (correct length: 32-byte Gamma || 16-byte c || 32-byte s,
    // RFC 9381 layout) proof with flipped bytes must be rejected, not just
    // proofs with the wrong length.
    let tamperKeyPair: ReturnType<typeof VRFService.generateKeyPair>;
    let message: Uint8Array;
    let validProof: Uint8Array;

    beforeAll(() => {
      tamperKeyPair = VRFService.generateKeyPair();
      message = new TextEncoder().encode('tamper test message');
      validProof = VRFService.evaluate(tamperKeyPair.privateKey, message).proof;
    });

    const tamperedCopy = (offset: number): Uint8Array => {
      const copy = new Uint8Array(validProof);
      copy[offset] ^= 0x01; // flip one bit, length stays 80
      return copy;
    };

    test('sanity: untampered proof verifies', () => {
      expect(() => {
        VRFService.proofToHash(tamperKeyPair.publicKey, message, validProof);
      }).not.toThrow();
    });

    test('should reject proof with a flipped byte in the Gamma point (bytes 0-31)', () => {
      expect(() => {
        VRFService.proofToHash(tamperKeyPair.publicKey, message, tamperedCopy(5));
      }).toThrow();
    });

    test('should reject proof with a flipped byte in the c component (bytes 32-47)', () => {
      expect(() => {
        VRFService.proofToHash(tamperKeyPair.publicKey, message, tamperedCopy(40));
      }).toThrow();
    });

    test('should reject proof with a flipped byte in the s component (bytes 48-79)', () => {
      expect(() => {
        VRFService.proofToHash(tamperKeyPair.publicKey, message, tamperedCopy(70));
      }).toThrow();
    });

    test('should reject proof with the last byte flipped', () => {
      expect(() => {
        VRFService.proofToHash(tamperKeyPair.publicKey, message, tamperedCopy(79));
      }).toThrow();
    });
  });
});
