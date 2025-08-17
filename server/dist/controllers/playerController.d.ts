import { Socket } from 'socket.io';
import { PlayerService } from '../services/playerService';
import { RoomService } from '../services/roomService';
import { ServerToClientEvents, ClientToServerEvents, SocketData } from '../types/socket.types';
export declare class PlayerController {
    private playerService;
    private roomService;
    constructor(playerService: PlayerService, roomService: RoomService);
    handlePlayerJoin: (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>, playerName: string) => void;
    handlePlayerLeave: (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>) => void;
    handlePlayerListRequest: (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>) => void;
    handleDisconnect: (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>) => void;
}
//# sourceMappingURL=playerController.d.ts.map