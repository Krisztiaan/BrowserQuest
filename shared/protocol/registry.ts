import Types from '../gametypes-browser';
import type {
    ClientToServerProtocolAction,
    ProtocolAction,
    ProtocolOpcode,
    ServerToClientProtocolAction,
} from './types';
import { checkClientToServerProtocolAction, isServerToClientProtocolAction } from './schema';

export type ProtocolDirection = 'client_to_server' | 'server_to_client';

export type ProtocolRegistryEntry<TDirection extends ProtocolDirection = ProtocolDirection> = {
    key: string;
    opcode: ProtocolOpcode;
    direction: TDirection;
};

export const CLIENT_TO_SERVER_PROTOCOL_REGISTRY: ReadonlyArray<ProtocolRegistryEntry<'client_to_server'>> = [
    { key: 'HELLO', opcode: Types.Messages.HELLO, direction: 'client_to_server' },
    { key: 'MOVE', opcode: Types.Messages.MOVE, direction: 'client_to_server' },
    { key: 'LOOTMOVE', opcode: Types.Messages.LOOTMOVE, direction: 'client_to_server' },
    { key: 'AGGRO', opcode: Types.Messages.AGGRO, direction: 'client_to_server' },
    { key: 'ATTACK', opcode: Types.Messages.ATTACK, direction: 'client_to_server' },
    { key: 'HIT', opcode: Types.Messages.HIT, direction: 'client_to_server' },
    { key: 'HURT', opcode: Types.Messages.HURT, direction: 'client_to_server' },
    { key: 'CHAT', opcode: Types.Messages.CHAT, direction: 'client_to_server' },
    { key: 'LOOT', opcode: Types.Messages.LOOT, direction: 'client_to_server' },
    { key: 'TELEPORT', opcode: Types.Messages.TELEPORT, direction: 'client_to_server' },
    { key: 'WHO', opcode: Types.Messages.WHO, direction: 'client_to_server' },
    { key: 'ZONE', opcode: Types.Messages.ZONE, direction: 'client_to_server' },
    { key: 'OPEN', opcode: Types.Messages.OPEN, direction: 'client_to_server' },
    { key: 'CHECK', opcode: Types.Messages.CHECK, direction: 'client_to_server' },
];

export const SERVER_TO_CLIENT_PROTOCOL_REGISTRY: ReadonlyArray<ProtocolRegistryEntry<'server_to_client'>> = [
    { key: 'WELCOME', opcode: Types.Messages.WELCOME, direction: 'server_to_client' },
    { key: 'SPAWN', opcode: Types.Messages.SPAWN, direction: 'server_to_client' },
    { key: 'DESPAWN', opcode: Types.Messages.DESPAWN, direction: 'server_to_client' },
    { key: 'MOVE', opcode: Types.Messages.MOVE, direction: 'server_to_client' },
    { key: 'LOOTMOVE', opcode: Types.Messages.LOOTMOVE, direction: 'server_to_client' },
    { key: 'ATTACK', opcode: Types.Messages.ATTACK, direction: 'server_to_client' },
    { key: 'HEALTH', opcode: Types.Messages.HEALTH, direction: 'server_to_client' },
    { key: 'CHAT', opcode: Types.Messages.CHAT, direction: 'server_to_client' },
    { key: 'EQUIP', opcode: Types.Messages.EQUIP, direction: 'server_to_client' },
    { key: 'DROP', opcode: Types.Messages.DROP, direction: 'server_to_client' },
    { key: 'TELEPORT', opcode: Types.Messages.TELEPORT, direction: 'server_to_client' },
    { key: 'DAMAGE', opcode: Types.Messages.DAMAGE, direction: 'server_to_client' },
    { key: 'POPULATION', opcode: Types.Messages.POPULATION, direction: 'server_to_client' },
    { key: 'KILL', opcode: Types.Messages.KILL, direction: 'server_to_client' },
    { key: 'LIST', opcode: Types.Messages.LIST, direction: 'server_to_client' },
    { key: 'DESTROY', opcode: Types.Messages.DESTROY, direction: 'server_to_client' },
    { key: 'HP', opcode: Types.Messages.HP, direction: 'server_to_client' },
    { key: 'BLINK', opcode: Types.Messages.BLINK, direction: 'server_to_client' },
];

export const PROTOCOL_REGISTRY: ReadonlyArray<ProtocolRegistryEntry> = [
    ...CLIENT_TO_SERVER_PROTOCOL_REGISTRY,
    ...SERVER_TO_CLIENT_PROTOCOL_REGISTRY,
];

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
