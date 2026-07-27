#!/usr/bin/env node
/**
 * Live trade simulation against the WebSocket server.
 *
 * Drives the REAL socket server (server/) with the REAL TypeScript services:
 *   - VRF keypairs and loot via VRFService / LootService (RFC 9381 ECVRF)
 *   - Canonical commit-reveal hashes via CommitRevealService
 *     (sha256 over the canonicalized { v, items, nonce } payload)
 *   - Per-item cryptographic verification of everything received over the
 *     wire via LootService.verifyItem
 *
 * Two simulated players (Alice, Bob) connect, join the default room, run the
 * full initiate -> commit -> reveal -> accept flow, and each verifies the
 * peer's reveal against the peer's commitment plus every received item's VRF
 * proof. Exits nonzero on any failure.
 *
 * Note: the server relays trade:committed without the commitment hash and
 * trade:revealed without the nonce, so peers cannot yet verify each other
 * purely from the wire (the web client has the same limitation and stores the
 * peer commitment out of band). This script exchanges commitment hashes and
 * nonces in-process, but verifies against the ITEMS AS RECEIVED over the
 * socket, which exercises canonical-hash robustness to JSON transport.
 *
 * Prerequisite: the trading server must be running on localhost:3001
 *   (cd server && npm run dev)
 *
 * Run with: npm run trade-sim
 * (compiles via tsconfig.harness.json into harness-build/, then runs on Node)
 */

import { io, Socket } from 'socket.io-client';
import { VRFService } from '../services/vrf/vrf.service';
import { LootService } from '../services/loot/loot.service';
import { CommitRevealService } from '../services/trading/commit-reveal.service';
import { toHexString } from '../utils/format.utils';
import { LootItem } from '../types/loot.types';
import { LootItem as WireLootItem } from '../types/websocket.types';

const SERVER_URL = process.env.TRADE_SIM_SERVER_URL || 'http://localhost:3001';
const STEP_TIMEOUT_MS = 10000;

const log = (who: string, message: string): void => {
  console.log(`[${new Date().toISOString()}] ${who}: ${message}`);
};

const fail = (message: string): never => {
  console.error(`\nSIMULATION FAILED: ${message}`);
  process.exit(1);
};

const withTimeout = <T>(promise: Promise<T>, label: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout waiting for: ${label}`)), STEP_TIMEOUT_MS)
    )
  ]);
};

/** Convert an app LootItem (vrfData, byte fields) to the websocket wire shape. */
const toWireItem = (item: LootItem): WireLootItem => {
  if (!item.vrfData) {
    throw new Error(`Item ${item.name} has no VRF data`);
  }
  const { publicKey, proof, message, blockhash, itemIndex, vrfOutput } = item.vrfData;
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    rarity: item.rarity as WireLootItem['rarity'],
    modifier: item.modifier,
    vrfProof: {
      publicKey,
      proof: typeof proof === 'string' ? proof : toHexString(proof),
      message,
      hash: typeof vrfOutput === 'string' ? vrfOutput : toHexString(vrfOutput as Uint8Array),
      blockhash,
      itemIndex
    }
  };
};

/** Convert a received wire item back to an app LootItem for VRF verification. */
const fromWireItem = (item: WireLootItem): LootItem => ({
  id: item.id,
  name: item.name,
  type: item.type,
  icon: '',
  rarity: item.rarity,
  modifier: item.modifier || '',
  createdAt: new Date().toISOString(),
  vrfData: item.vrfProof
    ? {
        publicKey: item.vrfProof.publicKey,
        proof: item.vrfProof.proof,
        message: item.vrfProof.message,
        vrfOutput: item.vrfProof.hash,
        blockhash: item.vrfProof.blockhash,
        itemIndex: item.vrfProof.itemIndex
      }
    : undefined
});

interface SimPlayer {
  name: string;
  socket: Socket;
  id: string;
  keyPair: { privateKey: string; publicKey: string };
  wireItems: WireLootItem[];
  nonce: string;
  commitment: string;
}

const createPlayer = (name: string, blockhash: string, itemCount: number): SimPlayer => {
  const keyPair = VRFService.generateKeyPair();
  const items = LootService.generateMultipleItems(keyPair.privateKey, blockhash, itemCount);
  const wireItems = items.map(toWireItem);
  const nonce = CommitRevealService.generateNonce();
  // Canonical commitment over the wire-format items (binds item identity,
  // survives JSON transport and field reordering).
  const commitment = CommitRevealService.computeCommitmentHash(wireItems, nonce);
  return {
    name,
    socket: io(SERVER_URL, { transports: ['websocket', 'polling'], autoConnect: false }),
    id: '',
    keyPair,
    wireItems,
    nonce,
    commitment
  };
};

const connectPlayer = (player: SimPlayer): Promise<void> =>
  withTimeout(
    new Promise<void>((resolve, reject) => {
      player.socket.on('connect_error', (err: Error) =>
        reject(new Error(`${player.name} connect error: ${err.message}`))
      );
      player.socket.on('connect', () => {
        log(player.name, 'Connected to server');
        player.socket.emit('player:join', player.name);
      });
      player.socket.on('player:list', (players: Array<{ id: string; name: string }>) => {
        const me = players.find(p => p.name === player.name);
        if (me && !player.id) {
          player.id = me.id;
          log(player.name, `Joined with ID: ${player.id}`);
          resolve();
        }
      });
      player.socket.connect();
    }),
    `${player.name} connection`
  );

const joinRoom = (player: SimPlayer, roomId: string): Promise<void> =>
  withTimeout(
    new Promise<void>(resolve => {
      player.socket.on('room:joined', (room: { name: string }) => {
        log(player.name, `Joined room: ${room.name}`);
        resolve();
      });
      player.socket.emit('room:join', roomId);
    }),
    `${player.name} room join`
  );

/**
 * Verify a peer's reveal: recompute the canonical commitment hash over the
 * items exactly as received from the socket, then cryptographically verify
 * each item's VRF proof and claimed properties.
 */
const verifyPeerReveal = (
  verifier: SimPlayer,
  peer: SimPlayer,
  receivedItems: WireLootItem[]
): void => {
  const commitmentOk = CommitRevealService.verifyCommitmentHash(
    peer.commitment,
    receivedItems,
    peer.nonce
  );
  if (!commitmentOk) {
    fail(`${verifier.name}: ${peer.name}'s reveal does not match their commitment`);
  }
  log(verifier.name, `${peer.name}'s reveal matches commitment ${peer.commitment.slice(0, 16)}...`);

  for (const wireItem of receivedItems) {
    const appItem = fromWireItem(wireItem);
    if (!appItem.vrfData) {
      fail(`${verifier.name}: received item ${wireItem.name} has no VRF proof`);
    }
    const valid = LootService.verifyItem(appItem, appItem.vrfData!.publicKey);
    if (!valid) {
      fail(`${verifier.name}: received item ${wireItem.name} failed VRF verification`);
    }
    log(verifier.name, `Verified ${wireItem.rarity} ${wireItem.name} (VRF proof + properties)`);
  }
};

async function runSimulation(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('VRF LOOT TRADING - LIVE SERVER TRADE SIMULATION');
  console.log('='.repeat(60) + '\n');

  const alice = createPlayer(
    'Alice',
    '0x4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
    2
  );
  const bob = createPlayer(
    'Bob',
    '0x00000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce2',
    1
  );

  try {
    // Step 1: connect
    log('SYSTEM', '=== STEP 1: Connecting players ===');
    await connectPlayer(alice);
    await connectPlayer(bob);

    // Step 2: join the default room
    log('SYSTEM', '=== STEP 2: Joining room ===');
    const roomId = await withTimeout(
      new Promise<string>(resolve => {
        alice.socket.on('room:list', (rooms: Array<{ id: string; name: string }>) => {
          if (rooms.length > 0) resolve(rooms[0].id);
        });
        alice.socket.emit('room:list');
      }),
      'room list'
    );
    await joinRoom(alice, roomId);
    await joinRoom(bob, roomId);

    // Step 3: Alice initiates the trade with her (real, verifiable) items
    log('SYSTEM', '=== STEP 3: Alice initiates trade ===');
    alice.wireItems.forEach(i => log('Alice', `Offering ${i.rarity} ${i.name}`));
    const tradeId = await withTimeout(
      new Promise<string>(resolve => {
        bob.socket.on('trade:initiated', (trade: { id: string }) => {
          log('Bob', `Received trade request (ID: ${trade.id})`);
          resolve(trade.id);
        });
        alice.socket.emit('trade:initiate', bob.id, alice.wireItems);
      }),
      'trade:initiated'
    );

    // Step 4: both players commit (canonical hash, COMMIT_SCHEMA_VERSION payload)
    log('SYSTEM', '=== STEP 4: Commit phase ===');
    bob.wireItems.forEach(i => log('Bob', `Offering ${i.rarity} ${i.name}`));
    await withTimeout(
      new Promise<void>(resolve => {
        const committed = new Set<string>();
        const onCommitted = (_tradeId: string, playerId: string) => {
          committed.add(playerId);
          if (committed.has(alice.id) && committed.has(bob.id)) resolve();
        };
        alice.socket.on('trade:committed', onCommitted);
        bob.socket.on('trade:committed', onCommitted);
        alice.socket.emit('trade:commit', tradeId, alice.commitment);
        log('Alice', `Committed: ${alice.commitment.slice(0, 16)}...`);
        bob.socket.emit('trade:commit', tradeId, bob.commitment);
        log('Bob', `Committed: ${bob.commitment.slice(0, 16)}...`);
      }),
      'both trade:committed'
    );
    log('SYSTEM', 'Both players committed');

    // Step 5: both players reveal; each verifies the peer's reveal + items
    log('SYSTEM', '=== STEP 5: Reveal phase (with verification) ===');
    await withTimeout(
      new Promise<void>(resolve => {
        const revealed = new Set<string>();
        const onReveal =
          (self: SimPlayer, peer: SimPlayer) =>
          (_tradeId: string, playerId: string, items: WireLootItem[]) => {
            if (playerId === peer.id) {
              log(self.name, `Received ${peer.name}'s reveal (${items.length} item(s))`);
              verifyPeerReveal(self, peer, items);
              revealed.add(playerId);
              if (revealed.has(alice.id) && revealed.has(bob.id)) resolve();
            } else {
              revealed.add(playerId);
              if (revealed.has(alice.id) && revealed.has(bob.id)) resolve();
            }
          };
        alice.socket.on('trade:revealed', onReveal(alice, bob));
        bob.socket.on('trade:revealed', onReveal(bob, alice));
        alice.socket.emit('trade:reveal', tradeId, alice.nonce, alice.wireItems);
        log('Alice', 'Revealed items and nonce');
        bob.socket.emit('trade:reveal', tradeId, bob.nonce, bob.wireItems);
        log('Bob', 'Revealed items and nonce');
      }),
      'both trade:revealed and verified'
    );

    // Step 6: accept and complete
    log('SYSTEM', '=== STEP 6: Complete trade ===');
    const completed = await withTimeout(
      new Promise<{ id: string; status: string }>(resolve => {
        alice.socket.on('trade:completed', (trade: { id: string; status: string }) =>
          resolve(trade)
        );
        alice.socket.emit('trade:accept', tradeId);
        log('Alice', 'Accepting trade...');
      }),
      'trade:completed'
    );
    log('SYSTEM', `Trade ${completed.id} completed with status ${completed.status}`);

    console.log('\n' + '='.repeat(60));
    console.log('SIMULATION COMPLETED SUCCESSFULLY');
    console.log('  - Real ECVRF items generated and traded');
    console.log('  - Canonical commitments verified against wire-received reveals');
    console.log('  - Every received item passed VRF proof + property verification');
    console.log('='.repeat(60) + '\n');
  } finally {
    alice.socket.disconnect();
    bob.socket.disconnect();
  }
  process.exit(0);
}

runSimulation().catch(err => fail((err as Error).message));
