import type { EntityKind } from '../entity-kind-domain';
import type Types from '../gametypes-browser';

export type ProtocolActionValue = number | string | boolean | null | number[];
export type ProtocolParsedAction = [number, ...ProtocolActionValue[]];

export type ClientToServerHelloAction = [typeof Types.Messages.HELLO, string, number, number];
export type ClientToServerMoveAction = [typeof Types.Messages.MOVE, number, number];
export type ClientToServerLootMoveAction = [typeof Types.Messages.LOOTMOVE, number, number, number];
export type ClientToServerAggroAction = [typeof Types.Messages.AGGRO, number];
export type ClientToServerAttackAction = [typeof Types.Messages.ATTACK, number];
export type ClientToServerHitAction = [typeof Types.Messages.HIT, number];
export type ClientToServerHurtAction = [typeof Types.Messages.HURT, number];
export type ClientToServerChatAction = [typeof Types.Messages.CHAT, string];
export type ClientToServerLootAction = [typeof Types.Messages.LOOT, number];
export type ClientToServerTeleportAction = [typeof Types.Messages.TELEPORT, number, number];
export type ClientToServerWhoAction = [typeof Types.Messages.WHO, ...number[]];
export type ClientToServerZoneAction = [typeof Types.Messages.ZONE];
export type ClientToServerOpenAction = [typeof Types.Messages.OPEN, number];
export type ClientToServerCheckAction = [typeof Types.Messages.CHECK, number];
export type ClientToServerAchievementAction = [typeof Types.Messages.ACHIEVEMENT, number];

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
    | ClientToServerCheckAction
    | ClientToServerAchievementAction;

export type ServerToClientWelcomeAction = [typeof Types.Messages.WELCOME, number, string, number, number, number];
export type ServerToClientSpawnAction = [
    typeof Types.Messages.SPAWN,
    number,
    EntityKind,
    number,
    number,
    ...ProtocolActionValue[]
];
export type ServerToClientDespawnAction = [typeof Types.Messages.DESPAWN, number];
export type ServerToClientMoveAction = [typeof Types.Messages.MOVE, number, number, number];
export type ServerToClientLootMoveAction = [typeof Types.Messages.LOOTMOVE, number, number];
export type ServerToClientAttackAction = [typeof Types.Messages.ATTACK, number, number];
export type ServerToClientHealthAction = [typeof Types.Messages.HEALTH, number] | [typeof Types.Messages.HEALTH, number, 1];
export type ServerToClientChatAction = [typeof Types.Messages.CHAT, number, string];
export type ServerToClientEquipAction = [typeof Types.Messages.EQUIP, number, EntityKind];
export type ServerToClientDropAction = [typeof Types.Messages.DROP, number, number, EntityKind, number[]];
export type ServerToClientTeleportAction = [typeof Types.Messages.TELEPORT, number, number, number];
export type ServerToClientDamageAction = [typeof Types.Messages.DAMAGE, number, number];
export type ServerToClientPopulationAction = [typeof Types.Messages.POPULATION, number, number];
export type ServerToClientKillAction = [typeof Types.Messages.KILL, EntityKind];
export type ServerToClientListAction = [typeof Types.Messages.LIST, ...number[]];
export type ServerToClientDestroyAction = [typeof Types.Messages.DESTROY, number];
export type ServerToClientHitPointsAction = [typeof Types.Messages.HP, number];
export type ServerToClientBlinkAction = [typeof Types.Messages.BLINK, number];
export type ServerToClientAchievementsAction = [
    typeof Types.Messages.ACHIEVEMENTS,
    number[],
    number,
    number,
    number,
    number,
    number,
];

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
    | ServerToClientBlinkAction
    | ServerToClientAchievementsAction;

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
    'MSG_ACHIEVEMENT',
    'MSG_ACHIEVEMENTS',
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
