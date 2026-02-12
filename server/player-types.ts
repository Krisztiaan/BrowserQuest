import type { ClientToServerProtocolAction, ServerToClientProtocolAction } from '../shared/protocol/types';
import type { EntityKind } from '../shared/entity-kind-domain';
import type { EntityId } from '../shared/domain/ids';

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
    id: EntityId;
    kind?: EntityKind;
}

export interface PlayerRuntimeMessage {
    serialize(): ServerToClientProtocolAction;
}

export interface PlayerRuntime {
    id: EntityId;
}

export interface PlayerRuntimeWorldServer {
    addPlayer(player: PlayerRuntime): void;
    emit(eventName: 'playerEnter', player: PlayerRuntime): void;
    isValidPosition(x: number, y: number): boolean;
    getEntityById(id: EntityId): PlayerRuntimeEntity | undefined;
    removeEntity(entity: PlayerRuntimeEntity): void;
    pushRelevantEntityListTo(player: PlayerRuntime): void;
    pushToPlayer(player: PlayerRuntime, message: PlayerRuntimeMessage | ServerToClientProtocolAction): void;
    map: {
        getCheckpoint(id: string | number): { id?: string | number } | null | undefined;
    };
}
