var Types = require('./gametypes');

var Protocol = {
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
};

Protocol.parseProtocolActionBatch = function (payload) {
    var parsed;
    try {
        parsed = JSON.parse(payload);
    } catch (_) {
        return [];
    }

    if (!Array.isArray(parsed)) {
        return [];
    }

    if (parsed.length > 0 && Array.isArray(parsed[0])) {
        return parsed.filter(function (entry) {
            return Array.isArray(entry) && typeof entry[0] === 'number';
        });
    }

    if (typeof parsed[0] === 'number') {
        return [parsed];
    }

    return [];
};

module.exports = Protocol;
