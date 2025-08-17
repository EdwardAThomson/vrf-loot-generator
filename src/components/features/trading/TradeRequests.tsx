// Trade Requests Component for Trading System
import React from 'react';
import { useTrading } from '../../../hooks/useTrading';
import styles from './TradingSystem.module.css';

/**
 * Component for viewing and managing incoming trade requests
 */
export const TradeRequests: React.FC = () => {
  const { 
    tradeRequests, 
    acceptTrade, 
    rejectTrade, 
    clearTradeRequests 
  } = useTrading();

  const handleAccept = (tradeId: number) => {
    acceptTrade(tradeId);
  };

  const handleReject = (tradeId: number) => {
    rejectTrade(tradeId);
  };

  if (tradeRequests.length === 0) {
    return (
      <div className={styles.emptyRequests}>
        <h3>📬 Trade Requests</h3>
        <p>No pending trade requests.</p>
        <div className={styles.requestsInfo}>
          <h4>💡 How to receive trade requests:</h4>
          <ul>
            <li>Share your Player ID with other players</li>
            <li>They can send you trade requests using your ID</li>
            <li>Accept or reject requests as they come in</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tradeRequests}>
      <div className={styles.requestsHeader}>
        <h3>📬 Trade Requests ({tradeRequests.length})</h3>
        {tradeRequests.length > 1 && (
          <button 
            onClick={clearTradeRequests}
            className={styles.secondaryButton}
          >
            Clear All
          </button>
        )}
      </div>

      <div className={styles.requestsList}>
        {tradeRequests.map((request) => (
          <div key={request.id} className={styles.tradeRequest}>
            <div className={styles.requestHeader}>
              <div className={styles.playerInfo}>
                <h4>{request.initiatorPlayerName}</h4>
                <span className={styles.playerId}>ID: {request.initiatorPlayerId}</span>
              </div>
              <div className={styles.requestTime}>
                {new Date(request.timestamp).toLocaleTimeString()}
              </div>
            </div>

            <div className={styles.requestDetails}>
              <div className={styles.offeredItems}>
                <h5>Offering ({request.offeredItems.length} items):</h5>
                <div className={styles.itemList}>
                  {request.offeredItems.map(item => (
                    <div key={item.id} className={styles.requestItem}>
                      <span className={styles.itemIcon}>{item.icon}</span>
                      <span className={styles.itemName}>{item.name}</span>
                      <span className={`${styles.itemRarity} ${styles[item.rarity.toLowerCase()]}`}>
                        {item.rarity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {request.requestedItems && request.requestedItems.length > 0 && (
                <div className={styles.requestedItems}>
                  <h5>Requesting ({request.requestedItems.length} items):</h5>
                  <div className={styles.itemList}>
                    {request.requestedItems.map(item => (
                      <div key={item.id} className={styles.requestItem}>
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

            <div className={styles.requestActions}>
              <button 
                onClick={() => handleAccept(request.id)}
                className={styles.primaryButton}
              >
                ✅ Accept
              </button>
              <button 
                onClick={() => handleReject(request.id)}
                className={styles.dangerButton}
              >
                ❌ Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
