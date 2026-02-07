export const MSG_HELLO = 0;
export const MSG_WELCOME = 1;
export const MSG_SPAWN = 2;
export const MSG_MOVE = 4;
export const MSG_LOOTMOVE = 5;
export const MSG_ATTACK = 7;
export const MSG_HIT = 8;
export const MSG_CHAT = 11;
export const MSG_DAMAGE = 16;
export const MSG_LIST = 19;
export const MSG_WHO = 20;
export const MSG_ZONE = 21;

export const ENTITY_CLOTH_ARMOR = 21;
export const ENTITY_SWORD_1 = 60;

export type ProtocolActionValue = number | string | boolean | null;
export type ProtocolAction = [number, ...ProtocolActionValue[]];

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
