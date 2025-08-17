import { Player } from '../types/player.types';
export declare class PlayerService {
    private players;
    private sessions;
    createPlayer(name: string, socketId: string): Player;
    getPlayer(playerId: string): Player | undefined;
    getPlayerBySocketId(socketId: string): Player | undefined;
    updatePlayerSocket(playerId: string, newSocketId: string): void;
    removePlayer(socketId: string): Player | undefined;
    getOnlinePlayers(): Player[];
    getPlayersInRoom(roomId: string): Player[];
    joinRoom(playerId: string, roomId: string): boolean;
    leaveRoom(playerId: string): boolean;
    updatePlayerInventory(playerId: string, inventory: any[]): boolean;
    cleanupInactivePlayers(maxInactiveMinutes?: number): void;
}
//# sourceMappingURL=playerService.d.ts.map