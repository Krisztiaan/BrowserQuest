import { expect, test } from 'bun:test';
import { compileMapPack, renderMapPackJson } from '../../shared/maps/map-pack';

function createTiledMap({
    width = 8,
    height = 8,
    fillTileId = 1,
    doors = [],
}: {
    width?: number;
    height?: number;
    fillTileId?: number;
    doors?: Array<{ id: number; x: number; y: number; properties?: Array<{ name: string; value: string }> }>;
}) {
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
                name: 'doors',
                type: 'objectgroup',
                objects: doors.map((door) => ({
                    id: door.id,
                    x: door.x,
                    y: door.y,
                    width: 16,
                    height: 16,
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

    expect(pack.schemaVersion).toBe(1);
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
                                    { name: 'target_map', value: 'house_01' },
                                    { name: 'target_door', value: 'house_entry' },
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

test('compileMapPack fails when world interior-entry door (o=u) omits target map links', () => {
    expect(() =>
        compileMapPack({
            maps: [
                {
                    id: 'world',
                    tiled: createTiledMap({
                        doors: [
                            {
                                id: 77,
                                x: 16,
                                y: 16,
                                properties: [
                                    { name: 'door_id', value: 'world_house_entry' },
                                    { name: 'o', value: 'u' },
                                ],
                            },
                        ],
                    }),
                },
            ],
        })
    ).toThrow('world interior-entry doors (o=u) require explicit "target_map" and "target_door"');
});

test('compileMapPack allows non-interior world door without target map links', () => {
    const pack = compileMapPack({
        maps: [
            {
                id: 'world',
                tiled: createTiledMap({
                    doors: [
                        {
                            id: 78,
                            x: 16,
                            y: 16,
                            properties: [{ name: 'o', value: 'd' }],
                        },
                    ],
                }),
            },
        ],
    });

    expect(pack.graph.maps.find((map) => map.id === 'world')?.doors).toEqual([{ id: '78', x: 1, y: 1 }]);
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
                                    { name: 'target_map', value: 'house_01' },
                                    { name: 'target_door', value: '11' },
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
