import { expect, test } from 'bun:test';
import { validateTerrainGrammar } from '../../tools/content/terrain-grammar-validator';

test('grammar validator reports missing transition shapes by pair', () => {
    const report = validateTerrainGrammar({
        grammar: {
            mapPropertiesRequired: [],
            families: [{ id: 'water' }, { id: 'sand' }],
            transitionPairs: [{ id: 'shoreline', requiredShapes: ['edge_n'] }],
            layerRoles: { transition: ['shoreline'] },
        },
        world: { layers: [] },
        tileset: { tiles: [] },
    });

    expect(report.missingTransitionShapes).toContainEqual({ pair: 'shoreline', shape: 'edge_n' });
});

test('grammar validator reports required map properties', () => {
    const report = validateTerrainGrammar({
        grammar: {
            mapPropertiesRequired: ['map_id'],
            families: [],
            transitionPairs: [],
            layerRoles: {},
        },
        world: { layers: [] },
        tileset: { tiles: [] },
    });

    expect(report.missingMapProperties).toContain('map_id');
});
