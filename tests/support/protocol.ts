import SharedProtocol from '../../shared/js/protocol-contract-esm.mjs';

type SharedProtocolContract = {
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
    parseProtocolActionBatch: (payload: string) => ProtocolAction[];
};

const Protocol = SharedProtocol as SharedProtocolContract;

export const MSG_HELLO = Protocol.MSG_HELLO;
export const MSG_WELCOME = Protocol.MSG_WELCOME;
export const MSG_SPAWN = Protocol.MSG_SPAWN;
export const MSG_MOVE = Protocol.MSG_MOVE;
export const MSG_LOOTMOVE = Protocol.MSG_LOOTMOVE;
export const MSG_ATTACK = Protocol.MSG_ATTACK;
export const MSG_HIT = Protocol.MSG_HIT;
export const MSG_CHAT = Protocol.MSG_CHAT;
export const MSG_DAMAGE = Protocol.MSG_DAMAGE;
export const MSG_LIST = Protocol.MSG_LIST;
export const MSG_WHO = Protocol.MSG_WHO;
export const MSG_ZONE = Protocol.MSG_ZONE;

export const ENTITY_CLOTH_ARMOR = Protocol.ENTITY_CLOTH_ARMOR;
export const ENTITY_SWORD_1 = Protocol.ENTITY_SWORD_1;

export type ProtocolOpcode =
    | typeof MSG_HELLO
    | typeof MSG_WELCOME
    | typeof MSG_SPAWN
    | typeof MSG_MOVE
    | typeof MSG_LOOTMOVE
    | typeof MSG_ATTACK
    | typeof MSG_HIT
    | typeof MSG_CHAT
    | typeof MSG_DAMAGE
    | typeof MSG_LIST
    | typeof MSG_WHO
    | typeof MSG_ZONE;

export type ProtocolActionValue = number | string | boolean | null;
export type ProtocolAction = [ProtocolOpcode | number, ...ProtocolActionValue[]];
export const parseProtocolActionBatch = Protocol.parseProtocolActionBatch;
