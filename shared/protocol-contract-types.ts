import type { EntityKind } from './entity-kind-domain';

export type ProtocolActionValue = number | string | boolean | null | number[];
export type ProtocolParsedAction = [number, ...ProtocolActionValue[]];

export type ClientToServerHelloAction = [0, string, number, number];
export type ClientToServerMoveAction = [4, number, number];
export type ClientToServerLootMoveAction = [5, number, number, number];
export type ClientToServerAggroAction = [6, number];
export type ClientToServerAttackAction = [7, number];
export type ClientToServerHitAction = [8, number];
export type ClientToServerHurtAction = [9, number];
export type ClientToServerChatAction = [11, string];
export type ClientToServerLootAction = [12, number];
export type ClientToServerTeleportAction = [15, number, number];
export type ClientToServerWhoAction = [20, ...number[]];
export type ClientToServerZoneAction = [21];
export type ClientToServerOpenAction = [25, number];
export type ClientToServerCheckAction = [26, number];

export type ClientToServerProtocolAction =
    | ClientToServerHelloAction
    | ClientToServerMoveAction
    | ClientToServerLootMoveAction
    | ClientToServerAggroAction
    | ClientToServerAttackAction
    | ClientToServerHitAction
    | ClientToServerHurtAction
    | ClientToServerChatAction
    | ClientToServerLootAction
    | ClientToServerTeleportAction
    | ClientToServerWhoAction
    | ClientToServerZoneAction
    | ClientToServerOpenAction
    | ClientToServerCheckAction;

export type ServerToClientWelcomeAction = [1, number, string, number, number, number];
export type ServerToClientSpawnAction = [2, number, EntityKind, number, number, ...ProtocolActionValue[]];
export type ServerToClientDespawnAction = [3, number];
export type ServerToClientMoveAction = [4, number, number, number];
export type ServerToClientLootMoveAction = [5, number, number];
export type ServerToClientAttackAction = [7, number, number];
export type ServerToClientHealthAction = [10, number] | [10, number, 1];
export type ServerToClientChatAction = [11, number, string];
export type ServerToClientEquipAction = [13, number, EntityKind];
export type ServerToClientDropAction = [14, number, number, EntityKind, number[]];
export type ServerToClientTeleportAction = [15, number, number, number];
export type ServerToClientDamageAction = [16, number, number];
export type ServerToClientPopulationAction = [17, number, number];
export type ServerToClientKillAction = [18, EntityKind];
export type ServerToClientListAction = [19, ...number[]];
export type ServerToClientDestroyAction = [22, number];
export type ServerToClientHitPointsAction = [23, number];
export type ServerToClientBlinkAction = [24, number];

export type ServerToClientProtocolAction =
    | ServerToClientWelcomeAction
    | ServerToClientSpawnAction
    | ServerToClientDespawnAction
    | ServerToClientMoveAction
    | ServerToClientLootMoveAction
    | ServerToClientAttackAction
    | ServerToClientHealthAction
    | ServerToClientChatAction
    | ServerToClientEquipAction
    | ServerToClientDropAction
    | ServerToClientTeleportAction
    | ServerToClientDamageAction
    | ServerToClientPopulationAction
    | ServerToClientKillAction
    | ServerToClientListAction
    | ServerToClientDestroyAction
    | ServerToClientHitPointsAction
    | ServerToClientBlinkAction;

export type ProtocolAction = ClientToServerProtocolAction | ServerToClientProtocolAction;
export type ProtocolOpcode = ProtocolAction[0];

export const PROTOCOL_CONTRACT_NUMERIC_KEYS = [
    'MSG_HELLO',
    'MSG_WELCOME',
    'MSG_SPAWN',
    'MSG_DESPAWN',
    'MSG_MOVE',
    'MSG_LOOTMOVE',
    'MSG_AGGRO',
    'MSG_ATTACK',
    'MSG_HIT',
    'MSG_HURT',
    'MSG_HEALTH',
    'MSG_CHAT',
    'MSG_LOOT',
    'MSG_EQUIP',
    'MSG_DROP',
    'MSG_TELEPORT',
    'MSG_DAMAGE',
    'MSG_POPULATION',
    'MSG_KILL',
    'MSG_LIST',
    'MSG_WHO',
    'MSG_ZONE',
    'MSG_DESTROY',
    'MSG_HP',
    'MSG_BLINK',
    'MSG_OPEN',
    'MSG_CHECK',
    'ENTITY_CLOTH_ARMOR',
    'ENTITY_SWORD_1',
] as const;

export const PROTOCOL_CONTRACT_FUNCTION_KEYS = ['parseProtocolActionBatch'] as const;

export const PROTOCOL_CONTRACT_KEYS = [...PROTOCOL_CONTRACT_NUMERIC_KEYS, ...PROTOCOL_CONTRACT_FUNCTION_KEYS] as const;

export type ProtocolContractNumericKey = (typeof PROTOCOL_CONTRACT_NUMERIC_KEYS)[number];
export type ProtocolContractFunctionKey = (typeof PROTOCOL_CONTRACT_FUNCTION_KEYS)[number];
export type ProtocolContractKey = (typeof PROTOCOL_CONTRACT_KEYS)[number];

export interface ProtocolContract extends Record<ProtocolContractNumericKey, number> {
    parseProtocolActionBatch(payload: string): ProtocolParsedAction[];
}
