/**
 * @jest-environment node
 *
 * Phase 2: sealed items must be untradeable. The trading paths must reject
 * sealed items outright instead of silently committing (and thus leaking)
 * their data.
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
import { LootService } from '../../loot/loot.service';
import { TradingService } from '../trading.service';
import { LootItem } from '../../../types/loot.types';

const BLOCKHASH = 'sealed-trade-test-blockhash';

describe('Trading rejects sealed items', () => {
  const keyPair = VRFService.generateKeyPair();
  const items = LootService.generateMultipleItems(keyPair.privateKey, BLOCKHASH, 3);

  const asSealed = (item: LootItem): LootItem => ({ ...item, sealed: true });

  test('validateTradeItems fails a trade containing a sealed item', () => {
    const offer = [items[0], asSealed(items[1])];
    const result = TradingService.validateTradeItems(offer, keyPair.publicKey);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('sealed'))).toBe(true);
  });

  test('validateTradeItems passes the same items once revealed (sealed flag cleared)', () => {
    const offer = [items[0], { ...items[1], sealed: false }];
    const result = TradingService.validateTradeItems(offer, keyPair.publicKey);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('createTradeRequest returns null when the offer contains a sealed item', () => {
    const result = TradingService.createTradeRequest(
      'alice', 'Alice', 'bob', 'Bob',
      [asSealed(items[0])],
      keyPair.publicKey
    );
    expect(result).toBeNull();
  });

  test('prepareTradeCommitment throws on sealed items and never builds a commitment', () => {
    expect(() =>
      TradingService.prepareTradeCommitment('alice', [items[0], asSealed(items[2])])
    ).toThrow(/sealed/i);
  });

  test('prepareTradeCommitment still works for revealed items', () => {
    const commitment = TradingService.prepareTradeCommitment('alice', [items[0]]);
    expect(commitment.commitment.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
