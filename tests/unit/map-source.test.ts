import { afterEach, expect, test } from 'bun:test';
import {
    __resetClientRuntimeMapSourceCacheForTests,
    fetchClientDefaultRuntimeMapId,
    fetchClientRuntimeMap,
} from '../../client/map-source';

const originalFetch = globalThis.fetch;

function resolveRequestPath(input: RequestInfo | URL): string {
    if (typeof input === 'string') {
        return input;
    }
    if (input instanceof URL) {
        return input.toString();
    }
    if (input instanceof Request) {
        return input.url;
    }
    return '';
}

function createClientMap(width: number, height: number): Record<string, unknown> {
    return {
        width,
        height,
        tilesize: 16,
        data: new Array(width * height).fill(1),
        foreground: new Array(width * height).fill(0),
        blocking: [],
        plateau: [],
        musicAreas: [],
        collisions: [],
        animated: {},
        doors: [],
        checkpoints: [],
    };
}

afterEach(() => {
    __resetClientRuntimeMapSourceCacheForTests();
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: originalFetch,
    });
});

test('map source loads map-pack runtime payload once and resolves maps by id', async () => {
    __resetClientRuntimeMapSourceCacheForTests();
    const fetchCalls: string[] = [];
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: (input: RequestInfo | URL) =>
            Promise.resolve(new Response(
                JSON.stringify({
                    schemaVersion: 2,
                    maps: [
                        { id: 'world', client: createClientMap(4, 4), server: {} },
                        { id: 'house', client: createClientMap(2, 3), server: {} },
                    ],
                    graph: { maps: [], edges: [] },
                }),
                { status: 200, headers: { 'content-type': 'application/json' } }
            )).then((response) => {
                fetchCalls.push(resolveRequestPath(input));
                return response;
            }),
    });

    const defaultMapId = await fetchClientDefaultRuntimeMapId();
    const world = await fetchClientRuntimeMap();
    const house = await fetchClientRuntimeMap('house');

    expect(defaultMapId).toBe('world');
    expect(world.width).toBe(4);
    expect(world.height).toBe(4);
    expect(house.width).toBe(2);
    expect(house.height).toBe(3);
    expect(fetchCalls).toEqual(['/assets/maps/runtime/map-pack.json']);

    let thrown = '';
    try {
        await fetchClientRuntimeMap('missing');
    } catch (error) {
        thrown = error instanceof Error ? error.message : String(error);
    }
    expect(thrown).toContain('Unknown runtime map id "missing".');
});

test('map source defers map payload normalization until a map is requested', async () => {
    __resetClientRuntimeMapSourceCacheForTests();
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: () =>
            Promise.resolve(
                new Response(
                    JSON.stringify({
                        schemaVersion: 2,
                        maps: [
                            { id: 'world', client: createClientMap(4, 4), server: {} },
                            { id: 'broken_house', client: { width: 2, height: 2, tilesize: 16, data: 'bad' }, server: {} },
                        ],
                        graph: { maps: [], edges: [] },
                    }),
                    { status: 200, headers: { 'content-type': 'application/json' } }
                )
            ),
    });

    const world = await fetchClientRuntimeMap('world');
    expect(world.width).toBe(4);
    let thrown = '';
    try {
        await fetchClientRuntimeMap('broken_house');
    } catch (error) {
        thrown = error instanceof Error ? error.message : String(error);
    }
    expect(thrown).toContain('Invalid runtime map pack payload: map "broken_house" client.data must be an array.');
});
