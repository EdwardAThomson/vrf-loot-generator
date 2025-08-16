// Trading System Component - Placeholder for Phase 3
import React from 'react';
import { Card } from '../../ui/Card/Card.js';
import styles from './TradingSystem.module.css';

/**
 * Trading System tab component - will be implemented in Phase 3
 */
export const TradingSystem = () => {
  return (
    <div className="trading-system">
      <Card
        title="Trading System"
        description="Secure item trading between players using commit-reveal protocol and VRF verification."
      >
        <div className={styles.comingSoon}>
          <h3>🚧 Coming Soon</h3>
          <p>
            The trading system will be implemented in Phase 3 with:
          </p>
          <ul>
            <li>WebSocket backend for cross-browser communication</li>
            <li>Real-time player presence</li>
            <li>Secure commit-reveal trading protocol</li>
            <li>VRF verification of traded items</li>
            <li>Inventory management</li>
          </ul>
          
          <p className="text-muted mt-3">
            For now, use the Loot Generator to create items that will be tradeable once the system is complete.
          </p>
        </div>
      </Card>
    </div>
  );
};
