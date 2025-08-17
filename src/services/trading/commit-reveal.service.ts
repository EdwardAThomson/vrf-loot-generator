// Commit-Reveal Protocol Service
// Implements cryptographic commit-reveal for secure trading

import * as sha256 from 'js-sha256';
import * as crypto from 'crypto-js';
import { LootItem } from '../../types/loot.types';

export interface CommitmentData {
  items: LootItem[];
  nonce: string;
  timestamp: number;
}

export interface Commitment {
  hash: string;
  timestamp: number;
}

export interface Reveal {
  items: LootItem[];
  nonce: string;
  timestamp: number;
}

export interface TradeCommitment {
  playerId: string;
  commitment: Commitment;
  reveal?: Reveal;
}

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
   * Create a commitment hash for the given items and nonce
   * @param items - Items being offered in the trade
   * @param nonce - Random nonce for security
   * @returns Commitment object with hash and timestamp
   */
  static createCommitment(items: LootItem[], nonce: string): Commitment {
    const timestamp = Date.now();
    
    // Create deterministic representation of items for hashing
    const itemsData = items.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      icon: item.icon,
      rarity: item.rarity,
      modifier: item.modifier,
      vrfData: item.vrfData,
      createdAt: item.createdAt
    }));

    const commitmentData: CommitmentData = {
      items: itemsData,
      nonce,
      timestamp
    };

    // Create hash of the commitment data
    const dataString = JSON.stringify(commitmentData);
    const hash = sha256.sha256(dataString);

    return {
      hash,
      timestamp
    };
  }

  /**
   * Verify that a reveal matches the original commitment
   * @param commitment - Original commitment hash
   * @param reveal - Revealed data (items + nonce)
   * @returns True if reveal is valid, false otherwise
   */
  static verifyReveal(commitment: Commitment, reveal: Reveal): boolean {
    try {
      // Recreate the commitment from the revealed data
      const recreatedCommitment = this.createCommitment(reveal.items, reveal.nonce);
      
      // Verify hash matches
      const hashMatches = recreatedCommitment.hash === commitment.hash;
      
      // Verify timestamp matches (within reasonable tolerance for clock differences)
      const timestampMatches = Math.abs(recreatedCommitment.timestamp - commitment.timestamp) < 1000; // 1 second tolerance
      
      return hashMatches && timestampMatches;
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
