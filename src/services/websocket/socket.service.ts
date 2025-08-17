import { io, Socket } from 'socket.io-client';
import { 
  ServerToClientEvents, 
  ClientToServerEvents, 
  Player, 
  TradingRoom, 
  TradeSession,
  LootItem 
} from '../../types/websocket.types';

export class SocketService {
  private socket: Socket | null = null;
  private eventCallbacks: Map<string, Function[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private connectingState = false;
  private isReconnecting = false;

  constructor(private url: string = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:3001') {}

  connect(playerName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected || this.connectingState) {
        resolve();
        return;
      }

      this.connectingState = true;

      // Disconnect any existing socket first
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      }

      this.socket = io(this.url, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true
      });

      // Connection events
      this.socket.on('connect', () => {
        console.log('Connected to server');
        this.reconnectAttempts = 0;
        this.connectingState = false;
        this.isReconnecting = false;
        
        // Join as player
        this.socket!.emit('player:join', playerName);
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        this.connectingState = false;
        this.handleReconnect();
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason);
        this.emit('disconnected', reason);
        
        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect
          this.handleReconnect();
        }
      });

      // Player events
      this.socket.on('player:joined', (player: Player) => {
        this.emit('player:joined', player);
      });

      this.socket.on('player:left', (playerId: string) => {
        this.emit('player:left', playerId);
      });

      this.socket.on('player:list', (players: Player[]) => {
        this.emit('player:list', players);
      });

      // Room events
      this.socket.on('room:joined', (room: TradingRoom) => {
        this.emit('room:joined', room);
      });

      this.socket.on('room:left', (roomId: string) => {
        this.emit('room:left', roomId);
      });

      this.socket.on('room:list', (rooms: TradingRoom[]) => {
        this.emit('room:list', rooms);
      });

      // Trading events
      this.socket.on('trade:initiated', (trade: TradeSession) => {
        this.emit('trade:initiated', trade);
      });

      this.socket.on('trade:committed', (tradeId: string, playerId: string) => {
        this.emit('trade:committed', { tradeId, playerId });
      });

      this.socket.on('trade:revealed', (tradeId: string, playerId: string, items: LootItem[]) => {
        this.emit('trade:revealed', { tradeId, playerId, items });
      });

      this.socket.on('trade:completed', (trade: TradeSession) => {
        this.emit('trade:completed', trade);
      });

      this.socket.on('trade:cancelled', (tradeId: string, reason: string) => {
        this.emit('trade:cancelled', { tradeId, reason });
      });

      // Error handling
      this.socket.on('error', (message: string) => {
        console.error('Server error:', message);
        this.emit('error', message);
      });
    });
  }

  disconnect(): void {
    this.connectingState = false;
    this.isReconnecting = false;
    if (this.socket) {
      this.socket.emit('player:leave');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.eventCallbacks.clear();
  }

  // Player methods
  joinRoom(roomId: string): void {
    this.socket?.emit('room:join', roomId);
  }

  leaveRoom(): void {
    this.socket?.emit('room:leave');
  }

  createRoom(roomName: string, isPrivate: boolean = false): void {
    this.socket?.emit('room:create', roomName, isPrivate);
  }

  requestPlayerList(): void {
    this.socket?.emit('player:list');
  }

  requestRoomList(): void {
    this.socket?.emit('room:list');
  }

  // Trading methods
  initiateTrade(targetPlayerId: string, offeredItems: LootItem[]): void {
    this.socket?.emit('trade:initiate', targetPlayerId, offeredItems);
  }

  commitTrade(tradeId: string, commitment: string): void {
    this.socket?.emit('trade:commit', tradeId, commitment);
  }

  revealTrade(tradeId: string, nonce: string, items: LootItem[]): void {
    this.socket?.emit('trade:reveal', tradeId, nonce, items);
  }

  acceptTrade(tradeId: string): void {
    this.socket?.emit('trade:accept', tradeId);
  }

  cancelTrade(tradeId: string): void {
    this.socket?.emit('trade:cancel', tradeId);
  }

  // Event system
  on(event: string, callback: Function): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  off(event: string, callback?: Function): void {
    if (!callback) {
      this.eventCallbacks.delete(event);
      return;
    }

    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  private handleReconnect(): void {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.emit('reconnect_failed');
      }
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
    
    setTimeout(() => {
      if (this.socket && !this.socket.connected && this.isReconnecting) {
        this.socket.connect();
      }
      this.isReconnecting = false;
    }, delay);
  }

  // Getters
  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  get isConnecting(): boolean {
    return this.connectingState || (this.socket?.connected === false && this.socket?.disconnected === false);
  }
}

// Export singleton instance
export const socketService = new SocketService();
