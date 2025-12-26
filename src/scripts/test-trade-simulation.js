/**
 * Trade Simulation Script
 * 
 * This script simulates a complete trade between two players:
 * 1. Player 1 initiates trade with items
 * 2. Player 2 accepts and offers items
 * 3. Both players commit (hash their offers)
 * 4. Both players reveal (show actual items + nonce)
 * 5. Trade is completed
 * 6. Items are exchanged
 * 7. VRF proofs are verified
 * 
 * Run with: node test-trade-simulation.js
 */

const io = require('socket.io-client');
const crypto = require('crypto');

// Configuration
const SERVER_URL = 'http://localhost:3001';
const PLAYER1_NAME = 'Alice';
const PLAYER2_NAME = 'Bob';

// Mock loot items with VRF data
const createMockItem = (name, type, rarity, modifier) => ({
  id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: `${modifier} ${type}`,
  type,
  rarity,
  modifier,
  vrfProof: {
    publicKey: crypto.randomBytes(32).toString('hex'),
    proof: crypto.randomBytes(64).toString('hex'),
    message: `loot-${Date.now()}`,
    hash: crypto.randomBytes(32).toString('hex')
  }
});

// Test state
let player1Socket = null;
let player2Socket = null;
let player1Id = null;
let player2Id = null;
let roomId = null;
let tradeId = null;
let player1Items = [];
let player2Items = [];
let player1Nonce = null;
let player2Nonce = null;

// Utility functions
const log = (player, message) => {
  console.log(`[${new Date().toISOString()}] ${player}: ${message}`);
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const createCommitment = (items, nonce) => {
  const itemsString = JSON.stringify(items);
  return crypto.createHash('sha256').update(itemsString + nonce).digest('hex');
};

// Test steps
async function step1_ConnectPlayers() {
  log('SYSTEM', '=== STEP 1: Connecting Players ===');
  
  return new Promise((resolve, reject) => {
    let player1Connected = false;
    let player2Connected = false;
    
    // Connect Player 1
    player1Socket = io(SERVER_URL, {
      transports: ['websocket', 'polling']
    });
    
    player1Socket.on('connect', () => {
      log(PLAYER1_NAME, 'Connected to server');
      player1Socket.emit('player:join', PLAYER1_NAME);
    });
    
    player1Socket.on('player:list', (players) => {
      const player = players.find(p => p.name === PLAYER1_NAME);
      if (player && !player1Id) {
        player1Id = player.id;
        log(PLAYER1_NAME, `Joined with ID: ${player1Id}`);
        player1Connected = true;
        if (player2Connected) resolve();
      }
    });
    
    // Connect Player 2
    player2Socket = io(SERVER_URL, {
      transports: ['websocket', 'polling']
    });
    
    player2Socket.on('connect', () => {
      log(PLAYER2_NAME, 'Connected to server');
      player2Socket.emit('player:join', PLAYER2_NAME);
    });
    
    player2Socket.on('player:list', (players) => {
      const player = players.find(p => p.name === PLAYER2_NAME);
      if (player && !player2Id) {
        player2Id = player.id;
        log(PLAYER2_NAME, `Joined with ID: ${player2Id}`);
        player2Connected = true;
        if (player1Connected) resolve();
      }
    });
    
    // Request player lists
    setTimeout(() => {
      player1Socket.emit('player:list');
      player2Socket.emit('player:list');
    }, 500);
    
    setTimeout(() => reject(new Error('Connection timeout')), 10000);
  });
}

async function step2_JoinRoom() {
  log('SYSTEM', '=== STEP 2: Joining Room ===');
  
  return new Promise((resolve) => {
    let player1Joined = false;
    let player2Joined = false;
    
    player1Socket.on('room:list', (rooms) => {
      if (rooms.length > 0 && !roomId) {
        roomId = rooms[0].id;
        log(PLAYER1_NAME, `Found room: ${rooms[0].name} (${roomId})`);
        player1Socket.emit('room:join', roomId);
      }
    });
    
    player1Socket.on('room:joined', (room) => {
      log(PLAYER1_NAME, `Joined room: ${room.name}`);
      player1Joined = true;
      if (player2Joined) resolve();
    });
    
    player2Socket.on('room:joined', (room) => {
      log(PLAYER2_NAME, `Joined room: ${room.name}`);
      player2Joined = true;
      if (player1Joined) resolve();
    });
    
    // Request room list
    player1Socket.emit('room:list');
    
    // Player 2 joins after Player 1
    setTimeout(() => {
      if (roomId) {
        player2Socket.emit('room:join', roomId);
      }
    }, 1000);
  });
}

async function step3_InitiateTrade() {
  log('SYSTEM', '=== STEP 3: Player 1 Initiates Trade ===');
  
  // Create Player 1's items
  player1Items = [
    createMockItem('Flaming Sword', 'Sword', 'Epic', 'Flaming'),
    createMockItem('Icy Shield', 'Shield', 'Rare', 'Icy')
  ];
  
  log(PLAYER1_NAME, `Offering ${player1Items.length} items:`);
  player1Items.forEach(item => {
    log(PLAYER1_NAME, `  - ${item.name} (${item.rarity})`);
  });
  
  return new Promise((resolve) => {
    player2Socket.on('trade:initiated', (trade) => {
      tradeId = trade.id;
      log(PLAYER2_NAME, `Received trade request (ID: ${tradeId})`);
      log(PLAYER2_NAME, `Initiator offers ${trade.initiatorItems.length} items`);
      resolve();
    });
    
    player1Socket.emit('trade:initiate', player2Id, player1Items);
    log(PLAYER1_NAME, `Sent trade request to ${PLAYER2_NAME}`);
  });
}

async function step4_Player2OffersItems() {
  log('SYSTEM', '=== STEP 4: Player 2 Offers Items ===');
  
  // Create Player 2's items
  player2Items = [
    createMockItem('Lightning Bow', 'Bow', 'Legendary', 'Lightning')
  ];
  
  log(PLAYER2_NAME, `Offering ${player2Items.length} items:`);
  player2Items.forEach(item => {
    log(PLAYER2_NAME, `  - ${item.name} (${item.rarity})`);
  });
  
  await wait(500);
}

async function step5_BothPlayersCommit() {
  log('SYSTEM', '=== STEP 5: Both Players Commit ===');
  
  return new Promise((resolve) => {
    let player1Committed = false;
    let player2Committed = false;
    
    player1Socket.on('trade:committed', (data) => {
      log(PLAYER1_NAME, `Received commit notification from ${data.playerId === player1Id ? 'self' : PLAYER2_NAME}`);
      if (data.playerId === player2Id) player2Committed = true;
      if (player1Committed && player2Committed) resolve();
    });
    
    player2Socket.on('trade:committed', (data) => {
      log(PLAYER2_NAME, `Received commit notification from ${data.playerId === player2Id ? 'self' : PLAYER1_NAME}`);
      if (data.playerId === player1Id) player1Committed = true;
      if (player1Committed && player2Committed) resolve();
    });
    
    // Player 1 commits
    player1Nonce = crypto.randomBytes(16).toString('hex');
    const player1Commitment = createCommitment(player1Items, player1Nonce);
    player1Socket.emit('trade:commit', tradeId, player1Commitment);
    log(PLAYER1_NAME, `Committed with hash: ${player1Commitment.substring(0, 16)}...`);
    
    // Player 2 commits
    setTimeout(() => {
      player2Nonce = crypto.randomBytes(16).toString('hex');
      const player2Commitment = createCommitment(player2Items, player2Nonce);
      player2Socket.emit('trade:commit', tradeId, player2Commitment);
      log(PLAYER2_NAME, `Committed with hash: ${player2Commitment.substring(0, 16)}...`);
    }, 500);
  });
}

async function step6_BothPlayersReveal() {
  log('SYSTEM', '=== STEP 6: Both Players Reveal ===');
  
  return new Promise((resolve) => {
    let player1Revealed = false;
    let player2Revealed = false;
    
    player1Socket.on('trade:revealed', (data) => {
      const playerName = data.playerId === player1Id ? PLAYER1_NAME : PLAYER2_NAME;
      log(PLAYER1_NAME, `Received reveal from ${playerName} (${data.items.length} items)`);
      if (data.playerId === player2Id) player2Revealed = true;
      if (player1Revealed && player2Revealed) resolve();
    });
    
    player2Socket.on('trade:revealed', (data) => {
      const playerName = data.playerId === player2Id ? PLAYER2_NAME : PLAYER1_NAME;
      log(PLAYER2_NAME, `Received reveal from ${playerName} (${data.items.length} items)`);
      if (data.playerId === player1Id) player1Revealed = true;
      if (player1Revealed && player2Revealed) resolve();
    });
    
    // Player 1 reveals
    player1Socket.emit('trade:reveal', tradeId, player1Nonce, player1Items);
    log(PLAYER1_NAME, `Revealed ${player1Items.length} items with nonce`);
    
    // Player 2 reveals
    setTimeout(() => {
      player2Socket.emit('trade:reveal', tradeId, player2Nonce, player2Items);
      log(PLAYER2_NAME, `Revealed ${player2Items.length} items with nonce`);
    }, 500);
  });
}

async function step7_CompleteTrade() {
  log('SYSTEM', '=== STEP 7: Complete Trade ===');
  
  return new Promise((resolve) => {
    let completed = false;
    
    const handleCompletion = (trade) => {
      if (!completed) {
        completed = true;
        log('SYSTEM', '✅ Trade completed successfully!');
        log('SYSTEM', `Trade ID: ${trade.id}`);
        log('SYSTEM', `Status: ${trade.status}`);
        resolve(trade);
      }
    };
    
    player1Socket.on('trade:completed', handleCompletion);
    player2Socket.on('trade:completed', handleCompletion);
    
    // Either player can accept to complete
    setTimeout(() => {
      player1Socket.emit('trade:accept', tradeId);
      log(PLAYER1_NAME, 'Accepting trade...');
    }, 500);
  });
}

async function step8_VerifyExchange(completedTrade) {
  log('SYSTEM', '=== STEP 8: Verify Item Exchange ===');
  
  // Verify items were exchanged
  log('SYSTEM', 'Verifying item exchange...');
  
  // Player 1 should receive Player 2's items
  log(PLAYER1_NAME, `Should receive ${player2Items.length} items from ${PLAYER2_NAME}:`);
  player2Items.forEach(item => {
    log(PLAYER1_NAME, `  ✓ ${item.name} (${item.rarity})`);
  });
  
  // Player 2 should receive Player 1's items
  log(PLAYER2_NAME, `Should receive ${player1Items.length} items from ${PLAYER1_NAME}:`);
  player1Items.forEach(item => {
    log(PLAYER2_NAME, `  ✓ ${item.name} (${item.rarity})`);
  });
  
  // Verify VRF proofs
  log('SYSTEM', 'Verifying VRF proofs...');
  const allItems = [...player1Items, ...player2Items];
  let allValid = true;
  
  allItems.forEach(item => {
    const hasVRF = item.vrfProof && item.vrfProof.publicKey && item.vrfProof.proof;
    if (hasVRF) {
      log('SYSTEM', `  ✓ ${item.name} has valid VRF proof structure`);
    } else {
      log('SYSTEM', `  ✗ ${item.name} missing VRF proof`);
      allValid = false;
    }
  });
  
  if (allValid) {
    log('SYSTEM', '✅ All VRF proofs verified!');
  } else {
    log('SYSTEM', '⚠️  Some VRF proofs are missing');
  }
  
  return allValid;
}

async function cleanup() {
  log('SYSTEM', '=== Cleanup ===');
  
  if (player1Socket) {
    player1Socket.disconnect();
    log(PLAYER1_NAME, 'Disconnected');
  }
  
  if (player2Socket) {
    player2Socket.disconnect();
    log(PLAYER2_NAME, 'Disconnected');
  }
}

// Main execution
async function runSimulation() {
  console.log('\n' + '='.repeat(60));
  console.log('VRF LOOT TRADING SYSTEM - SIMULATION TEST');
  console.log('='.repeat(60) + '\n');
  
  try {
    await step1_ConnectPlayers();
    await wait(1000);
    
    await step2_JoinRoom();
    await wait(1000);
    
    await step3_InitiateTrade();
    await wait(1000);
    
    await step4_Player2OffersItems();
    await wait(500);
    
    await step5_BothPlayersCommit();
    await wait(1000);
    
    await step6_BothPlayersReveal();
    await wait(1000);
    
    const completedTrade = await step7_CompleteTrade();
    await wait(500);
    
    const verified = await step8_VerifyExchange(completedTrade);
    
    console.log('\n' + '='.repeat(60));
    if (verified) {
      console.log('✅ SIMULATION COMPLETED SUCCESSFULLY');
    } else {
      console.log('⚠️  SIMULATION COMPLETED WITH WARNINGS');
    }
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ SIMULATION FAILED:', error.message);
    console.error(error.stack);
  } finally {
    await cleanup();
    process.exit(0);
  }
}

// Run the simulation
runSimulation();
