import { expect, test } from 'bun:test';
import { createWorldMapRegistryFromMapPack } from '../../../server/world/map-registry';

function buildServerMapPayload(width: number, height: number, doors: Array<{ x: number; y: number; tx: number; ty: number }> = []) {
    return {
        width,
        height,
        collisions: [],
        roamingAreas: [],
        chestAreas: [],
        staticChests: [],
        staticEntities: {},
        doors,
    };
}

test('map registry resolves cross-map door links from map graph', () => {
    const registry = createWorldMapRegistryFromMapPack({
        schemaVersion: 2,
        maps: [
            {
                id: 'overworld',
                server: buildServerMapPayload(8, 8, [{ x: 1, y: 1, tx: 3, ty: 3 }]),
                client: {},
            },
            {
                id: 'house_01',
                server: buildServerMapPayload(6, 6, [{ x: 2, y: 2, tx: 1, ty: 1 }]),
                client: {},
            },
        ],
        graph: {
            maps: [
                { id: 'overworld', width: 8, height: 8, doors: [{ id: 'door_world', x: 1, y: 1 }] },
                { id: 'house_01', width: 6, height: 6, doors: [{ id: 'door_house', x: 2, y: 2 }] },
            ],
            edges: [
                {
                    from: { mapId: 'overworld', doorId: 'door_world' },
                    to: { mapId: 'house_01', doorId: 'door_house' },
                },
            ],
        },
    });

    expect(registry.resolveDoorTeleport('overworld', 1, 1)).toEqual({
        toMapId: 'house_01',
        to: { x: 2, y: 2 },
    });
});

test('map registry resolves same-map legacy door routes without runtime fallback', () => {
    const registry = createWorldMapRegistryFromMapPack({
        schemaVersion: 2,
        maps: [
            {
                id: 'world',
                server: buildServerMapPayload(16, 16, [{ x: 3, y: 4, tx: 11, ty: 12 }]),
                client: {},
            },
        ],
        graph: {
            maps: [{ id: 'world', width: 16, height: 16, doors: [{ id: 'world_local_entry', x: 3, y: 4 }] }],
            edges: [],
        },
    });

    expect(registry.resolveDoorTeleport('world', 3, 4)).toEqual({
        toMapId: 'world',
        to: { x: 11, y: 12 },
    });
});

test('map registry prefers explicit graph edges over same-map legacy tx/ty', () => {
    const registry = createWorldMapRegistryFromMapPack({
        schemaVersion: 2,
        maps: [
            {
                id: 'overworld',
                server: buildServerMapPayload(8, 8, [{ x: 1, y: 1, tx: 7, ty: 7 }]),
                client: {},
            },
            {
                id: 'house_01',
                server: buildServerMapPayload(6, 6, [{ x: 2, y: 2, tx: 1, ty: 1 }]),
                client: {},
            },
        ],
        graph: {
            maps: [
                { id: 'overworld', width: 8, height: 8, doors: [{ id: 'door_world', x: 1, y: 1 }] },
                { id: 'house_01', width: 6, height: 6, doors: [{ id: 'door_house', x: 2, y: 2 }] },
            ],
            edges: [
                {
                    from: { mapId: 'overworld', doorId: 'door_world' },
                    to: { mapId: 'house_01', doorId: 'door_house' },
                },
            ],
        },
    });

    expect(registry.resolveDoorTeleport('overworld', 1, 1)).toEqual({
        toMapId: 'house_01',
        to: { x: 2, y: 2 },
    });
});

test('map registry rejects graph/map id mismatches', () => {
    expect(() =>
        createWorldMapRegistryFromMapPack({
            schemaVersion: 2,
            maps: [
                { id: 'a', server: buildServerMapPayload(4, 4), client: {} },
                { id: 'b', server: buildServerMapPayload(4, 4), client: {} },
            ],
            graph: {
                maps: [{ id: 'a', width: 4, height: 4, doors: [] }],
                edges: [],
            },
        })
    ).toThrow('Invalid map pack: graph/maps id mismatch');
});

test('map registry rejects map dimension mismatches against graph', () => {
    expect(() =>
        createWorldMapRegistryFromMapPack({
            schemaVersion: 2,
            maps: [{ id: 'a', server: buildServerMapPayload(8, 4), client: {} }],
            graph: {
                maps: [{ id: 'a', width: 4, height: 4, doors: [] }],
                edges: [],
            },
        })
    ).toThrow('dimensions mismatch graph');
});
