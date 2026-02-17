import { expect, test } from 'bun:test';
import { ensureConfigPreflightValid, ensureConfigSourcePresent, ensureMapPreflightValid } from '../../../../server/startup/preflight';

test('preflight helper emits and fails when no active config is present', () => {
    const errors: string[] = [];
    let failCode: number | null = null;

    const isPresent = ensureConfigSourcePresent({
        activeConfig: null,
        emitError: (message) => errors.push(message),
        fail: (code) => {
            failCode = code;
        },
    });

    expect(isPresent).toBe(false);
    expect(failCode).toBe(1);
    expect(errors).toEqual(['Server cannot start without any configuration file.']);
});

test('preflight helper accepts active config without emitting failures', () => {
    const errors: string[] = [];
    let failCode: number | null = null;

    const isPresent = ensureConfigSourcePresent({
        activeConfig: { port: 8000 },
        emitError: (message) => errors.push(message),
        fail: (code) => {
            failCode = code;
        },
    });

    expect(isPresent).toBe(true);
    expect(failCode).toBeNull();
    expect(errors).toEqual([]);
});

test('preflight validation helper accepts valid config without failure', () => {
    const errors: string[] = [];
    let failCode: number | null = null;
    let validateCalls = 0;

    const isValid = ensureConfigPreflightValid({
        activeConfig: { port: 8000 },
        validateConfig: () => {
            validateCalls += 1;
            return { isValid: true, errors: [] };
        },
        limitUtf8Bytes: (text) => text,
        emitError: (message) => errors.push(message),
        fail: (code) => {
            failCode = code;
        },
    });

    expect(isValid).toBe(true);
    expect(validateCalls).toBe(1);
    expect(failCode).toBeNull();
    expect(errors).toEqual([]);
});

test('preflight validation helper emits compacted error payload and fails for invalid config', () => {
    const errors: string[] = [];
    let failCode: number | null = null;
    let limitInput = '';
    let limitBytes = 0;

    const isValid = ensureConfigPreflightValid({
        activeConfig: { port: 'invalid' },
        validateConfig: () => ({
            isValid: false,
            errors: [{ field: 'port', message: 'Expected number' }],
        }),
        limitUtf8Bytes: (text, maxBytes) => {
            limitInput = text;
            limitBytes = maxBytes;
            return 'trimmed-errors';
        },
        emitError: (message) => errors.push(message),
        fail: (code) => {
            failCode = code;
        },
    });

    expect(isValid).toBe(false);
    expect(limitInput).toContain('Expected number');
    expect(limitBytes).toBe(512);
    expect(failCode).toBe(1);
    expect(errors).toEqual(['Startup preflight: invalid server configuration: trimmed-errors']);
});

test('map preflight helper accepts readable valid JSON map files', async () => {
    const errors: string[] = [];
    let failCode: number | null = null;

    const isValid = await ensureMapPreflightValid({
        activeConfig: { map_filepath: './assets/maps/tiled/world.json' },
        emitError: (message) => errors.push(message),
        fail: (code) => {
            failCode = code;
        },
        readFileText: () => Promise.resolve('{"width":1,"height":1,"collisions":[],"roamingAreas":[],"chestAreas":[],"staticChests":[],"staticEntities":{}}'),
    });

    expect(isValid).toBe(true);
    expect(failCode).toBeNull();
    expect(errors).toEqual([]);
});

test('map preflight helper fails for parseable but semantically invalid map payload', async () => {
    const errors: string[] = [];
    let failCode: number | null = null;

    const isValid = await ensureMapPreflightValid({
        activeConfig: { map_filepath: './bad-shape-map.json' },
        emitError: (message) => errors.push(message),
        fail: (code) => {
            failCode = code;
        },
        readFileText: () => Promise.resolve('{"width":1}'),
        validateMapPayloadFn: () => Promise.resolve({ ok: false, reason: 'missing required map fields' }),
    });

    expect(isValid).toBe(false);
    expect(failCode).toBe(1);
    expect(errors).toEqual([
        'Startup preflight: map file contains invalid map payload: ./bad-shape-map.json (missing required map fields)',
    ]);
});

test('map preflight helper fails for missing or invalid map JSON', async () => {
    const errorsMissing: string[] = [];
    let failMissing: number | null = null;
    const missingOk = await ensureMapPreflightValid({
        activeConfig: { map_filepath: './missing-map.json' },
        emitError: (message) => errorsMissing.push(message),
        fail: (code) => {
            failMissing = code;
        },
        readFileText: () => Promise.reject(new Error('ENOENT')),
    });

    expect(missingOk).toBe(false);
    expect(failMissing).toBe(1);
    expect(errorsMissing).toEqual(['Startup preflight: map file missing or unreadable: ./missing-map.json']);

    const errorsJson: string[] = [];
    let failJson: number | null = null;
    const jsonOk = await ensureMapPreflightValid({
        activeConfig: { map_filepath: './bad-map.json' },
        emitError: (message) => errorsJson.push(message),
        fail: (code) => {
            failJson = code;
        },
        readFileText: () => Promise.resolve('{bad json'),
    });

    expect(jsonOk).toBe(false);
    expect(failJson).toBe(1);
    expect(errorsJson).toEqual(['Startup preflight: map file contains invalid JSON: ./bad-map.json']);
});
