const Types = require('./gametypes') as {
    Messages: Record<string, number>;
    Entities: Record<string, number>;
};

import type { ProtocolActionValue, ProtocolContract, ProtocolParsedAction } from './protocol-contract-types';

function isProtocolActionValue(value: unknown): value is ProtocolActionValue {
    if (
        typeof value === 'number' ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        value === null
    ) {
        return true;
    }

    if (!Array.isArray(value)) {
        return false;
    }

    return value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));
}

function isProtocolAction(value: unknown): value is ProtocolParsedAction {
    if(!Array.isArray(value) || value.length === 0) {
        return false;
    }

    if(typeof value[0] !== 'number') {
        return false;
    }

    for(let i = 1; i < value.length; i += 1) {
        if(!isProtocolActionValue(value[i])) {
            return false;
        }
    }

    return true;
}

const Protocol: ProtocolContract = {
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
    parseProtocolActionBatch(payload: string): ProtocolParsedAction[] {
        let parsed: unknown;
        try {
            parsed = JSON.parse(payload);
        } catch (_) {
            return [];
        }

        if(!Array.isArray(parsed)) {
            return [];
        }

        if(parsed.length > 0 && Array.isArray(parsed[0])) {
            return parsed.filter((entry): entry is ProtocolParsedAction => isProtocolAction(entry));
        }

        if(isProtocolAction(parsed)) {
            return [parsed];
        }

        return [];
    },
};

module.exports = Protocol;
