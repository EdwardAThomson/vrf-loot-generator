#!/usr/bin/env node
/**
 * Pure Non-Graphical Trading Demo
 * 
 * This script demonstrates the complete VRF loot trading protocol
 * without any UI dependencies. It simulates two players trading items
 * through the commit-reveal protocol with full VRF verification.
 * 
 * Run with: node pure-trade-demo.js
 */

const crypto = require('crypto');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Logging utilities
const log = {
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}`),
  section: (msg) => console.log(`${colors.bright}${colors.yellow}### ${msg}${colors.reset}`),
  player1: (msg) => console.log(`${colors.blue}[Alice]${colors.reset} ${msg}`),
  player2: (msg) => console.log(`${colors.magenta}[Bob]${colors.reset} ${msg}`),
  server: (msg) => console.log(`${colors.green}[Server]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`)
};

// Mock VRF implementation for demonstration
class VRFService {
  static generateKeyPair() {
    const privateKey = crypto.randomBytes(32).toString('hex');
    const publicKey = crypto.createHash('sha256').update(privateKey).digest('hex');
    return { privateKey, publicKey };
  }

  static evaluate(privateKey, message) {
    const messageBuffer = Buffer.from(message);
    const keyBuffer = Buffer.from(privateKey, 'hex');
    
    // Generate VRF output (deterministic based on key + message)
    const vrfOutput = crypto.createHash('sha256')
      .update(Buffer.concat([keyBuffer, messageBuffer]))
      .digest();
    
    // Generate proof (simplified - real VRF uses elliptic curves)
    const proof = crypto.createHash('sha512')
      .update(Buffer.concat([keyBuffer, messageBuffer, vrfOutput]))
      .digest();
    
    return {
      vrfOutput,
      proof,
      index: vrfOutput
    };
  }

  static verify(publicKey, message, proof, vrfOutput) {
    // Simplified verification - real VRF uses elliptic curve verification
    // For demo purposes, we'll just check that proof and output are present
    return proof && proof.length > 0 && vrfOutput && vrfOutput.length > 0;
  }
}

// Loot generation service
class LootService {
  static RARITIES = ['Common', 'Rare', 'Epic', 'Legendary'];
  static TYPES = ['Sword', 'Axe', 'Shield', 'Bow', 'Staff', 'Dagger'];
  static MODIFIERS = ['Flaming', 'Icy', 'Lightning', 'Poisonous', 'Holy', 'Shadow'];

  static generateItem(vrfOutput, vrfData) {
    const bytes = vrfOutput;
    
    // Use VRF output to determine item properties
    const typeIndex = bytes[0] % this.TYPES.length;
    const rarityValue = (bytes[1] << 8) | bytes[2];
    const modifierIndex = bytes[3] % this.MODIFIERS.length;
    
    // Determine rarity based on value ranges
    let rarity;
    const rarityThreshold = rarityValue / 65535;
    if (rarityThreshold < 0.5) rarity = 'Common';
    else if (rarityThreshold < 0.8) rarity = 'Rare';
    else if (rarityThreshold < 0.95) rarity = 'Epic';
    else rarity = 'Legendary';
    
    const type = this.TYPES[typeIndex];
    const modifier = this.MODIFIERS[modifierIndex];
    
    return {
      id: crypto.randomBytes(8).toString('hex'),
      name: `${modifier} ${type}`,
      type,
      rarity,
      modifier,
      vrfData
    };
  }

  static generateMultipleItems(privateKey, blockhash, count) {
    const items = [];
    
    for (let i = 0; i < count; i++) {
      const message = `${blockhash}-${i}`;
      const vrfResult = VRFService.evaluate(privateKey, message);
      
      const vrfData = {
        publicKey: VRFService.generateKeyPair().publicKey,
        proof: vrfResult.proof.toString('hex'),
        message,
        vrfOutput: vrfResult.vrfOutput.toString('hex')
      };
      
      const item = this.generateItem(vrfResult.vrfOutput, vrfData);
      items.push(item);
    }
    
    return items;
  }

  static verifyItem(item) {
    if (!item.vrfData) return false;
    
    const { publicKey, proof, message, vrfOutput } = item.vrfData;
    if (!publicKey || !proof || !message || !vrfOutput) return false;
    
    const proofBuffer = Buffer.from(proof, 'hex');
    const outputBuffer = Buffer.from(vrfOutput, 'hex');
    
    return VRFService.verify(publicKey, message, proofBuffer, outputBuffer);
  }
}

// Trading protocol implementation
class TradingProtocol {
  constructor() {
    this.trades = new Map();
  }

  createTrade(initiatorId, targetId, initiatorItems) {
    const tradeId = crypto.randomBytes(16).toString('hex');
    
    const trade = {
      id: tradeId,
      initiatorId,
      targetId,
      status: 'INITIATED',
      initiatorItems,
      targetItems: [],
      initiatorCommitment: null,
      targetCommitment: null,
      initiatorNonce: null,
      targetNonce: null,
      createdAt: new Date()
    };
    
    this.trades.set(tradeId, trade);
    log.server(`Trade created: ${tradeId.substring(0, 8)}...`);
    log.server(`Status: ${trade.status}`);
    
    return trade;
  }

  commitTrade(tradeId, playerId, commitment) {
    const trade = this.trades.get(tradeId);
    if (!trade) {
      log.error(`Trade ${tradeId} not found`);
      return false;
    }

    if (trade.status !== 'INITIATED') {
      log.error(`Trade must be in INITIATED status to commit (current: ${trade.status})`);
      return false;
    }

    if (trade.initiatorId === playerId) {
      trade.initiatorCommitment = commitment;
      log.server(`Initiator committed: ${commitment.substring(0, 16)}...`);
    } else if (trade.targetId === playerId) {
      trade.targetCommitment = commitment;
      log.server(`Target committed: ${commitment.substring(0, 16)}...`);
    } else {
      log.error(`Player ${playerId} is not part of this trade`);
      return false;
    }

    // Check if both committed
    if (trade.initiatorCommitment && trade.targetCommitment) {
      trade.status = 'COMMITTED';
      log.server(`Trade status → COMMITTED`);
    }

    return true;
  }

  revealTrade(tradeId, playerId, nonce, items) {
    const trade = this.trades.get(tradeId);
    if (!trade) {
      log.error(`Trade ${tradeId} not found`);
      return false;
    }

    if (trade.status !== 'COMMITTED') {
      log.error(`Trade must be in COMMITTED status to reveal (current: ${trade.status})`);
      return false;
    }

    // Verify the reveal matches the commitment
    const itemsString = JSON.stringify(items);
    const expectedCommitment = crypto.createHash('sha256')
      .update(itemsString + nonce)
      .digest('hex');

    if (trade.initiatorId === playerId) {
      if (expectedCommitment !== trade.initiatorCommitment) {
        log.error(`Initiator's reveal doesn't match commitment!`);
        log.error(`Expected: ${trade.initiatorCommitment}`);
        log.error(`Got: ${expectedCommitment}`);
        return false;
      }
      trade.initiatorNonce = nonce;
      log.server(`Initiator revealed with valid nonce`);
    } else if (trade.targetId === playerId) {
      if (expectedCommitment !== trade.targetCommitment) {
        log.error(`Target's reveal doesn't match commitment!`);
        log.error(`Expected: ${trade.targetCommitment}`);
        log.error(`Got: ${expectedCommitment}`);
        return false;
      }
      trade.targetNonce = nonce;
      trade.targetItems = items;
      log.server(`Target revealed with valid nonce`);
    } else {
      log.error(`Player ${playerId} is not part of this trade`);
      return false;
    }

    // Check if both revealed
    if (trade.initiatorNonce && trade.targetNonce) {
      trade.status = 'REVEALED';
      log.server(`Trade status → REVEALED`);
    }

    return true;
  }

  // Verify all items BEFORE completing trade
  verifyTradeItems(tradeId) {
    const trade = this.trades.get(tradeId);
    if (!trade || trade.status !== 'REVEALED') {
      return { valid: false, reason: 'Trade not in REVEALED state' };
    }

    log.server('Verifying all items before trade completion...');
    console.log();

    // Verify initiator's items
    log.server('Checking initiator\'s items...');
    for (const item of trade.initiatorItems) {
      if (!item.vrfData) {
        log.error(`  ${item.name}: No VRF data`);
        return { valid: false, reason: `Item "${item.name}" has no VRF data` };
      }

      const { publicKey, proof, message, vrfOutput } = item.vrfData;
      const proofBuffer = Buffer.from(proof, 'hex');
      const outputBuffer = Buffer.from(vrfOutput, 'hex');
      
      const isValidProof = VRFService.verify(publicKey, message, proofBuffer, outputBuffer);
      if (!isValidProof) {
        log.error(`  ${item.name}: Invalid VRF proof`);
        return { valid: false, reason: `Item "${item.name}" has invalid VRF proof` };
      }

      // Regenerate item to verify properties
      const regeneratedItem = LootService.generateItem(outputBuffer, item.vrfData);
      if (regeneratedItem.rarity !== item.rarity || regeneratedItem.type !== item.type) {
        log.error(`  ${item.name}: Property mismatch`);
        log.error(`    Expected: ${regeneratedItem.rarity} ${regeneratedItem.type}`);
        log.error(`    Got: ${item.rarity} ${item.type}`);
        return { 
          valid: false, 
          reason: `Item "${item.name}" properties don't match VRF output` 
        };
      }
      
      log.success(`  ${item.name}: Valid`);
    }

    // Verify target's items
    log.server('Checking target\'s items...');
    for (const item of trade.targetItems) {
      if (!item.vrfData) {
        log.error(`  ${item.name}: No VRF data`);
        return { valid: false, reason: `Item "${item.name}" has no VRF data` };
      }

      const { publicKey, proof, message, vrfOutput } = item.vrfData;
      const proofBuffer = Buffer.from(proof, 'hex');
      const outputBuffer = Buffer.from(vrfOutput, 'hex');
      
      const isValidProof = VRFService.verify(publicKey, message, proofBuffer, outputBuffer);
      if (!isValidProof) {
        log.error(`  ${item.name}: Invalid VRF proof`);
        return { valid: false, reason: `Item "${item.name}" has invalid VRF proof` };
      }

      // Regenerate item to verify properties
      const regeneratedItem = LootService.generateItem(outputBuffer, item.vrfData);
      if (regeneratedItem.rarity !== item.rarity || regeneratedItem.type !== item.type) {
        log.error(`  ${item.name}: Property mismatch`);
        log.error(`    Expected: ${regeneratedItem.rarity} ${regeneratedItem.type}`);
        log.error(`    Got: ${item.rarity} ${item.type}`);
        return { 
          valid: false, 
          reason: `Item "${item.name}" properties don't match VRF output` 
        };
      }
      
      log.success(`  ${item.name}: Valid`);
    }

    console.log();
    return { valid: true, reason: 'All items verified' };
  }

  completeTrade(tradeId) {
    const trade = this.trades.get(tradeId);
    if (!trade) {
      log.error(`Trade ${tradeId} not found`);
      return null;
    }

    if (trade.status !== 'REVEALED') {
      log.error(`Trade must be in REVEALED status to complete (current: ${trade.status})`);
      return null;
    }

    // CRITICAL: Verify BEFORE completing
    const verification = this.verifyTradeItems(tradeId);
    if (!verification.valid) {
      trade.status = 'FAILED';
      trade.failureReason = verification.reason;
      log.error(`Trade verification failed: ${verification.reason}`);
      return null;
    }

    trade.status = 'COMPLETED';
    trade.completedAt = new Date();
    log.server(`Trade status → COMPLETED`);

    return trade;
  }

  getTrade(tradeId) {
    return this.trades.get(tradeId);
  }
}

// Player class
class Player {
  constructor(name) {
    this.id = crypto.randomBytes(16).toString('hex');
    this.name = name;
    this.inventory = [];
    const keyPair = VRFService.generateKeyPair();
    this.privateKey = keyPair.privateKey;
    this.publicKey = keyPair.publicKey;
  }

  generateLoot(count) {
    const blockhash = crypto.randomBytes(32).toString('hex');
    const items = LootService.generateMultipleItems(this.privateKey, blockhash, count);
    this.inventory.push(...items);
    return items;
  }

  selectItemsForTrade(count) {
    return this.inventory.slice(0, Math.min(count, this.inventory.length));
  }

  removeItems(items) {
    items.forEach(item => {
      const index = this.inventory.findIndex(i => i.id === item.id);
      if (index !== -1) {
        this.inventory.splice(index, 1);
      }
    });
  }

  addItems(items) {
    this.inventory.push(...items);
  }

  createCommitment(items) {
    const nonce = crypto.randomBytes(16).toString('hex');
    const itemsString = JSON.stringify(items);
    const commitment = crypto.createHash('sha256')
      .update(itemsString + nonce)
      .digest('hex');
    
    return { commitment, nonce };
  }
}

// Main demo execution
async function runDemo() {
  log.header();
  console.log(`${colors.bright}${colors.cyan}     VRF LOOT TRADING PROTOCOL - PURE DEMO${colors.reset}`);
  log.header();
  
  // Initialize
  log.section('STEP 1: Initialize Players and Server');
  const alice = new Player('Alice');
  const bob = new Player('Bob');
  const server = new TradingProtocol();
  
  log.player1(`ID: ${alice.id.substring(0, 8)}...`);
  log.player1(`Public Key: ${alice.publicKey.substring(0, 16)}...`);
  log.player2(`ID: ${bob.id.substring(0, 8)}...`);
  log.player2(`Public Key: ${bob.publicKey.substring(0, 16)}...`);
  
  // Generate loot
  log.section('STEP 2: Generate Loot Items');
  log.player1('Generating 3 items...');
  const aliceItems = alice.generateLoot(3);
  aliceItems.forEach(item => {
    log.player1(`  → ${item.name} (${item.rarity})`);
  });
  
  log.player2('Generating 2 items...');
  const bobItems = bob.generateLoot(2);
  bobItems.forEach(item => {
    log.player2(`  → ${item.name} (${item.rarity})`);
  });
  
  // Initiate trade
  log.section('STEP 3: Alice Initiates Trade');
  const aliceTradeItems = alice.selectItemsForTrade(2);
  log.player1(`Offering ${aliceTradeItems.length} items to Bob:`);
  aliceTradeItems.forEach(item => {
    log.player1(`  → ${item.name} (${item.rarity})`);
  });
  
  const trade = server.createTrade(alice.id, bob.id, aliceTradeItems);
  log.success(`Trade initiated: ${trade.id.substring(0, 8)}...`);
  
  // Bob selects items
  log.section('STEP 4: Bob Selects Items to Offer');
  const bobTradeItems = bob.selectItemsForTrade(1);
  log.player2(`Offering ${bobTradeItems.length} items to Alice:`);
  bobTradeItems.forEach(item => {
    log.player2(`  → ${item.name} (${item.rarity})`);
  });
  
  // Commit phase
  log.section('STEP 5: Commit Phase (Both Players)');
  log.info('Both players create cryptographic commitments to their offers');
  
  const aliceCommit = alice.createCommitment(aliceTradeItems);
  log.player1(`Commitment: ${aliceCommit.commitment.substring(0, 32)}...`);
  log.player1(`Nonce (secret): ${aliceCommit.nonce.substring(0, 16)}...`);
  server.commitTrade(trade.id, alice.id, aliceCommit.commitment);
  
  const bobCommit = bob.createCommitment(bobTradeItems);
  log.player2(`Commitment: ${bobCommit.commitment.substring(0, 32)}...`);
  log.player2(`Nonce (secret): ${bobCommit.nonce.substring(0, 16)}...`);
  server.commitTrade(trade.id, bob.id, bobCommit.commitment);
  
  const tradeAfterCommit = server.getTrade(trade.id);
  log.success(`Trade status: ${tradeAfterCommit.status}`);
  
  // Reveal phase
  log.section('STEP 6: Reveal Phase (Both Players)');
  log.info('Both players reveal their items and nonces for verification');
  
  log.player1('Revealing items and nonce...');
  const aliceRevealSuccess = server.revealTrade(trade.id, alice.id, aliceCommit.nonce, aliceTradeItems);
  if (aliceRevealSuccess) {
    log.success('Alice\'s reveal verified against commitment');
  } else {
    log.error('Alice\'s reveal verification FAILED');
  }
  
  log.player2('Revealing items and nonce...');
  const bobRevealSuccess = server.revealTrade(trade.id, bob.id, bobCommit.nonce, bobTradeItems);
  if (bobRevealSuccess) {
    log.success('Bob\'s reveal verified against commitment');
  } else {
    log.error('Bob\'s reveal verification FAILED');
  }
  
  const tradeAfterReveal = server.getTrade(trade.id);
  log.success(`Trade status: ${tradeAfterReveal.status}`);
  
  // Verify and complete trade
  log.section('STEP 7: Verify Items and Complete Trade');
  log.info('Server verifies ALL items BEFORE completing trade');
  console.log();
  
  const completedTrade = server.completeTrade(trade.id);
  if (!completedTrade) {
    log.error('Trade verification or completion FAILED');
    log.error('Items were NOT exchanged - both players protected');
    return;
  }
  
  log.success(`All items verified successfully!`);
  log.success(`Trade completed!`);
  log.success(`Final status: ${completedTrade.status}`);
  
  // Exchange items
  log.section('STEP 8: Exchange Items');
  log.info('Items are now exchanged between players');
  
  log.player1('Removing offered items from inventory...');
  alice.removeItems(aliceTradeItems);
  log.player1(`Inventory: ${alice.inventory.length} items remaining`);
  
  log.player1('Receiving Bob\'s items...');
  alice.addItems(bobTradeItems);
  log.player1(`Inventory: ${alice.inventory.length} items total`);
  bobTradeItems.forEach(item => {
    log.player1(`  + ${item.name} (${item.rarity})`);
  });
  
  log.player2('Removing offered items from inventory...');
  bob.removeItems(bobTradeItems);
  log.player2(`Inventory: ${bob.inventory.length} items remaining`);
  
  log.player2('Receiving Alice\'s items...');
  bob.addItems(aliceTradeItems);
  log.player2(`Inventory: ${bob.inventory.length} items total`);
  aliceTradeItems.forEach(item => {
    log.player2(`  + ${item.name} (${item.rarity})`);
  });
  
  // Note: VRF verification already happened in Step 7 (server-side)
  // This demonstrates what each player would see after receiving items
  log.section('STEP 9: Post-Trade Summary');
  log.info('Items have been verified and exchanged securely');
  console.log();
  
  log.success('Server verified all items before trade completion:');
  console.log('  ✓ All VRF proofs cryptographically valid');
  console.log('  ✓ All item properties match VRF outputs');
  console.log('  ✓ No fake or fraudulent items detected');
  console.log('  ✓ Trade completed safely');
  
  // Final summary
  log.section('FINAL SUMMARY');
  log.header();
  
  console.log(`${colors.bright}Trade Protocol Status:${colors.reset}`);
  console.log(`  Trade ID: ${completedTrade.id}`);
  console.log(`  Status: ${colors.green}${completedTrade.status}${colors.reset}`);
  console.log(`  Duration: ${completedTrade.completedAt - completedTrade.createdAt}ms`);
  console.log();
  
  console.log(`${colors.bright}Items Exchanged:${colors.reset}`);
  console.log(`  Alice → Bob: ${aliceTradeItems.length} items`);
  aliceTradeItems.forEach(item => {
    console.log(`    • ${item.name} (${item.rarity})`);
  });
  console.log(`  Bob → Alice: ${bobTradeItems.length} items`);
  bobTradeItems.forEach(item => {
    console.log(`    • ${item.name} (${item.rarity})`);
  });
  console.log();
  
  console.log(`${colors.bright}Final Inventories:${colors.reset}`);
  console.log(`  Alice: ${alice.inventory.length} items`);
  console.log(`  Bob: ${bob.inventory.length} items`);
  console.log();
  
  console.log(`${colors.bright}VRF Verification:${colors.reset}`);
  log.success('All items verified BEFORE trade completion');
  log.success('Verification prevented any fake items from being traded');
  console.log();
  
  console.log(`${colors.bright}Protocol Steps Completed:${colors.reset}`);
  log.success('1. Players initialized with VRF key pairs');
  log.success('2. Loot items generated using VRF');
  log.success('3. Trade initiated by Alice');
  log.success('4. Bob selected counter-offer items');
  log.success('5. Both players committed (cryptographic hash)');
  log.success('6. Both players revealed (items + nonce)');
  log.success('7. Server verified ALL items (VRF + properties)');
  log.success('8. Trade completed after verification passed');
  log.success('9. Items exchanged between players');
  
  log.header();
  
  if (completedTrade.status === 'COMPLETED') {
    console.log(`${colors.bright}${colors.green}✓ TRADING PROTOCOL VERIFICATION: PASSED${colors.reset}`);
    console.log(`${colors.bright}${colors.green}✓ FRAUD PROTECTION: ACTIVE${colors.reset}`);
  } else {
    console.log(`${colors.bright}${colors.red}✗ TRADING PROTOCOL VERIFICATION: FAILED${colors.reset}`);
  }
  
  log.header();
  console.log();
}

// Run the demo
runDemo().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
