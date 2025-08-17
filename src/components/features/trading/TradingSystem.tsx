// Trading System Component - Full Implementation
import React, { useState } from 'react';
import { Card } from '../../ui/Card/Card';
import { useTrading } from '../../../hooks/useTrading';
import { useInventory } from '../../../hooks/useInventory';
import { PlayerSetup } from './PlayerSetup';
import { InventoryView } from './InventoryView';
import { TradeInterface } from './TradeInterface';
import { TradeRequests } from './TradeRequests';
import { TradeStatus } from './TradeStatus';
import styles from './TradingSystem.module.css';

/**
 * Main Trading System Component
 */
export const TradingSystem: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'trade' | 'requests'>('inventory');
  const { playerId, playerName, isTradeActive, getPendingRequestsCount } = useTrading();
  const { isEmpty } = useInventory();
  
  const pendingRequests = getPendingRequestsCount();
  const isPlayerSetup = playerId && playerName;

  return (
    <div className="trading-system">
      <Card
        title="Trading System"
        description="Secure item trading between players using commit-reveal protocol and VRF verification."
      >
        {!isPlayerSetup ? (
          <PlayerSetup />
        ) : (
          <div className={styles.tradingInterface}>
            {/* Trade Status Bar */}
            {isTradeActive && (
              <div className={styles.statusBar}>
                <TradeStatus />
              </div>
            )}
            
            {/* Navigation Tabs */}
            <div className={styles.tabNavigation}>
              <button 
                className={`${styles.tab} ${activeTab === 'inventory' ? styles.active : ''}`}
                onClick={() => setActiveTab('inventory')}
              >
                Inventory {isEmpty() && '(Empty)'}
              </button>
              <button 
                className={`${styles.tab} ${activeTab === 'trade' ? styles.active : ''}`}
                onClick={() => setActiveTab('trade')}
                disabled={isEmpty()}
              >
                Trade
              </button>
              <button 
                className={`${styles.tab} ${activeTab === 'requests' ? styles.active : ''}`}
                onClick={() => setActiveTab('requests')}
              >
                Requests {pendingRequests > 0 && `(${pendingRequests})`}
              </button>
            </div>
            
            {/* Tab Content */}
            <div className={styles.tabContent}>
              {activeTab === 'inventory' && <InventoryView />}
              {activeTab === 'trade' && <TradeInterface />}
              {activeTab === 'requests' && <TradeRequests />}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
