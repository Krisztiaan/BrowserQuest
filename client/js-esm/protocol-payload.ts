import type { ProtocolAction } from '../../shared/js/protocol-contract-types';

export function isProtocolAction(value: unknown): value is ProtocolAction {
    if(!Array.isArray(value) || value.length === 0) {
        return false;
    }

    if(typeof value[0] !== "number") {
        return false;
    }

    for(var i = 1; i < value.length; i += 1) {
        var param = value[i];
        var isAllowedPrimitive = typeof param === "number"
            || typeof param === "string"
            || typeof param === "boolean"
            || param === null;
        if(!isAllowedPrimitive) {
            return false;
        }
    }

    return true;
}

export function normalizeProtocolActionBatch(decodedPayload: unknown): ProtocolAction[] {
    if(!Array.isArray(decodedPayload)) {
        return [];
    }

    if(decodedPayload.length > 0 && Array.isArray(decodedPayload[0])) {
        return decodedPayload.filter(function(entry): entry is ProtocolAction {
            return isProtocolAction(entry);
        });
    }

    if(isProtocolAction(decodedPayload)) {
        return [decodedPayload];
    }

    return [];
}
