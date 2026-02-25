import { expect, test } from 'bun:test';
import { mapGraphDoorRefKey, validateMapGraph } from '../../shared/maps/map-graph';

function createValidGraph() {
    return {
        maps: [
            {
                id: 'overworld',
                width: 100,
                height: 100,
                doors: [{ id: 'house_01_enter', x: 10, y: 20 }],
            },
            {
                id: 'house_01',
                width: 16,
                height: 16,
                doors: [{ id: 'exit', x: 4, y: 14 }],
            },
        ],
        edges: [
            {
                from: { mapId: 'overworld', doorId: 'house_01_enter' },
                to: { mapId: 'house_01', doorId: 'exit' },
            },
        ],
    };
}

test('map-graph validator accepts a valid graph', () => {
    expect(validateMapGraph(createValidGraph())).toEqual({ ok: true });
});

test('map-graph validator rejects duplicate map ids', () => {
    const graph = createValidGraph();
    graph.maps.push({
        id: 'overworld',
        width: 8,
        height: 8,
        doors: [{ id: 'dup', x: 1, y: 1 }],
    });

    expect(validateMapGraph(graph)).toEqual({
        ok: false,
        errors: ['Invalid map graph: duplicate map id "overworld".'],
    });
});

test('map-graph validator rejects duplicate door ids within a map', () => {
    const graph = createValidGraph();
    graph.maps[1]?.doors.push({ id: 'exit', x: 5, y: 14 });

    expect(validateMapGraph(graph)).toEqual({
        ok: false,
        errors: ['Invalid map graph: duplicate door id "exit" in map "house_01".'],
    });
});

test('map-graph validator rejects dangling links with deterministic messages', () => {
    const graph = createValidGraph();
    graph.edges.push({
        from: { mapId: 'house_01', doorId: 'missing' },
        to: { mapId: 'unknown_map', doorId: 'exit' },
    });

    expect(validateMapGraph(graph)).toEqual({
        ok: false,
        errors: [
            'Invalid map graph: dangling edge source "house_01:missing".',
            'Invalid map graph: dangling edge destination "unknown_map:exit".',
        ],
    });
});

test('map-graph validator rejects duplicate edges', () => {
    const graph = createValidGraph();
    const edge = graph.edges[0];
    if (!edge) {
        throw new Error('Expected a baseline edge');
    }
    graph.edges.push({ from: edge.from, to: edge.to });

    expect(validateMapGraph(graph)).toEqual({
        ok: false,
        errors: ['Invalid map graph: duplicate edge "overworld:house_01_enter->house_01:exit".'],
    });
});

test('map-graph helper creates deterministic door ref keys', () => {
    expect(mapGraphDoorRefKey({ mapId: 'house_01', doorId: 'exit' })).toBe('house_01:exit');
});
