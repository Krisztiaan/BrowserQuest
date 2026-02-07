export type ProtocolOpcode = number;
export type ProtocolActionValue = number | string | boolean | null;
export type ProtocolAction = [ProtocolOpcode, ...ProtocolActionValue[]];

export interface ProtocolContract {
    MSG_HELLO: number;
    MSG_WELCOME: number;
    MSG_SPAWN: number;
    MSG_MOVE: number;
    MSG_LOOTMOVE: number;
    MSG_ATTACK: number;
    MSG_HIT: number;
    MSG_CHAT: number;
    MSG_DAMAGE: number;
    MSG_LIST: number;
    MSG_WHO: number;
    MSG_ZONE: number;
    ENTITY_CLOTH_ARMOR: number;
    ENTITY_SWORD_1: number;
    parseProtocolActionBatch(payload: string): ProtocolAction[];
}
