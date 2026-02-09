import { expect, test } from 'bun:test';
import { ensureConfigPreflightValid, ensureConfigSourcePresent } from '../../server/js/main-esm-preflight-failures.ts';

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
    expect(errors).toEqual(['ESM preflight: invalid server configuration: trimmed-errors']);
});
