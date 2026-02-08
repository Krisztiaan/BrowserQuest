const Types = require('./gametypes') as {
    Messages: Record<string, number>;
    Entities: Record<string, number>;
};

import type { ProtocolAction, ProtocolContract } from './protocol-contract-types';

function isProtocolAction(value: unknown): value is ProtocolAction {
    if(!Array.isArray(value) || value.length === 0) {
        return false;
    }

    if(typeof value[0] !== 'number') {
        return false;
    }

    for(let i = 1; i < value.length; i += 1) {
        const param = value[i];
        const isAllowedPrimitive = typeof param === 'number'
            || typeof param === 'string'
            || typeof param === 'boolean'
            || param === null;
        if(!isAllowedPrimitive) {
            return false;
        }
    }

    return true;
}

const Protocol: ProtocolContract = {
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
    parseProtocolActionBatch(payload: string): ProtocolAction[] {
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
            return parsed.filter((entry): entry is ProtocolAction => isProtocolAction(entry));
        }

        if(isProtocolAction(parsed)) {
            return [parsed];
        }

        return [];
    },
};

module.exports = Protocol;
