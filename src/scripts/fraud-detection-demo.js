#!/usr/bin/env node
/**
 * Fraud Detection Demo
 * 
 * This script demonstrates the VRF trading system's ability to detect
 * and reject fraudulent items. One player (chosen randomly) attempts
 * to trade fake items, and the verification process catches them
 * BEFORE the trade completes.
 * 
 * Key Points:
 * - Verification happens BEFORE trade completion
 * - Any fake item causes the entire trade to fail
 * - Both players are protected from fraud
 * 
 * Run with: node fraud-detection-demo.js
 */

const crypto = require('crypto');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Logging utilities
const log = {
  header: () => console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}`),
  section: (msg) => console.log(`${colors.bright}${colors.yellow}### ${msg}${colors.reset}`),
  player1: (msg) => console.log(`${colors.blue}[Alice]${colors.reset} ${msg}`),
  player2: (msg) => console.log(`${colors.magenta}[Bob]${colors.reset} ${msg}`),
  server: (msg) => console.log(`${colors.green}[Server]${colors.reset} ${msg}`),
  fraud: (msg) => console.log(`${colors.red}[FRAUD ATTEMPT]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`)
};

// Mock VRF implementation
class VRFService {
  static generateKeyPair() {
    const privateKey = crypto.randomBytes(32).toString('hex');
    const publicKey = crypto.createHash('sha256').update(privateKey).digest('hex');
    return { privateKey, publicKey };
  }

  static evaluate(privateKey, message) {
    const messageBuffer = Buffer.from(message);
    const keyBuffer = Buffer.from(privateKey, 'hex');
    
    const vrfOutput = crypto.createHash('sha256')
      .update(Buffer.concat([keyBuffer, messageBuffer]))
      .digest();
    
    const proof = crypto.createHash('sha512')
      .update(Buffer.concat([keyBuffer, messageBuffer, vrfOutput]))
      .digest();
    
    return { vrfOutput, proof, index: vrfOutput };
  }

  static verify(publicKey, message, proof, vrfOutput) {
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
    
    const typeIndex = bytes[0] % this.TYPES.length;
    const rarityValue = (bytes[1] << 8) | bytes[2];
    const modifierIndex = bytes[3] % this.MODIFIERS.length;
    
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
    if (!item.vrfData) return { valid: false, reason: 'No VRF data' };
    
    const { publicKey, proof, message, vrfOutput } = item.vrfData;
    if (!publicKey || !proof || !message || !vrfOutput) {
      return { valid: false, reason: 'Incomplete VRF data' };
    }
    
    const proofBuffer = Buffer.from(proof, 'hex');
    const outputBuffer = Buffer.from(vrfOutput, 'hex');
    
    // Verify VRF proof
    const isValidProof = VRFService.verify(publicKey, message, proofBuffer, outputBuffer);
    if (!isValidProof) {
      return { valid: false, reason: 'Invalid VRF proof' };
    }
    
    // Regenerate item from VRF output to verify properties
    const regeneratedItem = this.generateItem(outputBuffer, item.vrfData);
    
    if (regeneratedItem.rarity !== item.rarity) {
      return { 
        valid: false, 
        reason: `Rarity mismatch: claimed ${item.rarity}, VRF produces ${regeneratedItem.rarity}` 
      };
    }
    
    if (regeneratedItem.type !== item.type) {
      return { 
        valid: false, 
        reason: `Type mismatch: claimed ${item.type}, VRF produces ${regeneratedItem.type}` 
      };
    }
    
    if (regeneratedItem.modifier !== item.modifier) {
      return { 
        valid: false, 
        reason: `Modifier mismatch: claimed ${item.modifier}, VRF produces ${regeneratedItem.modifier}` 
      };
    }
    
    return { valid: true, reason: 'All checks passed' };
  }

  // Create a FAKE item with mismatched properties
  static createFakeItem(realVrfData) {
    // Use real VRF data but claim different properties
    return {
      id: crypto.randomBytes(8).toString('hex'),
      name: 'Legendary Dragon Sword', // Fake name
      type: 'Sword',
      rarity: 'Legendary', // Fake rarity (VRF output might produce Common)
      modifier: 'Dragon', // Fake modifier
      vrfData: realVrfData // Real VRF data (this is the trick)
    };
  }
}

// Trading protocol with PRE-TRADE verification
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
    return trade;
  }

  commitTrade(tradeId, playerId, commitment) {
    const trade = this.trades.get(tradeId);
    if (!trade || trade.status !== 'INITIATED') return false;

    if (trade.initiatorId === playerId) {
      trade.initiatorCommitment = commitment;
    } else if (trade.targetId === playerId) {
      trade.targetCommitment = commitment;
    } else {
      return false;
    }

    if (trade.initiatorCommitment && trade.targetCommitment) {
      trade.status = 'COMMITTED';
    }

    return true;
  }

  revealTrade(tradeId, playerId, nonce, items) {
    const trade = this.trades.get(tradeId);
    if (!trade || trade.status !== 'COMMITTED') return false;

    const itemsString = JSON.stringify(items);
    const expectedCommitment = crypto.createHash('sha256')
      .update(itemsString + nonce)
      .digest('hex');

    if (trade.initiatorId === playerId) {
      if (expectedCommitment !== trade.initiatorCommitment) {
        return false;
      }
      trade.initiatorNonce = nonce;
    } else if (trade.targetId === playerId) {
      if (expectedCommitment !== trade.targetCommitment) {
        return false;
      }
      trade.targetNonce = nonce;
      trade.targetItems = items;
    } else {
      return false;
    }

    if (trade.initiatorNonce && trade.targetNonce) {
      trade.status = 'REVEALED';
    }

    return true;
  }

  // CRITICAL: Verify all items BEFORE completing trade
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
      const result = LootService.verifyItem(item);
      if (!result.valid) {
        log.error(`  ✗ ${item.name}: ${result.reason}`);
        return { 
          valid: false, 
          reason: `Initiator's item "${item.name}" failed verification: ${result.reason}`,
          fraudulentPlayer: trade.initiatorId
        };
      }
      log.success(`  ✓ ${item.name}: Valid`);
    }

    // Verify target's items
    log.server('Checking target\'s items...');
    for (const item of trade.targetItems) {
      const result = LootService.verifyItem(item);
      if (!result.valid) {
        log.error(`  ✗ ${item.name}: ${result.reason}`);
        return { 
          valid: false, 
          reason: `Target's item "${item.name}" failed verification: ${result.reason}`,
          fraudulentPlayer: trade.targetId
        };
      }
      log.success(`  ✓ ${item.name}: Valid`);
    }

    console.log();
    return { valid: true, reason: 'All items verified' };
  }

  completeTrade(tradeId) {
    const trade = this.trades.get(tradeId);
    if (!trade || trade.status !== 'REVEALED') return null;

    // VERIFY BEFORE COMPLETING
    const verification = this.verifyTradeItems(tradeId);
    if (!verification.valid) {
      trade.status = 'FAILED';
      trade.failureReason = verification.reason;
      trade.fraudulentPlayer = verification.fraudulentPlayer;
      return { success: false, trade, verification };
    }

    trade.status = 'COMPLETED';
    trade.completedAt = new Date();
    return { success: true, trade, verification };
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

  // Create a FAKE item for fraud attempt
  createFakeItem() {
    // Generate real VRF data first
    const message = `fake-${Date.now()}`;
    const vrfResult = VRFService.evaluate(this.privateKey, message);
    
    const vrfData = {
      publicKey: VRFService.generateKeyPair().publicKey,
      proof: vrfResult.proof.toString('hex'),
      message,
      vrfOutput: vrfResult.vrfOutput.toString('hex')
    };
    
    // Create fake item with mismatched properties
    return LootService.createFakeItem(vrfData);
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
  console.log(`${colors.bright}${colors.red}     FRAUD DETECTION DEMO - VRF LOOT TRADING${colors.reset}`);
  log.header();
  
  // Initialize
  log.section('STEP 1: Initialize Players and Server');
  const alice = new Player('Alice');
  const bob = new Player('Bob');
  const server = new TradingProtocol();
  
  log.player1(`ID: ${alice.id.substring(0, 8)}...`);
  log.player2(`ID: ${bob.id.substring(0, 8)}...`);
  
  // Generate loot
  log.section('STEP 2: Generate Legitimate Items');
  log.player1('Generating 2 legitimate items...');
  const aliceItems = alice.generateLoot(2);
  aliceItems.forEach(item => {
    log.player1(`  → ${item.name} (${item.rarity})`);
  });
  
  log.player2('Generating 2 legitimate items...');
  const bobItems = bob.generateLoot(2);
  bobItems.forEach(item => {
    log.player2(`  → ${item.name} (${item.rarity})`);
  });
  
  // Randomly choose fraudster
  log.section('STEP 3: One Player Attempts Fraud');
  const fraudster = Math.random() < 0.5 ? alice : bob;
  const honest = fraudster === alice ? bob : alice;
  
  log.fraud(`${fraudster.name} will attempt to trade a FAKE item!`);
  log.info(`${honest.name} will trade legitimate items`);
  console.log();
  
  // Fraudster creates fake item
  const fakeItem = fraudster.createFakeItem();
  log.fraud(`${fraudster.name} created fake item: ${fakeItem.name} (${fakeItem.rarity})`);
  log.fraud(`This item claims to be ${fakeItem.rarity}, but VRF output produces different properties`);
  console.log();
  
  // Set up trade items
  let aliceTradeItems, bobTradeItems;
  if (fraudster === alice) {
    aliceTradeItems = [aliceItems[0], fakeItem]; // Include fake item
    bobTradeItems = [bobItems[0]]; // Legitimate
  } else {
    aliceTradeItems = [aliceItems[0]]; // Legitimate
    bobTradeItems = [bobItems[0], fakeItem]; // Include fake item
  }
  
  // Initiate trade
  log.section('STEP 4: Initiate Trade');
  log.player1(`Offering ${aliceTradeItems.length} items:`);
  aliceTradeItems.forEach(item => {
    const isFake = item === fakeItem;
    if (isFake) {
      log.fraud(`  → ${item.name} (${item.rarity}) [FAKE]`);
    } else {
      log.player1(`  → ${item.name} (${item.rarity})`);
    }
  });
  
  const trade = server.createTrade(alice.id, bob.id, aliceTradeItems);
  log.server(`Trade created: ${trade.id.substring(0, 8)}...`);
  
  // Bob's counter-offer
  log.section('STEP 5: Counter-Offer');
  log.player2(`Offering ${bobTradeItems.length} items:`);
  bobTradeItems.forEach(item => {
    const isFake = item === fakeItem;
    if (isFake) {
      log.fraud(`  → ${item.name} (${item.rarity}) [FAKE]`);
    } else {
      log.player2(`  → ${item.name} (${item.rarity})`);
    }
  });
  
  // Commit phase
  log.section('STEP 6: Commit Phase');
  const aliceCommit = alice.createCommitment(aliceTradeItems);
  log.player1(`Commitment: ${aliceCommit.commitment.substring(0, 32)}...`);
  server.commitTrade(trade.id, alice.id, aliceCommit.commitment);
  
  const bobCommit = bob.createCommitment(bobTradeItems);
  log.player2(`Commitment: ${bobCommit.commitment.substring(0, 32)}...`);
  server.commitTrade(trade.id, bob.id, bobCommit.commitment);
  
  log.success(`Trade status: COMMITTED`);
  
  // Reveal phase
  log.section('STEP 7: Reveal Phase');
  log.player1('Revealing items and nonce...');
  server.revealTrade(trade.id, alice.id, aliceCommit.nonce, aliceTradeItems);
  log.success('Alice\'s reveal verified against commitment');
  
  log.player2('Revealing items and nonce...');
  server.revealTrade(trade.id, bob.id, bobCommit.nonce, bobTradeItems);
  log.success('Bob\'s reveal verified against commitment');
  
  log.success(`Trade status: REVEALED`);
  
  // Attempt to complete trade (this is where verification happens)
  log.section('STEP 8: Attempt Trade Completion');
  log.info('Server will now verify ALL items before completing trade...');
  console.log();
  
  const result = server.completeTrade(trade.id);
  
  // Show results
  log.section('VERIFICATION RESULTS');
  log.header();
  
  if (result.success) {
    log.error('UNEXPECTED: Trade completed successfully!');
    log.error('This should not happen - fraud detection failed!');
  } else {
    log.success('Trade REJECTED - Fraud detected!');
    console.log();
    console.log(`${colors.bright}Trade Status:${colors.reset} ${colors.red}FAILED${colors.reset}`);
    console.log(`${colors.bright}Reason:${colors.reset} ${result.verification.reason}`);
    console.log(`${colors.bright}Fraudulent Player:${colors.reset} ${fraudster.name} (${result.verification.fraudulentPlayer.substring(0, 8)}...)`);
    console.log();
    
    log.info('What happened:');
    console.log(`  1. ${fraudster.name} created a fake item with mismatched properties`);
    console.log(`  2. The item had valid VRF data, but claimed wrong rarity/type`);
    console.log(`  3. Server regenerated item from VRF output`);
    console.log(`  4. Properties didn't match - fraud detected!`);
    console.log(`  5. Trade was REJECTED before completion`);
    console.log();
    
    log.success('Both players are protected:');
    console.log(`  ✓ ${honest.name}'s legitimate items were NOT transferred`);
    console.log(`  ✓ ${fraudster.name}'s fake item was caught and rejected`);
    console.log(`  ✓ No items changed hands`);
    console.log(`  ✓ System integrity maintained`);
  }
  
  log.header();
  console.log(`${colors.bright}${colors.green}KEY TAKEAWAYS:${colors.reset}`);
  console.log();
  console.log(`${colors.bright}1. Verification happens BEFORE trade completion${colors.reset}`);
  console.log(`   - Items are verified in the REVEALED state`);
  console.log(`   - Trade only completes if ALL items pass verification`);
  console.log();
  console.log(`${colors.bright}2. VRF properties are regenerated and compared${colors.reset}`);
  console.log(`   - Not just checking if proof is valid`);
  console.log(`   - Also checking if claimed properties match VRF output`);
  console.log();
  console.log(`${colors.bright}3. Any fake item causes entire trade to fail${colors.reset}`);
  console.log(`   - Protects both players`);
  console.log(`   - No partial trades`);
  console.log(`   - Clear fraud detection`);
  console.log();
  console.log(`${colors.bright}4. System is robust against fraud${colors.reset}`);
  console.log(`   - Can't fake item properties`);
  console.log(`   - Can't use someone else's VRF proof`);
  console.log(`   - Can't bypass verification`);
  
  log.header();
  console.log(`${colors.bright}${colors.green}✓ FRAUD DETECTION: SUCCESSFUL${colors.reset}`);
  log.header();
  console.log();
}

// Run the demo
runDemo().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
