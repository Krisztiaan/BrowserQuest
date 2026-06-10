import { expect, test } from 'bun:test';
import processMap from '../../shared/maps/processmap';

test('visible tile object layers render into client data and foreground with collisions', () => {
    const tiledMap = {
        width: 4,
        height: 4,
        tilewidth: 16,
        tileheight: 16,
        tilesets: [
            {
                firstgid: 1,
                name: 'tilesheet-wang',
                objectalignment: 'topleft',
                tilewidth: 16,
                tileheight: 16,
                tiles: [
                    {
                        id: 0,
                        objectgroup: {
                            type: 'objectgroup',
                            objects: [
                                {
                                    id: 1,
                                    x: 0,
                                    y: 0,
                                    width: 16,
                                    height: 16,
                                },
                            ],
                        },
                    },
                ],
            },
        ],
        layers: [
            {
                id: 1,
                name: 'ground',
                type: 'tilelayer',
                visible: true,
                width: 4,
                height: 4,
                data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            },
            {
                id: 2,
                name: 'decor',
                type: 'objectgroup',
                visible: true,
                objects: [
                    {
                        id: 10,
                        gid: 1,
                        x: 16,
                        y: 16,
                        width: 16,
                        height: 16,
                    },
                ],
            },
            {
                id: 3,
                name: 'decor_foreground',
                class: 'Foreground',
                type: 'objectgroup',
                visible: true,
                objects: [
                    {
                        id: 11,
                        gid: 1,
                        x: 32,
                        y: 16,
                        width: 16,
                        height: 16,
                    },
                ],
            },
        ],
    } as Parameters<typeof processMap>[0];

    const clientMap = processMap(tiledMap, { mode: 'client', quiet: true });
    const serverMap = processMap(tiledMap, { mode: 'server', quiet: true });

    expect(clientMap.data?.[5]).toBe(1);
    expect(clientMap.foreground?.[6]).toBe(1);
    expect(clientMap.collisions).toContain(5);
    expect(clientMap.collisions).toContain(6);

    expect(serverMap.collisions).toContain(5);
    expect(serverMap.collisions).toContain(6);
});

test('depth-sorted tile object layers export render props and keep collisions', () => {
    const tiledMap = {
        width: 4,
        height: 4,
        tilewidth: 16,
        tileheight: 16,
        tilesets: [
            {
                firstgid: 1,
                name: 'tilesheet-wang',
                objectalignment: 'topleft',
                tilewidth: 16,
                tileheight: 16,
                tiles: [
                    {
                        id: 0,
                        objectgroup: {
                            type: 'objectgroup',
                            objects: [{ id: 1, x: 0, y: 0, width: 16, height: 16 }],
                        },
                    },
                    {
                        id: 1,
                    },
                ],
            },
        ],
        layers: [
            {
                id: 1,
                name: 'ground',
                type: 'tilelayer',
                visible: true,
                width: 4,
                height: 4,
                data: new Array(16).fill(0),
            },
            {
                id: 2,
                name: 'totem_prop',
                class: 'DepthSorted',
                type: 'objectgroup',
                visible: true,
                objects: [
                    { id: 10, gid: 2, x: 16, y: 16, width: 16, height: 16 },
                    { id: 11, gid: 1, x: 16, y: 32, width: 16, height: 16 },
                ],
            },
        ],
    } as Parameters<typeof processMap>[0];

    const clientMap = processMap(tiledMap, { mode: 'client', quiet: true });
    const serverMap = processMap(tiledMap, { mode: 'server', quiet: true });

    expect(clientMap.data?.every((value) => value === 0)).toBeTrue();
    expect(clientMap.foreground?.every((value) => value === 0)).toBeTrue();
    expect(clientMap.renderProps).toBeDefined();
    expect(clientMap.renderProps?.length).toBe(1);
    expect(clientMap.renderProps?.[0]).toEqual({
        depth: 2,
        minTileX: 1,
        minTileY: 1,
        maxTileX: 1,
        maxTileY: 2,
        parts: [
            { index: 5, gid: 2 },
            { index: 9, gid: 1 },
        ],
        meta: {
            layer: 'totem_prop',
            layerPath: 'totem_prop',
            family: 'totem_prop',
            depthMode: 'collision',
        },
    });
    expect(clientMap.collisions).toContain(9);
    expect(serverMap.collisions).toContain(9);
});

test('group layers flatten into runtime data and depth-sorted props with inherited metadata', () => {
    const tiledMap = {
        width: 4,
        height: 4,
        tilewidth: 16,
        tileheight: 16,
        tilesets: [
            {
                firstgid: 1,
                name: 'tilesheet-wang',
                objectalignment: 'topleft',
                tilewidth: 16,
                tileheight: 16,
                tiles: [
                    {
                        id: 0,
                        objectgroup: {
                            type: 'objectgroup',
                            objects: [{ id: 1, x: 0, y: 0, width: 16, height: 16 }],
                        },
                    },
                    {
                        id: 1,
                    },
                ],
            },
        ],
        layers: [
            {
                id: 1,
                name: 'forest',
                type: 'group',
                visible: true,
                offsetx: 16,
                offsety: 16,
                properties: [{ name: 'biome', value: 'forest' }],
                layers: [
                    {
                        id: 2,
                        name: 'ground',
                        type: 'tilelayer',
                        visible: true,
                        width: 4,
                        height: 4,
                        data: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    },
                    {
                        id: 3,
                        name: 'props',
                        class: 'DepthSorted',
                        type: 'objectgroup',
                        visible: true,
                        properties: [
                            { name: 'prop_family', value: 'forest_props' },
                            { name: 'depth_offset', value: 1 },
                        ],
                        objects: [
                            {
                                id: 10,
                                gid: 1,
                                x: 16,
                                y: 16,
                                width: 16,
                                height: 16,
                                template: 'templates/totem.tx',
                                properties: [
                                    { name: 'prop_kind', value: 'totem' },
                                    { name: 'tags', value: 'rare, ritual' },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    } as Parameters<typeof processMap>[0];

    const clientMap = processMap(tiledMap, { mode: 'client', quiet: true });
    const serverMap = processMap(tiledMap, { mode: 'server', quiet: true });

    expect(clientMap.data?.[5]).toBe(2);
    expect(clientMap.renderProps?.length).toBe(1);
    expect(clientMap.renderProps?.[0]).toEqual({
        depth: 3,
        minTileX: 2,
        minTileY: 2,
        maxTileX: 2,
        maxTileY: 2,
        parts: [{ index: 10, gid: 1 }],
        meta: {
            layer: 'props',
            layerPath: 'forest/props',
            groupPath: ['forest'],
            family: 'forest_props',
            kind: 'totem',
            biome: 'forest',
            tags: ['rare', 'ritual'],
            template: 'templates/totem.tx',
            depthMode: 'collision',
            depthOffset: 1,
        },
    });
    expect(clientMap.collisions).toContain(10);
    expect(serverMap.collisions).toContain(10);
});

test('explicit passable bridge deck tiles carve through colliding terrain while edge tiles stay blocked', () => {
    const tiledMap = {
        width: 4,
        height: 3,
        tilewidth: 16,
        tileheight: 16,
        tilesets: [
            {
                firstgid: 1,
                name: 'tilesheet-wang',
                tilewidth: 16,
                tileheight: 16,
                tiles: [
                    {
                        id: 0,
                        objectgroup: {
                            type: 'objectgroup',
                            objects: [{ id: 1, x: 0, y: 0, width: 16, height: 16 }],
                        },
                    },
                    {
                        id: 1,
                        properties: [{ name: 'passable', type: 'bool', value: true }],
                    },
                    {
                        id: 2,
                        properties: [{ name: 'passable', type: 'bool', value: true }],
                    },
                    {
                        id: 3,
                    },
                ],
            },
        ],
        layers: [
            {
                id: 1,
                name: 'cliffs',
                type: 'tilelayer',
                visible: true,
                width: 4,
                height: 3,
                data: [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
            },
            {
                id: 2,
                name: 'bridge',
                type: 'tilelayer',
                visible: true,
                width: 4,
                height: 3,
                data: [0, 0, 0, 0, 1, 2, 3, 4, 0, 0, 0, 0],
            },
        ],
    } as Parameters<typeof processMap>[0];

    const clientMap = processMap(tiledMap, { mode: 'client', quiet: true });
    const serverMap = processMap(tiledMap, { mode: 'server', quiet: true });

    expect(clientMap.collisions).toContain(4);
    expect(clientMap.collisions).not.toContain(5);
    expect(clientMap.collisions).not.toContain(6);
    expect(clientMap.collisions).toContain(7);
    expect(serverMap.collisions).toContain(4);
    expect(serverMap.collisions).not.toContain(5);
    expect(serverMap.collisions).not.toContain(6);
    expect(serverMap.collisions).toContain(7);
});

test('empty perimeter tiles are sealed as collisions', () => {
    const tiledMap = {
        width: 4,
        height: 4,
        tilewidth: 16,
        tileheight: 16,
        tilesets: [
            {
                firstgid: 1,
                name: 'tilesheet-wang',
                tilewidth: 16,
                tileheight: 16,
                tiles: [],
            },
        ],
        layers: [
            {
                id: 1,
                name: 'ground',
                type: 'tilelayer',
                visible: true,
                width: 4,
                height: 4,
                data: [0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0],
            },
        ],
    } as Parameters<typeof processMap>[0];

    const clientMap = processMap(tiledMap, { mode: 'client', quiet: true });
    const serverMap = processMap(tiledMap, { mode: 'server', quiet: true });

    expect(clientMap.blocking).toContain(0);
    expect(clientMap.blocking).toContain(3);
    expect(clientMap.blocking).toContain(12);
    expect(clientMap.blocking).toContain(15);
    expect(serverMap.collisions).toContain(0);
    expect(serverMap.collisions).toContain(15);
    expect(clientMap.blocking).not.toContain(5);
    expect(serverMap.collisions).not.toContain(5);
});
