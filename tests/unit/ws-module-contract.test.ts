import { expect, test } from 'bun:test';
import type { WsModuleContract } from '../../server/js/ws-module-types';
import {
    WS_MODULE_EXPORT_KEYS,
    WS_MODULE_SHADOW_SOURCE_CONTRACT,
    WS_RUNTIME_DEPENDENCY_BOUNDARIES,
} from '../../server/js/ws-module-types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WsModule = require('../../server/js/ws') as WsModuleContract;

function hasDuplicates(values: readonly string[]): boolean {
    return new Set(values).size !== values.length;
}

test('ws module contract inventory is deterministic', () => {
    expect(WS_RUNTIME_DEPENDENCY_BOUNDARIES.length).toBe(8);
    expect(hasDuplicates(WS_RUNTIME_DEPENDENCY_BOUNDARIES)).toBe(false);
    expect(WS_RUNTIME_DEPENDENCY_BOUNDARIES).toContain('./ws-runtime-class-factory.cjs');

    expect(WS_MODULE_EXPORT_KEYS.length).toBe(4);
    expect(hasDuplicates(WS_MODULE_EXPORT_KEYS)).toBe(false);
    expect(WS_MODULE_EXPORT_KEYS).toContain('MultiVersionWebsocketServer');
    expect(WS_MODULE_EXPORT_KEYS).toContain('wsWebSocketConnection');

    expect(WS_MODULE_SHADOW_SOURCE_CONTRACT.dependencyBoundaries).toEqual(WS_RUNTIME_DEPENDENCY_BOUNDARIES);
    expect(WS_MODULE_SHADOW_SOURCE_CONTRACT.exportKeys).toEqual(WS_MODULE_EXPORT_KEYS);
});

test('ws module exports seam-compatible runtime contract', () => {
    expect(typeof WsModule.createWebSocketRuntimeClasses).toBe('function');
    expect(typeof WsModule.MultiVersionWebsocketServer).toBe('function');
    expect(typeof WsModule.wsWebSocketConnection).toBe('function');
    expect(typeof WsModule.CLOSE_CODES.NORMAL).toBe('number');
});
