/**
 * @jest-environment node
 *
 * Phase 2 commitment/reveal layer tests:
 * 1. Sealed generation publishes a manifest that contains NO recoverable VRF
 *    output, proof, or item properties (checked on the literal wire-shaped
 *    serialization, not just the object shape).
 * 2. Honest reveal packages verify against the manifest.
 * 3. Tampered reveals (wrong properties, wrong output, wrong proof, wrong
 *    index, swapped indices), commitment mismatches against a different
 *    manifest, and version mismatches all fail closed.
 *
 * Uses real crypto (no mocks).
 */

// Self-sufficient environment polyfills (node env without CRA setup files)
/* eslint-disable @typescript-eslint/no-var-requires */
if (typeof globalThis.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  (globalThis as any).TextEncoder = TextEncoder;
  (globalThis as any).TextDecoder = TextDecoder;
}
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = require('crypto').webcrypto;
}

import { VRFService } from '../../vrf/vrf.service';
import {
  LootCommitmentService,
  LOOT_COMMITMENT_VERSION,
} from '../loot-commitment.service';
import { toHexString } from '../../../utils/format.utils';
import { LootRevealPackage } from '../../../types/loot.types';

const BLOCKHASH = '0x4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b';
const COUNT = 5;

describe('LootCommitmentService.generateSealedLoot', () => {
  const keyPair = VRFService.generateKeyPair();
  const { manifest, privateRecords } = LootCommitmentService.generateSealedLoot(
    keyPair.privateKey,
    BLOCKHASH,
    COUNT
  );

  test('manifest has the expected public shape', () => {
    expect(manifest.v).toBe(LOOT_COMMITMENT_VERSION);
    expect(manifest.blockhash).toBe(BLOCKHASH);
    expect(manifest.publicKey).toBe(keyPair.publicKey.toLowerCase());
    expect(manifest.count).toBe(COUNT);
    expect(manifest.commitments).toHaveLength(COUNT);
    manifest.commitments.forEach((c) => expect(c).toMatch(/^[0-9a-f]{64}$/));
    // All commitments distinct (they bind the index)
    expect(new Set(manifest.commitments).size).toBe(COUNT);
  });

  test('manifest object exposes only the documented public fields', () => {
    expect(Object.keys(manifest).sort()).toEqual(
      ['blockhash', 'commitments', 'count', 'publicKey', 'v'].sort()
    );
  });

  test('wire-shaped serialization of the manifest leaks no output, proof, or properties', () => {
    const wire = JSON.stringify(manifest);

    for (const record of privateRecords) {
      const outputHex = toHexString(record.vrfOutput);
      const proofHex = toHexString(record.proof);
      expect(wire).not.toContain(outputHex);
      expect(wire).not.toContain(proofHex);
      // No partial leakage of the secrets either (any 16-hex-char window)
      expect(wire).not.toContain(outputHex.slice(0, 16));
      expect(wire).not.toContain(proofHex.slice(0, 16));
      // Item properties must not appear
      expect(wire).not.toContain(record.item.name);
      expect(wire).not.toContain(record.item.rarity);
      expect(wire).not.toContain(record.item.modifier);
    }
    expect(wire).not.toContain('vrfOutput');
    expect(wire).not.toContain('proof');
    expect(wire).not.toContain('rarity');
    expect(wire).not.toContain('item');
  });

  test('private records carry everything needed for reveal', () => {
    expect(privateRecords).toHaveLength(COUNT);
    privateRecords.forEach((record, i) => {
      expect(record.itemIndex).toBe(i);
      expect(record.vrfOutput).toHaveLength(64);
      expect(record.proof).toHaveLength(80);
      expect(record.item.vrfData).toBeDefined();
    });
  });
});

describe('LootCommitmentService reveal and verification', () => {
  const keyPair = VRFService.generateKeyPair();
  const { manifest, privateRecords } = LootCommitmentService.generateSealedLoot(
    keyPair.privateKey,
    BLOCKHASH,
    COUNT
  );

  const revealOf = (i: number): LootRevealPackage =>
    LootCommitmentService.revealItem(privateRecords[i]);

  test('honest reveal of every item verifies against the manifest', () => {
    for (let i = 0; i < COUNT; i++) {
      expect(LootCommitmentService.verifyRevealedItem(revealOf(i), manifest)).toBe(true);
    }
  });

  test('reveal with wrong claimed properties is rejected', () => {
    const pkg = revealOf(0);
    const tampered = {
      ...pkg,
      claimedProperties: { ...pkg.claimedProperties, rarity: 'Legendary', name: 'Forged Blade' },
    };
    // Guard against the vanishingly unlikely case item 0 is already Legendary
    if (pkg.claimedProperties.rarity === 'Legendary') {
      tampered.claimedProperties.rarity = 'Common';
    }
    expect(LootCommitmentService.verifyRevealedItem(tampered, manifest)).toBe(false);
  });

  test('reveal with wrong vrfOutput is rejected', () => {
    const pkg = revealOf(0);
    const other = revealOf(1);
    expect(
      LootCommitmentService.verifyRevealedItem({ ...pkg, vrfOutput: other.vrfOutput }, manifest)
    ).toBe(false);
  });

  test('reveal with wrong proof is rejected', () => {
    const pkg = revealOf(0);
    const other = revealOf(1);
    expect(
      LootCommitmentService.verifyRevealedItem({ ...pkg, proof: other.proof }, manifest)
    ).toBe(false);
  });

  test('reveal with a single-bit-flipped proof is rejected', () => {
    const pkg = revealOf(0);
    const bytes = Uint8Array.from(Buffer.from(pkg.proof, 'hex'));
    bytes[10] ^= 0x01;
    expect(
      LootCommitmentService.verifyRevealedItem(
        { ...pkg, proof: toHexString(bytes) },
        manifest
      )
    ).toBe(false);
  });

  test('reveal presented at the wrong index is rejected', () => {
    const pkg = revealOf(2);
    expect(LootCommitmentService.verifyRevealedItem({ ...pkg, itemIndex: 3 }, manifest)).toBe(false);
  });

  test('out-of-range and non-integer indices are rejected', () => {
    const pkg = revealOf(0);
    expect(LootCommitmentService.verifyRevealedItem({ ...pkg, itemIndex: COUNT }, manifest)).toBe(false);
    expect(LootCommitmentService.verifyRevealedItem({ ...pkg, itemIndex: -1 }, manifest)).toBe(false);
    expect(LootCommitmentService.verifyRevealedItem({ ...pkg, itemIndex: 1.5 }, manifest)).toBe(false);
  });

  test('swapped indices between two items are rejected both ways', () => {
    const pkg0 = revealOf(0);
    const pkg1 = revealOf(1);
    const swapped0 = { ...pkg0, itemIndex: 1 };
    const swapped1 = { ...pkg1, itemIndex: 0 };
    expect(LootCommitmentService.verifyRevealedItem(swapped0, manifest)).toBe(false);
    expect(LootCommitmentService.verifyRevealedItem(swapped1, manifest)).toBe(false);
  });

  test('reveal against a different manifest (different key) is rejected', () => {
    const otherKeys = VRFService.generateKeyPair();
    const other = LootCommitmentService.generateSealedLoot(
      otherKeys.privateKey,
      BLOCKHASH,
      COUNT
    );
    const pkg = revealOf(0);
    expect(LootCommitmentService.verifyRevealedItem(pkg, other.manifest)).toBe(false);
  });

  test('reveal against a different manifest (different blockhash) is rejected', () => {
    const other = LootCommitmentService.generateSealedLoot(
      keyPair.privateKey,
      'a different blockhash entirely',
      COUNT
    );
    const pkg = revealOf(0);
    expect(LootCommitmentService.verifyRevealedItem(pkg, other.manifest)).toBe(false);
  });

  test('version mismatch is rejected (package and manifest)', () => {
    const pkg = revealOf(0);
    expect(
      LootCommitmentService.verifyRevealedItem({ ...pkg, v: LOOT_COMMITMENT_VERSION + 1 }, manifest)
    ).toBe(false);
    expect(
      LootCommitmentService.verifyRevealedItem(pkg, { ...manifest, v: LOOT_COMMITMENT_VERSION + 1 })
    ).toBe(false);
  });

  test('commitment binds the public key: same output committed under another key differs', () => {
    const record = privateRecords[0];
    const otherKeys = VRFService.generateKeyPair();
    const c1 = LootCommitmentService.computeCommitment(
      BLOCKHASH, 0, keyPair.publicKey, record.vrfOutput
    );
    const c2 = LootCommitmentService.computeCommitment(
      BLOCKHASH, 0, otherKeys.publicKey, record.vrfOutput
    );
    expect(c1).toBe(manifest.commitments[0]);
    expect(c2).not.toBe(c1);
  });

  test('sealed generation is deterministic: same inputs, same manifest', () => {
    const again = LootCommitmentService.generateSealedLoot(keyPair.privateKey, BLOCKHASH, COUNT);
    expect(again.manifest.commitments).toEqual(manifest.commitments);
  });
});
