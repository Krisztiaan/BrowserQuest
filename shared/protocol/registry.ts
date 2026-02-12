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

function safeParseJson(payload: string): unknown {
    try {
        return JSON.parse(payload);
    } catch (_) {
        return null;
    }
}

export function isClientToServerProtocolAction(value: unknown): value is ClientToServerProtocolAction {
    return Array.isArray(value) && checkClientToServerProtocolAction(value);
}

export function decodeClientToServerProtocolAction(value: unknown): ClientToServerProtocolAction | null {
    return isClientToServerProtocolAction(value) ? value : null;
}

export function normalizeClientToServerProtocolActionBatch(value: unknown): ClientToServerProtocolAction[] {
    if (!Array.isArray(value)) {
        return [];
    }
    if (value.length > 0 && Array.isArray(value[0])) {
        return value.filter((entry): entry is ClientToServerProtocolAction => isClientToServerProtocolAction(entry));
    }

    return isClientToServerProtocolAction(value) ? [value] : [];
}

export function decodeClientToServerProtocolActionBatch(payload: string): ClientToServerProtocolAction[] {
    return normalizeClientToServerProtocolActionBatch(safeParseJson(payload));
}

export function decodeServerToClientProtocolAction(value: unknown): ServerToClientProtocolAction | null {
    return isServerToClientProtocolAction(value) ? value : null;
}

export function normalizeServerToClientProtocolActionBatch(value: unknown): ServerToClientProtocolAction[] {
    if (!Array.isArray(value)) {
        return [];
    }
    if (value.length > 0 && Array.isArray(value[0])) {
        return value.filter((entry): entry is ServerToClientProtocolAction => isServerToClientProtocolAction(entry));
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
