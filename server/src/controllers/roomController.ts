import { Server, Socket } from 'socket.io';
import { PlayerService } from '../services/playerService';
import { RoomService } from '../services/roomService';
import { ServerToClientEvents, ClientToServerEvents, SocketData, InterServerEvents } from '../types/socket.types';

export class RoomController {
  private io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

  constructor(
    io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    private playerService: PlayerService,
    private roomService: RoomService
  ) {
    this.io = io;
  }

  private broadcastRoomList = () => {
    this.io.emit('room:list', this.roomService.getPublicRooms());
  };

  handleRoomCreate = (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    roomName: string,
    isPrivate: boolean
  ) => {
    try {
      const playerId = socket.data.playerId;
      if (!playerId) {
        socket.emit('error', 'Player not authenticated');
        return;
      }

      const room = this.roomService.createRoom(roomName, playerId, isPrivate);
      
      console.log(`Room ${room.name} (${room.id}) created by ${socket.data.playerName}`);
      
      // Auto-join the creator to the room and broadcast update
      this.handleRoomJoin(socket, room.id);
      this.broadcastRoomList();

    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', 'Failed to create room');
    }
  };

  handleRoomJoin = (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    roomId: string
  ) => {
    try {
      const playerId = socket.data.playerId;
      if (!playerId) {
        socket.emit('error', 'Player not authenticated');
        return;
      }

      const player = this.playerService.getPlayer(playerId);
      const room = this.roomService.getRoom(roomId);

      if (!player || !room) {
        socket.emit('error', 'Player or room not found');
        return;
      }

      // If player is already in the requested room, do nothing.
      if (player.roomId === roomId) {
        return;
      }

      // Leave current room if in one
      if (player.roomId) {
        this.handleRoomLeave(socket);
      }

      // Join the new room
      const success = this.roomService.joinRoom(roomId, player);
      if (!success) {
        socket.emit('error', 'Failed to join room (room may be full)');
        return;
      }

      // Update player's room
      this.playerService.joinRoom(playerId, roomId);
      socket.data.roomId = roomId;

      // Join socket room for broadcasting
      socket.join(roomId);

      // Notify player they joined
      socket.emit('room:joined', room);

      // Notify other players in the room
      socket.to(roomId).emit('player:joined', player);

      console.log(`Player ${player.name} joined room ${room.name}`);

      // Broadcast updated room list to everyone
      this.broadcastRoomList();

    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', 'Failed to join room');
    }
  };

  handleRoomLeave = (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>
  ) => {
    try {
      const playerId = socket.data.playerId;
      const roomId = socket.data.roomId;

      if (!playerId || !roomId) {
        return; // Player not in a room
      }

      const player = this.playerService.getPlayer(playerId);
      if (!player) return;

      // Cancel any active trades in this room
      const activeTrades = this.roomService.getActiveTradesForPlayer(playerId);
      activeTrades.forEach(trade => {
        if (trade.roomId === roomId) {
          this.roomService.cancelTrade(trade.id);
          // Notify other player
          const otherPlayerId = trade.initiatorId === playerId ? trade.targetId : trade.initiatorId;
          const otherPlayer = this.playerService.getPlayer(otherPlayerId);
          if (otherPlayer && otherPlayer.isOnline) {
            socket.to(otherPlayer.socketId).emit('trade:cancelled', trade.id, 'Player left room');
          }
        }
      });

      // Leave the room
      this.roomService.leaveRoom(roomId, playerId);
      this.playerService.leaveRoom(playerId);

      // Leave socket room
      socket.leave(roomId);

      // Clear room data from socket
      socket.data.roomId = undefined;

      // Notify other players in the room
      socket.to(roomId).emit('player:left', playerId);

      // Notify the player they left
      socket.emit('room:left', roomId);

      console.log(`Player ${player.name} left room ${roomId}`);

      // Broadcast updated room list to everyone
      this.broadcastRoomList();

    } catch (error) {
      console.error('Error leaving room:', error);
      socket.emit('error', 'Failed to leave room');
    }
  };

  handleRoomListRequest = (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>
  ) => {
    try {
      const publicRooms = this.roomService.getPublicRooms();
      socket.emit('room:list', publicRooms);
    } catch (error) {
      console.error('Error getting room list:', error);
      socket.emit('error', 'Failed to get room list');
    }
  };
}
