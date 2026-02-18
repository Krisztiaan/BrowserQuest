import type {
    ClientToServerProtocolAction,
    ProtocolAction,
    ServerToClientProtocolAction,
} from './types';

type ProtocolDecodeInput = unknown;

function safeParseJson(payload: string): ProtocolDecodeInput {
    try {
        const parsed: unknown = JSON.parse(payload);
        return parsed;
    } catch (_) {
        return null;
    }
}

export function decodeClientToServerProtocolActionBatchJson(payload: string): ProtocolDecodeInput {
    return safeParseJson(payload);
}

export function decodeServerToClientProtocolActionBatchJson(payload: string): ProtocolDecodeInput {
    return safeParseJson(payload);
}

export function encodeProtocolActionJson(action: ProtocolAction): string {
    return JSON.stringify(action);
}

export function encodeProtocolActionBatchJson(actions: ReadonlyArray<ProtocolAction>): string {
    return JSON.stringify(actions);
}

export function encodeClientToServerProtocolActionBatchJson(actions: ReadonlyArray<ClientToServerProtocolAction>): string {
    return JSON.stringify(actions);
}

export function encodeServerToClientProtocolActionBatchJson(actions: ReadonlyArray<ServerToClientProtocolAction>): string {
    return JSON.stringify(actions);
}
