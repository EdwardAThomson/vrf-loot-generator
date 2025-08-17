import React, { useState, useEffect } from 'react';
import { useOnlineTrading } from '../../../hooks/useOnlineTrading';
import { usePlayerStore } from '../../../store/player.store';
import { useInventoryStore } from '../../../store/index';
import { LootItem } from '../../../types/loot.types';
import { LootItem as WebSocketLootItem } from '../../../types/websocket.types';
import { LootItem as LootItemComponent } from '../loot-generator/LootItem';
import { socketService } from '../../../services/websocket/socket.service';
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
    initiateTrade,
    cancelTrade,
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
    if (tradeTargetPlayer && selectedItems.length > 0) {
      // Convert inventory items to WebSocket format
      const tradeItems: WebSocketLootItem[] = selectedItems.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
        rarity: item.rarity as 'Common' | 'Rare' | 'Epic' | 'Legendary',
        modifier: item.modifier,
        vrfProof: item.vrfData ? {
          publicKey: item.vrfData.publicKey,
          proof: typeof item.vrfData.proof === 'string' ? item.vrfData.proof : 'demo-proof',
          message: item.vrfData.message,
          hash: 'demo-hash'
        } : {
          publicKey: 'demo-key',
          proof: 'demo-proof', 
          message: 'demo-message',
          hash: 'demo-hash'
        }
      }));
      
      initiateTrade(tradeTargetPlayer, tradeItems);
      setShowTradeModal(false);
      setSelectedItems([]);
      setTradeTargetPlayer(null);
    }
  };

  const handleCancelTrade = () => {
    setShowTradeModal(false);
    setSelectedItems([]);
    setTradeTargetPlayer(null);
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
            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              <strong>Room Players:</strong>
              {currentRoom.players.map((player, index) => (
                <div key={index}>
                  {player.name} (ID: {player.id})
                </div>
              ))}
            </div>
            <button onClick={leaveRoom}>Leave Room</button>
          </div>
        ) : (
          <div className={styles.roomControls}>
            <input
              type="text"
              placeholder="Room name"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
            />
            <button onClick={handleCreateRoom}>Create Room</button>
          </div>
        )}

        <div className={styles.roomList}>
          <h4>Available Rooms:</h4>
          <button onClick={refreshRoomList}>Refresh</button>
          {availableRooms.length === 0 ? (
            <p>No rooms available</p>
          ) : (
            availableRooms.map(room => (
              <div key={room.id} className={styles.roomItem}>
                <span>{room.name} ({room.players.length}/{room.maxPlayers})</span>
                <button 
                  onClick={() => joinRoom(room.id)}
                  disabled={room.players.length >= room.maxPlayers}
                >
                  Join
                </button>
              </div>
            ))
          )}
        </div>
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
                  <button 
                    onClick={() => handleOpenTradeModal(player.id)}
                    disabled={!canInitiateTrade || isTrading}
                  >
                    Trade
                  </button>
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
            <p>Status: {currentTrade.status}</p>
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
            {pendingTradeRequests.map(trade => (
              <div key={trade.id} className={styles.tradeRequest}>
                <p>Trade request from player</p>
                <p>Items offered: {trade.initiatorItems.length}</p>
                <button onClick={() => cancelTrade(trade.id)}>Decline</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trade Modal */}
      {showTradeModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Select Items to Trade</h3>
            <p>Choose items from your inventory to offer in trade:</p>
            
            <div className={styles.modalInventory}>
              {inventory.map(item => (
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
            
            <div className={styles.modalActions}>
              <p>Selected: {selectedItems.length} items</p>
              <div className={styles.buttonGroup}>
                <button 
                  onClick={handleSendTradeRequest}
                  disabled={selectedItems.length === 0}
                  className={styles.primaryButton}
                >
                  Send Trade Request
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
    </div>
  );
};
