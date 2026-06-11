import { expect, test } from 'bun:test';
import { compileMapPack, renderMapPackJson } from '../../shared/maps/map-pack';

function createTiledMap({
    width = 8,
    height = 8,
    fillTileId = 1,
    doors = [],
    blockingIndices = [],
}: {
    width?: number;
    height?: number;
    fillTileId?: number;
    doors?: Array<{ id: number; x: number; y: number; class?: string; properties?: Array<{ name: string; value: string | boolean }> }>;
    blockingIndices?: number[];
}) {
    const blockingSet = new Set(blockingIndices);
    return {
        width,
        height,
        tilewidth: 16,
        tilesets: [{ name: 'tilesheet', firstgid: 1, tiles: [] }],
        layers: [
            {
                name: 'background',
                type: 'tilelayer',
                visible: true,
                data: new Array(width * height).fill(fillTileId),
            },
            {
                name: 'blocking',
                type: 'tilelayer',
                visible: true,
                data: new Array(width * height).fill(0).map((_, idx) => (blockingSet.has(idx) ? 1 : 0)),
            },
            {
                name: 'doors',
                type: 'objectgroup',
                objects: doors.map((door) => ({
                    id: door.id,
                    x: door.x,
                    y: door.y,
                    width: 16,
                    height: 16,
                    class: door.class ?? 'Door',
                    properties: door.properties ?? [],
                })),
            },
        ],
    };
}

test('compileMapPack supports single-map pack representation', () => {
    const pack = compileMapPack({
        maps: [{ id: 'world', tiled: createTiledMap({}) }],
    });

    expect(pack.schemaVersion).toBe(2);
    expect(pack.maps.length).toBe(1);
    expect(pack.maps[0]?.id).toBe('world');
    expect(pack.graph.maps.map((map) => map.id)).toEqual(['world']);
    expect(pack.graph.edges).toEqual([]);
});

test('compileMapPack is deterministic across input order', () => {
    const mapA = createTiledMap({
        doors: [{ id: 1, x: 16, y: 16, properties: [{ name: 'door_id', value: 'd1' }] }],
    });
    const mapB = createTiledMap({
        doors: [{ id: 2, x: 16, y: 16, properties: [{ name: 'door_id', value: 'd2' }] }],
    });

    const packA = compileMapPack({
        maps: [
            { id: 'b', tiled: mapB },
            { id: 'a', tiled: mapA },
        ],
        edges: [
            {
                from: { mapId: 'b', doorId: 'd2' },
                to: { mapId: 'a', doorId: 'd1' },
            },
            {
                from: { mapId: 'a', doorId: 'd1' },
                to: { mapId: 'b', doorId: 'd2' },
            },
        ],
    });

    const packB = compileMapPack({
        maps: [
            { id: 'a', tiled: mapA },
            { id: 'b', tiled: mapB },
        ],
        edges: [
            {
                from: { mapId: 'a', doorId: 'd1' },
                to: { mapId: 'b', doorId: 'd2' },
            },
            {
                from: { mapId: 'b', doorId: 'd2' },
                to: { mapId: 'a', doorId: 'd1' },
            },
        ],
    });

    expect(renderMapPackJson(packA)).toBe(renderMapPackJson(packB));
});

test('compileMapPack derives edges from door target_map/target_door properties', () => {
    const pack = compileMapPack({
        maps: [
            {
                id: 'overworld',
                tiled: createTiledMap({
                    doors: [
                        {
                            id: 10,
                            x: 32,
                            y: 16,
                            properties: [
                                { name: 'door_id', value: 'enter_house' },
                                { name: 'orientation', value: 'u' },
                                { name: 'target_map', value: 'house_01' },
                                { name: 'target_door', value: 'exit' },
                                { name: 'one_way', value: true },
                            ],
                        },
                    ],
                }),
            },
            {
                id: 'house_01',
                tiled: createTiledMap({
                    width: 12,
                    height: 12,
                    doors: [
                        {
                            id: 20,
                            x: 16,
                            y: 16,
                            properties: [{ name: 'door_id', value: 'exit' }],
                        },
                    ],
                }),
            },
        ],
    });

    expect(pack.graph.maps.find((map) => map.id === 'overworld')?.doors).toEqual([
        { id: 'enter_house', x: 2, y: 1 },
    ]);
    expect(pack.graph.edges).toEqual([
        {
            from: { mapId: 'overworld', doorId: 'enter_house' },
            to: { mapId: 'house_01', doorId: 'exit' },
        },
    ]);
});

test('compileMapPack strips authoring-only door metadata from runtime payloads', () => {
    const pack = compileMapPack({
        maps: [
            {
                id: 'world_01',
                tiled: createTiledMap({
                    doors: [
                        {
                            id: 1,
                            x: 16,
                            y: 16,
                            properties: [
                                { name: 'orientation', value: 'd' },
                                { name: 'target_tx', value: '2' },
                                { name: 'target_ty', value: '3' },
                                { name: 'area_id', value: 'forest_maze_rooms' },
                                { name: 'tags', value: 'door,teleport,forest' },
                                { name: 'authoring_note', value: 'Source-only note.' },
                            ],
                        },
                    ],
                }),
            },
        ],
    });

    expect(pack.maps[0]?.client.doors[0]).toEqual({
        x: 1,
        y: 1,
        p: 0,
        to: 'd',
        tx: 2,
        ty: 3,
    });
    expect(pack.maps[0]?.server.doors[0]).toEqual(pack.maps[0]?.client.doors[0]);
});

test('compileMapPack accepts a world-to-house door with reverse house link', () => {
    const pack = compileMapPack({
        maps: [
            {
                id: 'world_01',
                tiled: createTiledMap({
                    doors: [
                        {
                            id: 1,
                            x: 16,
                            y: 16,
                            properties: [
                                { name: 'door_id', value: 'world_house_01_entry' },
                                { name: 'orientation', value: 'u' },
                                { name: 'target_map', value: 'house_01' },
                                { name: 'target_door', value: 'house_01_entry' },
                            ],
                        },
                    ],
                }),
            },
            {
                id: 'house_01',
                tiled: createTiledMap({
                    doors: [
                        {
                            id: 2,
                            x: 32,
                            y: 48,
                            properties: [
                                { name: 'door_id', value: 'house_01_entry' },
                                { name: 'orientation', value: 'd' },
                                { name: 'target_map', value: 'world_01' },
                                { name: 'target_door', value: 'world_house_01_entry' },
                            ],
                        },
                    ],
                }),
            },
        ],
        edges: [],
        allowMissingTargetMaps: false,
    });

    expect(pack.graph.edges).toContainEqual({
        from: { mapId: 'world_01', doorId: 'world_house_01_entry' },
        to: { mapId: 'house_01', doorId: 'house_01_entry' },
    });
    expect(pack.graph.edges).toContainEqual({
        from: { mapId: 'house_01', doorId: 'house_01_entry' },
        to: { mapId: 'world_01', doorId: 'world_house_01_entry' },
    });
});

test('compileMapPack exports explicit portal semantics independently of object class', () => {
    const pack = compileMapPack({
        maps: [
            {
                id: 'world_01',
                tiled: createTiledMap({
                    doors: [
                        {
                            id: 1,
                            x: 16,
                            y: 16,
                            class: 'Door',
                            properties: [{ name: 'door_kind', value: 'portal' }],
                        },
                        {
                            id: 2,
                            x: 32,
                            y: 16,
                            class: 'Door',
                            properties: [{ name: 'is_portal', value: 'true' }],
                        },
                        {
                            id: 3,
                            x: 48,
                            y: 16,
                            class: 'Door',
                            properties: [{ name: 'door_kind', value: 'door' }],
                        },
                    ],
                }),
            },
        ],
    });

    const doors = pack.maps[0]?.client.doors as Array<{ p?: number }> | undefined;
    expect(doors?.map((door) => door.p)).toEqual([1, 1, 0]);
});

test('compileMapPack omits debug passability from default client payloads', () => {
    const pack = compileMapPack({
        maps: [{ id: 'world', tiled: createTiledMap({}) }],
    });

    expect('debugPassability' in (pack.maps[0]?.client as Record<string, unknown>)).toBe(false);
});

test('compileMapPack extracts graph doors from multiple recursive doors layers', () => {
    const pack = compileMapPack({
        maps: [
            {
                id: 'world_01',
                tiled: {
                    width: 8,
                    height: 8,
                    tilewidth: 16,
                    tileheight: 16,
                    tilesets: [{ name: 'tilesheet', firstgid: 1, tiles: [] }],
                    layers: [
                        {
                            name: 'background',
                            type: 'tilelayer',
                            visible: true,
                            data: new Array(64).fill(1),
                        },
                        {
                            name: 'doors',
                            type: 'objectgroup',
                            visible: true,
                            objects: [
                                {
                                    id: 1,
                                    x: 16,
                                    y: 16,
                                    width: 16,
                                    height: 16,
                                    class: 'Door',
                                    properties: [{ name: 'door_id', value: 'first' }],
                                },
                            ],
                        },
                        {
                            name: 'interiors',
                            type: 'group',
                            visible: true,
                            layers: [
                                {
                                    name: 'doors',
                                    type: 'objectgroup',
                                    visible: false,
                                    objects: [
                                        {
                                            id: 2,
                                            x: 32,
                                            y: 16,
                                            width: 16,
                                            height: 16,
                                            class: 'Door',
                                            properties: [{ name: 'door_id', value: 'second' }],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            },
        ],
    });

    expect(pack.graph.maps.find((map) => map.id === 'world_01')?.doors).toEqual([
        { id: 'first', x: 1, y: 1 },
        { id: 'second', x: 2, y: 1 },
    ]);
    expect(pack.maps[0]?.client.doors).toEqual([
        { x: 1, y: 1, p: 0, tdoor_id: 'first' },
        { x: 2, y: 1, p: 0, tdoor_id: 'second' },
    ]);
    expect(pack.maps[0]?.server.doors).toEqual([
        { x: 1, y: 1, p: 0, tdoor_id: 'first' },
        { x: 2, y: 1, p: 0, tdoor_id: 'second' },
    ]);
});

test('compileMapPack resolves graph-linked door tx/ty from destination door coordinates', () => {
    const pack = compileMapPack({
        maps: [
            {
                id: 'overworld',
                tiled: createTiledMap({
                    doors: [
                        {
                            id: 10,
                            x: 32,
                            y: 16,
                            properties: [
                                { name: 'door_id', value: 'enter_house' },
                                { name: 'orientation', value: 'u' },
                                { name: 'target_map', value: 'house_01' },
                                { name: 'target_door', value: 'exit' },
                                { name: 'one_way', value: true },
                            ],
                        },
                    ],
                }),
            },
            {
                id: 'house_01',
                tiled: createTiledMap({
                    width: 12,
                    height: 12,
                    doors: [
                        {
                            id: 20,
                            x: 16,
                            y: 16,
                            properties: [{ name: 'door_id', value: 'exit' }],
                        },
                    ],
                }),
            },
        ],
    });

    const overworld = pack.maps.find((m) => m.id === 'overworld');
    expect(overworld).toBeTruthy();

    const clientDoor = (overworld?.client.doors as unknown[]).find(
        (door) => (door as { tdoor_id?: unknown }).tdoor_id === 'enter_house'
    ) as { tx?: unknown; ty?: unknown } | undefined;
    const serverDoor = (overworld?.server.doors as unknown[]).find(
        (door) => (door as { tdoor_id?: unknown }).tdoor_id === 'enter_house'
    ) as { tx?: unknown; ty?: unknown } | undefined;

    // house_01 exit door is at (1,1) because the object is placed at (16,16) pixels on a 16px tile grid.
    expect(clientDoor?.tx).toBe(1);
    expect(clientDoor?.ty).toBe(1);
    expect(serverDoor?.tx).toBe(1);
    expect(serverDoor?.ty).toBe(1);
});

test('compileMapPack fails when graph-linked door declares redundant target coordinates', () => {
    expect(() =>
        compileMapPack({
            maps: [
                {
                    id: 'overworld',
                    tiled: createTiledMap({
                        doors: [
                            {
                                id: 10,
                                x: 32,
                                y: 16,
                                properties: [
                                    { name: 'door_id', value: 'enter_house' },
                                    { name: 'orientation', value: 'u' },
                                    { name: 'target_map', value: 'house_01' },
                                    { name: 'target_door', value: 'exit' },
                                    { name: 'target_tx', value: '999' },
                                ],
                            },
                        ],
                    }),
                },
                {
                    id: 'house_01',
                    tiled: createTiledMap({
                        width: 12,
                        height: 12,
                        doors: [
                            {
                                id: 20,
                                x: 16,
                                y: 16,
                                properties: [{ name: 'door_id', value: 'exit' }],
                            },
                        ],
                    }),
                },
            ],
        })
    ).toThrow('graph-linked doors must not declare redundant "target_tx" or "target_ty"');
});

test('compileMapPack accepts legacy object type metadata and skips invalid roaming-area mob kinds', () => {
    const pack = compileMapPack({
        maps: [
            {
                id: 'world',
                tiled: {
                    width: 8,
                    height: 8,
                    tilewidth: 16,
                    tilesets: [{ name: 'tilesheet', firstgid: 1, tiles: [] }],
                    layers: [
                        {
                            name: 'background',
                            type: 'tilelayer',
                            visible: true,
                            data: new Array(64).fill(1),
                        },
                        {
                            name: 'blocking',
                            type: 'tilelayer',
                            visible: true,
                            data: new Array(64).fill(0),
                        },
                        {
                            name: 'resource_nodes',
                            type: 'objectgroup',
                            objects: [
                                {
                                    id: 1,
                                    type: 'ResourceNode',
                                    x: 16,
                                    y: 16,
                                    width: 16,
                                    height: 16,
                                    properties: [{ name: 'resource_gid', value: 1886 }],
                                },
                            ],
                        },
                        {
                            name: 'roaming_areas',
                            type: 'objectgroup',
                            objects: [
                                {
                                    id: 2,
                                    type: 'RoamingArea',
                                    x: 32,
                                    y: 32,
                                    width: 16,
                                    height: 16,
                                    properties: [
                                        { name: 'count', value: 1 },
                                        { name: 'mob_kind', value: 'RoamingArea' },
                                    ],
                                },
                            ],
                        },
                        {
                            name: 'static_entities',
                            type: 'objectgroup',
                            objects: [
                                {
                                    id: 3,
                                    type: 'StaticEntity',
                                    x: 48,
                                    y: 48,
                                    width: 16,
                                    height: 16,
                                    properties: [{ name: 'entity_kind', value: 'rat' }],
                                },
                            ],
                        },
                    ],
                },
            },
        ],
    });

    const worldServer = pack.maps[0]?.server as {
        roamingAreas?: unknown[];
        staticEntities?: Record<string, string>;
    };

    expect(worldServer.roamingAreas ?? []).toEqual([]);
    expect(worldServer.staticEntities).toEqual({ '27': 'rat' });
});

test('compileMapPack exports roaming areas with valid mob kinds', () => {
    const pack = compileMapPack({
        maps: [
            {
                id: 'world',
                tiled: {
                    width: 8,
                    height: 8,
                    tilewidth: 16,
                    tilesets: [{ name: 'tilesheet', firstgid: 1, tiles: [] }],
                    layers: [
                        {
                            name: 'background',
                            type: 'tilelayer',
                            visible: true,
                            data: new Array(64).fill(1),
                        },
                        {
                            name: 'blocking',
                            type: 'tilelayer',
                            visible: true,
                            data: new Array(64).fill(0),
                        },
                        {
                            name: 'roaming_areas',
                            type: 'objectgroup',
                            objects: [
                                {
                                    id: 1,
                                    class: 'RoamingArea',
                                    x: 32,
                                    y: 32,
                                    width: 32,
                                    height: 48,
                                    properties: [
                                        { name: 'count', value: 2 },
                                        { name: 'mob_kind', value: 'rat' },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            },
        ],
    });

    const worldServer = pack.maps[0]?.server as {
        roamingAreas?: Array<{
            id: number;
            x: number;
            y: number;
            width: number;
            height: number;
            count: number;
            mobKind: string;
        }>;
    };

    expect(worldServer.roamingAreas).toEqual([
        {
            id: 0,
            x: 2,
            y: 2,
            width: 2,
            height: 3,
            count: 2,
            mobKind: 'rat',
        },
    ]);
});

test('compileMapPack exports resource nodes with stable ids and resource kinds', () => {
    const pack = compileMapPack({
        maps: [
            {
                id: 'mine_floor_001',
                tiled: {
                    width: 8,
                    height: 8,
                    tilewidth: 16,
                    tilesets: [{ name: 'tilesheet', firstgid: 1, tiles: [] }],
                    layers: [
                        {
                            name: 'background',
                            type: 'tilelayer',
                            visible: true,
                            data: new Array(64).fill(1),
                        },
                        {
                            name: 'blocking',
                            type: 'tilelayer',
                            visible: true,
                            data: new Array(64).fill(0),
                        },
                        {
                            name: 'resource_nodes',
                            type: 'objectgroup',
                            objects: [
                                {
                                    id: 1,
                                    class: 'ResourceNode',
                                    name: 'mine_ore_001',
                                    x: 96,
                                    y: 32,
                                    width: 16,
                                    height: 16,
                                    properties: [
                                        { name: 'resource_kind', value: 'ore_copper_small' },
                                        { name: 'resource_gid', value: 1886 },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            },
        ],
    });

    const mineServer = pack.maps[0]?.server as {
        resourceNodes?: Array<{
            id: string;
            x: number;
            y: number;
            kind: string;
            gid: number;
        }>;
    };

    expect(mineServer.resourceNodes).toEqual([
        {
            id: 'mine_ore_001',
            x: 6,
            y: 2,
            kind: 'ore_copper_small',
            gid: 1886,
        },
    ]);
});

test('compileMapPack de-duplicates resource node ids within a map', () => {
    const pack = compileMapPack({
        maps: [
            {
                id: 'mine_floor_001',
                tiled: {
                    width: 8,
                    height: 8,
                    tilewidth: 16,
                    tilesets: [{ name: 'tilesheet', firstgid: 1, tiles: [] }],
                    layers: [
                        {
                            name: 'background',
                            type: 'tilelayer',
                            visible: true,
                            data: new Array(64).fill(1),
                        },
                        {
                            name: 'blocking',
                            type: 'tilelayer',
                            visible: true,
                            data: new Array(64).fill(0),
                        },
                        {
                            name: 'resource_nodes',
                            type: 'objectgroup',
                            objects: [
                                {
                                    id: 10,
                                    class: 'ResourceNode',
                                    name: 'resource_node_1894',
                                    x: 16,
                                    y: 16,
                                    width: 16,
                                    height: 16,
                                    properties: [{ name: 'resource_kind', value: 'ore_copper_small' }],
                                },
                                {
                                    id: 11,
                                    class: 'ResourceNode',
                                    name: 'resource_node_1894',
                                    x: 32,
                                    y: 16,
                                    width: 16,
                                    height: 16,
                                    properties: [{ name: 'resource_kind', value: 'ore_copper_small' }],
                                },
                            ],
                        },
                    ],
                },
            },
        ],
    });

    const mineServer = pack.maps[0]?.server as {
        resourceNodes?: Array<{ id: string; x: number; y: number; kind: string }>;
    };

    expect(mineServer.resourceNodes).toEqual([
        { id: 'resource_node_1894', x: 1, y: 1, kind: 'ore_copper_small' },
        { id: 'resource_node_1894_11', x: 2, y: 1, kind: 'ore_copper_small' },
    ]);
});

test('compileMapPack carves authored blocking to prevent trapped door soft-locks', () => {
    const width = 8;
    const height = 8;
    const doorTile = { x: 2, y: 2 };
    const doorPixel = { x: doorTile.x * 16, y: doorTile.y * 16 };
    const blockedNeighborIndex = (doorTile.y + 1) * width + doorTile.x; // (2,3)
    const blockingIndices = [
        (doorTile.y - 1) * width + doorTile.x, // (2,1)
        blockedNeighborIndex, // (2,3) - expected carve
        doorTile.y * width + (doorTile.x - 1), // (1,2)
        doorTile.y * width + (doorTile.x + 1), // (3,2)
    ];

    const pack = compileMapPack({
        maps: [
            {
                id: 'overworld',
                tiled: createTiledMap({
                    width,
                    height,
                    doors: [
                        {
                            id: 10,
                            x: doorPixel.x,
                            y: doorPixel.y,
                            properties: [
                                { name: 'door_id', value: 'enter_house' },
                                { name: 'orientation', value: 'u' },
                                { name: 'target_map', value: 'house_01' },
                                { name: 'target_door', value: 'exit' },
                                { name: 'one_way', value: true },
                            ],
                        },
                    ],
                }),
            },
            {
                id: 'house_01',
                tiled: createTiledMap({
                    width,
                    height,
                    // Trap the destination door tile in blocking, but leave (2,4) walkable so a 2-step carve works.
                    blockingIndices,
                    doors: [
                        {
                            id: 20,
                            x: doorPixel.x,
                            y: doorPixel.y,
                            properties: [{ name: 'door_id', value: 'exit' }],
                        },
                    ],
                }),
            },
        ],
    });

    const house = pack.maps.find((m) => m.id === 'house_01');
    expect(house).toBeTruthy();
    expect((house?.client.blocking as number[]).includes(blockedNeighborIndex)).toBe(false);
    expect((house?.server.collisions as number[]).includes(blockedNeighborIndex)).toBe(false);
});

test('compileMapPack allows a door tile to stay walkable when its tileset tile is explicitly passable', () => {
    const width = 4;
    const height = 4;
    const doorTile = { x: 1, y: 1 };
    const doorIndex = doorTile.y * width + doorTile.x;

    const pack = compileMapPack({
        maps: [
            {
                id: 'house',
                tiled: {
                    width,
                    height,
                    tilewidth: 16,
                    tileheight: 16,
                    tilesets: [
                        {
                            name: 'tilesheet',
                            firstgid: 1,
                            tiles: [
                                {
                                    id: 0,
                                    objectgroup: {
                                        type: 'objectgroup',
                                        objects: [{ id: 1, x: 0, y: 0, width: 16, height: 16 }],
                                    },
                                    properties: [{ name: 'passable', value: true }],
                                },
                            ],
                        },
                    ],
                    layers: [
                        {
                            name: 'background',
                            type: 'tilelayer',
                            visible: true,
                            data: [
                                0, 0, 0, 0,
                                0, 1, 0, 0,
                                0, 0, 0, 0,
                                0, 0, 0, 0,
                            ],
                        },
                        {
                            name: 'blocking',
                            type: 'tilelayer',
                            visible: true,
                            data: new Array(width * height).fill(0),
                        },
                        {
                            name: 'doors',
                            type: 'objectgroup',
                            objects: [
                                {
                                    id: 10,
                                    x: doorTile.x * 16,
                                    y: doorTile.y * 16,
                                    width: 16,
                                    height: 16,
                                    class: 'Door',
                                    properties: [{ name: 'door_id', value: 'entry' }],
                                },
                            ],
                        },
                    ],
                },
            },
        ],
    });

    const house = pack.maps.find((m) => m.id === 'house');
    expect(house).toBeTruthy();
    expect((house?.client.collisions as number[]).includes(doorIndex)).toBe(false);
    expect((house?.server.collisions as number[]).includes(doorIndex)).toBe(false);
});

test('compileMapPack fails when cross-map transition destination has empty renderable terrain', () => {
    expect(() =>
        compileMapPack({
            maps: [
                {
                    id: 'world',
                    tiled: createTiledMap({
                        doors: [
                            {
                                id: 10,
                                x: 16,
                                y: 16,
                                properties: [
                                    { name: 'door_id', value: 'enter_blank_house' },
                                    { name: 'orientation', value: 'u' },
                                    { name: 'target_map', value: 'house_01' },
                                    { name: 'target_door', value: 'house_entry' },
                                    { name: 'one_way', value: true },
                                ],
                            },
                        ],
                    }),
                },
                {
                    id: 'house_01',
                    tiled: createTiledMap({
                        fillTileId: 0,
                        doors: [
                            {
                                id: 20,
                                x: 16,
                                y: 16,
                                properties: [{ name: 'door_id', value: 'house_entry' }],
                            },
                        ],
                    }),
                },
            ],
        })
    ).toThrow('cross-map transition destination must include at least one non-zero renderable tile');
});

test('compileMapPack allows empty renderable terrain on maps without cross-map transition targets', () => {
    const pack = compileMapPack({
        maps: [{ id: 'world', tiled: createTiledMap({ fillTileId: 0 }) }],
    });

    expect(pack.maps).toHaveLength(1);
    expect(pack.maps[0]?.id).toBe('world');
});

test('compileMapPack fails on dangling graph links', () => {
    expect(() =>
        compileMapPack({
            maps: [{ id: 'world', tiled: createTiledMap({}) }],
            edges: [
                {
                    from: { mapId: 'world', doorId: 'missing' },
                    to: { mapId: 'world', doorId: 'missing_2' },
                },
            ],
        })
    ).toThrow('Invalid map pack graph');
});

test('compileMapPack fails when target_map/target_door are partially declared', () => {
    expect(() =>
        compileMapPack({
            maps: [
                {
                    id: 'world',
                    tiled: createTiledMap({
                        doors: [
                            {
                                id: 1,
                                x: 16,
                                y: 16,
                                properties: [
                                    { name: 'door_id', value: 'entry' },
                                    { name: 'target_map', value: 'house_01' },
                                ],
                            },
                        ],
                    }),
                },
            ],
        })
    ).toThrow('"target_map" and "target_door" must be provided together');
});

test('compileMapPack fails when graph-linked door omits orientation', () => {
    expect(() =>
        compileMapPack({
            maps: [
                {
                    id: 'world',
                    tiled: createTiledMap({
                        doors: [
                            {
                                id: 1,
                                x: 16,
                                y: 16,
                                properties: [
                                    { name: 'door_id', value: 'entry' },
                                    { name: 'target_map', value: 'house_01' },
                                    { name: 'target_door', value: 'exit' },
                                    { name: 'one_way', value: true },
                                ],
                            },
                        ],
                    }),
                },
                {
                    id: 'house_01',
                    tiled: createTiledMap({
                        doors: [
                            {
                                id: 2,
                                x: 16,
                                y: 16,
                                properties: [{ name: 'door_id', value: 'exit' }],
                            },
                        ],
                    }),
                },
            ],
        })
    ).toThrow('graph-linked doors require explicit "orientation" property');
});

test('compileMapPack fails when graph-linked door declares raw tx or ty', () => {
    expect(() =>
        compileMapPack({
            maps: [
                {
                    id: 'world',
                    tiled: createTiledMap({
                        doors: [
                            {
                                id: 1,
                                x: 16,
                                y: 16,
                                properties: [
                                    { name: 'door_id', value: 'entry' },
                                    { name: 'orientation', value: 'u' },
                                    { name: 'target_map', value: 'house_01' },
                                    { name: 'target_door', value: 'exit' },
                                    { name: 'tx', value: '2' },
                                    { name: 'one_way', value: true },
                                ],
                            },
                        ],
                    }),
                },
                {
                    id: 'house_01',
                    tiled: createTiledMap({
                        doors: [
                            {
                                id: 2,
                                x: 16,
                                y: 16,
                                properties: [{ name: 'door_id', value: 'exit' }],
                            },
                        ],
                    }),
                },
            ],
        })
    ).toThrow('graph-linked doors must not declare raw "tx" or "ty"');
});

test('compileMapPack fails when graph-linked door has no reverse link', () => {
    expect(() =>
        compileMapPack({
            maps: [
                {
                    id: 'world',
                    tiled: createTiledMap({
                        doors: [
                            {
                                id: 1,
                                x: 16,
                                y: 16,
                                properties: [
                                    { name: 'door_id', value: 'entry' },
                                    { name: 'orientation', value: 'u' },
                                    { name: 'target_map', value: 'house_01' },
                                    { name: 'target_door', value: 'exit' },
                                ],
                            },
                        ],
                    }),
                },
                {
                    id: 'house_01',
                    tiled: createTiledMap({
                        doors: [
                            {
                                id: 2,
                                x: 16,
                                y: 16,
                                properties: [{ name: 'door_id', value: 'exit' }],
                            },
                        ],
                    }),
                },
            ],
        })
    ).toThrow('reverse link missing');
});

test('compileMapPack rejects legacy target_map world references', () => {
    expect(() =>
        compileMapPack({
            maps: [
                {
                    id: 'world_01',
                    tiled: createTiledMap({
                        doors: [
                            {
                                id: 1,
                                x: 16,
                                y: 16,
                                properties: [
                                    { name: 'door_id', value: 'entry' },
                                    { name: 'orientation', value: 'u' },
                                    { name: 'target_map', value: 'world' },
                                    { name: 'target_door', value: 'exit' },
                                ],
                            },
                        ],
                    }),
                },
                {
                    id: 'house_01',
                    tiled: createTiledMap({
                        doors: [
                            {
                                id: 2,
                                x: 16,
                                y: 16,
                                properties: [{ name: 'door_id', value: 'exit' }],
                            },
                        ],
                    }),
                },
            ],
            allowMissingTargetMaps: true,
        })
    ).toThrow('target_map "world" is not supported; use "world_01"');
});

test('compileMapPack fails when legacy door properties are used', () => {
    expect(() =>
        compileMapPack({
            maps: [
                {
                    id: 'world_01',
                    tiled: createTiledMap({
                        doors: [
                            {
                                id: 79,
                                x: 16,
                                y: 16,
                                properties: [{ name: 'o', value: 'u' }],
                            },
                        ],
                    }),
                },
            ],
        })
    ).toThrow('Legacy door property "o" is not supported; use "orientation".');
});

test('compileMapPack fails when world interior-entry door (orientation=u) omits target map links', () => {
    expect(() =>
        compileMapPack({
            maps: [
                {
                    id: 'world_01',
                    tiled: createTiledMap({
                        doors: [
                            {
                                id: 77,
                                x: 16,
                                y: 16,
                                properties: [
                                    { name: 'door_id', value: 'world_house_entry' },
                                    { name: 'orientation', value: 'u' },
                                ],
                            },
                        ],
                    }),
                },
            ],
        })
    ).toThrow('world interior-entry doors (orientation=u) require explicit "target_map" and "target_door"');
});

test('compileMapPack allows non-interior world door without target map links', () => {
    const pack = compileMapPack({
        maps: [
            {
                id: 'world_01',
                tiled: createTiledMap({
                    doors: [
                        {
                            id: 78,
                            x: 16,
                            y: 16,
                            properties: [{ name: 'orientation', value: 'd' }],
                        },
                    ],
                }),
            },
        ],
    });

    expect(pack.graph.maps.find((map) => map.id === 'world_01')?.doors).toEqual([{ id: '78', x: 1, y: 1 }]);
    expect(pack.graph.edges).toEqual([]);
});

test('compileMapPack fails when a graph-linked source door has no explicit door_id', () => {
    expect(() =>
        compileMapPack({
            maps: [
                {
                    id: 'world',
                    tiled: createTiledMap({
                        doors: [
                            {
                                id: 10,
                                x: 16,
                                y: 16,
                                properties: [
                                    { name: 'target_map', value: 'house_01' },
                                    { name: 'target_door', value: 'exit' },
                                    { name: 'orientation', value: 'u' },
                                ],
                            },
                        ],
                    }),
                },
                {
                    id: 'house_01',
                    tiled: createTiledMap({
                        doors: [
                            {
                                id: 11,
                                x: 16,
                                y: 16,
                                properties: [{ name: 'door_id', value: 'exit' }],
                            },
                        ],
                    }),
                },
            ],
        })
    ).toThrow('graph-linked doors require explicit "door_id" property');
});

test('compileMapPack fails when graph edge references destination door without explicit door_id', () => {
    expect(() =>
        compileMapPack({
            maps: [
                {
                    id: 'world',
                    tiled: createTiledMap({
                        doors: [
                            {
                                id: 10,
                                x: 16,
                                y: 16,
                                properties: [
                                    { name: 'door_id', value: 'entry' },
                                    { name: 'orientation', value: 'u' },
                                    { name: 'target_map', value: 'house_01' },
                                    { name: 'target_door', value: '11' },
                                    { name: 'one_way', value: true },
                                ],
                            },
                        ],
                    }),
                },
                {
                    id: 'house_01',
                    tiled: createTiledMap({
                        doors: [
                            {
                                id: 11,
                                x: 16,
                                y: 16,
                            },
                        ],
                    }),
                },
            ],
        })
    ).toThrow('edge endpoint "house_01:11" must reference a door with explicit "door_id" property');
});
