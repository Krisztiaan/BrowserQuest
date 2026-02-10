import { expect, test } from 'bun:test';
import ConfigPreflight from '../../server/js/config-preflight';
import ConfigPreflightEsm, { validateConfig } from '../../server/js/config-preflight-esm';

function createValidConfig() {
    return {
        port: 8000,
        debug_level: 'info',
        nb_players_per_world: 200,
        nb_worlds: 5,
        map_filepath: './tools/maps/tiled/world.json',
        metrics_enabled: false,
    };
}

test('esm config-preflight validates valid config', () => {
    const result = validateConfig(createValidConfig());
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
});

test('esm config-preflight matches cjs output for invalid payload', () => {
    const invalid = {
        ...createValidConfig(),
        port: 0,
        debug_level: 'warn',
        nb_players_per_world: 0,
        nb_worlds: -1,
        map_filepath: '',
        metrics_enabled: 'nope',
    };

    const esmResult = ConfigPreflightEsm.validateConfig(invalid);
    const cjsResult = ConfigPreflight.validateConfig(invalid);

    expect(esmResult).toEqual(cjsResult);
});
