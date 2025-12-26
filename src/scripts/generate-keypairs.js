// Temporary script to generate real VRF keypairs
const elliptic = require('elliptic');
const EC = new elliptic.ec('p256');

// Generate Alice's keypair
const aliceKeyPair = EC.genKeyPair();
const alicePrivateKey = aliceKeyPair.getPrivate('hex');
const alicePublicKey = aliceKeyPair.getPublic('hex');

// Generate Bob's keypair
const bobKeyPair = EC.genKeyPair();
const bobPrivateKey = bobKeyPair.getPrivate('hex');
const bobPublicKey = bobKeyPair.getPublic('hex');

console.log('// Real VRF Keypairs Generated');
console.log('// Alice:');
console.log(`const ALICE_PRIVATE_KEY = '${alicePrivateKey}';`);
console.log(`const ALICE_PUBLIC_KEY = '${alicePublicKey}';`);
console.log('');
console.log('// Bob:');
console.log(`const BOB_PRIVATE_KEY = '${bobPrivateKey}';`);
console.log(`const BOB_PUBLIC_KEY = '${bobPublicKey}';`);
