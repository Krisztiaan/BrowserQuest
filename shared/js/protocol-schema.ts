import Types from './gametypes-browser';
import type {
    ProtocolActionValue,
    ServerToClientProtocolAction,
} from './protocol-contract-types';

type MessageTypeFormat = Array<'n' | 's'>;
export type ClientToServerFormatSchema = Record<number, MessageTypeFormat>;

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isFiniteInteger(value: unknown): value is number {
    return isFiniteNumber(value) && Number.isSafeInteger(value);
}

function isString(value: unknown): value is string {
    return typeof value === 'string';
}

function isNumberOrString(value: unknown): value is number | string {
    return isFiniteNumber(value) || isString(value);
}

function isNumberArray(value: unknown): value is number[] {
    return Array.isArray(value) && value.every(isFiniteNumber);
}

function isProtocolActionValue(value: unknown): value is ProtocolActionValue {
    return (
        isFiniteNumber(value) ||
        isString(value) ||
        typeof value === 'boolean' ||
        value === null ||
        isNumberArray(value)
    );
}

export const CLIENT_TO_SERVER_FORMAT_SCHEMA: ClientToServerFormatSchema = {
    [Types.Messages.HELLO]: ['s', 'n', 'n'],
    [Types.Messages.MOVE]: ['n', 'n'],
    [Types.Messages.LOOTMOVE]: ['n', 'n', 'n'],
    [Types.Messages.AGGRO]: ['n'],
    [Types.Messages.ATTACK]: ['n'],
    [Types.Messages.HIT]: ['n'],
    [Types.Messages.HURT]: ['n'],
    [Types.Messages.CHAT]: ['s'],
    [Types.Messages.LOOT]: ['n'],
    [Types.Messages.TELEPORT]: ['n', 'n'],
    [Types.Messages.ZONE]: [],
    [Types.Messages.OPEN]: ['n'],
    [Types.Messages.CHECK]: ['n'],
};

type ServerToClientActionValidator = (action: unknown[]) => boolean;

const SERVER_TO_CLIENT_FIXED_VALIDATORS: Record<number, ServerToClientActionValidator> = {
    [Types.Messages.WELCOME]: (action) =>
        action.length === 6 &&
        isFiniteNumber(action[1]) &&
        isString(action[2]) &&
        isFiniteNumber(action[3]) &&
        isFiniteNumber(action[4]) &&
        isFiniteNumber(action[5]),
    [Types.Messages.SPAWN]: (action) =>
        action.length >= 5 &&
        isFiniteNumber(action[1]) &&
        isNumberOrString(action[2]) &&
        isFiniteNumber(action[3]) &&
        isFiniteNumber(action[4]) &&
        action.slice(5).every(isProtocolActionValue),
    [Types.Messages.DESPAWN]: (action) => action.length === 2 && isFiniteNumber(action[1]),
    [Types.Messages.MOVE]: (action) =>
        action.length === 4 && isFiniteNumber(action[1]) && isFiniteNumber(action[2]) && isFiniteNumber(action[3]),
    [Types.Messages.LOOTMOVE]: (action) => action.length === 3 && isFiniteNumber(action[1]) && isFiniteNumber(action[2]),
    [Types.Messages.ATTACK]: (action) => action.length === 3 && isFiniteNumber(action[1]) && isFiniteNumber(action[2]),
    [Types.Messages.HEALTH]: (action) =>
        (action.length === 2 && isFiniteNumber(action[1])) ||
        (action.length === 3 && isFiniteNumber(action[1]) && action[2] === 1),
    [Types.Messages.CHAT]: (action) => action.length === 3 && isFiniteNumber(action[1]) && isString(action[2]),
    [Types.Messages.EQUIP]: (action) => action.length === 3 && isFiniteNumber(action[1]) && isNumberOrString(action[2]),
    [Types.Messages.DROP]: (action) =>
        action.length === 5 &&
        isFiniteNumber(action[1]) &&
        isFiniteNumber(action[2]) &&
        isNumberOrString(action[3]) &&
        isNumberArray(action[4]),
    [Types.Messages.TELEPORT]: (action) =>
        action.length === 4 && isFiniteNumber(action[1]) && isFiniteNumber(action[2]) && isFiniteNumber(action[3]),
    [Types.Messages.DAMAGE]: (action) => action.length === 3 && isFiniteNumber(action[1]) && isFiniteNumber(action[2]),
    [Types.Messages.POPULATION]: (action) =>
        action.length === 3 && isFiniteNumber(action[1]) && isFiniteNumber(action[2]),
    [Types.Messages.KILL]: (action) => action.length === 2 && isNumberOrString(action[1]),
    [Types.Messages.DESTROY]: (action) => action.length === 2 && isFiniteNumber(action[1]),
    [Types.Messages.HP]: (action) => action.length === 2 && isFiniteNumber(action[1]),
    [Types.Messages.BLINK]: (action) => action.length === 2 && isFiniteNumber(action[1]),
};

export function isFixedClientToServerOpcode(type: number): boolean {
    return type in CLIENT_TO_SERVER_FORMAT_SCHEMA;
}

export function checkClientToServerProtocolAction(action: unknown[]): boolean {
    if (action.length === 0 || !isFiniteNumber(action[0])) {
        return false;
    }

    const opcode = action[0];
    const payload = action.slice(1);

    if (isFixedClientToServerOpcode(opcode)) {
        const format = CLIENT_TO_SERVER_FORMAT_SCHEMA[opcode] as MessageTypeFormat;
        if (payload.length !== format.length) {
            return false;
        }

        for (let i = 0; i < payload.length; i += 1) {
            if (format[i] === 'n' && !isFiniteInteger(payload[i])) {
                return false;
            }
            if (format[i] === 's' && !isString(payload[i])) {
                return false;
            }
        }
        return true;
    }

    if (opcode === Types.Messages.WHO) {
        return payload.length > 0 && payload.every((entry) => isFiniteInteger(entry));
    }

    return false;
}

export function isServerToClientProtocolAction(action: unknown): action is ServerToClientProtocolAction {
    if (!Array.isArray(action) || action.length === 0 || !isFiniteNumber(action[0])) {
        return false;
    }

    const opcode = action[0];
    if (opcode === Types.Messages.LIST) {
        return action.slice(1).every((entry) => isFiniteNumber(entry));
    }

    const validate = SERVER_TO_CLIENT_FIXED_VALIDATORS[opcode];
    return validate ? validate(action) : false;
}

export default {
    CLIENT_TO_SERVER_FORMAT_SCHEMA,
    checkClientToServerProtocolAction,
    isFixedClientToServerOpcode,
    isServerToClientProtocolAction,
};
