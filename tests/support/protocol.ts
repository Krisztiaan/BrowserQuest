import SharedProtocol from '../../shared/js/protocol-contract-esm.ts';
import type {
    ClientToServerProtocolAction,
    ProtocolAction,
    ProtocolActionValue,
    ProtocolContract,
    ProtocolOpcode,
    ProtocolParsedAction,
    ServerToClientProtocolAction,
} from '../../shared/js/protocol-contract-types';

const Protocol = SharedProtocol as ProtocolContract;

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

export type {
    ProtocolOpcode,
    ProtocolActionValue,
    ProtocolParsedAction,
    ClientToServerProtocolAction,
    ServerToClientProtocolAction,
    ProtocolAction,
};
export const parseProtocolActionBatch = Protocol.parseProtocolActionBatch;
