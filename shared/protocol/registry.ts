import type {
    ClientToServerProtocolAction,
    ProtocolAction,
    ServerToClientProtocolAction,
} from './types';
import { checkClientToServerProtocolAction, isServerToClientProtocolAction } from './schema';
import { decodeBinaryActionBatchPayload, encodeBinaryActionBatchPayload } from './binary-action-codec';
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

type ProtocolDecodeInput = unknown;

function safeParseJson(payload: string): ProtocolDecodeInput {
    try {
        const parsed: unknown = JSON.parse(payload);
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
        const entries: unknown[] = value;
        for (let i = 0; i < entries.length; i += 1) {
            const entry = entries[i];
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

export function decodeClientToServerProtocolActionBatchBinary(payload: ArrayBuffer | Uint8Array): ClientToServerProtocolAction[] {
    try {
        return normalizeClientToServerProtocolActionBatch(decodeBinaryActionBatchPayload(payload));
    } catch {
        return [];
    }
}

export function decodeServerToClientProtocolAction(value: ProtocolDecodeInput): ServerToClientProtocolAction | null {
    const candidate = value as Parameters<typeof isServerToClientProtocolAction>[0];
    return isServerToClientProtocolAction(candidate) ? candidate : null;
}

export function normalizeServerToClientProtocolActionBatch(value: ProtocolDecodeInput): ServerToClientProtocolAction[] {
    if (!Array.isArray(value)) {
        return [];
    }
    if (value.length > 0 && Array.isArray(value[0])) {
        const out: ServerToClientProtocolAction[] = [];
        const entries: unknown[] = value;
        for (let i = 0; i < entries.length; i += 1) {
            const entry = entries[i];
            const candidate = entry as Parameters<typeof isServerToClientProtocolAction>[0];
            if (!isServerToClientProtocolAction(candidate)) {
                return [];
            }
            out.push(candidate);
        }
        return out;
    }

    const candidate = value as Parameters<typeof isServerToClientProtocolAction>[0];
    return isServerToClientProtocolAction(candidate) ? [candidate] : [];
}

export function decodeServerToClientProtocolActionBatch(payload: string): ServerToClientProtocolAction[] {
    return normalizeServerToClientProtocolActionBatch(safeParseJson(payload));
}

export function decodeServerToClientProtocolActionBatchBinary(payload: ArrayBuffer | Uint8Array): ServerToClientProtocolAction[] {
    try {
        return normalizeServerToClientProtocolActionBatch(decodeBinaryActionBatchPayload(payload));
    } catch {
        return [];
    }
}

export function encodeProtocolAction(action: ProtocolAction): string {
    return JSON.stringify(action);
}

export function encodeProtocolActionBatch(actions: ReadonlyArray<ProtocolAction>): string {
    return JSON.stringify(actions);
}

export function encodeProtocolActionBinary(action: ProtocolAction): Uint8Array {
    return encodeBinaryActionBatchPayload([action]);
}

export function encodeProtocolActionBatchBinary(actions: ReadonlyArray<ProtocolAction>): Uint8Array {
    return encodeBinaryActionBatchPayload(actions);
}
