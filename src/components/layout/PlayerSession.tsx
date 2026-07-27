import React, { useState, useEffect } from 'react';
import { usePlayerStore } from '../../store/player.store';
import { useWebSocket } from '../../hooks/useWebSocket';
import styles from './PlayerSession.module.css';

export const PlayerSession: React.FC = () => {
  const [inputName, setInputName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  
  const {
    playerName,
    isLoggedIn,
    login,
    logout,
    setCurrentPlayer
  } = usePlayerStore();

  const { 
    isConnected, 
    error, 
    connect, 
    disconnect 
  } = useWebSocket();

  // Auto-connect if we have a stored session but aren't connected
  useEffect(() => {
    if (isLoggedIn && playerName && !isConnected && !isConnecting) {
      setIsConnecting(true);
      connect(playerName)
        .then(() => {
          setIsConnecting(false);
        })
        .catch(() => {
          setIsConnecting(false);
        });
    }
    // Including 'connect' is safe: when its identity changes mid-connection
    // the guard above (isConnected / local isConnecting) prevents a second
    // connect attempt.
  }, [isLoggedIn, playerName, isConnected, isConnecting, connect]);

  const handleLogin = async () => {
    if (!inputName.trim()) return;
    
    setIsConnecting(true);
    try {
      await connect(inputName.trim());
      login(inputName.trim());
      setInputName('');
    } catch (error) {
      console.error('Failed to connect:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLogout = () => {
    disconnect();
    logout();
    setCurrentPlayer(null);
  };

  if (isLoggedIn && isConnected) {
    return (
      <div className={styles.sessionInfo}>
        <div className={styles.playerInfo}>
          <span className={styles.playerName}>👤 {playerName}</span>
          <span className={styles.status}>🟢 Online</span>
        </div>
        <button 
          onClick={handleLogout}
          className={styles.logoutButton}
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (isLoggedIn && isConnecting) {
    return (
      <div className={styles.sessionInfo}>
        <div className={styles.connecting}>
          <span>🔄 Reconnecting as {playerName}...</span>
          <button 
            onClick={handleLogout}
            className={styles.cancelButton}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.loginForm}>
      <div className={styles.inputGroup}>
        <input
          type="text"
          placeholder="Enter your player name"
          value={inputName}
          onChange={(e) => setInputName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          disabled={isConnecting}
          className={styles.nameInput}
        />
        <button 
          onClick={handleLogin}
          disabled={isConnecting || !inputName.trim()}
          className={styles.connectButton}
        >
          {isConnecting ? 'Connecting...' : 'Connect'}
        </button>
      </div>
      {error && (
        <div className={styles.error}>
          Connection failed: {error}
        </div>
      )}
    </div>
  );
};
