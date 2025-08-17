import { Socket } from 'socket.io';
import { PlayerService } from '../services/playerService';
import { RoomService } from '../services/roomService';
import { ServerToClientEvents, ClientToServerEvents, SocketData } from '../types/socket.types';
export declare class RoomController {
    private playerService;
    private roomService;
    constructor(playerService: PlayerService, roomService: RoomService);
    handleRoomCreate: (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>, roomName: string, isPrivate: boolean) => void;
    handleRoomJoin: (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>, roomId: string) => void;
    handleRoomLeave: (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>) => void;
    handleRoomListRequest: (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>) => void;
}
//# sourceMappingURL=roomController.d.ts.map