// @ts-nocheck
import Types from './gametypes-esm';

/**
 * @param {unknown} value
 * @returns {value is import('./protocol-contract-types').ProtocolActionValue}
 */
function isProtocolActionValue(value) {
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' || value === null) {
        return true;
    }

    if (!Array.isArray(value)) {
        return false;
    }

    return value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));
}

/**
 * @param {unknown} value
 * @returns {value is import('./protocol-contract-types').ProtocolParsedAction}
 */
function isProtocolAction(value) {
    if (!Array.isArray(value) || value.length === 0) {
        return false;
    }

    if (typeof value[0] !== 'number') {
        return false;
    }

    for (let i = 1; i < value.length; i += 1) {
        if (!isProtocolActionValue(value[i])) {
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
    MSG_DESPAWN: Types.Messages.DESPAWN,
    MSG_MOVE: Types.Messages.MOVE,
    MSG_LOOTMOVE: Types.Messages.LOOTMOVE,
    MSG_AGGRO: Types.Messages.AGGRO,
    MSG_ATTACK: Types.Messages.ATTACK,
    MSG_HIT: Types.Messages.HIT,
    MSG_HURT: Types.Messages.HURT,
    MSG_HEALTH: Types.Messages.HEALTH,
    MSG_CHAT: Types.Messages.CHAT,
    MSG_LOOT: Types.Messages.LOOT,
    MSG_EQUIP: Types.Messages.EQUIP,
    MSG_DROP: Types.Messages.DROP,
    MSG_TELEPORT: Types.Messages.TELEPORT,
    MSG_DAMAGE: Types.Messages.DAMAGE,
    MSG_POPULATION: Types.Messages.POPULATION,
    MSG_KILL: Types.Messages.KILL,
    MSG_LIST: Types.Messages.LIST,
    MSG_WHO: Types.Messages.WHO,
    MSG_ZONE: Types.Messages.ZONE,
    MSG_DESTROY: Types.Messages.DESTROY,
    MSG_HP: Types.Messages.HP,
    MSG_BLINK: Types.Messages.BLINK,
    MSG_OPEN: Types.Messages.OPEN,
    MSG_CHECK: Types.Messages.CHECK,
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
export const MSG_DESPAWN = protocolContract.MSG_DESPAWN;
export const MSG_MOVE = protocolContract.MSG_MOVE;
export const MSG_LOOTMOVE = protocolContract.MSG_LOOTMOVE;
export const MSG_AGGRO = protocolContract.MSG_AGGRO;
export const MSG_ATTACK = protocolContract.MSG_ATTACK;
export const MSG_HIT = protocolContract.MSG_HIT;
export const MSG_HURT = protocolContract.MSG_HURT;
export const MSG_HEALTH = protocolContract.MSG_HEALTH;
export const MSG_CHAT = protocolContract.MSG_CHAT;
export const MSG_LOOT = protocolContract.MSG_LOOT;
export const MSG_EQUIP = protocolContract.MSG_EQUIP;
export const MSG_DROP = protocolContract.MSG_DROP;
export const MSG_TELEPORT = protocolContract.MSG_TELEPORT;
export const MSG_DAMAGE = protocolContract.MSG_DAMAGE;
export const MSG_POPULATION = protocolContract.MSG_POPULATION;
export const MSG_KILL = protocolContract.MSG_KILL;
export const MSG_LIST = protocolContract.MSG_LIST;
export const MSG_WHO = protocolContract.MSG_WHO;
export const MSG_ZONE = protocolContract.MSG_ZONE;
export const MSG_DESTROY = protocolContract.MSG_DESTROY;
export const MSG_HP = protocolContract.MSG_HP;
export const MSG_BLINK = protocolContract.MSG_BLINK;
export const MSG_OPEN = protocolContract.MSG_OPEN;
export const MSG_CHECK = protocolContract.MSG_CHECK;
export const ENTITY_CLOTH_ARMOR = protocolContract.ENTITY_CLOTH_ARMOR;
export const ENTITY_SWORD_1 = protocolContract.ENTITY_SWORD_1;
export const parseProtocolActionBatch = protocolContract.parseProtocolActionBatch;
export default protocolContract;
