import { expect, test } from 'bun:test';
import Area, { type AreaEntity, type AreaWorldContract } from '../../server/area';
import { findWorldPositionNextTo } from '../../server/world/entity';
import { notifyWorldPopulation } from '../../server/world/population-state';
import Types from '../../shared/gametypes-browser';

test('area removeFromArea ignores unknown entity ids', () => {
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
    let serialized: unknown[] | null = null;

    const host: PopulationHost = {
        playerCount: 5,
        pushBroadcast(message) {
            serialized = message.serialize() as unknown[];
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
