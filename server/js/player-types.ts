import type { ClientToServerProtocolAction, ServerToClientProtocolAction } from '../../shared/js/protocol-contract-types';
import type { EntityKind } from '../../shared/js/entity-kind-domain';

export interface PlayerRuntimeConnection {
    id: string;
    listen(callback: (message: ClientToServerProtocolAction) => void): void;
    onClose(callback: () => void): void;
    send(message: ServerToClientProtocolAction): void;
    sendUTF8(message: string): void;
    close(reason: string): void;
    closeInvalidPayload?(reason: string): void;
}

export interface PlayerRuntimeEntity {
    id: string | number;
    kind?: EntityKind;
}

export interface PlayerRuntimeMessage {
    serialize(): ServerToClientProtocolAction;
}

export interface PlayerRuntime {
    id: string | number;
}

export interface PlayerRuntimeWorldServer {
    addPlayer(player: PlayerRuntime): void;
    emit(eventName: 'playerEnter', player: PlayerRuntime): void;
    isValidPosition(x: number, y: number): boolean;
    getEntityById(id: string | number): PlayerRuntimeEntity | undefined;
    handleMobHate(mobId: string | number, playerId: string | number, hatePoints: number): void;
    broadcastAttacker(player: PlayerRuntime): void;
    handleHurtEntity(entity: PlayerRuntimeEntity, attacker?: PlayerRuntimeEntity, damage?: number): void;
    removeEntity(entity: PlayerRuntimeEntity): void;
    handleOpenedChest(chest: PlayerRuntimeEntity, player: PlayerRuntime): void;
    handlePlayerVanish(player: PlayerRuntime): void;
    pushRelevantEntityListTo(player: PlayerRuntime): void;
    pushToPlayer(player: PlayerRuntime, message: PlayerRuntimeMessage | ServerToClientProtocolAction): void;
    map: {
        getCheckpoint(id: string | number): { id?: string | number } | null | undefined;
    };
}
