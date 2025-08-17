import { Socket } from 'socket.io';
import { PlayerService } from '../services/playerService';
import { RoomService } from '../services/roomService';
import { ServerToClientEvents, ClientToServerEvents, SocketData } from '../types/socket.types';
export declare class TradingController {
    private playerService;
    private roomService;
    constructor(playerService: PlayerService, roomService: RoomService);
    handleTradeInitiate: (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>, targetPlayerId: string, offeredItems: any[]) => void;
    handleTradeCommit: (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>, tradeId: string, commitment: string) => void;
    handleTradeReveal: (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>, tradeId: string, nonce: string, items: any[]) => void;
    handleTradeAccept: (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>, tradeId: string) => void;
    handleTradeCancel: (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>, tradeId: string) => void;
}
//# sourceMappingURL=tradingController.d.ts.map