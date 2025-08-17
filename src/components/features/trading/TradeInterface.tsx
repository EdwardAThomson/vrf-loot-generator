// Trade Interface Component for Trading System
import React, { useState } from 'react';
import { useTrading } from '../../../hooks/useTrading';
import { useInventory } from '../../../hooks/useInventory';
import { Player } from '../../../types/trading.types';
import styles from './TradingSystem.module.css';

/**
 * Component for initiating and managing trades
 */
export const TradeInterface: React.FC = () => {
  const [targetPlayerId, setTargetPlayerId] = useState('');
  const [targetPlayerName, setTargetPlayerName] = useState('');
  const [showTradeForm, setShowTradeForm] = useState(false);

  const { 
    startTrade, 
    connectedPlayers, 
    isTradeActive, 
    currentTrade,
    getTradeStatus,
    commitToCurrentTrade,
    revealCurrentTrade,
    finalizeTrade,
    cancelCurrentTrade
  } = useTrading();

  const { selectedItems, hasSelection } = useInventory();

  const tradeStatus = getTradeStatus();

  const handleStartTrade = () => {
    if (!hasSelection()) {
      alert('Please select items from your inventory first!');
      return;
    }

    if (!targetPlayerId.trim() || !targetPlayerName.trim()) {
      alert('Please enter target player details!');
      return;
    }

    const targetPlayer: Player = {
      id: targetPlayerId.trim(),
      name: targetPlayerName.trim(),
      isOnline: true,
      lastSeen: null
    };

    // For demo purposes, use a mock public key
    const mockPublicKey = 'demo_public_key_' + Date.now();
    
    const success = startTrade(targetPlayer, selectedItems, mockPublicKey);
    if (success) {
      setShowTradeForm(false);
      setTargetPlayerId('');
      setTargetPlayerName('');
    }
  };

  const handleCommitTrade = () => {
    commitToCurrentTrade(selectedItems);
  };

  const handleRevealTrade = () => {
    revealCurrentTrade();
  };

  const handleCompleteTrade = () => {
    finalizeTrade();
  };

  const handleCancelTrade = () => {
    if (window.confirm('Are you sure you want to cancel this trade?')) {
      cancelCurrentTrade();
    }
  };

  // If no trade is active, show trade initiation form
  if (!isTradeActive) {
    return (
      <div className={styles.tradeInterface}>
        <h3>🤝 Start a Trade</h3>
        
        {!hasSelection() && (
          <div className={styles.warning}>
            ⚠️ Please select items from your inventory first!
          </div>
        )}

        {hasSelection() && (
          <div className={styles.selectedItems}>
            <h4>Selected Items ({selectedItems.length}):</h4>
            <div className={styles.itemList}>
              {selectedItems.map(item => (
                <div key={item.id} className={styles.selectedItem}>
                  <span className={styles.itemIcon}>{item.icon}</span>
                  <span className={styles.itemName}>{item.name}</span>
                  <span className={`${styles.itemRarity} ${styles[item.rarity.toLowerCase()]}`}>
                    {item.rarity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!showTradeForm ? (
          <button 
            onClick={() => setShowTradeForm(true)}
            className={styles.primaryButton}
            disabled={!hasSelection()}
          >
            Initiate Trade
          </button>
        ) : (
          <div className={styles.tradeForm}>
            <h4>Trade With:</h4>
            <div className={styles.inputGroup}>
              <label htmlFor="targetPlayerId">Player ID:</label>
              <input
                id="targetPlayerId"
                type="text"
                value={targetPlayerId}
                onChange={(e) => setTargetPlayerId(e.target.value)}
                placeholder="Enter player ID..."
              />
            </div>
            
            <div className={styles.inputGroup}>
              <label htmlFor="targetPlayerName">Player Name:</label>
              <input
                id="targetPlayerName"
                type="text"
                value={targetPlayerName}
                onChange={(e) => setTargetPlayerName(e.target.value)}
                placeholder="Enter player name..."
              />
            </div>

            <div className={styles.formActions}>
              <button 
                onClick={handleStartTrade}
                className={styles.primaryButton}
              >
                Send Trade Request
              </button>
              <button 
                onClick={() => setShowTradeForm(false)}
                className={styles.secondaryButton}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className={styles.tradeInfo}>
          <h4>💡 How Trading Works:</h4>
          <ol>
            <li>Select items from your inventory</li>
            <li>Enter the target player's details</li>
            <li>Send a trade request</li>
            <li>Wait for acceptance and commit to the trade</li>
            <li>Reveal your items after both parties commit</li>
            <li>Complete the trade if both parties agree</li>
          </ol>
        </div>
      </div>
    );
  }

  // If trade is active, show trade management interface
  return (
    <div className={styles.activeTradeInterface}>
      <h3>🔄 Active Trade</h3>
      
      {currentTrade && (
        <div className={styles.tradeDetails}>
          <div className={styles.tradeHeader}>
            <h4>Trading with: {currentTrade.targetPlayerName}</h4>
            <div className={styles.tradePhase}>
              Phase: <span className={styles.phaseLabel}>{tradeStatus.phase}</span>
            </div>
          </div>

          <div className={styles.tradeItems}>
            <div className={styles.yourItems}>
              <h5>Your Offer:</h5>
              <div className={styles.itemList}>
                {currentTrade.offeredItems.map(item => (
                  <div key={item.id} className={styles.tradeItem}>
                    <span className={styles.itemIcon}>{item.icon}</span>
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={`${styles.itemRarity} ${styles[item.rarity.toLowerCase()]}`}>
                      {item.rarity}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {currentTrade.requestedItems && currentTrade.requestedItems.length > 0 && (
              <div className={styles.requestedItems}>
                <h5>Requesting:</h5>
                <div className={styles.itemList}>
                  {currentTrade.requestedItems.map(item => (
                    <div key={item.id} className={styles.tradeItem}>
                      <span className={styles.itemIcon}>{item.icon}</span>
                      <span className={styles.itemName}>{item.name}</span>
                      <span className={`${styles.itemRarity} ${styles[item.rarity.toLowerCase()]}`}>
                        {item.rarity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Trade Actions based on phase */}
          <div className={styles.tradeActions}>
            {tradeStatus.phase === 'negotiating' && (
              <button 
                onClick={handleCommitTrade}
                className={styles.primaryButton}
              >
                Commit to Trade
              </button>
            )}

            {tradeStatus.phase === 'committed' && tradeStatus.canReveal && (
              <button 
                onClick={handleRevealTrade}
                className={styles.primaryButton}
              >
                Reveal Items
              </button>
            )}

            {tradeStatus.phase === 'revealed' && tradeStatus.isReady && (
              <button 
                onClick={handleCompleteTrade}
                className={styles.primaryButton}
              >
                Complete Trade
              </button>
            )}

            <button 
              onClick={handleCancelTrade}
              className={styles.dangerButton}
            >
              Cancel Trade
            </button>
          </div>

          {/* Trade Status Messages */}
          {tradeStatus.phase === 'committed' && !tradeStatus.canReveal && (
            <div className={styles.statusMessage}>
              ⏳ Waiting for partner to commit...
            </div>
          )}

          {tradeStatus.phase === 'revealed' && !tradeStatus.isReady && (
            <div className={styles.statusMessage}>
              ⏳ Waiting for partner to reveal...
            </div>
          )}
        </div>
      )}
    </div>
  );
};
