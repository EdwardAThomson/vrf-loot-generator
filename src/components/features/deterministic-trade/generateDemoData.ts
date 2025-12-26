/**
 * Generate deterministic demo data for trade testing
 * 
 * This file generates REAL VRF keypairs and items, but deterministically.
 * By using fixed private keys and fixed input hashes, we get the same items every time,
 * but they are cryptographically valid and verifiable.
 */

import { VRFService } from '../../../services/vrf/vrf.service';
import { LootService } from '../../../services/loot/loot.service';

// REAL VRF private keys (generated using elliptic curve cryptography)
// These are fixed for demo reproducibility but are cryptographically valid
// Generated using: elliptic.ec('p256').genKeyPair()
const ALICE_PRIVATE_KEY = '5d0247d9e4e1ece46a703365875d4c80355781f4ea632e0e703fc7537ceab0cb';
const BOB_PRIVATE_KEY = 'df9a386c02ebc0df405cc256057b8886fdfa0fcd55b04409870fa6aa3b56a3ad';

// Fixed blockhashes (deterministic input for VRF)
const ALICE_BLOCKHASH = 'alice-demo-blockhash-fixed-12345';
const BOB_BLOCKHASH = 'bob-demo-blockhash-fixed-67890';

export interface DemoPlayer {
  id: string;
  name: string;
  publicKey: string;
  privateKey: string;
}

export interface DemoItem {
  id: string;
  name: string;
  type: string;
  rarity: string;
  modifier: string;
  vrfProof: {
    publicKey: string;
    proof: string;
    message: string;
    hash: string;
  };
}

/**
 * Generate Alice's demo data
 */
export function generateAliceData(): { player: DemoPlayer; items: DemoItem[] } {
  // Generate public key from private key
  const publicKey = VRFService.getPublicKeyFromPrivate(ALICE_PRIVATE_KEY);
  
  const player: DemoPlayer = {
    id: 'alice',
    name: 'Alice',
    publicKey,
    privateKey: ALICE_PRIVATE_KEY
  };
  
  // Generate 2 items deterministically
  const lootItems = LootService.generateMultipleItems(
    ALICE_PRIVATE_KEY,
    ALICE_BLOCKHASH,
    2
  );
  
  // Convert to demo format
  const items: DemoItem[] = lootItems.map(item => {
    // Convert Uint8Array to hex string for proof
    let proofString = '';
    if (item.vrfData?.proof) {
      if (typeof item.vrfData.proof === 'string') {
        proofString = item.vrfData.proof;
      } else {
        proofString = Array.from(item.vrfData.proof)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
    }
    
    // Convert Uint8Array to hex string for vrfOutput
    let vrfOutputString = '';
    if (item.vrfData?.vrfOutput) {
      if (typeof item.vrfData.vrfOutput === 'string') {
        vrfOutputString = item.vrfData.vrfOutput;
      } else {
        vrfOutputString = Array.from(item.vrfData.vrfOutput)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
    }
    
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      rarity: item.rarity,
      modifier: item.modifier,
      vrfProof: {
        publicKey: item.vrfData?.publicKey || publicKey,
        proof: proofString,
        message: item.vrfData?.message || '',
        hash: vrfOutputString
      }
    };
  });
  
  return { player, items };
}

/**
 * Generate Bob's demo data
 */
export function generateBobData(): { player: DemoPlayer; items: DemoItem[] } {
  // Generate public key from private key
  const publicKey = VRFService.getPublicKeyFromPrivate(BOB_PRIVATE_KEY);
  
  const player: DemoPlayer = {
    id: 'bob',
    name: 'Bob',
    publicKey,
    privateKey: BOB_PRIVATE_KEY
  };
  
  // Generate 2 items deterministically
  const lootItems = LootService.generateMultipleItems(
    BOB_PRIVATE_KEY,
    BOB_BLOCKHASH,
    2
  );
  
  // Convert to demo format
  const items: DemoItem[] = lootItems.map(item => {
    // Convert Uint8Array to hex string for proof
    let proofString = '';
    if (item.vrfData?.proof) {
      if (typeof item.vrfData.proof === 'string') {
        proofString = item.vrfData.proof;
      } else {
        proofString = Array.from(item.vrfData.proof)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
    }
    
    // Convert Uint8Array to hex string for vrfOutput
    let vrfOutputString = '';
    if (item.vrfData?.vrfOutput) {
      if (typeof item.vrfData.vrfOutput === 'string') {
        vrfOutputString = item.vrfData.vrfOutput;
      } else {
        vrfOutputString = Array.from(item.vrfData.vrfOutput)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
    }
    
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      rarity: item.rarity,
      modifier: item.modifier,
      vrfProof: {
        publicKey: item.vrfData?.publicKey || publicKey,
        proof: proofString,
        message: item.vrfData?.message || '',
        hash: vrfOutputString
      }
    };
  });
  
  return { player, items };
}

/**
 * Verify an item's VRF proof
 */
export function verifyDemoItem(item: DemoItem, publicKey: string): boolean {
  try {
    // Convert back to LootItem format for verification
    const lootItem = {
      id: item.id,
      name: item.name,
      type: item.type,
      icon: '⚔️',
      rarity: item.rarity,
      modifier: item.modifier,
      createdAt: new Date().toISOString(),
      vrfData: {
        publicKey: item.vrfProof.publicKey,
        proof: item.vrfProof.proof,
        message: item.vrfProof.message,
        vrfOutput: item.vrfProof.hash
      }
    };
    
    return LootService.verifyItem(lootItem, publicKey);
  } catch (error) {
    console.error('Verification error:', error);
    return false;
  }
}
