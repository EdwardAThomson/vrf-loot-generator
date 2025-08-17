// Player Setup Component for Trading System
import React, { useEffect } from 'react';
import { useTrading } from '../../../hooks/useTrading';
import { usePlayerStore } from '../../../store/player.store';
import styles from './TradingSystem.module.css';

/**
 * Component for setting up player identity before trading
 */
export const PlayerSetup: React.FC = () => {
  const { initializePlayer, playerId: tradingPlayerId, playerName: tradingPlayerName } = useTrading();
  const { isLoggedIn, playerName, currentPlayer } = usePlayerStore();

  useEffect(() => {
    // Auto-initialize trading player when global session is available
    if (isLoggedIn && playerName && !tradingPlayerId) {
      // Generate a simple player ID for trading
      const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      initializePlayer(playerId, playerName);
    }
  }, [isLoggedIn, playerName, tradingPlayerId, initializePlayer]);

  if (!isLoggedIn) {
    return (
      <div className={styles.playerSetup}>
        <h3>🎮 Player Setup</h3>
        <p>Please connect using the player session above to start trading.</p>
        
        <div className={styles.setupInfo}>
          <p className={styles.infoText}>
            💡 <strong>Note:</strong> Make sure you have some loot items from the Loot Generator before starting to trade.
          </p>
        </div>
      </div>
    );
  }

  if (tradingPlayerId && tradingPlayerName) {
    return (
      <div className={styles.playerSetup}>
        <h3>🎮 Player Ready</h3>
        <p>Welcome, <strong>{tradingPlayerName}</strong>! You're ready to trade.</p>
        
        <div className={styles.setupInfo}>
          <p className={styles.infoText}>
            💡 <strong>Note:</strong> Make sure you have some loot items from the Loot Generator before starting to trade.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.playerSetup}>
      <h3>🎮 Setting up...</h3>
      <p>Initializing your trading session...</p>
    </div>
  );
};
