// VRF library testing

import React, { useState } from 'react';
import { generateKey, evaluate, proofToHash } from './vrf';

// Convert Uint8Array or Buffer to hex string, with fallback for undefined values
function toHexString(byteArray) {
  if (!byteArray) return 'undefined'; // Handle undefined or null cases
  return Array.from(byteArray, byte => ('0' + (byte & 0xff).toString(16)).slice(-2)).join('');
}


function App() {
  const [message, setMessage] = useState('');
  const [privateKey, setPrivateKey] = useState(null);
  const [publicKey, setPublicKey] = useState(null);
  const [vrfOutput, setVrfOutput] = useState(null);
  const [proof, setProof] = useState(null);
  const [index, setIndex] = useState(null);
  // const [randomScalar, setRandomScalar] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifiedIndex, setVerifiedIndex] = useState(null);

  // Loot generation stuff
  const [lootData, setLootData] = useState([]);
  const [iterations, setIterations] = useState(5); // Number of iterations

  // Generate a new key pair
  const generateKeys = () => {
    const { privateKey, publicKey } = generateKey();
    setPrivateKey(privateKey);
    setPublicKey(publicKey);
    setVrfOutput(null);
    setProof(null);
    setIndex(null);
    // setRandomScalar(null);
    setVerificationResult(null);
    setVerifiedIndex(null);
  };

  // Compute VRF and proof
  const computeVRF = () => {
    if (!privateKey || !message) {
      alert('Please generate a key and enter a message.');
      return;
    }
    const msgBuffer = new TextEncoder().encode(message);
    const { index, proof, vrfOutput } = evaluate(privateKey, msgBuffer);

    setIndex(index);
    setProof(proof);
    setVrfOutput(vrfOutput);
    // setRandomScalar(randomScalar);

  };

  // Verify the VRF proof
  const verifyProof = () => {
    if (!publicKey || !message || !proof) {
      alert('Please generate the VRF and proof first.');
      return;
    }
    const msgBuffer = new TextEncoder().encode(message);
    try {
      const verifiedIndex = proofToHash(publicKey, msgBuffer, proof);
      setVerifiedIndex(verifiedIndex);

      // Compare the verifiedIndex with the original index from proof generation
      if (toHexString(verifiedIndex) === toHexString(index)) {
        setVerificationResult('VRF proof is valid and VRF index matches!');
      } else {
        setVerificationResult('VRF proof is valid, but VRF index does NOT match.');
      }

    } catch (error) {
      setVerificationResult(`Invalid VRF proof: ${error.message}`);
    }
  };


  // =========== Loot generation section ==========


  // [RARITY]
  // Determine the item rarity using VRF output
  // Function to map VRF output to loot rarity
  const determineLootRarity = (vrfOutput) => {
    // Convert the first 8 characters of the VRF output into a decimal number
    const outputDecimal = parseInt(toHexString(vrfOutput).slice(0, 8), 16) % 100; // Range: 0-99

    // Rarity based on percentage thresholds (common: 60%, rare: 20%, epic: 10%, legendary: 10%)
    if (outputDecimal < 55) return 'Common';       // 55% chance
    if (outputDecimal < 80) return 'Rare';         // 25% chance
    if (outputDecimal < 95) return 'Epic';         // 15% chance
    return 'Legendary';                            // 5% chance
  };

  // List of possible items
  const itemTypes = ['Sword', 'Axe', 'Shield', 'Bow', 'Dagger', 'Staff'];

  // List of possible enchantment or properties
  const itemModifiers = ['Flaming', 'Lightning', 'Icy', 'Cursed', 'Poisonous', 'Holy', 'Gilded', 'Astral'];

  // [TYPE]
  // Determine the item type based on VRF output
  const determineItemType = (vrfOutput) => {
      const hexString = toHexString(vrfOutput);

      // Use a different slice of the hex string to determine the item
      const itemIndex = parseInt(hexString.slice(8, 12), 16) % itemTypes.length;
      // console.log("item index:", itemIndex)
      return itemTypes[itemIndex];
  };

  // [ENCHANTMENT]
  // Determine the item enchantment based on VRF output
  const determineItemModifier = (vrfOutput) => {
      const hexString = toHexString(vrfOutput);

      // Use a different slice of the hex string to determine the item modifier
      const modifierIndex = parseInt(hexString.slice(12, 16), 16) % itemModifiers.length;
      // console.log("Enchantment index", modifierIndex)
      return itemModifiers[modifierIndex];
  };


  // Generate seeds and loot items using VRF
  const generateLoot = async () => {
    // keys already created
    if (!privateKey || !message) {
      alert('Please generate a key and enter a blockhash.');
      return;
    }

    const blockhash = message; // set blockhash = message taken from the user -- slightly redundant
    let lootList = [];     // Loot array

    // generate loot
    for (let i = 0; i < iterations; i++) {

      const message = blockhash + i.toString(16); // Use blockhash + integer as data
      const msgBuffer = new TextEncoder().encode(message);

      // Call evaluate with the modified message
      const { index, proof, vrfOutput } = evaluate(privateKey, msgBuffer);

      setIndex(index);
      setProof(proof);  // the Proof looks awful in its raw form, that's why the HexString function exists.
      setVrfOutput(vrfOutput);   // the VRF Output looks awful in its raw form, that's why the HexString function exists.

      // Generate loot based on VRF output (you can adjust this logic)
      const rarity = determineLootRarity(vrfOutput); //determineLoot1(vrfOutput); // Determine item rarity
      const itemType = determineItemType(vrfOutput); // Determine item type
      const modifier = determineItemModifier(vrfOutput); // Determine item enchantment
      lootList.push({ iteration: i, message, vrfOutput: toHexString(vrfOutput), proof: toHexString(proof), rarity, modifier, itemType });
    }

    setLootData(lootList);
  };

  // UI stuff for this app
  return (
    <div style={{ padding: '20px' }}>
      <h1>VRF Loot Generator</h1>
      <p>First section shows a test of the VRF calculations. Compare the outputs with the code.</p>
      <p>Second section shows the output from a simple loot generation algorithm.</p>
      <hr/>

      <h2>VRF Testing</h2>
      <p> Perform each step in order.</p>
        <ul>
          <li>Click "Generate Key Pair"</li>
          <li>Enter a message (this could be a blockhash)</li>
          <li>Click "Compute VRF"</li>
          <li>Click "Verify VRF Proof"</li>
        </ul>

      <hr/>

      <div>
        <button onClick={generateKeys}>Generate Key Pair</button>
        {publicKey && (
          <div>
            <p><strong>Public Key (Hex):</strong> {publicKey.encode('hex')}</p>
          </div>
        )}
      </div>

      <div>
        <label>
          <strong>Message:</strong>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ margin: '0 10px' }}
          />
        </label>
      </div>

      <div>
        <button onClick={computeVRF}>Compute VRF</button>
      </div>

      {privateKey && (
        <div>
          <p><strong>Private Key (Hex):</strong> {privateKey.toString(16)}</p>
        </div>
      )}

      {message && (
        <div>
          <p><strong>Message (Hex):</strong> (blockhash) {toHexString(new TextEncoder().encode(message))}</p>
        </div>
      )}

      {vrfOutput && (
        <div>
          <p><strong>VRF Output (Hex):</strong> {toHexString(vrfOutput)}</p>
        </div>
      )}

      {index && proof && (
        <div>
          <p><strong>VRF Index (Hex):</strong> {toHexString(index)}</p>
          <p><strong>VRF Proof (Hex):</strong> {toHexString(proof)}</p>
        </div>
      )}

      <div>
        <button onClick={verifyProof}>Verify VRF Proof</button>
      </div>

      {verificationResult && verifiedIndex && (
        <div>
          <p><strong>Verification Result:</strong> {verificationResult}</p>
          <p><strong>Verified Index (Hex):</strong> {toHexString(verifiedIndex)}</p>
        </div>
      )}


      <div>
        <hr/>
        <h2>Loot Results</h2>
        <p> Go through section 1 first. You need to generate a keypair and insert a message first.</p>
        <label>
          <strong>Number of items:</strong>
          <input
              type="number"
              value={iterations}
              onChange={(e) => setIterations(e.target.value)}
              min="1"
              style={{margin: '0 10px', width: '80px'}}
          />
        </label>
      </div>

      <div>
      <button onClick={generateLoot}>Generate Loot</button>
      </div>

      {lootData.length > 0 && (
        <div>

             <p>
                Blockhash: {message}
             </p>

          {lootData.map((result, index) => (
            <div key={index}>
              <p>
                <strong>Item {result.iteration + 1}:</strong> VRF Output: {result.vrfOutput}, {result.rarity} {result.modifier} {result.itemType}
              </p>
            </div>
          ))}
        </div>
      )}



    </div>
  );
}

export default App;
