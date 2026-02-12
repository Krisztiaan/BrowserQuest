import type { ProtocolActionValue, ServerToClientProtocolAction } from './types';
import {
    CLIENT_TO_SERVER_PROTOCOL_MANIFEST,
    SERVER_TO_CLIENT_PROTOCOL_MANIFEST,
    type ClientToServerProtocolManifestEntry,
    type ServerToClientProtocolManifestEntry,
} from './manifest';

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
        isFiniteNumber(value) || isString(value) || typeof value === 'boolean' || value === null || isNumberArray(value)
    );
}

function validateClientToServerArg(kind: 'n' | 's', value: unknown): boolean {
    switch (kind) {
        case 'n':
            return isFiniteInteger(value);
        case 's':
            return isString(value);
    }
}

function validateServerToClientArg(kind: 'n' | 's' | 'ns' | 'na' | 'pv' | 'lit1', value: unknown): boolean {
    switch (kind) {
        case 'n':
            return isFiniteNumber(value);
        case 's':
            return isString(value);
        case 'ns':
            return isNumberOrString(value);
        case 'na':
            return isNumberArray(value);
        case 'pv':
            return isProtocolActionValue(value);
        case 'lit1':
            return value === 1;
        default:
            return false;
    }
}

function validateClientToServerActionBySchema(entry: ClientToServerProtocolManifestEntry, action: unknown[]): boolean {
    if (action.length === 0 || !isFiniteNumber(action[0])) {
        return false;
    }
    const opcode = action[0];
    if (opcode !== entry.opcode) {
        return false;
    }

    const payload = action.slice(1);
    const schema = entry.schema;
    if (schema.kind === 'fixed') {
        if (payload.length !== schema.args.length) {
            return false;
        }
        for (let i = 0; i < schema.args.length; i += 1) {
            const argKind = schema.args[i];
            if (!argKind || !validateClientToServerArg(argKind, payload[i])) {
                return false;
            }
        }
        return true;
    }

    if (schema.kind === 'varargs') {
        if (payload.length < schema.minArgs) {
            return false;
        }
        for (let i = 0; i < payload.length; i += 1) {
            if (!validateClientToServerArg(schema.arg as 'n' | 's', payload[i])) {
                return false;
            }
        }
        return true;
    }

    return false;
}

function validateServerToClientActionBySchema(entry: ServerToClientProtocolManifestEntry, action: unknown[]): boolean {
    if (action.length === 0 || !isFiniteNumber(action[0])) {
        return false;
    }
    const opcode = action[0];
    if (opcode !== entry.opcode) {
        return false;
    }

    const payload = action.slice(1);
    const schema = entry.schema;
    switch (schema.kind) {
        case 'fixed': {
            if (payload.length !== schema.args.length) {
                return false;
            }
            for (let i = 0; i < schema.args.length; i += 1) {
                const argKind = schema.args[i];
                if (!argKind || !validateServerToClientArg(argKind, payload[i])) {
                    return false;
                }
            }
            return true;
        }
        case 'varargs': {
            if (payload.length < schema.minArgs) {
                return false;
            }
            for (let i = 0; i < payload.length; i += 1) {
                if (!validateServerToClientArg(schema.arg, payload[i])) {
                    return false;
                }
            }
            return true;
        }
        case 'prefixRest': {
            if (payload.length < schema.prefix.length) {
                return false;
            }
            for (let i = 0; i < schema.prefix.length; i += 1) {
                const argKind = schema.prefix[i];
                if (!argKind || !validateServerToClientArg(argKind, payload[i])) {
                    return false;
                }
            }
            for (let i = schema.prefix.length; i < payload.length; i += 1) {
                if (!validateServerToClientArg(schema.rest, payload[i])) {
                    return false;
                }
            }
            return true;
        }
        case 'oneOf': {
            for (let optIndex = 0; optIndex < schema.options.length; optIndex += 1) {
                const opt = schema.options[optIndex];
                if (opt?.args.length !== payload.length) {
                    continue;
                }
                let ok = true;
                for (let i = 0; i < opt.args.length; i += 1) {
                    const argKind = opt.args[i];
                    if (!argKind || !validateServerToClientArg(argKind, payload[i])) {
                        ok = false;
                        break;
                    }
                }
                if (ok) {
                    return true;
                }
            }
            return false;
        }
        default:
            return false;
    }
}

const CLIENT_TO_SERVER_ENTRY_BY_OPCODE = new Map<number, ClientToServerProtocolManifestEntry>(
    CLIENT_TO_SERVER_PROTOCOL_MANIFEST.map((entry) => [entry.opcode, entry])
);
const SERVER_TO_CLIENT_ENTRY_BY_OPCODE = new Map<number, ServerToClientProtocolManifestEntry>(
    SERVER_TO_CLIENT_PROTOCOL_MANIFEST.map((entry) => [entry.opcode, entry])
);

export const CLIENT_TO_SERVER_FORMAT_SCHEMA: ClientToServerFormatSchema = Object.fromEntries(
    CLIENT_TO_SERVER_PROTOCOL_MANIFEST.flatMap((entry) =>
        entry.schema.kind === 'fixed' ? [[entry.opcode, [...entry.schema.args] as MessageTypeFormat]] : []
    )
) as ClientToServerFormatSchema;

export function isFixedClientToServerOpcode(type: number): boolean {
    return type in CLIENT_TO_SERVER_FORMAT_SCHEMA;
}

export function checkClientToServerProtocolAction(action: unknown[]): boolean {
    if (action.length === 0 || !isFiniteNumber(action[0])) {
        return false;
    }
    const opcode = action[0];
    const entry = CLIENT_TO_SERVER_ENTRY_BY_OPCODE.get(opcode);
    if (!entry) {
        return false;
    }
    return validateClientToServerActionBySchema(entry, action);
}

export function isServerToClientProtocolAction(action: unknown): action is ServerToClientProtocolAction {
    if (!Array.isArray(action) || action.length === 0 || !isFiniteNumber(action[0])) {
        return false;
    }
    const opcode = action[0];
    const entry = SERVER_TO_CLIENT_ENTRY_BY_OPCODE.get(opcode);
    if (!entry) {
        return false;
    }
    return validateServerToClientActionBySchema(entry, action);
}

export default {
    CLIENT_TO_SERVER_FORMAT_SCHEMA,
    checkClientToServerProtocolAction,
    isFixedClientToServerOpcode,
    isServerToClientProtocolAction,
};
