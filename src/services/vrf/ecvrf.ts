// RFC 9381 ECVRF-EDWARDS25519-SHA512-TAI (suite_string = 0x03)
//
// Implements the final RFC 9381 verifiable random function over edwards25519
// with SHA-512 and the try-and-increment hash-to-curve method, on top of the
// audited @noble/curves and @noble/hashes primitives.
//
// Encodings (all per RFC 9381 Section 5.5, little-endian integers per RFC 8032):
//   secret key  SK:   32 bytes (RFC 8032 ed25519 seed)
//   public key  Y:    32 bytes (compressed edwards point)
//   proof       pi:   80 bytes = Gamma (32) || c (16) || s (32)
//   output      beta: 64 bytes = proof_to_hash(pi)
//
// Validated against the RFC 9381 Appendix B.3 test vectors (Examples 16-18);
// see __tests__/ecvrf.rfc9381-vectors.test.ts.

import { ed25519 } from '@noble/curves/ed25519';
import { sha512 } from '@noble/hashes/sha2';

const Point = ed25519.ExtendedPoint;
type EdPoint = typeof Point.BASE;

const SUITE_ID = 0x03; // ECVRF-EDWARDS25519-SHA512-TAI
const ORDER = ed25519.CURVE.n; // prime order q of the base point subgroup

export const SECRET_KEY_LENGTH = 32;
export const PUBLIC_KEY_LENGTH = 32;
export const PROOF_LENGTH = 80; // Gamma(32) || c(16) || s(32)
export const OUTPUT_LENGTH = 64; // beta = SHA-512 output
const C_LENGTH = 16; // cLen = qLen / 2

// ---------------------------------------------------------------------------
// Byte / integer helpers (little-endian, per the suite's int_to_string)
// ---------------------------------------------------------------------------

/** Cross-realm-safe Uint8Array check (instanceof fails across JS realms). */
export function isBytes(value: unknown): value is Uint8Array {
  return (
    value instanceof Uint8Array ||
    (ArrayBuffer.isView(value) && value.constructor.name === 'Uint8Array')
  );
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const length = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function bytesToNumberLE(bytes: Uint8Array): bigint {
  let result = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i]);
  }
  return result;
}

function numberToBytesLE(value: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let v = value;
  for (let i = 0; i < length; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  if (v !== 0n) {
    throw new Error('ECVRF: integer does not fit in requested byte length');
  }
  return out;
}

function modOrder(value: bigint): bigint {
  const r = value % ORDER;
  return r >= 0n ? r : r + ORDER;
}

/** Scalar multiplication that tolerates zero scalars and the identity point. */
function mul(point: EdPoint, scalar: bigint): EdPoint {
  if (scalar === 0n || point.equals(Point.ZERO)) {
    return Point.ZERO;
  }
  return point.multiply(scalar);
}

/** Strict RFC 8032 string_to_point: rejects non-canonical encodings. */
function decodePoint(bytes: Uint8Array): EdPoint {
  return Point.fromHex(bytes, false);
}

// ---------------------------------------------------------------------------
// RFC 9381 subroutines
// ---------------------------------------------------------------------------

/**
 * Derive the secret scalar x and the nonce-generation key from the 32-byte
 * secret key, per RFC 8032 Section 5.1.5 / RFC 9381 Section 5.4.2.2.
 * The scalar is returned reduced mod q, which is equivalent for every use
 * here (B and H both have order q).
 */
function deriveScalarAndNonceKey(secretKey: Uint8Array): { x: bigint; nonceKey: Uint8Array } {
  const hashed = sha512(secretKey);
  const scalarBytes = hashed.slice(0, 32);
  scalarBytes[0] &= 0xf8;
  scalarBytes[31] &= 0x7f;
  scalarBytes[31] |= 0x40;
  return {
    x: modOrder(bytesToNumberLE(scalarBytes)),
    nonceKey: hashed.slice(32),
  };
}

/**
 * ECVRF_encode_to_curve, try-and-increment variant (RFC 9381 Section 5.4.1.1).
 * encode_to_curve_salt is the encoded public key Y.
 */
function encodeToCurveTAI(salt: Uint8Array, alpha: Uint8Array): EdPoint {
  const prefix = new Uint8Array([SUITE_ID, 0x01]); // suite_string || encode_to_curve_domain_separator_front
  for (let ctr = 0; ctr < 256; ctr++) {
    const hashInput = concatBytes(prefix, salt, alpha, new Uint8Array([ctr, 0x00]));
    const hashString = sha512(hashInput);
    try {
      const candidate = decodePoint(hashString.slice(0, 32));
      const h = candidate.clearCofactor(); // H = cofactor * H
      if (!h.equals(Point.ZERO)) {
        return h;
      }
    } catch {
      // Not a valid point encoding; increment ctr and retry.
    }
  }
  throw new Error('ECVRF: encode_to_curve failed to find a valid point');
}

/** ECVRF_nonce_generation (RFC 9381 Section 5.4.2.2). */
function generateNonce(nonceKey: Uint8Array, hString: Uint8Array): bigint {
  const kString = sha512(concatBytes(nonceKey, hString));
  return modOrder(bytesToNumberLE(kString));
}

/** ECVRF_challenge_generation (RFC 9381 Section 5.4.3) over encoded points. */
function generateChallenge(...encodedPoints: Uint8Array[]): bigint {
  const cString = sha512(
    concatBytes(new Uint8Array([SUITE_ID, 0x02]), ...encodedPoints, new Uint8Array([0x00]))
  );
  return bytesToNumberLE(cString.slice(0, C_LENGTH));
}

/** beta = Hash(suite_string || 0x03 || point_to_string(cofactor * Gamma) || 0x00) */
function betaFromGamma(gamma: EdPoint): Uint8Array {
  return sha512(
    concatBytes(
      new Uint8Array([SUITE_ID, 0x03]),
      gamma.clearCofactor().toRawBytes(),
      new Uint8Array([0x00])
    )
  );
}

/** ECVRF_decode_proof (RFC 9381 Section 5.4.4). */
function decodeProof(pi: Uint8Array): { gamma: EdPoint; c: bigint; s: bigint } {
  if (!isBytes(pi) || pi.length !== PROOF_LENGTH) {
    throw new Error(`ECVRF: proof must be ${PROOF_LENGTH} bytes`);
  }
  const gamma = decodePoint(pi.slice(0, 32)); // throws on invalid encoding
  const c = bytesToNumberLE(pi.slice(32, 48));
  const s = bytesToNumberLE(pi.slice(48, 80));
  if (s >= ORDER) {
    throw new Error('ECVRF: proof scalar s is out of range');
  }
  return { gamma, c, s };
}

function assertSecretKey(secretKey: Uint8Array): void {
  if (!isBytes(secretKey) || secretKey.length !== SECRET_KEY_LENGTH) {
    throw new Error(`ECVRF: secret key must be ${SECRET_KEY_LENGTH} bytes`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Derive the 32-byte public key from a 32-byte secret key. */
export function getPublicKey(secretKey: Uint8Array): Uint8Array {
  assertSecretKey(secretKey);
  return ed25519.getPublicKey(secretKey);
}

/** ECVRF_prove: produce the 80-byte proof pi for (SK, alpha). Deterministic. */
export function prove(secretKey: Uint8Array, alpha: Uint8Array): Uint8Array {
  assertSecretKey(secretKey);
  const { x, nonceKey } = deriveScalarAndNonceKey(secretKey);
  const publicKey = ed25519.getPublicKey(secretKey);

  const h = encodeToCurveTAI(publicKey, alpha);
  const hString = h.toRawBytes();

  const gamma = mul(h, x);
  const k = generateNonce(nonceKey, hString);

  const c = generateChallenge(
    publicKey,
    hString,
    gamma.toRawBytes(),
    mul(Point.BASE, k).toRawBytes(),
    mul(h, k).toRawBytes()
  );
  const s = modOrder(k + c * x);

  return concatBytes(gamma.toRawBytes(), numberToBytesLE(c, C_LENGTH), numberToBytesLE(s, 32));
}

/**
 * ECVRF_proof_to_hash: derive the 64-byte output beta from a proof, WITHOUT
 * verifying it. Only use on proofs already known to be valid (e.g. the output
 * of prove); untrusted proofs must go through verify().
 */
export function proofToHash(pi: Uint8Array): Uint8Array {
  const { gamma } = decodeProof(pi);
  return betaFromGamma(gamma);
}

/**
 * ECVRF_verify (RFC 9381 Section 5.3): check that pi is a valid proof for
 * (PK, alpha) and return the 64-byte output beta. Throws if invalid.
 * Performs full key validation (rejects small-order public keys).
 */
export function verify(publicKey: Uint8Array, alpha: Uint8Array, pi: Uint8Array): Uint8Array {
  if (!isBytes(publicKey) || publicKey.length !== PUBLIC_KEY_LENGTH) {
    throw new Error(`ECVRF: public key must be ${PUBLIC_KEY_LENGTH} bytes`);
  }
  const y = decodePoint(publicKey); // throws on invalid encoding
  if (y.clearCofactor().equals(Point.ZERO)) {
    throw new Error('ECVRF: public key is a small-order point');
  }

  const { gamma, c, s } = decodeProof(pi);
  const h = encodeToCurveTAI(publicKey, alpha);

  const u = mul(Point.BASE, s).subtract(mul(y, c)); // U = s*B - c*Y
  const v = mul(h, s).subtract(mul(gamma, c)); // V = s*H - c*Gamma

  const cPrime = generateChallenge(
    publicKey,
    h.toRawBytes(),
    gamma.toRawBytes(),
    u.toRawBytes(),
    v.toRawBytes()
  );

  if (c !== cPrime) {
    throw new Error('ECVRF: invalid proof');
  }
  return betaFromGamma(gamma);
}
