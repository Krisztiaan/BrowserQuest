import type { ProtocolActionValue, ServerToClientProtocolAction } from '../../shared/js/protocol-contract-types';

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isString(value: unknown): value is string {
    return typeof value === 'string';
}

function isNumberOrString(value: unknown): value is number | string {
    return isNumber(value) || isString(value);
}

function isNumberArray(value: unknown): value is number[] {
    return Array.isArray(value) && value.every(isNumber);
}

function isProtocolActionValue(value: unknown): value is ProtocolActionValue {
    return (
        isNumber(value) ||
        isString(value) ||
        typeof value === 'boolean' ||
        value === null ||
        isNumberArray(value)
    );
}

export function isProtocolAction(value: unknown): value is ServerToClientProtocolAction {
    if(!Array.isArray(value) || value.length === 0) {
        return false;
    }

    if(!isNumber(value[0])) {
        return false;
    }

    const opcode = value[0];

    switch(opcode) {
        case 1:
            return value.length === 6
                && isNumber(value[1])
                && isString(value[2])
                && isNumber(value[3])
                && isNumber(value[4])
                && isNumber(value[5]);
        case 2:
            return value.length >= 5
                && isNumber(value[1])
                && isNumberOrString(value[2])
                && isNumber(value[3])
                && isNumber(value[4])
                && value.slice(5).every(isProtocolActionValue);
        case 3:
            return value.length === 2 && isNumber(value[1]);
        case 4:
            return value.length === 4 && isNumber(value[1]) && isNumber(value[2]) && isNumber(value[3]);
        case 5:
            return value.length === 3 && isNumber(value[1]) && isNumber(value[2]);
        case 7:
            return value.length === 3 && isNumber(value[1]) && isNumber(value[2]);
        case 10:
            return (
                (value.length === 2 && isNumber(value[1])) ||
                (value.length === 3 && isNumber(value[1]) && value[2] === 1)
            );
        case 11:
            return value.length === 3 && isNumber(value[1]) && isString(value[2]);
        case 13:
            return value.length === 3 && isNumber(value[1]) && isNumberOrString(value[2]);
        case 14:
            return value.length === 5
                && isNumber(value[1])
                && isNumber(value[2])
                && isNumberOrString(value[3])
                && isNumberArray(value[4]);
        case 15:
            return value.length === 4 && isNumber(value[1]) && isNumber(value[2]) && isNumber(value[3]);
        case 16:
            return value.length === 3 && isNumber(value[1]) && isNumber(value[2]);
        case 17:
            return value.length === 3 && isNumber(value[1]) && isNumber(value[2]);
        case 18:
            return value.length === 2 && isNumberOrString(value[1]);
        case 19:
            return value.length >= 1 && value.slice(1).every(isNumber);
        case 22:
            return value.length === 2 && isNumber(value[1]);
        case 23:
            return value.length === 2 && isNumber(value[1]);
        case 24:
            return value.length === 2 && isNumber(value[1]);
        default:
            return false;
    }
}

export function normalizeProtocolActionBatch(decodedPayload: unknown): ServerToClientProtocolAction[] {
    if(!Array.isArray(decodedPayload)) {
        return [];
    }

    if(decodedPayload.length > 0 && Array.isArray(decodedPayload[0])) {
        return decodedPayload.filter(function(entry): entry is ServerToClientProtocolAction {
            return isProtocolAction(entry);
        });
    }

    if(isProtocolAction(decodedPayload)) {
        return [decodedPayload];
    }

    return [];
}
