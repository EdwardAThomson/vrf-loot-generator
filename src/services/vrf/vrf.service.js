// VRF Service - Single source of truth for all VRF operations
// Based on the original vrf.js implementation

import elliptic from 'elliptic';
import BN from 'bn.js';
import sha256 from 'js-sha256';
import sha512 from 'js-sha512';

// Initialize elliptic curve using P256 (like original)
const EC = new elliptic.ec('p256');
const curve = EC.curve;
const one = new BN(1);

// Helper: Convert a number to a 32-byte array
function toBytesInt32(num) {
  return new Uint8Array([
    (num >> 24) & 0xff,
    (num >> 16) & 0xff,
    (num >> 8) & 0xff,
    num & 0xff,
  ]);
}

// Hash to a point on the curve (H1)
function H1(message) {
  let x = null, y = null;
  const byteLen = (curve.n.bitLength() + 7) >> 3;
  let i = 0;

  while (x === null && i < 100) {
    // Hash the input + counter
    const hash = sha512.array(new Uint8Array([...toBytesInt32(i), ...message]));
    // Generate a point using the hash
    const pointData = [2, ...hash.slice(0, byteLen)];
    try {
      const point = EC.curve.pointFromX(new BN(pointData.slice(1)), pointData[0] & 1);
      x = point.getX();
      y = point.getY();
    } catch (err) {
      // Invalid point, try the next counter
      i++;
    }
  }
  return curve.point(x, y);
}

// Hash to a scalar (H2)
function H2(data) {
  const byteLen = (curve.n.bitLength() + 7) >> 3;
  let i = 0;

  while (true) {
    const hash = sha512.array(new Uint8Array([...toBytesInt32(i), ...data]));
    const k = new BN(hash.slice(0, byteLen));
    if (k.cmp(curve.n.sub(one)) === -1) {
      return k.add(one);
    }
    i++;
  }
}

/**
 * VRF Service class - handles all VRF operations
 */
export class VRFService {
  /**
   * Generate a new key pair for VRF operations
   * @returns {Object} Object containing privateKey and publicKey
   */
  static generateKeyPair() {
    try {
      const keyPair = EC.genKeyPair();
      return {
        publicKey: keyPair.getPublic('hex'),
        privateKey: keyPair.getPrivate('hex'),
      };
    } catch (error) {
      throw new Error(`Failed to generate key pair: ${error.message}`);
    }
  }

  /**
   * Evaluate VRF for given private key and message
   * @param {*} privateKey - Private key (BN or hex string)
   * @param {Uint8Array} message - Message to evaluate VRF for
   * @returns {Object} Object containing vrfOutput, proof, and index
   */
  static evaluate(privateKey, message) {
    try {
      if (!privateKey || !message) {
        throw new Error('Private key and message are required');
      }

      const keyPair = EC.keyFromPrivate(privateKey, 'hex');
      const privateKeyBN = keyPair.getPrivate();

      // H = H1(m)
      const H = H1(message);

      // VRF output: [k]H
      const vrfPoint = H.mul(privateKeyBN);
      const vrf = vrfPoint.encode();

      // Prover chooses random r
      const rKeyPair = EC.genKeyPair();
      const r = rKeyPair.getPrivate();

      // Calculate r*G and r*H
      const rG = curve.g.mul(r);
      const rH = H.mul(r);

      // Compute the challenge s = H2(G, H, [k]G, VRF, [r]G, [r]H)
      const buffer = [
        ...curve.g.encode(),
        ...H.encode(),
        ...keyPair.getPublic().encode(),
        ...vrf,
        ...rG.encode(),
        ...rH.encode(),
      ];

      const s = H2(buffer);

      // Compute t = r - s * k mod n
      const t = r.sub(s.mul(privateKeyBN)).umod(curve.n);

      // Hash the VRF result to produce the index
      const index = sha256.array(new Uint8Array(vrf));

      // Construct the proof (s, t, VRF output)
      const proof = [
        ...s.toArray('be', 32),
        ...t.toArray('be', 32),
        ...vrf,
      ];

      // return VRF Index, Proof, VRF Output
      return { index, proof, vrfOutput: vrf };
    } catch (error) {
      throw new Error(`VRF evaluation failed: ${error.message}`);
    }
  }

  /**
   * Verify VRF proof (proofToHash from original)
   * @param {*} publicKey - Public key
   * @param {Uint8Array} message - Original message
   * @param {Array} proof - VRF proof as byte array
   * @returns {Array} Verified index if valid, throws error if invalid
   */
  static proofToHash(publicKey, message, proof) {
    try {
      const keyPair = EC.keyFromPublic(publicKey, 'hex');

      if (proof.length !== 64 + 65) {
        throw new Error('Invalid VRF proof length');
      }

      // Parse the proof into s, t, and VRF
      const s = new BN(proof.slice(0, 32));
      const t = new BN(proof.slice(32, 64));
      const vrf = proof.slice(64);

      // Check that VRF is a valid curve point
      const vrfPoint = EC.curve.decodePoint(vrf);
      if (!vrfPoint) {
        throw new Error('Invalid VRF proof: VRF point is not valid');
      }

      // Calculate t*G + s*([k]G)
      const tG = curve.g.mul(t);
      const sG = keyPair.getPublic().mul(s);
      const tksG = tG.add(sG);

      // H = H1(m)
      const H = H1(message);

      // Calculate t*H + s*VRF
      const tH = H.mul(t);
      const sVrf = vrfPoint.mul(s);
      const tksh = tH.add(sVrf);

      // Recompute the challenge: s' = H2(G, H, [k]G, VRF, [t]G + [s]([k]G), [t]H + [s]VRF)
      const buffer = [
        ...curve.g.encode(),
        ...H.encode(),
        ...keyPair.getPublic().encode(),
        ...vrf,
        ...tksG.encode(),
        ...tksh.encode(),
      ];

      const sPrime = H2(buffer);

      // Verify that s == s'
      if (!s.eq(sPrime)) {
        throw new Error('Invalid VRF proof');
      }

      // Return the hashed VRF result (index)
      return sha256.array(new Uint8Array(vrf));
    } catch (error) {
      throw new Error(`VRF verification failed: ${error.message}`);
    }
  }

}

// Legacy exports for backward compatibility
export const generateKey = VRFService.generateKeyPair;
export const evaluate = VRFService.evaluate;
export const proofToHash = VRFService.proofToHash;
