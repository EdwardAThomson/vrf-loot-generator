// Commit-Reveal Protocol Service
// Implements cryptographic commit-reveal for secure trading
//
// Commitment format (COMMIT_SCHEMA_VERSION = 1):
//
//   hash = sha256( canonicalize({ v, items, nonce }) )
//
// where `canonicalize` is the deterministic encoder in src/utils/canonical.ts
// (sorted keys, one canonical form per value), `v` is the schema version
// number (so future format changes fail verification instead of silently
// verifying), `nonce` is the committer's random hex nonce, and `items` is the
// array of extracted item IDENTITIES (see CommittedItem below), in offer order.
//
// The commitment binds item identity, not the whole mutable LootItem object.
// Committed fields per item: id, name, type, rarity, modifier, and the VRF
// identity fields blockhash / itemIndex / vrfOutput / proof (bytes as
// lowercase hex, treated as opaque data of unspecified length). Display-only
// or client-local fields (icon, createdAt, vrfData.publicKey/message/index)
// deliberately do NOT affect the hash: honest peers may render or timestamp
// the same item differently, and that must not break verification.
//
// Timestamps are metadata only. They are NOT part of the hashed payload and
// verifyReveal ignores them entirely, so an honest late reveal (minutes after
// the commit) still verifies. Freshness policy is a separate concern, handled
// by isCommitmentValid.

import * as sha256 from 'js-sha256';
import * as crypto from 'crypto-js';
import { LootItem } from '../../types/loot.types';
import { canonicalize } from '../../utils/canonical';
import { toHexString } from '../../utils/format.utils';

/** Version of the committed payload format. Bump on any format change. */
export const COMMIT_SCHEMA_VERSION = 1;

/**
 * VRF fields the commitment can read from an item. Structural superset of
 * `VRFData` (loot.types, field `vrfOutput`) and the websocket wire item's
 * `vrfProof` (field `hash`). Only the identity fields are committed.
 */
export interface CommittableVRFFields {
  publicKey?: string;
  proof?: Uint8Array | string | null;
  message?: string;
  blockhash?: string | null;
  itemIndex?: number | null;
  index?: Uint8Array | string;
  vrfOutput?: Uint8Array | string | null;
  /** Wire-format alias for vrfOutput (websocket LootItem.vrfProof.hash). */
  hash?: Uint8Array | string | null;
}

/**
 * Minimal structural item shape the commitment reads. Both the app `LootItem`
 * (src/types/loot.types.ts) and the websocket wire `LootItem`
 * (src/types/websocket.types.ts) satisfy it. Extra fields (icon, createdAt,
 * ...) are ignored by extraction and never affect the hash.
 */
export interface CommittableItem {
  id: string;
  name: string;
  type: string;
  rarity: string;
  modifier?: string | null;
  vrfData?: CommittableVRFFields | null;
  vrfProof?: CommittableVRFFields | null;
}

/** VRF identity fields bound by the commitment (bytes as lowercase hex). */
export interface CommittedVRFIdentity {
  blockhash: string | null;
  itemIndex: number | null;
  vrfOutput: string | null;
  proof: string | null;
}

/** The exact per-item fields bound by a commitment. */
export interface CommittedItem {
  id: string;
  name: string;
  type: string;
  rarity: string;
  modifier: string;
  vrfData: CommittedVRFIdentity | null;
}

export interface Commitment {
  hash: string;
  /** Metadata only (creation time). Not part of the hash, never verified. */
  timestamp: number;
}

export interface Reveal {
  items: LootItem[];
  nonce: string;
  /** Metadata only (reveal time). Not part of the hash, never verified. */
  timestamp: number;
}

export interface TradeCommitment {
  playerId: string;
  commitment: Commitment;
  reveal?: Reveal;
}

/** Normalize an opaque bytes-or-hex-string field to lowercase hex (or null). */
const toOpaqueHex = (value: Uint8Array | string | undefined | null): string | null => {
  if (value === undefined || value === null) return null;
  if (value instanceof Uint8Array) return toHexString(value);
  return value.toLowerCase();
};

/**
 * Commit-Reveal Protocol Service
 * Ensures fair trading by preventing players from changing their offers after seeing opponent's items
 */
export class CommitRevealService {
  /**
   * Generate a cryptographically secure random nonce
   */
  static generateNonce(): string {
    return crypto.lib.WordArray.random(32).toString();
  }

  /**
   * Extract the identity fields of an item that the commitment binds.
   * Missing optional fields normalize to null (never undefined), and byte
   * fields normalize to lowercase hex, so semantically identical items
   * always extract to the same CommittedItem regardless of representation.
   */
  static extractCommittedItem(item: CommittableItem): CommittedItem {
    const vrf = item.vrfData ?? item.vrfProof ?? null;
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      rarity: item.rarity,
      modifier: item.modifier !== undefined && item.modifier !== null ? item.modifier : '',
      vrfData: vrf
        ? {
            blockhash: vrf.blockhash !== undefined && vrf.blockhash !== null
              ? vrf.blockhash.toLowerCase()
              : null,
            itemIndex: vrf.itemIndex !== undefined && vrf.itemIndex !== null
              ? vrf.itemIndex
              : null,
            vrfOutput: toOpaqueHex(vrf.vrfOutput !== undefined && vrf.vrfOutput !== null ? vrf.vrfOutput : vrf.hash),
            proof: toOpaqueHex(vrf.proof)
          }
        : null
    };
  }

  /**
   * Compute the commitment hash for items + nonce.
   * @param items - Items being offered in the trade
   * @param nonce - Random nonce for security
   * @param version - Payload schema version (exposed for testing; callers use the default)
   * @returns Lowercase hex sha256 commitment hash
   */
  static computeCommitmentHash(
    items: CommittableItem[],
    nonce: string,
    version: number = COMMIT_SCHEMA_VERSION
  ): string {
    const payload = {
      v: version,
      items: items.map((item) => this.extractCommittedItem(item)),
      nonce
    };
    return sha256.sha256(canonicalize(payload));
  }

  /**
   * Verify a bare commitment hash against revealed items + nonce.
   */
  static verifyCommitmentHash(hash: string, items: CommittableItem[], nonce: string): boolean {
    try {
      return this.computeCommitmentHash(items, nonce) === hash;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a commitment for the given items and nonce.
   * The returned timestamp is metadata (used only by isCommitmentValid); it is
   * not part of the committed payload.
   */
  static createCommitment(items: LootItem[], nonce: string): Commitment {
    return {
      hash: this.computeCommitmentHash(items, nonce),
      timestamp: Date.now()
    };
  }

  /**
   * Verify that a reveal matches the original commitment.
   * Only the hash binds: timestamps are ignored, so honest late reveals verify.
   * @param commitment - Original commitment
   * @param reveal - Revealed data (items + nonce)
   * @returns True if reveal is valid, false otherwise
   */
  static verifyReveal(commitment: Commitment, reveal: Reveal): boolean {
    try {
      return this.computeCommitmentHash(reveal.items, reveal.nonce) === commitment.hash;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a reveal object from items and nonce
   * @param items - Items being revealed
   * @param nonce - Original nonce used in commitment
   * @returns Reveal object
   */
  static createReveal(items: LootItem[], nonce: string): Reveal {
    return {
      items,
      nonce,
      timestamp: Date.now()
    };
  }

  /**
   * Validate that both players have revealed and their commitments are valid
   * @param player1Commitment - Player 1's commitment
   * @param player1Reveal - Player 1's reveal
   * @param player2Commitment - Player 2's commitment
   * @param player2Reveal - Player 2's reveal
   * @returns True if both reveals are valid
   */
  static validateTrade(
    player1Commitment: Commitment,
    player1Reveal: Reveal,
    player2Commitment: Commitment,
    player2Reveal: Reveal
  ): boolean {
    const player1Valid = this.verifyReveal(player1Commitment, player1Reveal);
    const player2Valid = this.verifyReveal(player2Commitment, player2Reveal);

    return player1Valid && player2Valid;
  }

  /**
   * Check if a commitment is still valid (not too old)
   * @param commitment - Commitment to check
   * @param maxAgeMs - Maximum age in milliseconds (default: 5 minutes)
   * @returns True if commitment is still valid
   */
  static isCommitmentValid(commitment: Commitment, maxAgeMs: number = 5 * 60 * 1000): boolean {
    const age = Date.now() - commitment.timestamp;
    return age <= maxAgeMs;
  }

  /**
   * Generate a secure trade session ID
   * @param player1Id - First player ID
   * @param player2Id - Second player ID
   * @returns Unique session ID for the trade
   */
  static generateTradeSessionId(player1Id: string, player2Id: string): string {
    const sortedIds = [player1Id, player2Id].sort();
    const timestamp = Date.now();
    const nonce = this.generateNonce();

    const sessionData = `${sortedIds[0]}-${sortedIds[1]}-${timestamp}-${nonce}`;
    return sha256.sha256(sessionData).substring(0, 16);
  }

  /**
   * Create a complete trade commitment for a player
   * @param playerId - Player making the commitment
   * @param items - Items being offered
   * @returns Complete trade commitment object
   */
  static createTradeCommitment(playerId: string, items: LootItem[]): TradeCommitment {
    const nonce = this.generateNonce();
    const commitment = this.createCommitment(items, nonce);

    return {
      playerId,
      commitment,
      // Store reveal data privately (not shared until reveal phase)
      reveal: this.createReveal(items, nonce)
    };
  }

  /**
   * Extract only the public commitment data (without reveal)
   * @param tradeCommitment - Full trade commitment
   * @returns Public commitment data safe to share
   */
  static getPublicCommitment(tradeCommitment: TradeCommitment): { playerId: string; commitment: Commitment } {
    return {
      playerId: tradeCommitment.playerId,
      commitment: tradeCommitment.commitment
    };
  }
}
