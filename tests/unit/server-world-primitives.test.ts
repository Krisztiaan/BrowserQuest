import { expect, test } from 'bun:test';
import Area, { type AreaEntity, type AreaWorldContract } from '../../server/area';
import MobArea from '../../server/mobarea';
import { findWorldPositionNextTo } from '../../server/world/entity';
import { notifyWorldPopulation } from '../../server/world/population-state';
import { flushOutgoingQueues } from '../../server/world/transport';
import { entityIdFromWire } from '../../shared/domain/ids';
import Types from '../../shared/gametypes-browser';
import type { ServerToClientProtocolAction } from '../../shared/protocol/types';

test('area removeFromArea ignores missing entity ids', () => {
    const world: AreaWorldContract = {
        isValidPosition() {
            return true;
        },
        addMob() {},
    };
    const area = new Area('arena', 0, 0, 2, 2, world);
    const first: AreaEntity = { id: 1, isDead: false };
    const second: AreaEntity = { id: 2, isDead: false };

    area.addToArea(first);
    area.addToArea(second);
    area.removeFromArea({ id: 999 });

    expect(area.entities.map((entity) => entity.id)).toEqual([1, 2]);
});

test('area _getRandomPositionInsideArea throws when no valid tile exists', () => {
    const world: AreaWorldContract = {
        isValidPosition() {
            return false;
        },
        addMob() {},
    };
    const area = new Area('blocked', 10, 20, 1, 1, world);

    expect(() => area._getRandomPositionInsideArea()).toThrow();
});

test('notifyWorldPopulation preserves explicit zero totals', () => {
    type PopulationHost = Parameters<typeof notifyWorldPopulation>[0];
    let serialized: ServerToClientProtocolAction | null = null;

    const host: PopulationHost = {
        playerCount: 5,
        pushBroadcast(message) {
            serialized = Array.isArray(message) ? message : message.serialize();
        },
    };

    notifyWorldPopulation(host, 0);

    expect(serialized).toEqual([Types.Messages.POPULATION, 5, 0]);
});

test('findWorldPositionNextTo returns first valid candidate', () => {
    let attempts = 0;

    const position = findWorldPositionNextTo(
        {
            x: 9,
            y: 9,
            getPositionNextTo() {
                attempts += 1;
                if (attempts === 3) {
                    return { x: 4, y: 5 };
                }
                return { x: -1, y: -1 };
            },
        },
        { id: 1 },
        (x, y) => x === 4 && y === 5
    );

    expect(position).toEqual({ x: 4, y: 5 });
    expect(attempts).toBe(3);
});

test('findWorldPositionNextTo falls back to current entity position after bounded attempts', () => {
    let attempts = 0;

    const position = findWorldPositionNextTo(
        {
            x: 7,
            y: 9,
            getPositionNextTo() {
                attempts += 1;
                return { x: 999, y: 999 };
            },
        },
        { id: 1 },
        () => false
    );

    expect(position).toEqual({ x: 7, y: 9 });
    expect(attempts).toBe(32);
});

test('mob area spawns mobs with allocator-provided ids', () => {
    const spawnedMobIds: number[] = [];
    const allocatedIds = [entityIdFromWire(901), entityIdFromWire(902), entityIdFromWire(903)];
    let nextIndex = 0;
    const world = {
        isValidPosition() {
            return true;
        },
        addMob(entity: { id: number }) {
            spawnedMobIds.push(entity.id);
        },
    };

    const area = new MobArea(
        'm1',
        3,
        'rat',
        10,
        10,
        2,
        2,
        world,
        () => allocatedIds[nextIndex++] ?? entityIdFromWire(999)
    );
    area.spawnMobs();

    expect(spawnedMobIds).toEqual([901, 902, 903]);
    expect(area.entities.map((entity) => entity.id)).toEqual([901, 902, 903]);
});

test('flushOutgoingQueues preserves order and bounded batch sizing while draining queues', () => {
    const sentPayloads: Array<ServerToClientProtocolAction | ServerToClientProtocolAction[]> = [];
    const playerQueue = Array.from({ length: 120 }, (_, index) => index + 1);
    const outgoingQueues = {
        player1: playerQueue,
    };

    flushOutgoingQueues(outgoingQueues, () => ({
        send(payload: ServerToClientProtocolAction | ServerToClientProtocolAction[]) {
            sentPayloads.push(payload);
        },
    }));

    expect(sentPayloads.length).toBe(3);
    expect(Array.isArray(sentPayloads[0])).toBe(true);
    expect(Array.isArray(sentPayloads[1])).toBe(true);
    expect(Array.isArray(sentPayloads[2])).toBe(true);
    expect(Array.isArray(sentPayloads[0]) ? sentPayloads[0].length : 0).toBe(50);
    expect(Array.isArray(sentPayloads[1]) ? sentPayloads[1].length : 0).toBe(50);
    expect(Array.isArray(sentPayloads[2]) ? sentPayloads[2].length : 0).toBe(20);
    expect((sentPayloads[0] as number[])[0]).toBe(1);
    expect((sentPayloads[1] as number[])[0]).toBe(51);
    expect((sentPayloads[2] as number[])[0]).toBe(101);
    expect(playerQueue.length).toBe(0);
});

test('flushOutgoingQueues avoids front-splice churn and still flushes payloads', () => {
    const sentPayloads: Array<ServerToClientProtocolAction | ServerToClientProtocolAction[]> = [];
    const playerQueue = [1, 2, 3] as number[] & { splice?: (...args: never[]) => never };
    playerQueue.splice = () => {
        throw new Error('splice should not be used during queue flush');
    };

    const outgoingQueues = {
        player1: playerQueue,
    };

    flushOutgoingQueues(outgoingQueues, () => ({
        send(payload: ServerToClientProtocolAction | ServerToClientProtocolAction[]) {
            sentPayloads.push(payload);
        },
    }));

    expect(sentPayloads).toEqual([[1, 2, 3]]);
    expect(playerQueue.length).toBe(0);
});
