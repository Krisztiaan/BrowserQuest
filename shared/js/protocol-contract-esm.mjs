import Types from './gametypes-esm.mjs';

/**
 * @param {unknown} value
 * @returns {value is import('./protocol-contract-types').ProtocolAction}
 */
function isProtocolAction(value) {
    if (!Array.isArray(value) || value.length === 0) {
        return false;
    }

    if (typeof value[0] !== 'number') {
        return false;
    }

    for (let i = 1; i < value.length; i += 1) {
        const param = value[i];
        const isAllowedPrimitive =
            typeof param === 'number' || typeof param === 'string' || typeof param === 'boolean' || param === null;
        if (!isAllowedPrimitive) {
            return false;
        }
    }

    return true;
}

/** @type {import('./protocol-contract-types').ProtocolContract} */
const protocolContract = {
    MSG_HELLO: Types.Messages.HELLO,
    MSG_WELCOME: Types.Messages.WELCOME,
    MSG_SPAWN: Types.Messages.SPAWN,
    MSG_MOVE: Types.Messages.MOVE,
    MSG_LOOTMOVE: Types.Messages.LOOTMOVE,
    MSG_ATTACK: Types.Messages.ATTACK,
    MSG_HIT: Types.Messages.HIT,
    MSG_CHAT: Types.Messages.CHAT,
    MSG_DAMAGE: Types.Messages.DAMAGE,
    MSG_LIST: Types.Messages.LIST,
    MSG_WHO: Types.Messages.WHO,
    MSG_ZONE: Types.Messages.ZONE,
    ENTITY_CLOTH_ARMOR: Types.Entities.CLOTHARMOR,
    ENTITY_SWORD_1: Types.Entities.SWORD1,
    parseProtocolActionBatch(payload) {
        let parsed;
        try {
            parsed = JSON.parse(payload);
        } catch (_) {
            return [];
        }

        if (!Array.isArray(parsed)) {
            return [];
        }

        if (parsed.length > 0 && Array.isArray(parsed[0])) {
            return parsed.filter((entry) => isProtocolAction(entry));
        }

        if (isProtocolAction(parsed)) {
            return [parsed];
        }

        return [];
    },
};

export const MSG_HELLO = protocolContract.MSG_HELLO;
export const MSG_WELCOME = protocolContract.MSG_WELCOME;
export const MSG_SPAWN = protocolContract.MSG_SPAWN;
export const MSG_MOVE = protocolContract.MSG_MOVE;
export const MSG_LOOTMOVE = protocolContract.MSG_LOOTMOVE;
export const MSG_ATTACK = protocolContract.MSG_ATTACK;
export const MSG_HIT = protocolContract.MSG_HIT;
export const MSG_CHAT = protocolContract.MSG_CHAT;
export const MSG_DAMAGE = protocolContract.MSG_DAMAGE;
export const MSG_LIST = protocolContract.MSG_LIST;
export const MSG_WHO = protocolContract.MSG_WHO;
export const MSG_ZONE = protocolContract.MSG_ZONE;
export const ENTITY_CLOTH_ARMOR = protocolContract.ENTITY_CLOTH_ARMOR;
export const ENTITY_SWORD_1 = protocolContract.ENTITY_SWORD_1;
export const parseProtocolActionBatch = protocolContract.parseProtocolActionBatch;
export default protocolContract;
