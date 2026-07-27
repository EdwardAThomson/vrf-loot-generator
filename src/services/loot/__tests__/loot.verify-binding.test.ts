/**
 * @jest-environment node
 *
 * Phase 1b crypto-correctness tests:
 * 1. verifyItem binds the supplied vrfOutput to the verified proof (RFC 9381:
 *    vrfOutput must equal proof_to_hash(pi)); forged-output items must fail.
 * 2. Per-item messages use fixed-width encoding (blockhash bytes || uint32 BE
 *    index) so distinct (blockhash, index) pairs produce distinct messages.
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
import { LootService } from '../loot.service';
import { buildItemMessage, blockhashToBytes } from '../../../utils/message.utils';
import { toHexString } from '../../../utils/format.utils';
import { LootItem } from '../../../types/loot.types';

const sha256 = require('js-sha256');

describe('Fixed-width item message encoding (buildItemMessage)', () => {
  test('appends the index as 4 big-endian bytes after the blockhash bytes', () => {
    const msg = buildItemMessage('abc', 1);
    expect(msg.length).toBe(3 + 4); // 'abc' is not valid hex -> UTF-8 (3 bytes) + uint32
    expect(Array.from(msg.slice(-4))).toEqual([0, 0, 0, 1]);

    const msg2 = buildItemMessage('abc', 258);
    expect(Array.from(msg2.slice(-4))).toEqual([0, 0, 1, 2]);
  });

  test('decodes even-length hex blockhashes as bytes', () => {
    const msg = buildItemMessage('deadbeef', 7);
    expect(msg.length).toBe(4 + 4);
    expect(Array.from(msg.slice(0, 4))).toEqual([0xde, 0xad, 0xbe, 0xef]);
    expect(Array.from(blockhashToBytes('0xDEADBEEF'))).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });

  test('falls back to UTF-8 for non-hex blockhashes', () => {
    const msg = buildItemMessage('alice-demo-blockhash', 0);
    const utf8 = new TextEncoder().encode('alice-demo-blockhash');
    expect(Array.from(msg.slice(0, utf8.length))).toEqual(Array.from(utf8));
  });

  test('resolves the ambiguity of the old string-concatenation scheme', () => {
    // Old scheme: `${blockhash}-${i}` was ambiguous. The claimed pair
    // (blockhash "abc-1", index 2) and (blockhash "abc", index "1-2")
    // serialize to the same message string:
    expect(`${'abc-1'}-${2}`).toBe(`${'abc'}-${'1-2'}`);

    // New scheme: distinct (blockhash, index) pairs give distinct messages.
    const pairs: Array<[string, number]> = [
      ['abc-1', 2],
      ['abc-1-2', 0],
      ['abc', 12],
      ['abc', 1],
      ['abc-12', 1],
    ];
    const encoded = pairs.map(([b, i]) => toHexString(buildItemMessage(b, i)));
    expect(new Set(encoded).size).toBe(encoded.length);
  });

  test('rejects out-of-range indexes', () => {
    expect(() => buildItemMessage('abc', -1)).toThrow();
    expect(() => buildItemMessage('abc', 2 ** 32)).toThrow();
    expect(() => buildItemMessage('abc', 1.5)).toThrow();
  });
});

describe('verifyItem proof/output binding', () => {
  const blockhash = 'deadbeefcafef00ddeadbeefcafef00ddeadbeefcafef00ddeadbeefcafef00d';
  let privateKey: string;
  let publicKey: string;
  let itemA: LootItem;
  let itemB: LootItem;

  beforeAll(() => {
    const keyPair = VRFService.generateKeyPair();
    privateKey = keyPair.privateKey;
    publicKey = keyPair.publicKey;
    // Two items generated from different messages (same blockhash, index 0 and 1)
    [itemA, itemB] = LootService.generateMultipleItems(privateKey, blockhash, 2);
  });

  test('honestly generated items verify (round trip)', () => {
    expect(LootService.verifyItem(itemA, publicKey)).toBe(true);
    expect(LootService.verifyItem(itemB, publicKey)).toBe(true);
  });

  test('generation uses the fixed-width message and stores it as hex', () => {
    expect(itemA.vrfData?.itemIndex).toBe(0);
    expect(itemB.vrfData?.itemIndex).toBe(1);
    expect(itemA.vrfData?.message).toBe(toHexString(buildItemMessage(blockhash, 0)));
    expect(itemB.vrfData?.message).toBe(toHexString(buildItemMessage(blockhash, 1)));
  });

  test('forged item: valid proof for message A with unrelated vrfOutput B fails', () => {
    const proofA = itemA.vrfData!.proof as Uint8Array;
    const outputB = itemB.vrfData!.vrfOutput as Uint8Array;

    // Sanity: proof A is genuinely valid for message A on its own
    expect(() =>
      VRFService.proofToHash(publicKey, buildItemMessage(blockhash, 0), proofA)
    ).not.toThrow();

    // Build the forgery exactly as the old code would have accepted it: keep
    // item A's valid proof/message, swap in item B's vrfOutput, and claim the
    // properties that B's output maps to (so the property-match check passes).
    const propsFromB = LootService.generateItem(outputB);
    const forged: LootItem = {
      ...itemA,
      type: propsFromB.type,
      rarity: propsFromB.rarity,
      modifier: propsFromB.modifier,
      vrfData: {
        ...itemA.vrfData!,
        vrfOutput: outputB,
      },
    };

    // Old verifyItem: proofToHash(A) passed, properties matched B's output -> true.
    // New verifyItem: vrfOutput is not the point embedded in proof A -> false.
    expect(LootService.verifyItem(forged, publicKey)).toBe(false);
  });

  test('vrfOutput must equal proof_to_hash of the verified proof', () => {
    const proofA = itemA.vrfData!.proof as Uint8Array;
    const beta = VRFService.verify(publicKey, buildItemMessage(blockhash, 0), proofA);
    expect(toHexString(beta)).toBe(toHexString(itemA.vrfData!.vrfOutput as Uint8Array));

    // Flip one byte of the claimed output: must fail even though the proof is valid
    const tampered = new Uint8Array(itemA.vrfData!.vrfOutput as Uint8Array);
    tampered[10] ^= 0xff;
    const forged: LootItem = {
      ...itemA,
      vrfData: { ...itemA.vrfData!, vrfOutput: tampered },
    };
    expect(LootService.verifyItem(forged, publicKey)).toBe(false);
  });

  test('computed index binds: sha256(vrfOutput) must equal proofToHash result', () => {
    const proofA = itemA.vrfData!.proof as Uint8Array;
    const computedIndex = VRFService.proofToHash(
      publicKey,
      buildItemMessage(blockhash, 0),
      proofA
    );
    const hashedOutput = new Uint8Array(
      sha256.array(itemA.vrfData!.vrfOutput as Uint8Array)
    );
    expect(toHexString(hashedOutput)).toBe(toHexString(computedIndex));
  });

  test('verification reconstructs the message: wrong claimed index fails', () => {
    // Same valid data but claim it was item index 1 instead of 0
    const forged: LootItem = {
      ...itemA,
      vrfData: { ...itemA.vrfData!, itemIndex: 1 },
    };
    expect(LootService.verifyItem(forged, publicKey)).toBe(false);

    // And a wrong claimed blockhash fails too
    const forged2: LootItem = {
      ...itemA,
      vrfData: { ...itemA.vrfData!, blockhash: 'deadbeef' },
    };
    expect(LootService.verifyItem(forged2, publicKey)).toBe(false);
  });

  test('a free-form message string is ignored by verification', () => {
    // Tampering with the stored display message does not affect the result,
    // because verification rebuilds the message from (blockhash, itemIndex).
    const tamperedMessage: LootItem = {
      ...itemA,
      vrfData: { ...itemA.vrfData!, message: 'attacker-controlled-string' },
    };
    expect(LootService.verifyItem(tamperedMessage, publicKey)).toBe(true);
  });

  test('items without blockhash or numeric itemIndex fail closed', () => {
    const noBlockhash: LootItem = {
      ...itemA,
      vrfData: { ...itemA.vrfData!, blockhash: undefined },
    };
    const noIndex: LootItem = {
      ...itemA,
      vrfData: { ...itemA.vrfData!, itemIndex: undefined },
    };
    expect(LootService.verifyItem(noBlockhash, publicKey)).toBe(false);
    expect(LootService.verifyItem(noIndex, publicKey)).toBe(false);
  });

  test('hex string proof and vrfOutput round-trip through verification', () => {
    const hexItem: LootItem = {
      ...itemA,
      vrfData: {
        ...itemA.vrfData!,
        proof: toHexString(itemA.vrfData!.proof as Uint8Array),
        vrfOutput: toHexString(itemA.vrfData!.vrfOutput as Uint8Array),
      },
    };
    expect(LootService.verifyItem(hexItem, publicKey)).toBe(true);
  });
});
