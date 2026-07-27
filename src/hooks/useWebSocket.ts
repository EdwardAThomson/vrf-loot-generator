import { useState, useEffect, useCallback, useRef } from 'react';
import { socketService } from '../services/websocket/socket.service';
import { usePlayerStore } from '../store/player.store';
import { 
  Player, 
  TradingRoom, 
  WebSocketState 
} from '../types/websocket.types';

export const useWebSocket = () => {
  const { setCurrentPlayer } = usePlayerStore();
  
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    currentPlayer: null,
    currentRoom: null,
    onlinePlayers: [],
    availableRooms: [],
    activeTrades: []
  });

  const eventListenersRef = useRef<Map<string, Function>>(new Map());

  // Connection methods
  const connect = useCallback(async (playerName: string) => {
    if (state.isConnected || state.isConnecting) return;

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      await socketService.connect(playerName);
      setState(prev => ({ ...prev, isConnected: true, isConnecting: false }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      }));
    }
  }, [state.isConnected, state.isConnecting]);

  const disconnect = useCallback(() => {
    socketService.disconnect();
    setCurrentPlayer(null); // Clear global store
    setState({
      isConnected: false,
      isConnecting: false,
      error: null,
      currentPlayer: null,
      currentRoom: null,
      onlinePlayers: [],
      availableRooms: [],
      activeTrades: []
    });
  }, [setCurrentPlayer]);

  // Room methods
  const joinRoom = useCallback((roomId: string) => {
    if (!state.isConnected) return;
    socketService.joinRoom(roomId);
  }, [state.isConnected]);

  const leaveRoom = useCallback(() => {
    if (!state.isConnected) return;
    socketService.leaveRoom();
  }, [state.isConnected]);

  const createRoom = useCallback((roomName: string, isPrivate: boolean = false) => {
    if (!state.isConnected) return;
    socketService.createRoom(roomName, isPrivate);
  }, [state.isConnected]);

  const refreshPlayerList = useCallback(() => {
    if (!state.isConnected) return;
    socketService.requestPlayerList();
  }, [state.isConnected]);

  const refreshRoomList = useCallback(() => {
    if (!state.isConnected) return;
    socketService.requestRoomList();
  }, [state.isConnected]);

  // Setup event listeners
  useEffect(() => {
    const listeners = new Map<string, Function>();

    // Player events
    const onPlayerJoined = (player: Player) => {
      setState(prev => {
        // If this is our player, set as current
        if (socketService.isConnected && player.name) {
          setCurrentPlayer(player); // Update global store
          return { ...prev, currentPlayer: player };
        }
        
        // Add to online players if not already there
        const existingIndex = prev.onlinePlayers.findIndex(p => p.id === player.id);
        const updatedPlayers = existingIndex >= 0 
          ? prev.onlinePlayers.map((p, i) => i === existingIndex ? player : p)
          : [...prev.onlinePlayers, player];
        
        return { ...prev, onlinePlayers: updatedPlayers };
      });
    };

    const onPlayerLeft = (playerId: string) => {
      setState(prev => ({
        ...prev,
        onlinePlayers: prev.onlinePlayers.filter(p => p.id !== playerId)
      }));
    };

    const onPlayerList = (players: Player[]) => {
      setState(prev => ({ ...prev, onlinePlayers: players }));
    };

    // Room events
    const onRoomJoined = (room: TradingRoom) => {
      setState(prev => ({ ...prev, currentRoom: room }));
    };

    const onRoomLeft = (roomId: string) => {
      setState(prev => ({ 
        ...prev, 
        currentRoom: prev.currentRoom?.id === roomId ? null : prev.currentRoom 
      }));
    };

    const onRoomList = (rooms: TradingRoom[]) => {
      setState(prev => ({ ...prev, availableRooms: rooms }));
    };

    // Error handling
    const onError = (message: string) => {
      setState(prev => ({ ...prev, error: message }));
    };

    const onDisconnected = (reason: string) => {
      setState(prev => ({ 
        ...prev, 
        isConnected: false, 
        error: `Disconnected: ${reason}` 
      }));
    };

    // Register listeners
    listeners.set('player:joined', onPlayerJoined);
    listeners.set('player:left', onPlayerLeft);
    listeners.set('player:list', onPlayerList);
    listeners.set('room:joined', onRoomJoined);
    listeners.set('room:left', onRoomLeft);
    listeners.set('room:list', onRoomList);
    listeners.set('error', onError);
    listeners.set('disconnected', onDisconnected);

    // Attach listeners to socket service
    listeners.forEach((callback, event) => {
      socketService.on(event, callback);
    });

    eventListenersRef.current = listeners;

    // Cleanup on unmount
    return () => {
      listeners.forEach((callback, event) => {
        socketService.off(event, callback);
      });
    };
    // setCurrentPlayer is a Zustand store action, so its identity is stable
    // across renders and this effect still runs only once on mount.
  }, [setCurrentPlayer]);

  // Auto-refresh lists when connected (only once)
  useEffect(() => {
    if (state.isConnected) {
      socketService.requestPlayerList();
      socketService.requestRoomList();
    }
  }, [state.isConnected]);

  return {
    // State
    ...state,
    
    // Connection methods
    connect,
    disconnect,
    
    // Room methods
    joinRoom,
    leaveRoom,
    createRoom,
    refreshPlayerList,
    refreshRoomList,
    
    // Computed values
    playersInCurrentRoom: state.currentRoom?.players || [],
    canJoinRoom: state.isConnected && !state.currentRoom,
    canCreateRoom: state.isConnected
  };
};
