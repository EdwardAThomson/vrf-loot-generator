import { Server, Socket } from 'socket.io';
import { PlayerService } from '../services/playerService';
import { RoomService } from '../services/roomService';
import { ServerToClientEvents, ClientToServerEvents, SocketData, InterServerEvents } from '../types/socket.types';

export class PlayerController {
  private io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

  constructor(
    io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    private playerService: PlayerService,
    private roomService: RoomService
  ) {
    this.io = io;
  }

  handlePlayerJoin = (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    playerName: string
  ) => {
    try {
      // Create or reconnect player
      const player = this.playerService.createPlayer(playerName, socket.id);
      
      // Store player data in socket
      socket.data.playerId = player.id;
      socket.data.playerName = player.name;

      // Notify the player they've joined
      socket.emit('player:joined', player);

      // Broadcast to all other clients that a new player joined
      socket.broadcast.emit('player:joined', player);

      console.log(`Player ${player.name} (${player.id}) joined`);

      // Send current online players list to the new player
      const onlinePlayers = this.playerService.getOnlinePlayers();
      socket.emit('player:list', onlinePlayers);

    } catch (error) {
      console.error('Error handling player join:', error);
      socket.emit('error', 'Failed to join the game');
    }
  };

  handlePlayerLeave = (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>
  ) => {
    try {
      const player = this.playerService.removePlayer(socket.id);
      
      if (player) {
        // Leave any room the player was in
        if (player.roomId) {
          this.roomService.leaveRoom(player.roomId, player.id);
          socket.leave(player.roomId);
        }

        // Cancel any active trades
        const activeTrades = this.roomService.getActiveTradesForPlayer(player.id);
        activeTrades.forEach(trade => {
          this.roomService.cancelTrade(trade.id);
          // Notify other player in the trade
          const otherPlayerId = trade.initiatorId === player.id ? trade.targetId : trade.initiatorId;
          const otherPlayer = this.playerService.getPlayer(otherPlayerId);
          if (otherPlayer && otherPlayer.isOnline) {
            socket.to(otherPlayer.socketId).emit('trade:cancelled', trade.id, 'Other player disconnected');
          }
        });

        // Broadcast to all clients that player left
        socket.broadcast.emit('player:left', player.id);

        console.log(`Player ${player.name} (${player.id}) left`);
      }
    } catch (error) {
      console.error('Error handling player leave:', error);
    }
  };

  handlePlayerListRequest = (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>
  ) => {
    try {
      const onlinePlayers = this.playerService.getOnlinePlayers();
      socket.emit('player:list', onlinePlayers);
    } catch (error) {
      console.error('Error handling player list request:', error);
      socket.emit('error', 'Failed to get player list');
    }
  };

  handleDisconnect = (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>
  ) => {
    this.handlePlayerLeave(socket);
  };
}
