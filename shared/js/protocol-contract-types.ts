export type ProtocolOpcode = number;
export type ProtocolActionValue = number | string | boolean | null;
export type ProtocolAction = [ProtocolOpcode, ...ProtocolActionValue[]];

export const PROTOCOL_CONTRACT_NUMERIC_KEYS = [
    'MSG_HELLO',
    'MSG_WELCOME',
    'MSG_SPAWN',
    'MSG_MOVE',
    'MSG_LOOTMOVE',
    'MSG_ATTACK',
    'MSG_HIT',
    'MSG_CHAT',
    'MSG_DAMAGE',
    'MSG_LIST',
    'MSG_WHO',
    'MSG_ZONE',
    'ENTITY_CLOTH_ARMOR',
    'ENTITY_SWORD_1',
] as const;

export const PROTOCOL_CONTRACT_FUNCTION_KEYS = ['parseProtocolActionBatch'] as const;

export const PROTOCOL_CONTRACT_KEYS = [...PROTOCOL_CONTRACT_NUMERIC_KEYS, ...PROTOCOL_CONTRACT_FUNCTION_KEYS] as const;

export type ProtocolContractNumericKey = (typeof PROTOCOL_CONTRACT_NUMERIC_KEYS)[number];
export type ProtocolContractFunctionKey = (typeof PROTOCOL_CONTRACT_FUNCTION_KEYS)[number];
export type ProtocolContractKey = (typeof PROTOCOL_CONTRACT_KEYS)[number];

export interface ProtocolContract extends Record<ProtocolContractNumericKey, number> {
    parseProtocolActionBatch(payload: string): ProtocolAction[];
}
