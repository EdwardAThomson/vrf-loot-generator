import { Socket } from 'socket.io';
import { PlayerService } from '../services/playerService';
import { RoomService } from '../services/roomService';
import { ServerToClientEvents, ClientToServerEvents, SocketData } from '../types/socket.types';

export class TradingController {
  constructor(
    private playerService: PlayerService,
    private roomService: RoomService
  ) {}

  handleTradeInitiate = (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    targetPlayerId: string,
    offeredItems: any[]
  ) => {
    try {
      const initiatorId = socket.data.playerId;
      const roomId = socket.data.roomId;

      if (!initiatorId || !roomId) {
        socket.emit('error', 'Player not authenticated or not in a room');
        return;
      }

      const initiator = this.playerService.getPlayer(initiatorId);
      const target = this.playerService.getPlayer(targetPlayerId);

      if (!initiator || !target) {
        socket.emit('error', 'Player not found');
        return;
      }

      if (!target.isOnline) {
        socket.emit('error', 'Target player is offline');
        return;
      }

      if (target.roomId !== roomId) {
        socket.emit('error', 'Target player is not in the same room');
        return;
      }

      // Create the trade
      const trade = this.roomService.createTrade(roomId, initiatorId, targetPlayerId, offeredItems);
      if (!trade) {
        socket.emit('error', 'Failed to create trade (players may already be trading)');
        return;
      }

      // Notify both players
      socket.emit('trade:initiated', trade);
      socket.to(target.socketId).emit('trade:initiated', trade);

      console.log(`Trade initiated between ${initiator.name} and ${target.name}`);

    } catch (error) {
      console.error('Error initiating trade:', error);
      socket.emit('error', 'Failed to initiate trade');
    }
  };

  handleTradeCommit = (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    tradeId: string,
    commitment: string
  ) => {
    try {
      const playerId = socket.data.playerId;
      if (!playerId) {
        socket.emit('error', 'Player not authenticated');
        return;
      }

      const success = this.roomService.commitTrade(tradeId, playerId, commitment);
      if (!success) {
        socket.emit('error', 'Failed to commit to trade');
        return;
      }

      const trade = this.roomService.getTrade(tradeId);
      if (!trade) {
        socket.emit('error', 'Trade not found');
        return;
      }

      // Notify both players
      const otherPlayerId = trade.initiatorId === playerId ? trade.targetId : trade.initiatorId;
      const otherPlayer = this.playerService.getPlayer(otherPlayerId);

      socket.emit('trade:committed', tradeId, playerId);
      if (otherPlayer && otherPlayer.isOnline) {
        socket.to(otherPlayer.socketId).emit('trade:committed', tradeId, playerId);
      }

      console.log(`Player ${socket.data.playerName} committed to trade ${tradeId}`);

    } catch (error) {
      console.error('Error committing trade:', error);
      socket.emit('error', 'Failed to commit to trade');
    }
  };

  handleTradeReveal = (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    tradeId: string,
    nonce: string,
    items: any[]
  ) => {
    try {
      const playerId = socket.data.playerId;
      if (!playerId) {
        socket.emit('error', 'Player not authenticated');
        return;
      }

      const success = this.roomService.revealTrade(tradeId, playerId, nonce, items);
      if (!success) {
        socket.emit('error', 'Failed to reveal trade');
        return;
      }

      const trade = this.roomService.getTrade(tradeId);
      if (!trade) {
        socket.emit('error', 'Trade not found');
        return;
      }

      // Notify both players
      const otherPlayerId = trade.initiatorId === playerId ? trade.targetId : trade.initiatorId;
      const otherPlayer = this.playerService.getPlayer(otherPlayerId);

      socket.emit('trade:revealed', tradeId, playerId, items);
      if (otherPlayer && otherPlayer.isOnline) {
        socket.to(otherPlayer.socketId).emit('trade:revealed', tradeId, playerId, items);
      }

      console.log(`Player ${socket.data.playerName} revealed trade ${tradeId}`);

    } catch (error) {
      console.error('Error revealing trade:', error);
      socket.emit('error', 'Failed to reveal trade');
    }
  };

  handleTradeAccept = (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    tradeId: string
  ) => {
    try {
      const playerId = socket.data.playerId;
      if (!playerId) {
        socket.emit('error', 'Player not authenticated');
        return;
      }

      const trade = this.roomService.getTrade(tradeId);
      if (!trade) {
        socket.emit('error', 'Trade not found');
        return;
      }

      if (trade.status !== 'REVEALED') {
        socket.emit('error', 'Trade is not ready to be completed');
        return;
      }

      // Complete the trade
      const success = this.roomService.completeTrade(tradeId);
      if (!success) {
        socket.emit('error', 'Failed to complete trade');
        return;
      }

      // Update player inventories (this would integrate with your existing inventory system)
      // For now, we'll just notify both players
      const otherPlayerId = trade.initiatorId === playerId ? trade.targetId : trade.initiatorId;
      const otherPlayer = this.playerService.getPlayer(otherPlayerId);

      socket.emit('trade:completed', trade);
      if (otherPlayer && otherPlayer.isOnline) {
        socket.to(otherPlayer.socketId).emit('trade:completed', trade);
      }

      console.log(`Trade ${tradeId} completed`);

    } catch (error) {
      console.error('Error completing trade:', error);
      socket.emit('error', 'Failed to complete trade');
    }
  };

  handleTradeCancel = (
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    tradeId: string
  ) => {
    try {
      const playerId = socket.data.playerId;
      if (!playerId) {
        socket.emit('error', 'Player not authenticated');
        return;
      }

      const trade = this.roomService.getTrade(tradeId);
      if (!trade) {
        socket.emit('error', 'Trade not found');
        return;
      }

      // Only allow cancellation by participants
      if (trade.initiatorId !== playerId && trade.targetId !== playerId) {
        socket.emit('error', 'You are not part of this trade');
        return;
      }

      const success = this.roomService.cancelTrade(tradeId);
      if (!success) {
        socket.emit('error', 'Failed to cancel trade');
        return;
      }

      // Notify both players
      const otherPlayerId = trade.initiatorId === playerId ? trade.targetId : trade.initiatorId;
      const otherPlayer = this.playerService.getPlayer(otherPlayerId);

      socket.emit('trade:cancelled', tradeId, 'Trade cancelled by player');
      if (otherPlayer && otherPlayer.isOnline) {
        socket.to(otherPlayer.socketId).emit('trade:cancelled', tradeId, 'Trade cancelled by other player');
      }

      console.log(`Trade ${tradeId} cancelled by ${socket.data.playerName}`);

    } catch (error) {
      console.error('Error cancelling trade:', error);
      socket.emit('error', 'Failed to cancel trade');
    }
  };
}
