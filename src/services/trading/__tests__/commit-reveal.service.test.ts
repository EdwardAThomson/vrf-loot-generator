// Tests for the hardened commit-reveal service: canonical serialization,
// identity-only commitments, and timestamp-free verification.

import {
  CommitRevealService,
  COMMIT_SCHEMA_VERSION
} from '../commit-reveal.service';
import { canonicalize } from '../../../utils/canonical';
import { LootItem } from '../../../types/loot.types';

const toBytes = (hex: string): Uint8Array => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substring(2 * i, 2 * i + 2), 16);
  }
  return out;
};

const PROOF_HEX = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
const OUTPUT_HEX = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

const makeItem = (overrides: Partial<LootItem> = {}): LootItem => ({
  id: 'item-1',
  name: 'Sword of Testing',
  type: 'Weapon',
  icon: 'sword.png',
  rarity: 'Rare',
  modifier: 'Sharp',
  createdAt: '2026-07-27T10:00:00.000Z',
  vrfData: {
    publicKey: '04deadbeef',
    proof: PROOF_HEX,
    message: 'display-only-message',
    blockhash: '0xABCDEF0123456789',
    itemIndex: 3,
    vrfOutput: OUTPUT_HEX
  },
  ...overrides
});

describe('canonicalize', () => {
  it('is independent of object key insertion order', () => {
    const a = { x: 1, y: [{ b: 2, a: 1 }], z: 'hi' };
    const b = { z: 'hi', y: [{ a: 1, b: 2 }], x: 1 };
    expect(canonicalize(a)).toEqual(canonicalize(b));
  });

  it('encodes Uint8Array as a tagged lowercase hex object', () => {
    expect(canonicalize(new Uint8Array([0, 1, 255]))).toEqual('{"$bytes":"0001ff"}');
  });

  it('rejects undefined values, functions, and NaN', () => {
    expect(() => canonicalize({ a: undefined })).toThrow();
    expect(() => canonicalize(undefined)).toThrow();
    expect(() => canonicalize({ a: () => 1 })).toThrow();
    expect(() => canonicalize(NaN)).toThrow();
    expect(() => canonicalize(Infinity)).toThrow();
  });

  it('rejects the reserved $bytes key on plain objects', () => {
    expect(() => canonicalize({ $bytes: '00' })).toThrow();
  });

  it('preserves array order as significant', () => {
    expect(canonicalize([1, 2])).not.toEqual(canonicalize([2, 1]));
  });
});

describe('CommitRevealService', () => {
  it('round trips commit and reveal', () => {
    const items = [makeItem(), makeItem({ id: 'item-2', name: 'Shield' })];
    const nonce = CommitRevealService.generateNonce();
    const commitment = CommitRevealService.createCommitment(items, nonce);
    const reveal = CommitRevealService.createReveal(items, nonce);

    expect(CommitRevealService.verifyReveal(commitment, reveal)).toBe(true);
  });

  it('verifies a reveal whose objects have permuted keys but identical semantics', () => {
    const original = makeItem();
    const nonce = 'fixed-nonce';
    const commitment = CommitRevealService.createCommitment([original], nonce);

    // Same semantic item, different key insertion order everywhere
    const permuted = {
      createdAt: original.createdAt,
      vrfData: {
        vrfOutput: OUTPUT_HEX,
        itemIndex: 3,
        blockhash: '0xABCDEF0123456789',
        message: 'display-only-message',
        proof: PROOF_HEX,
        publicKey: '04deadbeef'
      },
      modifier: 'Sharp',
      rarity: 'Rare',
      icon: 'sword.png',
      type: 'Weapon',
      name: 'Sword of Testing',
      id: 'item-1'
    } as LootItem;

    const reveal = CommitRevealService.createReveal([permuted], nonce);
    expect(CommitRevealService.verifyReveal(commitment, reveal)).toBe(true);
  });

  it('rejects a tampered item', () => {
    const nonce = 'fixed-nonce';
    const commitment = CommitRevealService.createCommitment([makeItem()], nonce);

    const tampered = makeItem({ rarity: 'Legendary' });
    const reveal = CommitRevealService.createReveal([tampered], nonce);
    expect(CommitRevealService.verifyReveal(commitment, reveal)).toBe(false);
  });

  it('rejects a tampered vrf identity field', () => {
    const nonce = 'fixed-nonce';
    const item = makeItem();
    const commitment = CommitRevealService.createCommitment([item], nonce);

    const tampered = makeItem();
    tampered.vrfData = { ...tampered.vrfData!, itemIndex: 4 };
    const reveal = CommitRevealService.createReveal([tampered], nonce);
    expect(CommitRevealService.verifyReveal(commitment, reveal)).toBe(false);
  });

  it('rejects a different nonce', () => {
    const items = [makeItem()];
    const commitment = CommitRevealService.createCommitment(items, 'nonce-A');
    const reveal = CommitRevealService.createReveal(items, 'nonce-B');
    expect(CommitRevealService.verifyReveal(commitment, reveal)).toBe(false);
  });

  it('verifies a late reveal (minutes after the commitment)', () => {
    const items = [makeItem()];
    const nonce = 'fixed-nonce';
    const commitment = CommitRevealService.createCommitment(items, nonce);

    // Simulate the reveal being created 10 minutes later
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 60 * 1000);
    try {
      const lateReveal = CommitRevealService.createReveal(items, nonce);
      expect(lateReveal.timestamp - commitment.timestamp).toBeGreaterThanOrEqual(10 * 60 * 1000);
      expect(CommitRevealService.verifyReveal(commitment, lateReveal)).toBe(true);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('ignores display-only fields: icon and createdAt do not change the commitment', () => {
    const nonce = 'fixed-nonce';
    const base = CommitRevealService.computeCommitmentHash([makeItem()], nonce);
    const redecorated = CommitRevealService.computeCommitmentHash(
      [makeItem({ icon: 'different.png', createdAt: '1999-01-01T00:00:00.000Z' })],
      nonce
    );
    expect(redecorated).toEqual(base);
  });

  it('hashes Uint8Array and hex-string vrfData fields identically', () => {
    const nonce = 'fixed-nonce';
    const hexItem = makeItem();
    const bytesItem = makeItem();
    bytesItem.vrfData = {
      ...bytesItem.vrfData!,
      proof: toBytes(PROOF_HEX),
      vrfOutput: toBytes(OUTPUT_HEX)
    };

    expect(CommitRevealService.computeCommitmentHash([bytesItem], nonce))
      .toEqual(CommitRevealService.computeCommitmentHash([hexItem], nonce));
  });

  it('treats vrf byte fields as opaque: lengths from the RFC 9381 migration still work', () => {
    const nonce = 'fixed-nonce';
    const item = makeItem();
    item.vrfData = {
      ...item.vrfData!,
      vrfOutput: new Uint8Array(64).fill(7), // 64-byte output
      proof: new Uint8Array(80).fill(9) // 80-byte proof
    };
    const commitment = CommitRevealService.createCommitment([item], nonce);
    const reveal = CommitRevealService.createReveal([item], nonce);
    expect(CommitRevealService.verifyReveal(commitment, reveal)).toBe(true);
  });

  it('fails verification on a schema version mismatch', () => {
    const items = [makeItem()];
    const nonce = 'fixed-nonce';
    const futureHash = CommitRevealService.computeCommitmentHash(
      items,
      nonce,
      COMMIT_SCHEMA_VERSION + 1
    );

    const commitment = { hash: futureHash, timestamp: Date.now() };
    const reveal = CommitRevealService.createReveal(items, nonce);
    expect(CommitRevealService.verifyReveal(commitment, reveal)).toBe(false);
    // Same payload under the current version verifies
    expect(
      CommitRevealService.verifyCommitmentHash(
        CommitRevealService.computeCommitmentHash(items, nonce),
        items,
        nonce
      )
    ).toBe(true);
  });

  it('accepts the websocket wire item shape (vrfProof/hash aliases) identically', () => {
    const nonce = 'fixed-nonce';
    const appShapeHash = CommitRevealService.computeCommitmentHash([makeItem()], nonce);
    const wireItem = {
      id: 'item-1',
      name: 'Sword of Testing',
      type: 'Weapon',
      rarity: 'Rare',
      modifier: 'Sharp',
      vrfProof: {
        publicKey: '04deadbeef',
        proof: PROOF_HEX,
        message: 'display-only-message',
        hash: OUTPUT_HEX,
        blockhash: '0xabcdef0123456789',
        itemIndex: 3
      }
    };
    expect(CommitRevealService.computeCommitmentHash([wireItem], nonce)).toEqual(appShapeHash);
  });

  it('validates a full two-player trade', () => {
    const p1 = CommitRevealService.createTradeCommitment('alice', [makeItem()]);
    const p2 = CommitRevealService.createTradeCommitment('bob', [makeItem({ id: 'item-2' })]);

    expect(
      CommitRevealService.validateTrade(
        p1.commitment,
        p1.reveal!,
        p2.commitment,
        p2.reveal!
      )
    ).toBe(true);
  });

  it('getPublicCommitment omits the reveal', () => {
    const tc = CommitRevealService.createTradeCommitment('alice', [makeItem()]);
    const pub = CommitRevealService.getPublicCommitment(tc);
    expect(pub).toEqual({ playerId: 'alice', commitment: tc.commitment });
    expect((pub as any).reveal).toBeUndefined();
  });
});
