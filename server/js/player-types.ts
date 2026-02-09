import type { ClientToServerProtocolAction, ServerToClientProtocolAction } from '../../shared/js/protocol-contract-types';
import type { EntityKind } from '../../shared/js/entity-kind-domain';

export const PLAYER_RUNTIME_DEPENDENCY_BOUNDARIES = [
    './character',
    './chest',
    './log',
    './message',
    './utils',
    './properties',
    './formulas',
    './format',
    '../../shared/js/gametypes',
] as const;

export type PlayerRuntimeDependencyBoundary = (typeof PLAYER_RUNTIME_DEPENDENCY_BOUNDARIES)[number];

export const PLAYER_CONSTRUCTOR_FIELDS = [
    'server',
    'connection',
    'name',
    'hasEnteredGame',
    'isDead',
    'haters',
    'lastCheckpoint',
    'disconnectTimeout',
    'firepotionTimeout',
    'attackers',
] as const;

export type PlayerConstructorField = (typeof PLAYER_CONSTRUCTOR_FIELDS)[number];

export const PLAYER_CALLBACK_FIELDS = [
    'exit_callback',
    'move_callback',
    'lootmove_callback',
    'zone_callback',
    'orient_callback',
    'message_callback',
    'broadcast_callback',
    'broadcastzone_callback',
    'requestpos_callback',
] as const;

export type PlayerCallbackField = (typeof PLAYER_CALLBACK_FIELDS)[number];

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
    enter_callback(player: PlayerRuntime): void;
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

export interface PlayerShadowSourceContract {
    dependencyBoundaries: readonly PlayerRuntimeDependencyBoundary[];
    constructorFields: readonly PlayerConstructorField[];
    callbackFields: readonly PlayerCallbackField[];
}

export const PLAYER_SHADOW_SOURCE_CONTRACT: PlayerShadowSourceContract = {
    dependencyBoundaries: PLAYER_RUNTIME_DEPENDENCY_BOUNDARIES,
    constructorFields: PLAYER_CONSTRUCTOR_FIELDS,
    callbackFields: PLAYER_CALLBACK_FIELDS,
};
