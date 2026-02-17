import type {
    ClientToServerProtocolAction,
    ProtocolAction,
    ServerToClientProtocolAction,
} from './types';
import { checkClientToServerProtocolAction, isServerToClientProtocolAction } from './schema';
import {
    CLIENT_TO_SERVER_PROTOCOL_MANIFEST,
    PROTOCOL_MANIFEST,
    SERVER_TO_CLIENT_PROTOCOL_MANIFEST,
    type ProtocolDirection,
    type ProtocolManifestEntry,
} from './manifest';

export type ProtocolRegistryEntry<TDirection extends ProtocolDirection = ProtocolDirection> =
    ProtocolManifestEntry<TDirection>;

// The actual registry lists are derived from `shared/protocol/manifest.ts`.
export const CLIENT_TO_SERVER_PROTOCOL_REGISTRY = CLIENT_TO_SERVER_PROTOCOL_MANIFEST;
export const SERVER_TO_CLIENT_PROTOCOL_REGISTRY = SERVER_TO_CLIENT_PROTOCOL_MANIFEST;
export const PROTOCOL_REGISTRY = PROTOCOL_MANIFEST;

type JsonScalar = string | number | boolean | null;
type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };
type ProtocolDecodeInput = JsonValue | object | undefined;

function safeParseJson(payload: string): ProtocolDecodeInput {
    try {
        const parsed: JsonValue = JSON.parse(payload);
        return parsed;
    } catch (_) {
        return null;
    }
}

export function isClientToServerProtocolAction(
    value: ProtocolDecodeInput
): value is ClientToServerProtocolAction {
    return Array.isArray(value) && checkClientToServerProtocolAction(value);
}

export function decodeClientToServerProtocolAction(value: ProtocolDecodeInput): ClientToServerProtocolAction | null {
    return isClientToServerProtocolAction(value) ? value : null;
}

export function normalizeClientToServerProtocolActionBatch(value: ProtocolDecodeInput): ClientToServerProtocolAction[] {
    if (!Array.isArray(value)) {
        return [];
    }
    if (value.length > 0 && Array.isArray(value[0])) {
        const out: ClientToServerProtocolAction[] = [];
        for (let i = 0; i < value.length; i += 1) {
            const entry = value[i];
            if (!isClientToServerProtocolAction(entry)) {
                return [];
            }
            out.push(entry);
        }
        return out;
    }

    return isClientToServerProtocolAction(value) ? [value] : [];
}

export function decodeClientToServerProtocolActionBatch(payload: string): ClientToServerProtocolAction[] {
    return normalizeClientToServerProtocolActionBatch(safeParseJson(payload));
}

export function decodeServerToClientProtocolAction(value: ProtocolDecodeInput): ServerToClientProtocolAction | null {
    return isServerToClientProtocolAction(value) ? value : null;
}

export function normalizeServerToClientProtocolActionBatch(value: ProtocolDecodeInput): ServerToClientProtocolAction[] {
    if (!Array.isArray(value)) {
        return [];
    }
    if (value.length > 0 && Array.isArray(value[0])) {
        const out: ServerToClientProtocolAction[] = [];
        for (let i = 0; i < value.length; i += 1) {
            const entry = value[i];
            if (!isServerToClientProtocolAction(entry)) {
                return [];
            }
            out.push(entry);
        }
        return out;
    }

    return isServerToClientProtocolAction(value) ? [value] : [];
}

export function decodeServerToClientProtocolActionBatch(payload: string): ServerToClientProtocolAction[] {
    return normalizeServerToClientProtocolActionBatch(safeParseJson(payload));
}

export function encodeProtocolAction(action: ProtocolAction): string {
    return JSON.stringify(action);
}

export function encodeProtocolActionBatch(actions: ReadonlyArray<ProtocolAction>): string {
    return JSON.stringify(actions);
}
