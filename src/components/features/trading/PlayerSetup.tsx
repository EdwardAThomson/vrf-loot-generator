// Player Setup Component for Trading System
import React, { useState } from 'react';
import { useTrading } from '../../../hooks/useTrading';
import styles from './TradingSystem.module.css';

/**
 * Component for setting up player identity before trading
 */
export const PlayerSetup: React.FC = () => {
  const [playerName, setPlayerName] = useState('');
  const { initializePlayer } = useTrading();

  const handleSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      // Generate a simple player ID
      const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      initializePlayer(playerId, playerName.trim());
    }
  };

  return (
    <div className={styles.playerSetup}>
      <h3>🎮 Player Setup</h3>
      <p>Enter your player name to start trading:</p>
      
      <form onSubmit={handleSetup} className={styles.setupForm}>
        <div className={styles.inputGroup}>
          <label htmlFor="playerName">Player Name:</label>
          <input
            id="playerName"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name..."
            maxLength={20}
            required
          />
        </div>
        
        <button 
          type="submit" 
          className={styles.primaryButton}
          disabled={!playerName.trim()}
        >
          Start Trading
        </button>
      </form>
      
      <div className={styles.setupInfo}>
        <p className={styles.infoText}>
          💡 <strong>Note:</strong> Make sure you have some loot items from the Loot Generator before starting to trade.
        </p>
      </div>
    </div>
  );
};
