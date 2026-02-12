import Types from '../gametypes-browser';
import type { ClientToServerProtocolAction, ProtocolOpcode, ServerToClientProtocolAction } from './types';

export type ProtocolDirection = 'client_to_server' | 'server_to_client';

type ClientToServerArg = 'n' | 's';
type ServerToClientArg = 'n' | 's' | 'ns' | 'na' | 'pv' | 'lit1';

type ActionSchema<TArg extends string> =
    | Readonly<{ kind: 'fixed'; args: ReadonlyArray<TArg> }>
    | Readonly<{ kind: 'varargs'; minArgs: number; arg: TArg }>
    | Readonly<{ kind: 'prefixRest'; prefix: ReadonlyArray<TArg>; rest: TArg }>
    | Readonly<{ kind: 'oneOf'; options: ReadonlyArray<Readonly<{ args: ReadonlyArray<TArg> }>> }>;

export type ProtocolManifestEntry<TDirection extends ProtocolDirection = ProtocolDirection> = Readonly<{
    key: string;
    opcode: ProtocolOpcode;
    direction: TDirection;
}>;

export type ClientToServerProtocolManifestEntry = ProtocolManifestEntry<'client_to_server'> & Readonly<{
    schema: ActionSchema<ClientToServerArg>;
}>;

export type ServerToClientProtocolManifestEntry = ProtocolManifestEntry<'server_to_client'> & Readonly<{
    schema: ActionSchema<ServerToClientArg>;
}>;

export const CLIENT_TO_SERVER_PROTOCOL_MANIFEST = [
    { key: 'HELLO', opcode: Types.Messages.HELLO, direction: 'client_to_server', schema: { kind: 'fixed', args: ['s', 'n', 'n'] } },
    { key: 'MOVE', opcode: Types.Messages.MOVE, direction: 'client_to_server', schema: { kind: 'fixed', args: ['n', 'n'] } },
    { key: 'LOOTMOVE', opcode: Types.Messages.LOOTMOVE, direction: 'client_to_server', schema: { kind: 'fixed', args: ['n', 'n', 'n'] } },
    { key: 'AGGRO', opcode: Types.Messages.AGGRO, direction: 'client_to_server', schema: { kind: 'fixed', args: ['n'] } },
    { key: 'ATTACK', opcode: Types.Messages.ATTACK, direction: 'client_to_server', schema: { kind: 'fixed', args: ['n'] } },
    { key: 'HIT', opcode: Types.Messages.HIT, direction: 'client_to_server', schema: { kind: 'fixed', args: ['n'] } },
    { key: 'HURT', opcode: Types.Messages.HURT, direction: 'client_to_server', schema: { kind: 'fixed', args: ['n'] } },
    { key: 'CHAT', opcode: Types.Messages.CHAT, direction: 'client_to_server', schema: { kind: 'fixed', args: ['s'] } },
    { key: 'LOOT', opcode: Types.Messages.LOOT, direction: 'client_to_server', schema: { kind: 'fixed', args: ['n'] } },
    { key: 'TELEPORT', opcode: Types.Messages.TELEPORT, direction: 'client_to_server', schema: { kind: 'fixed', args: ['n', 'n'] } },
    { key: 'WHO', opcode: Types.Messages.WHO, direction: 'client_to_server', schema: { kind: 'varargs', minArgs: 1, arg: 'n' } },
    { key: 'ZONE', opcode: Types.Messages.ZONE, direction: 'client_to_server', schema: { kind: 'fixed', args: [] } },
    { key: 'OPEN', opcode: Types.Messages.OPEN, direction: 'client_to_server', schema: { kind: 'fixed', args: ['n'] } },
    { key: 'CHECK', opcode: Types.Messages.CHECK, direction: 'client_to_server', schema: { kind: 'fixed', args: ['n'] } },
] as const satisfies ReadonlyArray<ClientToServerProtocolManifestEntry>;

export const SERVER_TO_CLIENT_PROTOCOL_MANIFEST = [
    {
        key: 'WELCOME',
        opcode: Types.Messages.WELCOME,
        direction: 'server_to_client',
        schema: { kind: 'fixed', args: ['n', 's', 'n', 'n', 'n'] },
    },
    {
        key: 'SPAWN',
        opcode: Types.Messages.SPAWN,
        direction: 'server_to_client',
        schema: { kind: 'prefixRest', prefix: ['n', 'ns', 'n', 'n'], rest: 'pv' },
    },
    { key: 'DESPAWN', opcode: Types.Messages.DESPAWN, direction: 'server_to_client', schema: { kind: 'fixed', args: ['n'] } },
    { key: 'MOVE', opcode: Types.Messages.MOVE, direction: 'server_to_client', schema: { kind: 'fixed', args: ['n', 'n', 'n'] } },
    { key: 'LOOTMOVE', opcode: Types.Messages.LOOTMOVE, direction: 'server_to_client', schema: { kind: 'fixed', args: ['n', 'n'] } },
    { key: 'ATTACK', opcode: Types.Messages.ATTACK, direction: 'server_to_client', schema: { kind: 'fixed', args: ['n', 'n'] } },
    { key: 'HEALTH', opcode: Types.Messages.HEALTH, direction: 'server_to_client', schema: { kind: 'oneOf', options: [{ args: ['n'] }, { args: ['n', 'lit1'] }] } },
    { key: 'CHAT', opcode: Types.Messages.CHAT, direction: 'server_to_client', schema: { kind: 'fixed', args: ['n', 's'] } },
    { key: 'EQUIP', opcode: Types.Messages.EQUIP, direction: 'server_to_client', schema: { kind: 'fixed', args: ['n', 'ns'] } },
    { key: 'DROP', opcode: Types.Messages.DROP, direction: 'server_to_client', schema: { kind: 'fixed', args: ['n', 'n', 'ns', 'na'] } },
    { key: 'TELEPORT', opcode: Types.Messages.TELEPORT, direction: 'server_to_client', schema: { kind: 'fixed', args: ['n', 'n', 'n'] } },
    { key: 'DAMAGE', opcode: Types.Messages.DAMAGE, direction: 'server_to_client', schema: { kind: 'fixed', args: ['n', 'n'] } },
    { key: 'POPULATION', opcode: Types.Messages.POPULATION, direction: 'server_to_client', schema: { kind: 'fixed', args: ['n', 'n'] } },
    { key: 'KILL', opcode: Types.Messages.KILL, direction: 'server_to_client', schema: { kind: 'fixed', args: ['ns'] } },
    { key: 'LIST', opcode: Types.Messages.LIST, direction: 'server_to_client', schema: { kind: 'varargs', minArgs: 0, arg: 'n' } },
    { key: 'DESTROY', opcode: Types.Messages.DESTROY, direction: 'server_to_client', schema: { kind: 'fixed', args: ['n'] } },
    { key: 'HP', opcode: Types.Messages.HP, direction: 'server_to_client', schema: { kind: 'fixed', args: ['n'] } },
    { key: 'BLINK', opcode: Types.Messages.BLINK, direction: 'server_to_client', schema: { kind: 'fixed', args: ['n'] } },
] as const satisfies ReadonlyArray<ServerToClientProtocolManifestEntry>;

export const PROTOCOL_MANIFEST = [
    ...CLIENT_TO_SERVER_PROTOCOL_MANIFEST,
    ...SERVER_TO_CLIENT_PROTOCOL_MANIFEST,
] as const satisfies ReadonlyArray<ProtocolManifestEntry>;

export function isClientToServerManifestEntry(entry: ProtocolManifestEntry): entry is ClientToServerProtocolManifestEntry {
    return entry.direction === 'client_to_server';
}

export function isServerToClientManifestEntry(entry: ProtocolManifestEntry): entry is ServerToClientProtocolManifestEntry {
    return entry.direction === 'server_to_client';
}

// Compile-time coverage checks: protocol action unions and manifest must stay aligned.
type ManifestClientToServerOpcodes = (typeof CLIENT_TO_SERVER_PROTOCOL_MANIFEST)[number]['opcode'];
type ManifestServerToClientOpcodes = (typeof SERVER_TO_CLIENT_PROTOCOL_MANIFEST)[number]['opcode'];
type ClientToServerOpcodes = ClientToServerProtocolAction[0];
type ServerToClientOpcodes = ServerToClientProtocolAction[0];

type _AssertManifestC2SIsSubset = Exclude<ManifestClientToServerOpcodes, ClientToServerOpcodes> extends never
    ? true
    : never;
type _AssertManifestS2CIsSubset = Exclude<ManifestServerToClientOpcodes, ServerToClientOpcodes> extends never
    ? true
    : never;
type _AssertC2SIsSubsetOfManifest = Exclude<ClientToServerOpcodes, ManifestClientToServerOpcodes> extends never
    ? true
    : never;
type _AssertS2CIsSubsetOfManifest = Exclude<ServerToClientOpcodes, ManifestServerToClientOpcodes> extends never
    ? true
    : never;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _manifestCoverageC2S: _AssertManifestC2SIsSubset & _AssertC2SIsSubsetOfManifest = true;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _manifestCoverageS2C: _AssertManifestS2CIsSubset & _AssertS2CIsSubsetOfManifest = true;
