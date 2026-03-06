import { expect, test } from 'bun:test';
import type { EntityKindName } from '../../shared/entity-kind-domain';
import Map, { validateMapPayload } from '../../server/map';

function createMinimalMapDefinition() {
    return {
        width: 4,
        height: 4,
        collisions: [],
        roamingAreas: [],
        chestAreas: [],
        staticChests: [],
        staticEntities: {} as Record<string, EntityKindName>,
        doors: [],
        checkpoints: [],
    };
}

test('server map payload validation rejects invalid static entity kinds', async () => {
    const result = await validateMapPayload({
        width: 4,
        height: 4,
        collisions: [],
        roamingAreas: [],
        chestAreas: [],
        staticChests: [],
        staticEntities: { '27': 'definitely_not_an_entity' },
        doors: [],
        checkpoints: [],
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Invalid map payload');
});

test('server map ready supports multiple callbacks without overwrite', () => {
    const map = Object.create(Map.prototype) as Map;
    map.isLoaded = false;
    map.readyCallbacks = [];
    const calls: string[] = [];

    map.ready(() => {
        calls.push('first');
    });
    map.ready(() => {
        calls.push('second');
    });

    map.initMap(createMinimalMapDefinition());

    expect(calls).toEqual(['first', 'second']);

    map.ready(() => {
        calls.push('third');
    });

    expect(calls).toEqual(['first', 'second', 'third']);
});
