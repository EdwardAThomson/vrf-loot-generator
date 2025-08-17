// Trade Status Component for Trading System
import React from 'react';
import { useTrading } from '../../../hooks/useTrading';
import styles from './TradingSystem.module.css';

/**
 * Component for displaying current trade status and progress
 */
export const TradeStatus: React.FC = () => {
  const { 
    getTradeStatus, 
    getTradePartner, 
    validationErrors, 
    fairnessAssessment 
  } = useTrading();

  const status = getTradeStatus();
  const partner = getTradePartner();

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'negotiating': return '🤝';
      case 'committed': return '🔒';
      case 'revealed': return '👁️';
      case 'completed': return '✅';
      default: return '⏳';
    }
  };

  const getPhaseDescription = (phase: string) => {
    switch (phase) {
      case 'negotiating': return 'Negotiating trade terms';
      case 'committed': return 'Both parties committed';
      case 'revealed': return 'Items revealed';
      case 'completed': return 'Trade completed';
      default: return 'Processing...';
    }
  };

  return (
    <div className={styles.tradeStatus}>
      <div className={styles.statusHeader}>
        <div className={styles.phaseIndicator}>
          <span className={styles.phaseIcon}>{getPhaseIcon(status.phase)}</span>
          <span className={styles.phaseText}>{getPhaseDescription(status.phase)}</span>
        </div>
        
        {partner && (
          <div className={styles.partnerInfo}>
            Trading with: <strong>{partner.name}</strong>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className={styles.progressBar}>
        <div className={styles.progressTrack}>
          <div 
            className={styles.progressFill}
            style={{
              width: status.phase === 'negotiating' ? '25%' :
                     status.phase === 'committed' ? '50%' :
                     status.phase === 'revealed' ? '75%' :
                     status.phase === 'completed' ? '100%' : '0%'
            }}
          />
        </div>
        <div className={styles.progressSteps}>
          <span className={`${styles.step} ${status.phase !== 'negotiating' ? styles.completed : ''}`}>
            Negotiate
          </span>
          <span className={`${styles.step} ${['committed', 'revealed', 'completed'].includes(status.phase) ? styles.completed : ''}`}>
            Commit
          </span>
          <span className={`${styles.step} ${['revealed', 'completed'].includes(status.phase) ? styles.completed : ''}`}>
            Reveal
          </span>
          <span className={`${styles.step} ${status.phase === 'completed' ? styles.completed : ''}`}>
            Complete
          </span>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className={styles.validationErrors}>
          <h5>⚠️ Validation Issues:</h5>
          <ul>
            {validationErrors.map((error, index) => (
              <li key={index} className={styles.errorItem}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Fairness Assessment */}
      {fairnessAssessment && (
        <div className={`${styles.fairnessAssessment} ${fairnessAssessment.isFair ? styles.fair : styles.unfair}`}>
          <h5>⚖️ Trade Fairness:</h5>
          <div className={styles.fairnessDetails}>
            <div className={styles.valueComparison}>
              <span>Your Value: {fairnessAssessment.player1Value}</span>
              <span>Partner Value: {fairnessAssessment.player2Value}</span>
            </div>
            <div className={styles.fairnessResult}>
              {fairnessAssessment.isFair ? (
                <span className={styles.fairTrade}>✅ Fair Trade</span>
              ) : (
                <span className={styles.unfairTrade}>⚠️ Unbalanced Trade</span>
              )}
            </div>
            {fairnessAssessment.suggestion && (
              <div className={styles.suggestion}>
                💡 {fairnessAssessment.suggestion}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Messages */}
      <div className={styles.statusMessages}>
        {status.phase === 'committed' && !status.canReveal && (
          <div className={styles.waitingMessage}>
            ⏳ Waiting for partner to commit...
          </div>
        )}
        
        {status.phase === 'revealed' && !status.isReady && (
          <div className={styles.waitingMessage}>
            ⏳ Waiting for partner to reveal...
          </div>
        )}
        
        {status.isCompleted && (
          <div className={styles.completedMessage}>
            🎉 Trade completed successfully!
          </div>
        )}
      </div>
    </div>
  );
};
