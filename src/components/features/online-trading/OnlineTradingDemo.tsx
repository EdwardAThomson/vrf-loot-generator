import React, { useState, useEffect } from 'react';
import { useOnlineTrading } from '../../../hooks/useOnlineTrading';
import { usePlayerStore } from '../../../store/player.store';
import { useInventoryStore } from '../../../store/index';
import { LootItem } from '../../../types/loot.types';
import { LootItem as WebSocketLootItem } from '../../../types/websocket.types';
import { LootItem as LootItemComponent } from '../loot-generator/LootItem';
import { socketService } from '../../../services/websocket/socket.service';
import { CommitRevealService } from '../../../services/trading/commit-reveal.service';
import styles from './OnlineTradingDemo.module.css';

interface RoomPlayer {
  id: string;
  name: string;
}

interface TradingRoom {
  id: string;
  name: string;
  players: RoomPlayer[];
  maxPlayers: number;
}

export const OnlineTradingDemo: React.FC = () => {
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedItems, setSelectedItems] = useState<LootItem[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<RoomPlayer[]>([]);
  const [availableRooms, setAvailableRooms] = useState<TradingRoom[]>([]);
  const [currentRoom, setCurrentRoom] = useState<TradingRoom | null>(null);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeTargetPlayer, setTradeTargetPlayer] = useState<string | null>(null);
  const [showAcceptTradeModal, setShowAcceptTradeModal] = useState(false);
  const [acceptingTradeId, setAcceptingTradeId] = useState<string | null>(null);
  const [respondingItems, setRespondingItems] = useState<LootItem[]>([]);
  const [existingTradeItems, setExistingTradeItems] = useState<LootItem[]>([]);
  const [isModifyingTrade, setIsModifyingTrade] = useState(false);
  const [hasAcceptedTrade, setHasAcceptedTrade] = useState(false);
  const [showViewTradeModal, setShowViewTradeModal] = useState(false);
  const [viewingTradeId, setViewingTradeId] = useState<string | null>(null);

  const { playerName, isLoggedIn } = usePlayerStore();
  const { items: inventory } = useInventoryStore();
  
  // WebSocket connection status
  const isConnected = socketService.isConnected;
  const currentPlayer = isLoggedIn ? { id: playerName, name: playerName } : null;

  const {
    activeTrades,
    pendingTradeRequests,
    currentTrade,
    isTrading,
    tradeError,
    tradeLog,
    verificationResults,
    initiateTrade,
    commitToTrade,
    cancelTrade,
    clearTradeLog,
    hasActiveTrades,
    hasPendingRequests,
    canInitiateTrade
  } = useOnlineTrading();

  const handleCreateRoom = () => {
    if (newRoomName.trim()) {
      socketService.createRoom(newRoomName.trim(), false);
      setNewRoomName('');
    }
  };



  const leaveRoom = () => {
    socketService.leaveRoom();
    setCurrentRoom(null);
  };

  const joinRoom = (roomId: string) => {
    socketService.joinRoom(roomId);
  };

  const refreshRoomList = () => {
    socketService.requestRoomList();
  };

  const refreshPlayerList = () => {
    socketService.requestPlayerList();
  };

  // WebSocket event listeners
  useEffect(() => {
    if (!isConnected) return;

    // Player events
    const handlePlayerList = (players: RoomPlayer[]) => {
      setOnlinePlayers(players);
    };

    const handlePlayerJoined = (player: RoomPlayer) => {
      setOnlinePlayers(prev => {
        if (prev.find(p => p.id === player.id)) {
          return prev;
        }
        return [...prev, player];
      });
    };

    const handlePlayerLeft = (playerId: string) => {
      setOnlinePlayers(prev => prev.filter(p => p.id !== playerId));
    };

    // Room events
    const handleRoomList = (rooms: TradingRoom[]) => {
      setAvailableRooms(rooms);
      setCurrentRoom(prevRoom => {
        if (!prevRoom) return null;
        const updatedRoom = rooms.find(r => r.id === prevRoom.id);
        return updatedRoom || null;
      });
    };

    const handleRoomJoined = (room: TradingRoom) => {
      setCurrentRoom(room);
    };

    const handleRoomLeft = () => {
      setCurrentRoom(null);
    };

    // Register event listeners
    socketService.on('player:list', handlePlayerList);
    socketService.on('player:joined', handlePlayerJoined);
    socketService.on('player:left', handlePlayerLeft);
    socketService.on('room:list', handleRoomList);
    socketService.on('room:joined', handleRoomJoined);
    socketService.on('room:left', handleRoomLeft);

    // Initial data fetch
    refreshPlayerList();
    refreshRoomList();

    // Cleanup
    return () => {
      socketService.off('player:list', handlePlayerList);
      socketService.off('player:joined', handlePlayerJoined);
      socketService.off('player:left', handlePlayerLeft);
      socketService.off('room:list', handleRoomList);
      socketService.off('room:joined', handleRoomJoined);
      socketService.off('room:left', handleRoomLeft);
    };
  }, [isConnected]);

  const handleOpenTradeModal = (targetPlayerId: string) => {
    setTradeTargetPlayer(targetPlayerId);
    setShowTradeModal(true);
    setSelectedItems([]);
  };

  const handleItemSelection = (item: LootItem) => {
    setSelectedItems(prev => {
      const isSelected = prev.some(selected => selected.id === item.id);
      if (isSelected) {
        return prev.filter(selected => selected.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const handleSendTradeRequest = () => {
    // Combine existing trade items with newly selected items
    const allOfferedItems = isModifyingTrade 
      ? [...existingTradeItems, ...selectedItems]
      : selectedItems;
      
    if (tradeTargetPlayer && allOfferedItems.length > 0) {
      // Convert inventory items to WebSocket format with proper VRF data
      const tradeItems: WebSocketLootItem[] = allOfferedItems.map(item => {
        // Convert proof to string if it's Uint8Array
        let proofString = '';
        if (item.vrfData?.proof) {
          if (typeof item.vrfData.proof === 'string') {
            proofString = item.vrfData.proof;
          } else {
            proofString = Array.from(item.vrfData.proof)
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
          }
        }
        
        // Convert vrfOutput to string if it's Uint8Array
        let vrfOutputString = '';
        if (item.vrfData?.vrfOutput) {
          if (typeof item.vrfData.vrfOutput === 'string') {
            vrfOutputString = item.vrfData.vrfOutput;
          } else {
            vrfOutputString = Array.from(item.vrfData.vrfOutput)
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
          }
        }
        
        return {
          id: item.id,
          name: item.name,
          type: item.type,
          rarity: item.rarity as 'Common' | 'Rare' | 'Epic' | 'Legendary',
          modifier: item.modifier,
          vrfProof: item.vrfData ? {
            publicKey: item.vrfData.publicKey,
            proof: proofString,
            message: item.vrfData.message,
            hash: vrfOutputString,
            blockhash: item.vrfData.blockhash,
            itemIndex: item.vrfData.itemIndex
          } : {
            publicKey: '',
            proof: '',
            message: '',
            hash: ''
          }
        };
      });
      
      // If we're modifying an existing trade, cancel it first
      if (acceptingTradeId) {
        cancelTrade(acceptingTradeId);
      }
      
      initiateTrade(tradeTargetPlayer, tradeItems);
      
      // Store items for later commit/reveal when Player 2 responds
      sessionStorage.setItem(`pending_trade_items`, JSON.stringify(tradeItems));
      
      setShowTradeModal(false);
      setSelectedItems([]);
      setTradeTargetPlayer(null);
      setAcceptingTradeId(null);
      setExistingTradeItems([]);
      setIsModifyingTrade(false);
    }
  };

  const handleCancelTrade = () => {
    setShowTradeModal(false);
    setSelectedItems([]);
    setTradeTargetPlayer(null);
    setAcceptingTradeId(null);
    setExistingTradeItems([]);
    setIsModifyingTrade(false);
  };

  const handleOpenAcceptTradeModal = (tradeId: string) => {
    setAcceptingTradeId(tradeId);
    setShowAcceptTradeModal(true);
    setRespondingItems([]);
    setHasAcceptedTrade(false);
  };

  const handleRespondingItemSelection = (item: LootItem) => {
    setRespondingItems(prev => {
      const isSelected = prev.some(selected => selected.id === item.id);
      if (isSelected) {
        return prev.filter(selected => selected.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const handleAcceptTrade = () => {
    if (acceptingTradeId && !hasAcceptedTrade) {
      // First acceptance - show the full trading interface
      setHasAcceptedTrade(true);
    } else if (acceptingTradeId && hasAcceptedTrade && respondingItems.length > 0) {
      // Convert responding items to WebSocket format with proper VRF data
      const tradeItems: WebSocketLootItem[] = respondingItems.map(item => {
        // Convert proof to string if it's Uint8Array
        let proofString = '';
        if (item.vrfData?.proof) {
          if (typeof item.vrfData.proof === 'string') {
            proofString = item.vrfData.proof;
          } else {
            // Convert Uint8Array to hex string
            proofString = Array.from(item.vrfData.proof)
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
          }
        }
        
        // Convert vrfOutput to string if it's Uint8Array
        let vrfOutputString = '';
        if (item.vrfData?.vrfOutput) {
          if (typeof item.vrfData.vrfOutput === 'string') {
            vrfOutputString = item.vrfData.vrfOutput;
          } else {
            // Convert Uint8Array to hex string
            vrfOutputString = Array.from(item.vrfData.vrfOutput)
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');
          }
        }
        
        return {
          id: item.id,
          name: item.name,
          type: item.type,
          rarity: item.rarity as 'Common' | 'Rare' | 'Epic' | 'Legendary',
          modifier: item.modifier,
          vrfProof: item.vrfData ? {
            publicKey: item.vrfData.publicKey,
            proof: proofString,
            message: item.vrfData.message,
            hash: vrfOutputString,
            blockhash: item.vrfData.blockhash,
            itemIndex: item.vrfData.itemIndex
          } : {
            publicKey: '',
            proof: '',
            message: '',
            hash: ''
          }
        };
      });
      
      // Send counter-offer by committing to trade (canonical commitment hash)
      const itemsString = JSON.stringify(tradeItems);
      const nonce = CommitRevealService.generateNonce();
      const commitment = CommitRevealService.computeCommitmentHash(tradeItems, nonce);
      
      // Store nonce and items for later reveal
      sessionStorage.setItem(`trade_nonce_${acceptingTradeId}`, nonce);
      sessionStorage.setItem(`trade_items_${acceptingTradeId}`, itemsString);
      
      console.log(`Player 2 committing to trade ${acceptingTradeId} with ${tradeItems.length} items`);
      
      // Commit to trade (this sends the counter-offer)
      commitToTrade(acceptingTradeId, commitment);
      
      // Close modal and reset state
      setShowAcceptTradeModal(false);
      setRespondingItems([]);
      setAcceptingTradeId(null);
      setHasAcceptedTrade(false);
    }
  };

  const handleCancelAcceptTrade = () => {
    setShowAcceptTradeModal(false);
    setRespondingItems([]);
    setAcceptingTradeId(null);
    setHasAcceptedTrade(false);
  };

  const handleModifyTrade = (tradeId: string) => {
    // Find the trade and set up modify mode
    const trade = pendingTradeRequests.find(t => t.id === tradeId);
    if (trade) {
      // Store the trade ID we're modifying
      setAcceptingTradeId(tradeId);
      setTradeTargetPlayer(trade.targetId);
      setShowTradeModal(true);
      setIsModifyingTrade(true);
      
      // Convert trade items back to inventory items for display
      const existingItems = inventory.filter(item => 
        trade.initiatorItems.some(tradeItem => tradeItem.id === item.id)
      );
      setExistingTradeItems(existingItems);
      
      // Start with no new selections (user can add to existing offer)
      setSelectedItems([]);
    }
  };

  const handleViewTrade = (tradeId: string) => {
    setViewingTradeId(tradeId);
    setShowViewTradeModal(true);
  };

  const handleCloseViewTrade = () => {
    setShowViewTradeModal(false);
    setViewingTradeId(null);
  };

  // Show message if not logged in
  if (!isLoggedIn || !isConnected) {
    return (
      <div className={styles.container}>
        <h2>Online Trading Demo</h2>
        <div className={styles.section}>
          <p>Please connect using the player session above to access online trading features.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2>Trading System</h2>
      <p>Secure item trading between players using commit-reveal protocol and VRF verification.</p>
      
      {/* Connection Status */}
      <div className={styles.section}>
        <h3>Connection Status</h3>
        <div className={styles.status}>
          Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
        {currentPlayer && (
          <div className={styles.playerInfo}>
            <p>Playing as: <strong>{currentPlayer.name}</strong></p>
          </div>
        )}
      </div>

      {/* Inventory Section */}
      <div className={styles.section}>
        <h3>Your Inventory ({inventory.length} items)</h3>
        {inventory.length === 0 ? (
          <p>No items in inventory. Generate some loot items first!</p>
        ) : (
          <div className={styles.inventoryGrid}>
            {inventory.map(item => (
              <LootItemComponent
                key={item.id}
                item={item}
                publicKey={playerName || ''}
                showVerification={false}
                selectable={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* Room Management */}
      <div className={styles.section}>
        <h3>Rooms</h3>
        
        {currentRoom ? (
          <div className={styles.currentRoom}>
            <p>Current Room: <strong>{currentRoom.name}</strong></p>
            <p>Players: {currentRoom.players.length}/{currentRoom.maxPlayers}</p>
            <div className={styles.roomPlayerList}>
              <strong>Room Players:</strong>
              {currentRoom.players.map(player => (
                <div key={player.id} className={styles.roomPlayerItem}>
                  <span>
                    {player.name}
                    {player.name === playerName && ' (You)'}
                  </span>
                  {player.name !== playerName && (
                    <button
                      onClick={() => handleOpenTradeModal(player.id)}
                      disabled={!canInitiateTrade || isTrading}
                      className={styles.tradeButton}
                    >
                      Trade
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={leaveRoom} className={styles.leaveButton}>Leave Room</button>
          </div>
        ) : (
          <div className={styles.roomControls}>
            <div className={styles.roomList}>
              <h4>Available Rooms:</h4>
              <button onClick={refreshRoomList}>Refresh</button>
              {availableRooms.length === 0 ? (
                <p>No rooms available</p>
              ) : (
                availableRooms.map((room: TradingRoom) => (
                  <div key={room.id} className={styles.roomItem}>
                    <span>{room.name} ({room.players.length}/{room.maxPlayers})</span>
                    {room.players.some(p => p.id === currentPlayer?.id) ? (
                      <span className={styles.currentRoomTag}>Current</span>
                    ) : (
                      <button 
                        onClick={() => joinRoom(room.id)}
                        disabled={currentRoom !== null || room.players.length >= room.maxPlayers}
                      >
                        Join
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className={styles.createRoom}>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Or create a new room..."
                disabled={currentRoom !== null}
              />
              <button onClick={handleCreateRoom} disabled={currentRoom !== null || !newRoomName.trim()}>
                Create Room
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Player List */}
      <div className={styles.section}>
        <h3>Online Players ({onlinePlayers.length} total)</h3>
        <button onClick={refreshPlayerList}>Refresh</button>
        
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
          <strong>All Online Players (Debug):</strong>
          {onlinePlayers.map((player, index) => (
            <div key={index}>
              {player.name} (ID: {player.id}) {player.id === currentPlayer?.id || player.name === playerName ? '[YOU]' : ''}
            </div>
          ))}
        </div>
        
        {onlinePlayers.length === 0 ? (
          <p>No other players online</p>
        ) : (
          <div className={styles.playerList}>
            {onlinePlayers
              .filter(player => 
                player.id !== currentPlayer?.id && 
                player.name !== currentPlayer?.name &&
                player.id !== playerName &&
                player.name !== playerName
              )
              .map(player => (
                <div key={player.id} className={styles.playerItem}>
                  <span>{player.name} (ID: {player.id})</span>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* Trading Status */}
      <div className={styles.section}>
        <h3>Trading</h3>
        
        {tradeError && (
          <div className={styles.error}>Error: {tradeError}</div>
        )}
        
        {isTrading && currentTrade && (
          <div className={styles.currentTrade}>
            <h4>Current Trade</h4>
            <p>Trading with: {currentTrade.initiatorId === currentPlayer?.id ? currentTrade.targetId : currentTrade.initiatorId}</p>
            <p>Status: <strong>{currentTrade.status}</strong></p>
            
            {/* Status explanation */}
            <div className={styles.statusExplanation}>
              {currentTrade.status === 'INITIATED' && (
                <p>⏳ Waiting for both players to commit their offers...</p>
              )}
              {currentTrade.status === 'COMMITTED' && (
                <p>🔒 Both players committed. Waiting for reveals...</p>
              )}
              {currentTrade.status === 'REVEALED' && (
                <p>✅ Both players revealed. Ready to complete trade!</p>
              )}
            </div>
            
            {/* Trade details */}
            <div className={styles.tradeProgress}>
              <h5>Initiator's Offer ({currentTrade.initiatorItems.length} items)</h5>
              <div className={styles.miniItemList}>
                {currentTrade.initiatorItems.map((item, idx) => (
                  <span key={idx} className={styles[item.rarity.toLowerCase()]}>
                    {item.name}
                  </span>
                ))}
              </div>
              
              {currentTrade.targetItems && currentTrade.targetItems.length > 0 && (
                <>
                  <h5>Target's Offer ({currentTrade.targetItems.length} items)</h5>
                  <div className={styles.miniItemList}>
                    {currentTrade.targetItems.map((item, idx) => (
                      <span key={idx} className={styles[item.rarity.toLowerCase()]}>
                        {item.name}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
            
            <button onClick={() => cancelTrade(currentTrade.id)}>Cancel Trade</button>
          </div>
        )}
        
        {hasActiveTrades && (
          <div className={styles.activeTrades}>
            <h4>Active Trades ({activeTrades.length})</h4>
            {activeTrades.map(trade => (
              <div key={trade.id} className={styles.tradeItem}>
                <p>Trade ID: {trade.id}</p>
                <p>Status: {trade.status}</p>
                <button onClick={() => cancelTrade(trade.id)}>Cancel</button>
              </div>
            ))}
          </div>
        )}
        
        {hasPendingRequests && (
          <div className={styles.pendingRequests}>
            <h4>Pending Trade Requests ({pendingTradeRequests.length})</h4>
            {pendingTradeRequests.map(trade => {
              // Check if current player is the initiator of this trade
              // Find the actual UUID for the current player
              const myPlayerRecord = onlinePlayers.find(p => p.name === playerName);
              const myPlayerId = myPlayerRecord?.id;
              const isMyTrade = trade.initiatorId === myPlayerId;
              // Get the other player's info
              const otherPlayerId = isMyTrade ? trade.targetId : trade.initiatorId;
              const otherPlayerName = onlinePlayers.find(p => p.id === otherPlayerId)?.name || otherPlayerId;
              
              return (
                <div key={trade.id} className={styles.tradeRequest}>
                  <p>Trade request {isMyTrade ? 'to' : 'from'} player: <strong>{otherPlayerName}</strong></p>
                  <p>Items offered: {trade.initiatorItems.length}</p>
                  
                  <div className={styles.tradeActions}>
                    {isMyTrade ? (
                      <>
                        <button 
                          onClick={() => handleViewTrade(trade.id)}
                          className={styles.viewButton}
                        >
                          View
                        </button>
                        <button 
                          onClick={() => handleModifyTrade(trade.id)}
                          className={styles.modifyButton}
                        >
                          Modify
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleViewTrade(trade.id)}
                          className={styles.viewButton}
                        >
                          View
                        </button>
                        <button 
                          onClick={() => handleOpenAcceptTradeModal(trade.id)}
                          className={styles.acceptButton}
                        >
                          Accept
                        </button>
                      </>
                    )}
                    <button onClick={() => cancelTrade(trade.id)} className={styles.declineButton}>
                      {isMyTrade ? 'Cancel' : 'Decline'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Execution Log Panel */}
      <div className={styles.section}>
        <h3>📋 Trade Execution Log</h3>
        <div className={styles.logControls}>
          <button onClick={clearTradeLog} className={styles.clearLogButton}>
            Clear Log
          </button>
        </div>
        <div className={styles.executionLog}>
          {tradeLog.length === 0 ? (
            <p className={styles.emptyLog}>No trade activity yet. Initiate a trade to see the execution log.</p>
          ) : (
            tradeLog.map((entry, index) => (
              <div 
                key={index} 
                className={`${styles.logEntry} ${styles[entry.type]}`}
              >
                <span className={styles.logTimestamp}>[{entry.timestamp}]</span>
                <span className={styles.logMessage}>{entry.message}</span>
              </div>
            ))
          )}
        </div>
        
        {/* VRF Verification Results */}
        {verificationResults.length > 0 && (
          <div className={styles.verificationResults}>
            <h4>VRF Verification Results</h4>
            {verificationResults.map((result, index) => (
              <div 
                key={index} 
                className={`${styles.verificationItem} ${result.valid ? styles.valid : styles.invalid}`}
              >
                <span className={styles.verificationIcon}>
                  {result.valid ? '✅' : '❌'}
                </span>
                <span className={styles.verificationName}>{result.itemName}</span>
                {!result.valid && result.reason && (
                  <span className={styles.verificationReason}>{result.reason}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trade Modal */}
      {showTradeModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.tradeModal}>
            <h3>{isModifyingTrade ? 'Modify Trade Offer' : 'Create Trade Offer'}</h3>
            
            <div className={styles.tradeModalContent}>
              {/* Left Side - Inventory */}
              <div className={styles.inventorySection}>
                <h4>Your Inventory</h4>
                <p>Click items to add to your offer:</p>
                <div className={styles.modalInventory}>
                  {inventory
                    .filter(item => !existingTradeItems.some(existing => existing.id === item.id))
                    .map(item => (
                    <LootItemComponent
                      key={item.id}
                      item={item}
                      publicKey={playerName || ''}
                      showVerification={false}
                      selectable={true}
                      selected={selectedItems.some(selected => selected.id === item.id)}
                      onSelect={handleItemSelection}
                    />
                  ))}
                </div>
              </div>
              
              {/* Right Side - Current Offer */}
              <div className={styles.offerSection}>
                <h4>Your Trade Offer</h4>
                
                {/* Existing items (if modifying) */}
                {isModifyingTrade && existingTradeItems.length > 0 && (
                  <div className={styles.existingOffer}>
                    <h5>Currently Offered:</h5>
                    <div className={styles.existingItems}>
                      {existingTradeItems.map(item => (
                        <div key={item.id} className={styles.existingTradeItem}>
                          <LootItemComponent
                            item={item}
                            publicKey={playerName || ''}
                            showVerification={false}
                            selectable={false}
                          />
                          <div className={styles.existingLabel}>Already in trade</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* New selections */}
                <div className={styles.newOffer}>
                  <h5>{isModifyingTrade ? 'Adding to Offer:' : 'Selected Items:'}</h5>
                  {selectedItems.length === 0 ? (
                    <p className={styles.emptyOffer}>No {isModifyingTrade ? 'additional ' : ''}items selected</p>
                  ) : (
                    <div className={styles.selectedItems}>
                      {selectedItems.map(item => (
                        <LootItemComponent
                          key={item.id}
                          item={item}
                          publicKey={playerName || ''}
                          showVerification={false}
                          selectable={true}
                          selected={true}
                          onSelect={handleItemSelection}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className={styles.modalActions}>
              <div className={styles.offerSummary}>
                <p>
                  Total offer: {existingTradeItems.length + selectedItems.length} items
                  {isModifyingTrade && (
                    <span> ({existingTradeItems.length} existing + {selectedItems.length} new)</span>
                  )}
                </p>
              </div>
              <div className={styles.buttonGroup}>
                <button 
                  onClick={handleSendTradeRequest}
                  disabled={!isModifyingTrade && selectedItems.length === 0}
                  className={styles.primaryButton}
                >
                  {isModifyingTrade ? 'Update Trade' : 'Send Trade Request'}
                </button>
                <button 
                  onClick={handleCancelTrade}
                  className={styles.secondaryButton}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accept Trade Modal */}
      {showAcceptTradeModal && acceptingTradeId && (
        <div className={styles.modalOverlay}>
          {!hasAcceptedTrade ? (
            /* Initial Accept/Decline Dialog */
            <div className={styles.modal}>
              <h3>Trade Request</h3>
              <p>You have received a trade request. Would you like to proceed to the trading interface?</p>
              <p><em>You'll be able to view their offer and select your own items once you proceed.</em></p>
              
              <div className={styles.modalActions}>
                <div className={styles.buttonGroup}>
                  <button 
                    onClick={handleAcceptTrade}
                    className={styles.primaryButton}
                  >
                    Proceed to Trade
                  </button>
                  <button 
                    onClick={handleCancelAcceptTrade}
                    className={styles.secondaryButton}
                  >
                    Decline
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Full Trading Interface */
            <div className={styles.tradeModal}>
              <h3>Trade Interface</h3>
              
              <div className={styles.tradeModalContent}>
                {/* Left Side - Your Inventory */}
                <div className={styles.inventorySection}>
                  <h4>Your Inventory</h4>
                  <p>Click items to add to your offer:</p>
                  <div className={styles.modalInventory}>
                    {inventory.map(item => (
                      <LootItemComponent
                        key={item.id}
                        item={item}
                        publicKey={playerName || ''}
                        showVerification={false}
                        selectable={true}
                        selected={respondingItems.some(selected => selected.id === item.id)}
                        onSelect={handleRespondingItemSelection}
                      />
                    ))}
                  </div>
                </div>
                
                {/* Middle - Your Offer */}
                <div className={styles.offerSection}>
                  <h4>Your Offer</h4>
                  <div className={styles.newOffer}>
                    <h5>Selected Items:</h5>
                    {respondingItems.length === 0 ? (
                      <p className={styles.emptyOffer}>No items selected</p>
                    ) : (
                      <div className={styles.selectedItems}>
                        {respondingItems.map(item => (
                          <LootItemComponent
                            key={item.id}
                            item={item}
                            publicKey={playerName || ''}
                            showVerification={false}
                            selectable={true}
                            selected={true}
                            onSelect={handleRespondingItemSelection}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Right Side - Their Offer */}
                <div className={styles.theirOfferSection}>
                  <h4>Their Offer</h4>
                  {(() => {
                    const trade = pendingTradeRequests.find(t => t.id === acceptingTradeId);
                    return trade ? (
                      <div className={styles.theirItems}>
                        <h5>They are offering:</h5>
                        <div className={styles.offeredItemsGrid}>
                          {trade.initiatorItems.map((item, index) => (
                            <div key={index} className={styles.tradeItemCard}>
                              <div className={`${styles.itemName} ${styles[item.rarity.toLowerCase()]}`}>
                                {item.name}
                              </div>
                              <div className={styles.itemDetails}>
                                <span className={styles.itemRarity}>{item.rarity}</span>
                                <span className={styles.itemType}>{item.type}</span>
                                {item.modifier && (
                                  <span className={styles.itemModifier}>{item.modifier}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
              
              <div className={styles.modalActions}>
                <div className={styles.offerSummary}>
                  <p>Your offer: {respondingItems.length} items</p>
                </div>
                <div className={styles.buttonGroup}>
                  <button 
                    onClick={handleAcceptTrade}
                    disabled={respondingItems.length === 0}
                    className={styles.primaryButton}
                  >
                    Confirm Trade
                  </button>
                  <button 
                    onClick={handleCancelAcceptTrade}
                    className={styles.secondaryButton}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Trade Modal */}
      {showViewTradeModal && viewingTradeId && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Trade Details</h3>
            {(() => {
              const trade = pendingTradeRequests.find(t => t.id === viewingTradeId);
              if (!trade) return <p>Trade not found</p>;
              
              const myPlayerRecord = onlinePlayers.find(p => p.name === playerName);
              const myPlayerId = myPlayerRecord?.id;
              const isMyTrade = trade.initiatorId === myPlayerId;
              const otherPlayerId = isMyTrade ? trade.targetId : trade.initiatorId;
              const otherPlayerName = onlinePlayers.find(p => p.id === otherPlayerId)?.name || otherPlayerId;
              
              return (
                <>
                  <p>Trade with: <strong>{otherPlayerName}</strong></p>
                  <p>Status: <strong>{trade.status}</strong></p>
                  
                  <div className={styles.tradeDetails}>
                    <h4>{isMyTrade ? 'Your Offer' : 'Their Offer'}</h4>
                    <div className={styles.offeredItemsGrid}>
                      {trade.initiatorItems.map((item, index) => (
                        <div key={index} className={styles.tradeItemCard}>
                          <div className={`${styles.itemName} ${styles[item.rarity.toLowerCase()]}`}>
                            {item.name}
                          </div>
                          <div className={styles.itemDetails}>
                            <span className={styles.itemRarity}>{item.rarity}</span>
                            <span className={styles.itemType}>{item.type}</span>
                            {item.modifier && (
                              <span className={styles.itemModifier}>{item.modifier}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {trade.targetItems && trade.targetItems.length > 0 && (
                    <div className={styles.tradeDetails}>
                      <h4>{isMyTrade ? 'Their Offer' : 'Your Offer'}</h4>
                      <div className={styles.offeredItemsGrid}>
                        {trade.targetItems.map((item, index) => (
                          <div key={index} className={styles.tradeItemCard}>
                            <div className={`${styles.itemName} ${styles[item.rarity.toLowerCase()]}`}>
                              {item.name}
                            </div>
                            <div className={styles.itemDetails}>
                              <span className={styles.itemRarity}>{item.rarity}</span>
                              <span className={styles.itemType}>{item.type}</span>
                              {item.modifier && (
                                <span className={styles.itemModifier}>{item.modifier}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className={styles.modalActions}>
                    <div className={styles.buttonGroup}>
                      <button 
                        onClick={handleCloseViewTrade}
                        className={styles.secondaryButton}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
