import { expect, test } from 'bun:test';
import ConfigPreflight from '../../server/config-preflight';

function createValidConfig() {
    return {
        port: 8000,
        debug_level: 'info',
        nb_players_per_world: 200,
        nb_worlds: 5,
        map_filepath: './assets/maps/tiled/world.json',
        metrics_enabled: false,
    };
}

test('config preflight accepts default-safe valid config', () => {
    const result = ConfigPreflight.validateConfig(createValidConfig());
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
});

test('config preflight rejects invalid core fields', () => {
    const result = ConfigPreflight.validateConfig({
        ...createValidConfig(),
        port: 0,
        debug_level: 'warn',
        nb_players_per_world: -1,
        nb_worlds: 0,
        map_filepath: '',
        metrics_enabled: 'yes',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((error: { field: string }) => error.field === 'port')).toBe(true);
    expect(result.errors.some((error: { field: string }) => error.field === 'debug_level')).toBe(true);
    expect(result.errors.some((error: { field: string }) => error.field === 'nb_players_per_world')).toBe(true);
    expect(result.errors.some((error: { field: string }) => error.field === 'nb_worlds')).toBe(true);
    expect(result.errors.some((error: { field: string }) => error.field === 'map_filepath')).toBe(true);
    expect(result.errors.some((error: { field: string }) => error.field === 'metrics_enabled')).toBe(true);
});

test('config preflight allows metrics-enabled config to defer adapter-field validation to metrics runtime', () => {
    const result = ConfigPreflight.validateConfig({
        ...createValidConfig(),
        metrics_enabled: true,
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
});
