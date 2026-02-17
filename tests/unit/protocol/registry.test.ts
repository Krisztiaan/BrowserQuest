import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import {
    GAMECLIENT_INBOUND_HANDLER_OPCODES,
    PLAYER_SESSION_DISPATCH_OPCODES,
} from '../../../shared/protocol/handler-opcodes';
import { CLIENT_TO_SERVER_FORMAT_SCHEMA } from '../../../shared/protocol/schema';
import {
    CLIENT_TO_SERVER_PROTOCOL_REGISTRY,
    SERVER_TO_CLIENT_PROTOCOL_REGISTRY,
    decodeClientToServerProtocolAction,
    decodeClientToServerProtocolActionBatch,
    decodeServerToClientProtocolAction,
    decodeServerToClientProtocolActionBatch,
    encodeProtocolAction,
    encodeProtocolActionBatch,
    normalizeClientToServerProtocolActionBatch,
    normalizeServerToClientProtocolActionBatch,
} from '../../../shared/protocol/registry';

function sortedUnique(values: number[]): number[] {
    return [...new Set(values)].sort((a, b) => a - b);
}

test('client-to-server protocol registry stays aligned with schema opcodes', () => {
    const registryOpcodes = sortedUnique(CLIENT_TO_SERVER_PROTOCOL_REGISTRY.map((entry) => entry.opcode));
    const schemaOpcodes = sortedUnique([
        ...Object.keys(CLIENT_TO_SERVER_FORMAT_SCHEMA).map((key) => Number(key)),
        Types.Messages.HELLO,
        Types.Messages.WHO,
    ]);

    expect(registryOpcodes).toEqual(schemaOpcodes);
});

test('server-to-client protocol registry stays aligned with canonical opcode set', () => {
    const registryOpcodes = sortedUnique(SERVER_TO_CLIENT_PROTOCOL_REGISTRY.map((entry) => entry.opcode));
    const expectedOpcodes = sortedUnique([
        Types.Messages.WELCOME,
        Types.Messages.SPAWN,
        Types.Messages.DESPAWN,
        Types.Messages.MOVE,
        Types.Messages.LOOTMOVE,
        Types.Messages.ATTACK,
        Types.Messages.HEALTH,
        Types.Messages.CHAT,
        Types.Messages.EQUIP,
        Types.Messages.DROP,
        Types.Messages.TELEPORT,
        Types.Messages.DAMAGE,
        Types.Messages.POPULATION,
        Types.Messages.KILL,
        Types.Messages.LIST,
        Types.Messages.DESTROY,
        Types.Messages.HP,
        Types.Messages.BLINK,
        Types.Messages.ACHIEVEMENTS,
        Types.Messages.OUTCOME,
        Types.Messages.REJECT,
        Types.Messages.ACK,
        Types.Messages.CORRECTION,
        Types.Messages.CHUNK_SNAPSHOT,
        Types.Messages.CHUNK_SNAPSHOT_PART,
        Types.Messages.CHUNK_DELTA,
    ]);

    expect(registryOpcodes).toEqual(expectedOpcodes);
});

test('registry decode helpers accept valid actions and reject invalid actions', () => {
    expect(decodeClientToServerProtocolAction([Types.Messages.INTENT, 1, 'move.step', '{"x":10,"y":20}'])).toEqual([
        Types.Messages.INTENT,
        1,
        'move.step',
        '{"x":10,"y":20}',
    ]);
    expect(decodeClientToServerProtocolAction([Types.Messages.INTENT, 1.5, 'move.step', '{"x":10,"y":20}'])).toBeNull();

    expect(decodeServerToClientProtocolAction([Types.Messages.CHAT, 5, 'hi'])).toEqual([Types.Messages.CHAT, 5, 'hi']);
    expect(decodeServerToClientProtocolAction([Types.Messages.CHAT, 5, 99])).toBeNull();
});

test('registry batch helpers normalize single and multi action payloads', () => {
    expect(normalizeClientToServerProtocolActionBatch([Types.Messages.ZONE])).toEqual([[Types.Messages.ZONE]]);
    expect(
        normalizeClientToServerProtocolActionBatch([
            [Types.Messages.ZONE],
            [Types.Messages.INTENT, 2, 'move.step', '{"x":4,"y":5}'],
        ])
    ).toEqual([
        [Types.Messages.ZONE],
        [Types.Messages.INTENT, 2, 'move.step', '{"x":4,"y":5}'],
    ]);
    expect(normalizeClientToServerProtocolActionBatch([[Types.Messages.ZONE], ['bad']])).toEqual([]);
    expect(normalizeServerToClientProtocolActionBatch([Types.Messages.POPULATION, 3, 10])).toEqual([
        [Types.Messages.POPULATION, 3, 10],
    ]);
    expect(
        normalizeServerToClientProtocolActionBatch([
            [Types.Messages.POPULATION, 3, 10],
            [Types.Messages.HP, 100],
        ])
    ).toEqual([
        [Types.Messages.POPULATION, 3, 10],
        [Types.Messages.HP, 100],
    ]);
    expect(normalizeServerToClientProtocolActionBatch([[Types.Messages.HP, 100], ['bad']])).toEqual([]);
});

test('registry string batch decoders parse and validate payload frames', () => {
    expect(
        decodeClientToServerProtocolActionBatch(
            JSON.stringify([
                [Types.Messages.ZONE],
                [Types.Messages.INTENT, 1, 'move.step', '{"x":8,"y":9}'],
            ])
        )
    ).toEqual([
        [Types.Messages.ZONE],
        [Types.Messages.INTENT, 1, 'move.step', '{"x":8,"y":9}'],
    ]);
    expect(
        decodeClientToServerProtocolActionBatch(
            JSON.stringify([[Types.Messages.INTENT, 1.5, 'move.step', '{"x":8,"y":9}']])
        )
    ).toEqual([]);
    expect(decodeClientToServerProtocolActionBatch('[[21],["bad"]]')).toEqual([]);

    expect(decodeServerToClientProtocolActionBatch('[[17,1,2],[23,50]]')).toEqual([
        [Types.Messages.POPULATION, 1, 2],
        [Types.Messages.HP, 50],
    ]);
    expect(decodeServerToClientProtocolActionBatch('[[11,5,10]]')).toEqual([]);
    expect(decodeServerToClientProtocolActionBatch('[[23,50],["bad"]]')).toEqual([]);
});

test('registry encode helpers preserve protocol action payload shapes', () => {
    expect(encodeProtocolAction([Types.Messages.ZONE])).toBe(JSON.stringify([Types.Messages.ZONE]));
    expect(encodeProtocolActionBatch([[Types.Messages.ZONE], [Types.Messages.INTENT, 7, 'move.step', '{"x":7,"y":8}']])).toBe(
        JSON.stringify([[Types.Messages.ZONE], [Types.Messages.INTENT, 7, 'move.step', '{"x":7,"y":8}']])
    );
});

test('player session dispatch opcode coverage stays aligned with client-to-server registry', () => {
    const registryOpcodes = sortedUnique(CLIENT_TO_SERVER_PROTOCOL_REGISTRY.map((entry) => entry.opcode));
    const dispatchOpcodes = sortedUnique([...PLAYER_SESSION_DISPATCH_OPCODES]);

    expect(dispatchOpcodes).toEqual(registryOpcodes);
});

test('gameclient inbound handler opcode coverage stays aligned with server-to-client registry', () => {
    const registryOpcodes = sortedUnique(SERVER_TO_CLIENT_PROTOCOL_REGISTRY.map((entry) => entry.opcode));
    const dispatchOpcodes = sortedUnique([...GAMECLIENT_INBOUND_HANDLER_OPCODES]);

    expect(dispatchOpcodes).toEqual(registryOpcodes);
});
