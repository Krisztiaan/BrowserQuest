import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import type { ServerToClientSpawnAction } from '../../../shared/protocol/types';
import { decodeSpawnAction, encodeSpawnSnapshot } from '../../../shared/replication/spawn-snapshot';

test('spawn snapshot encoder/decoder round-trips wire-compatible SPAWN actions', () => {
    const mobAction: ServerToClientSpawnAction = [Types.Messages.SPAWN, 123, Types.Entities.RAT, 10, 20, 3, 777];
    const mobSnapshot = decodeSpawnAction(mobAction);
    expect(mobSnapshot).toEqual({
        id: 123,
        kind: Types.Entities.RAT,
        x: 10,
        y: 20,
        extras: { type: 'mob', orientation: 3, targetId: 777 },
    });
    expect(encodeSpawnSnapshot(mobSnapshot)).toEqual(mobAction);

    const playerAction: ServerToClientSpawnAction = [
        Types.Messages.SPAWN,
        42,
        Types.Entities.WARRIOR,
        1,
        2,
        'alice',
        1,
        Types.Entities.CLOTHARMOR,
        Types.Entities.SWORD1,
        99,
    ];
    const playerSnapshot = decodeSpawnAction(playerAction);
    expect(playerSnapshot).toEqual({
        id: 42,
        kind: Types.Entities.WARRIOR,
        x: 1,
        y: 2,
        extras: {
            type: 'player',
            name: 'alice',
            orientation: 1,
            armor: Types.Entities.CLOTHARMOR,
            weapon: Types.Entities.SWORD1,
            targetId: 99,
        },
    });
    expect(encodeSpawnSnapshot(playerSnapshot)).toEqual(playerAction);
});
