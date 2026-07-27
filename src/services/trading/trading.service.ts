// Trading Service - Business logic for secure item trading
import { LootService } from '../loot/loot.service';
import { VRFService } from '../vrf/vrf.service';
import { CommitRevealService, TradeCommitment, Commitment, Reveal } from './commit-reveal.service';
import { LootItem } from '../../types/loot.types';
import { TradeRequest, Player } from '../../types/trading.types';

export interface TradeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CompletedTrade {
  sessionId: string;
  player1: {
    id: string;
    offeredItems: LootItem[];
    receivedItems: LootItem[];
  };
  player2: {
    id: string;
    offeredItems: LootItem[];
    receivedItems: LootItem[];
  };
  completedAt: string;
  verified: boolean;
}

/**
 * Trading Service - Handles secure item trading with VRF verification
 */
export class TradingService {
  /**
   * Validate that all items in a trade offer are legitimate
   * @param items - Items to validate
   * @param ownerPublicKey - VRF public key of the item owner
   * @returns Validation result
   */
  static validateTradeItems(items: LootItem[], ownerPublicKey: string): TradeValidationResult {
    const result: TradeValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (items.length === 0) {
      result.errors.push('Trade must include at least one item');
      result.isValid = false;
      return result;
    }

    for (const item of items) {
      // Sealed (committed, unrevealed) items are untradeable: trading them
      // would require shipping their VRF output/proof, which defeats the
      // sealed state. The owner must reveal first.
      if (item.sealed) {
        result.errors.push(`Item ${item.name} is sealed and cannot be traded (reveal it first)`);
        result.isValid = false;
        continue;
      }

      // Check if item has VRF data for verification
      if (!item.vrfData) {
        result.warnings.push(`Item ${item.name} cannot be verified (no VRF data)`);
        continue;
      }

      // Verify item authenticity using VRF
      try {
        const isValid = LootService.verifyItem(item, ownerPublicKey);
        if (!isValid) {
          result.errors.push(`Item ${item.name} failed VRF verification`);
          result.isValid = false;
        }
      } catch (error) {
        result.errors.push(`Failed to verify item ${item.name}: ${(error as Error).message}`);
        result.isValid = false;
      }
    }

    return result;
  }

  /**
   * Create a trade request with initial validation
   * @param initiatorId - Player initiating the trade
   * @param targetId - Player being invited to trade
   * @param targetName - Name of target player
   * @param offeredItems - Items being offered
   * @param initiatorPublicKey - VRF public key of initiator
   * @returns Trade request or null if validation fails
   */
  static createTradeRequest(
    initiatorId: string,
    initiatorName: string,
    targetId: string,
    targetName: string,
    offeredItems: LootItem[],
    initiatorPublicKey: string
  ): { tradeRequest: TradeRequest; errors: string[] } | null {
    // Validate offered items
    const validation = this.validateTradeItems(offeredItems, initiatorPublicKey);
    
    if (!validation.isValid) {
      return null;
    }

    const tradeRequest: TradeRequest = {
      id: Date.now(),
      initiator: initiatorId,
      initiatorPlayerId: initiatorId,
      initiatorPlayerName: initiatorName,
      target: targetId,
      targetPlayerId: targetId,
      targetPlayerName: targetName,
      offeredItems,
      requestedItems: [], // Will be filled when target responds
      status: 'pending',
      createdAt: new Date().toISOString(),
      timestamp: Date.now()
    };

    return {
      tradeRequest,
      errors: validation.errors
    };
  }

  /**
   * Prepare commitment for a trade (called when both players are ready)
   * @param playerId - Player making the commitment
   * @param items - Items being committed to trade
   * @returns Trade commitment object
   */
  static prepareTradeCommitment(playerId: string, items: LootItem[]): TradeCommitment {
    const sealed = items.filter(item => item.sealed);
    if (sealed.length > 0) {
      throw new Error(
        `Cannot commit sealed item(s) to a trade: ${sealed.map(i => i.name).join(', ')}. Reveal them first.`
      );
    }
    return CommitRevealService.createTradeCommitment(playerId, items);
  }

  /**
   * Validate and execute a completed trade
   * @param player1Commitment - Player 1's commitment
   * @param player1Reveal - Player 1's reveal
   * @param player2Commitment - Player 2's commitment  
   * @param player2Reveal - Player 2's reveal
   * @param sessionId - Trade session ID
   * @returns Completed trade result or null if invalid
   */
  static executeTrade(
    player1Id: string,
    player1Commitment: Commitment,
    player1Reveal: Reveal,
    player2Id: string,
    player2Commitment: Commitment,
    player2Reveal: Reveal,
    sessionId: string
  ): CompletedTrade | null {
    // Validate the commit-reveal protocol
    const isValid = CommitRevealService.validateTrade(
      player1Commitment,
      player1Reveal,
      player2Commitment,
      player2Reveal
    );

    if (!isValid) {
      return null;
    }

    // Create completed trade record
    const completedTrade: CompletedTrade = {
      sessionId,
      player1: {
        id: player1Id,
        offeredItems: player1Reveal.items,
        receivedItems: player2Reveal.items
      },
      player2: {
        id: player2Id,
        offeredItems: player2Reveal.items,
        receivedItems: player1Reveal.items
      },
      completedAt: new Date().toISOString(),
      verified: true
    };

    return completedTrade;
  }

  /**
   * Check if a player can initiate a trade
   * @param player - Player to check
   * @param targetPlayer - Target player
   * @returns True if trade can be initiated
   */
  static canInitiateTrade(player: Player, targetPlayer: Player): boolean {
    return (
      player.isOnline &&
      targetPlayer.isOnline &&
      !player.inTrade &&
      !targetPlayer.inTrade &&
      player.id !== targetPlayer.id
    );
  }

  /**
   * Generate a unique trade session between two players
   * @param player1Id - First player ID
   * @param player2Id - Second player ID
   * @returns Unique session ID
   */
  static createTradeSession(player1Id: string, player2Id: string): string {
    return CommitRevealService.generateTradeSessionId(player1Id, player2Id);
  }

  /**
   * Validate trade fairness (optional - for UI warnings)
   * @param player1Items - Player 1's items
   * @param player2Items - Player 2's items
   * @returns Fairness assessment
   */
  static assessTradeFairness(player1Items: LootItem[], player2Items: LootItem[]): {
    isFair: boolean;
    player1Value: number;
    player2Value: number;
    suggestion?: string;
  } {
    // Simple rarity-based value assessment
    const rarityValues = {
      'Common': 1,
      'Rare': 3,
      'Epic': 9,
      'Legendary': 27
    };

    const player1Value = player1Items.reduce((sum, item) => 
      sum + (rarityValues[item.rarity as keyof typeof rarityValues] || 1), 0
    );

    const player2Value = player2Items.reduce((sum, item) => 
      sum + (rarityValues[item.rarity as keyof typeof rarityValues] || 1), 0
    );

    const ratio = Math.max(player1Value, player2Value) / Math.min(player1Value, player2Value);
    const isFair = ratio <= 2; // Allow up to 2:1 ratio

    let suggestion: string | undefined;
    if (!isFair) {
      if (player1Value > player2Value) {
        suggestion = 'Player 1 is offering significantly more valuable items';
      } else {
        suggestion = 'Player 2 is offering significantly more valuable items';
      }
    }

    return {
      isFair,
      player1Value,
      player2Value,
      suggestion
    };
  }

  /**
   * Check if commitments are still valid (not expired)
   * @param commitments - Array of commitments to check
   * @returns True if all commitments are valid
   */
  static areCommitmentsValid(commitments: Commitment[]): boolean {
    return commitments.every(commitment => 
      CommitRevealService.isCommitmentValid(commitment)
    );
  }
}
