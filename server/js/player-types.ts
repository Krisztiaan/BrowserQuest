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
    listen(callback: (message: unknown[]) => void): void;
    onClose(callback: () => void): void;
    send(message: unknown): void;
    sendUTF8(message: string): void;
    close(reason: string): void;
    closeInvalidPayload?(reason: string): void;
}

export interface PlayerRuntimeWorldServer {
    addPlayer(player: unknown): void;
    enter_callback(player: unknown): void;
    isValidPosition(x: number, y: number): boolean;
    getEntityById(id: string | number): unknown;
    handleMobHate(mobId: string | number, playerId: string | number, hatePoints: number): void;
    broadcastAttacker(player: unknown): void;
    handleHurtEntity(entity: unknown, attacker?: unknown, damage?: number): void;
    removeEntity(entity: unknown): void;
    handleOpenedChest(chest: unknown, player: unknown): void;
    handlePlayerVanish(player: unknown): void;
    pushRelevantEntityListTo(player: unknown): void;
    pushToPlayer(player: unknown, message: unknown): void;
    map: {
        getCheckpoint(id: string | number): unknown;
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
