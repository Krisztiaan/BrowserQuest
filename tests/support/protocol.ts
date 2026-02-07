import SharedTypes from '../../shared/js/gametypes-esm.mjs';

const Types = SharedTypes as {
    Messages: Record<string, number>;
    Entities: Record<string, number>;
};

export const MSG_HELLO = Types.Messages.HELLO;
export const MSG_WELCOME = Types.Messages.WELCOME;
export const MSG_SPAWN = Types.Messages.SPAWN;
export const MSG_MOVE = Types.Messages.MOVE;
export const MSG_LOOTMOVE = Types.Messages.LOOTMOVE;
export const MSG_ATTACK = Types.Messages.ATTACK;
export const MSG_HIT = Types.Messages.HIT;
export const MSG_CHAT = Types.Messages.CHAT;
export const MSG_DAMAGE = Types.Messages.DAMAGE;
export const MSG_LIST = Types.Messages.LIST;
export const MSG_WHO = Types.Messages.WHO;
export const MSG_ZONE = Types.Messages.ZONE;

export const ENTITY_CLOTH_ARMOR = Types.Entities.CLOTHARMOR;
export const ENTITY_SWORD_1 = Types.Entities.SWORD1;

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

export function parseProtocolActionBatch(payload: string): ProtocolAction[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(payload);
    } catch (_) {
        return [];
    }

    if (!Array.isArray(parsed)) {
        return [];
    }

    if (parsed.length > 0 && Array.isArray(parsed[0])) {
        return parsed.filter((entry): entry is ProtocolAction => Array.isArray(entry) && typeof entry[0] === 'number');
    }

    if (typeof parsed[0] === 'number') {
        return [parsed as ProtocolAction];
    }

    return [];
}
