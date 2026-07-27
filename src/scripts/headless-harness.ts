#!/usr/bin/env node
/**
 * Headless VRF loot harness.
 *
 * Exercises the REAL TypeScript services (no browser, no mocks, no UI):
 *   - VRF key generation
 *   - VRF evaluation over a sample blockhash
 *   - Proof verification (proofToHash), including tamper rejection
 *   - Loot generation (N items) and per-item verification
 *   - Commit-reveal trade round trip via CommitRevealService
 *   - Sealed loot lifecycle via LootCommitmentService: seal, non-leaky
 *     manifest, selective reveal, manifest verification, tamper rejection
 *
 * Prints a PASS/FAIL summary per check and exits nonzero on any failure,
 * so it is usable as a CI gate.
 *
 * Run with: npm run harness
 * (compiles via tsconfig.harness.json into harness-build/, then runs on Node)
 */

import { VRFService } from '../services/vrf/vrf.service';
import { LootService } from '../services/loot/loot.service';
import { CommitRevealService } from '../services/trading/commit-reveal.service';
import { LootCommitmentService } from '../services/loot/loot-commitment.service';
import { TradingService } from '../services/trading/trading.service';
import { DungeonService } from '../services/dungeon/dungeon.service';
import { toHexString } from '../utils/format.utils';
import { LootItem } from '../types/loot.types';

const ITEM_COUNT = 5;
const SAMPLE_BLOCKHASH =
  '0x4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b';

interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

const results: CheckResult[] = [];

function check(name: string, fn: () => string | void): void {
  try {
    const detail = fn() || undefined;
    results.push({ name, passed: true, detail });
  } catch (err) {
    results.push({ name, passed: false, detail: (err as Error).message });
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function expectThrow(fn: () => unknown, message: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, message);
}

function main(): void {
  // ---- 1. Key generation -------------------------------------------------
  let keyPair = { privateKey: '', publicKey: '' };
  check('VRF key generation', () => {
    keyPair = VRFService.generateKeyPair();
    assert(keyPair.privateKey.length > 0, 'empty private key');
    assert(keyPair.publicKey.length > 0, 'empty public key');
    assert(
      VRFService.getPublicKeyFromPrivate(keyPair.privateKey) === keyPair.publicKey,
      'public key does not derive from private key'
    );
    return `pubkey ${keyPair.publicKey.slice(0, 16)}...`;
  });

  // ---- 2. VRF evaluation over a sample blockhash -------------------------
  const message = new TextEncoder().encode(SAMPLE_BLOCKHASH);
  let vrfResult: ReturnType<typeof VRFService.evaluate> | null = null;
  check('VRF evaluation over sample blockhash', () => {
    vrfResult = VRFService.evaluate(keyPair.privateKey, message);
    assert(vrfResult.proof.length === 80, `unexpected proof length ${vrfResult.proof.length}`);
    assert(vrfResult.vrfOutput.length === 64, `unexpected output length ${vrfResult.vrfOutput.length}`);
    assert(vrfResult.index.length === 32, `unexpected index length ${vrfResult.index.length}`);
    // RFC 9381 ECVRF is fully deterministic (output AND proof)
    const again = VRFService.evaluate(keyPair.privateKey, message);
    assert(
      toHexString(again.vrfOutput) === toHexString(vrfResult.vrfOutput),
      'VRF output not deterministic'
    );
    assert(
      toHexString(again.proof) === toHexString(vrfResult.proof),
      'VRF proof not deterministic'
    );
    return `index ${toHexString(vrfResult.index).slice(0, 16)}...`;
  });

  // ---- 3. Proof verification --------------------------------------------
  check('VRF proof verifies (proofToHash)', () => {
    assert(vrfResult !== null, 'no VRF result from previous step');
    const hash = VRFService.proofToHash(keyPair.publicKey, message, vrfResult!.proof);
    assert(
      toHexString(hash) === toHexString(vrfResult!.index),
      'verified hash does not match index'
    );
  });

  check('Tampered proof rejected (bit flipped in Gamma)', () => {
    assert(vrfResult !== null, 'no VRF result from previous step');
    const tampered = new Uint8Array(vrfResult!.proof);
    tampered[5] ^= 0x01;
    expectThrow(
      () => VRFService.proofToHash(keyPair.publicKey, message, tampered),
      'tampered Gamma component was accepted'
    );
  });

  check('Tampered proof rejected (bit flipped in s)', () => {
    assert(vrfResult !== null, 'no VRF result from previous step');
    const tampered = new Uint8Array(vrfResult!.proof);
    tampered[70] ^= 0x01;
    expectThrow(
      () => VRFService.proofToHash(keyPair.publicKey, message, tampered),
      'tampered s component was accepted'
    );
  });

  check('Proof rejected under wrong public key', () => {
    assert(vrfResult !== null, 'no VRF result from previous step');
    const other = VRFService.generateKeyPair();
    expectThrow(
      () => VRFService.proofToHash(other.publicKey, message, vrfResult!.proof),
      'proof accepted under unrelated public key'
    );
  });

  // ---- 4. Loot generation and verification -------------------------------
  let items: LootItem[] = [];
  check(`Generate ${ITEM_COUNT} loot items`, () => {
    items = LootService.generateMultipleItems(keyPair.privateKey, SAMPLE_BLOCKHASH, ITEM_COUNT);
    assert(items.length === ITEM_COUNT, `expected ${ITEM_COUNT} items, got ${items.length}`);
    const outputs = new Set(
      items.map(item => toHexString(item.vrfData!.vrfOutput as Uint8Array))
    );
    assert(outputs.size === ITEM_COUNT, 'duplicate VRF outputs across items');
    return items.map(i => `${i.rarity} ${i.name}`).join(', ');
  });

  check('Every generated item verifies', () => {
    for (const [i, item] of items.entries()) {
      assert(
        LootService.verifyItem(item, keyPair.publicKey),
        `item ${i} failed verification`
      );
    }
  });

  check('Item rejected under wrong public key', () => {
    const other = VRFService.generateKeyPair();
    assert(
      !LootService.verifyItem(items[0], other.publicKey),
      'item verified under unrelated public key'
    );
  });

  check('Forged item (valid proof, unrelated vrfOutput) rejected', () => {
    const forged: LootItem = {
      ...items[0],
      vrfData: { ...items[0].vrfData!, vrfOutput: items[1].vrfData!.vrfOutput }
    };
    assert(
      !LootService.verifyItem(forged, keyPair.publicKey),
      'forged vrfOutput passed item verification'
    );
  });

  // ---- 5. Commit-reveal trade round trip ---------------------------------
  check('Commit-reveal trade round trip', () => {
    const alice = VRFService.generateKeyPair();
    const bob = VRFService.generateKeyPair();
    const aliceItems = LootService.generateMultipleItems(alice.privateKey, 'alice-trade-block', 2);
    const bobItems = LootService.generateMultipleItems(bob.privateKey, 'bob-trade-block', 2);

    const sessionId = CommitRevealService.generateTradeSessionId('alice', 'bob');
    assert(sessionId.length === 16, `unexpected session id length ${sessionId.length}`);

    const aliceCommitment = CommitRevealService.createTradeCommitment('alice', aliceItems);
    const bobCommitment = CommitRevealService.createTradeCommitment('bob', bobItems);

    // Public commitment must not leak the reveal
    const publicAlice = CommitRevealService.getPublicCommitment(aliceCommitment);
    assert(!('reveal' in publicAlice), 'public commitment leaks reveal data');

    const valid = CommitRevealService.validateTrade(
      aliceCommitment.commitment,
      aliceCommitment.reveal!,
      bobCommitment.commitment,
      bobCommitment.reveal!
    );
    assert(valid, 'honest commit-reveal round trip failed validation');
  });

  check('Commit-reveal rejects swapped-item reveal', () => {
    const carol = VRFService.generateKeyPair();
    const carolItems = LootService.generateMultipleItems(carol.privateKey, 'carol-trade-block', 2);
    const commitment = CommitRevealService.createTradeCommitment('carol', carolItems);

    // Attempt to reveal different items than were committed
    const otherItems = LootService.generateMultipleItems(carol.privateKey, 'carol-other-block', 2);
    const cheatingReveal = CommitRevealService.createReveal(
      otherItems,
      commitment.reveal!.nonce
    );
    assert(
      !CommitRevealService.verifyReveal(commitment.commitment, cheatingReveal),
      'reveal with swapped items was accepted'
    );
  });

  // ---- 6. Sealed loot lifecycle -------------------------------------------
  let sealed: ReturnType<typeof LootCommitmentService.generateSealedLoot> | null = null;
  check(`Sealed generation of ${ITEM_COUNT} items (commitments only)`, () => {
    sealed = LootCommitmentService.generateSealedLoot(
      keyPair.privateKey,
      SAMPLE_BLOCKHASH,
      ITEM_COUNT
    );
    assert(sealed.manifest.commitments.length === ITEM_COUNT, 'wrong commitment count');
    assert(sealed.privateRecords.length === ITEM_COUNT, 'wrong private record count');
    return `C_0 ${sealed.manifest.commitments[0].slice(0, 16)}...`;
  });

  check('Sealed manifest is non-leaky (no output, proof, or properties)', () => {
    assert(sealed !== null, 'no sealed batch from previous step');
    const wire = JSON.stringify(sealed!.manifest);
    for (const record of sealed!.privateRecords) {
      const outputHex = toHexString(record.vrfOutput);
      const proofHex = toHexString(record.proof);
      assert(!wire.includes(outputHex.slice(0, 16)), 'manifest leaks vrfOutput bytes');
      assert(!wire.includes(proofHex.slice(0, 16)), 'manifest leaks proof bytes');
      assert(!wire.includes(record.item.rarity), 'manifest leaks item rarity');
      assert(!wire.includes(record.item.name), 'manifest leaks item name');
    }
    assert(!wire.includes('vrfOutput'), 'manifest has a vrfOutput field');
    assert(!wire.includes('proof'), 'manifest has a proof field');
  });

  check('Selective reveal of item 2 of 5 verifies against manifest', () => {
    assert(sealed !== null, 'no sealed batch from previous step');
    const pkg = LootCommitmentService.revealItem(sealed!.privateRecords[2]);
    assert(
      LootCommitmentService.verifyRevealedItem(pkg, sealed!.manifest),
      'honest reveal failed manifest verification'
    );
    return `${pkg.claimedProperties.rarity} ${pkg.claimedProperties.name}`;
  });

  check('Tampered reveal rejected (wrong properties, swapped output, wrong index)', () => {
    assert(sealed !== null, 'no sealed batch from previous step');
    const pkg = LootCommitmentService.revealItem(sealed!.privateRecords[2]);
    const other = LootCommitmentService.revealItem(sealed!.privateRecords[3]);

    const wrongRarity = pkg.claimedProperties.rarity === 'Legendary' ? 'Common' : 'Legendary';
    const wrongProps = {
      ...pkg,
      claimedProperties: { ...pkg.claimedProperties, rarity: wrongRarity }
    };
    assert(
      !LootCommitmentService.verifyRevealedItem(wrongProps, sealed!.manifest),
      'reveal with tampered properties was accepted'
    );

    const swappedOutput = { ...pkg, vrfOutput: other.vrfOutput, proof: other.proof };
    assert(
      !LootCommitmentService.verifyRevealedItem(swappedOutput, sealed!.manifest),
      'reveal with swapped output/proof was accepted'
    );

    const wrongIndex = { ...pkg, itemIndex: 3 };
    assert(
      !LootCommitmentService.verifyRevealedItem(wrongIndex, sealed!.manifest),
      'reveal presented at the wrong index was accepted'
    );
  });

  check('Sealed items rejected by the trading path', () => {
    assert(sealed !== null, 'no sealed batch from previous step');
    const sealedItem: LootItem = {
      ...sealed!.privateRecords[0].item,
      vrfData: undefined,
      sealed: true
    };
    const validation = TradingService.validateTradeItems([sealedItem], keyPair.publicKey);
    assert(!validation.isValid, 'sealed item passed trade validation');
    expectThrow(
      () => TradingService.prepareTradeCommitment('p1', [sealedItem]),
      'sealed item was committed to a trade'
    );
  });

  // ---- 7. Dungeon layout (public derivation) ------------------------------
  check('Dungeon generation is deterministic (byte-identical across runs)', () => {
    const a = DungeonService.generateFromTxHash(SAMPLE_BLOCKHASH);
    const b = DungeonService.generateFromTxHash(SAMPLE_BLOCKHASH);
    assert(JSON.stringify(a) === JSON.stringify(b), 'two runs from same tx hash differ');
    const other = DungeonService.generateFromTxHash('other-sample-tx');
    assert(
      JSON.stringify(a.tiles) !== JSON.stringify(other.tiles),
      'different tx hashes produced identical layouts'
    );
    return `${a.rooms.length} rooms, seed ${a.layoutSeedHex.slice(0, 16)}...`;
  });

  check('Dungeon item count and spots match (seed[31] % MAX_ITEMS) + 1', () => {
    const seed = DungeonService.deriveLayoutSeed(SAMPLE_BLOCKHASH);
    const dungeon = DungeonService.generateDungeon(seed);
    const expected = DungeonService.deriveItemCount(seed);
    assert(dungeon.itemCount === expected, 'itemCount does not match formula');
    assert(dungeon.itemSpots.length === expected, 'itemSpots count does not match itemCount');
    return `${expected} item spot(s)`;
  });

  check('Dungeon exit reachable from entrance (BFS over walkable tiles)', () => {
    const dungeon = DungeonService.generateFromTxHash(SAMPLE_BLOCKHASH);
    assert(DungeonService.isExitReachable(dungeon), 'exit not reachable from entrance');
  });

  // ---- Summary ------------------------------------------------------------
  console.log('\nVRF loot headless harness');
  console.log('='.repeat(60));
  let failures = 0;
  for (const r of results) {
    const status = r.passed ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${r.name}${r.detail ? `\n       ${r.detail}` : ''}`);
    if (!r.passed) failures++;
  }
  console.log('='.repeat(60));
  console.log(`${results.length - failures}/${results.length} checks passed`);

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log('\nAll checks passed.');
}

main();
