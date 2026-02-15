import { expect, test } from 'bun:test';
import Map from '../../server/map';

function createMinimalMapDefinition() {
    return {
        width: 4,
        height: 4,
        collisions: [],
        roamingAreas: [],
        chestAreas: [],
        staticChests: [],
        staticEntities: {},
        doors: [],
        checkpoints: [],
    };
}

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
