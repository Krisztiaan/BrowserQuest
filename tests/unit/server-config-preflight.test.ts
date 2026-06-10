import { expect, test } from 'bun:test';
import ConfigPreflight from '../../server/config-preflight';

function createValidConfig() {
    return {
        port: 8000,
        debug_level: 'info',
        nb_players_per_world: 64,
        nb_worlds: 5,
        map_filepath: './assets/maps/tiled/map-pack.config.json',
        metrics_enabled: false,
    };
}

test('config preflight accepts default-safe valid config', () => {
    const result = ConfigPreflight.validateConfig(createValidConfig());
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
});

test('config preflight accepts larger explicit world capacity for load experiments', () => {
    const result = ConfigPreflight.validateConfig({
        ...createValidConfig(),
        nb_players_per_world: 200,
    });

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
        chunk_size: 9999,
        updates_per_second: 0,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((error: { field: string }) => error.field === 'port')).toBe(true);
    expect(result.errors.some((error: { field: string }) => error.field === 'debug_level')).toBe(true);
    expect(result.errors.some((error: { field: string }) => error.field === 'nb_players_per_world')).toBe(true);
    expect(result.errors.some((error: { field: string }) => error.field === 'nb_worlds')).toBe(true);
    expect(result.errors.some((error: { field: string }) => error.field === 'map_filepath')).toBe(true);
    expect(result.errors.some((error: { field: string }) => error.field === 'metrics_enabled')).toBe(true);
    expect(result.errors.some((error: { field: string }) => error.field === 'chunk_size')).toBe(true);
    expect(result.errors.some((error: { field: string }) => error.field === 'updates_per_second')).toBe(true);
});

test('config preflight allows metrics-enabled config to defer adapter-field validation to metrics runtime', () => {
    const result = ConfigPreflight.validateConfig({
        ...createValidConfig(),
        metrics_enabled: true,
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
});

test('config preflight accepts optional plugin module list', () => {
    const result = ConfigPreflight.validateConfig({
        ...createValidConfig(),
        plugins: ['./server/plugins/sample-spawner.plugin.ts'],
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
});

test('config preflight rejects invalid plugin module list', () => {
    const result = ConfigPreflight.validateConfig({
        ...createValidConfig(),
        plugins: [null, 123],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((error: { field: string }) => error.field === 'plugins')).toBe(true);
});

test('config preflight accepts optional persistence tuning fields', () => {
    const result = ConfigPreflight.validateConfig({
        ...createValidConfig(),
        player_db_path: ':memory:',
        chunk_overlay_db_path: ':memory:',
        claims_db_path: ':memory:',
        chunk_overlay_flush_interval_ms: 5000,
        chunk_overlay_flush_max_chunks: 128,
        chunk_overlay_bootstrap_load_limit_chunks: 2048,
        chunk_snapshot_payload_max_utf8_bytes: 32 * 1024,
        chunk_snapshot_max_parts: 64,
        chunk_size: 64,
        updates_per_second: 30,
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
});
