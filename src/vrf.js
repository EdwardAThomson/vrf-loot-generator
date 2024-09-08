// vrf.js
// based upon Google's Key Transparency (license: Apache 2.0)
// https://github.com/google/keytransparency/blob/master/core/crypto/vrf/p256/p256.go
// Code translated by ChatGPT

// The original license:
// Copyright 2016 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


const elliptic = require('elliptic');
const { sha256 } = require('js-sha256');
const { sha512 } = require('js-sha512');
const BN = require('bn.js');

// Initialize elliptic curve using P256
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

// VRF key generation
function generateKey() {
  const keyPair = EC.genKeyPair();
  return {
    publicKey: keyPair.getPublic(),
    privateKey: keyPair.getPrivate(),
  };
}

// Evaluate VRF: Computes the VRF output and proof
function evaluate(privateKey, message) {
  const keyPair = EC.keyFromPrivate(privateKey);

  // H = H1(m)
  const H = H1(message);

  // VRF output: [k]H
  const vrfPoint = H.mul(privateKey);
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
  const t = r.sub(s.mul(privateKey)).umod(curve.n);

  // Hash the VRF result to produce the index
  const index = sha256.array(new Uint8Array(vrf));

  // Construct the proof (s, t, VRF output)
  const proof = [
    ...s.toArray('be', 32),
    ...t.toArray('be', 32),
    ...vrf,
  ];

  // return VRF Index, Proof, VRF Output, and the random value
  return { index, proof, vrfOutput: vrf };
}

// Verify the VRF proof
function proofToHash(publicKey, message, proof) {
  const keyPair = EC.keyFromPublic(publicKey);

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
}

// Export the functions
module.exports = {
  generateKey,
  evaluate,
  proofToHash,
};
