// Temporary script to generate real VRF keypairs
// (RFC 9381 ECVRF-EDWARDS25519-SHA512-TAI: 32-byte secret and public keys)
const crypto = require('crypto');
const { ed25519 } = require('@noble/curves/ed25519');

function generate() {
  const secretKey = crypto.randomBytes(32);
  const publicKey = Buffer.from(ed25519.getPublicKey(secretKey));
  return {
    privateKey: secretKey.toString('hex'),
    publicKey: publicKey.toString('hex'),
  };
}

const alice = generate();
const bob = generate();

console.log('// Real VRF Keypairs Generated');
console.log('// Alice:');
console.log(`const ALICE_PRIVATE_KEY = '${alice.privateKey}';`);
console.log(`const ALICE_PUBLIC_KEY = '${alice.publicKey}';`);
console.log('');
console.log('// Bob:');
console.log(`const BOB_PRIVATE_KEY = '${bob.privateKey}';`);
console.log(`const BOB_PUBLIC_KEY = '${bob.publicKey}';`);
