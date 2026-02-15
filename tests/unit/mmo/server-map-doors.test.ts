import { expect, test } from 'bun:test';
import ServerMap from '../../../server/map';

test('server map resolves door destinations deterministically', () => {
    const map = Object.create(ServerMap.prototype) as ServerMap;

    map.initMap({
        width: 100,
        height: 100,
        collisions: [],
        roamingAreas: [],
        chestAreas: [],
        staticChests: [],
        staticEntities: {},
        doors: [
            { x: 5, y: 5, tx: 10, ty: 10 },
            { x: 20, y: 21, tx: 22, ty: 23 },
        ],
        checkpoints: [],
    });

    expect(map.isDoor(5, 5)).toBe(true);
    expect(map.isDoor(6, 5)).toBe(false);
    expect(map.getDoorDestination(5, 5)).toEqual({ x: 10, y: 10 });
    expect(map.getDoorDestination(6, 5)).toBe(null);
    expect(map.getDoorDestination(20, 21)).toEqual({ x: 22, y: 23 });
});

test('server map bounds and zone-group ids follow zero-based edge contract', () => {
    const map = Object.create(ServerMap.prototype) as ServerMap;

    map.initMap({
        width: 100,
        height: 100,
        collisions: [],
        roamingAreas: [],
        chestAreas: [],
        staticChests: [],
        staticEntities: {},
        doors: [],
        checkpoints: [],
    });

    expect(map.isOutOfBounds(0, 0)).toBe(false);
    expect(map.isOutOfBounds(1, 1)).toBe(false);
    expect(map.isOutOfBounds(99, 99)).toBe(false);
    expect(map.isOutOfBounds(-1, 0)).toBe(true);
    expect(map.isOutOfBounds(0, -1)).toBe(true);
    expect(map.isOutOfBounds(100, 99)).toBe(true);
    expect(map.isOutOfBounds(99, 100)).toBe(true);

    expect(map.getGroupIdFromPosition(0, 0)).toBe('0-0');
    expect(map.getGroupIdFromPosition(1, 1)).toBe('0-0');
    expect(map.getGroupIdFromPosition(27, 11)).toBe('0-0');
    expect(map.getGroupIdFromPosition(28, 12)).toBe('1-1');
    expect(map.getGroupIdFromPosition(99, 99)).toBe('3-8');
});
