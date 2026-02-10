import type { ServerToClientProtocolAction } from '../../shared/js/protocol-contract-types';
import { isServerToClientProtocolAction } from '../../shared/js/protocol-schema';

export function isProtocolAction(value: unknown): value is ServerToClientProtocolAction {
    return isServerToClientProtocolAction(value);
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
