import { expect, test } from 'bun:test';
import WsModule from '../../../server/ws/runtime';

function hasDuplicates(values: readonly string[]): boolean {
    return new Set(values).size !== values.length;
}

test('ws runtime export key inventory is deterministic', () => {
    const exportKeys = Object.keys(WsModule).sort();
    expect(hasDuplicates(exportKeys)).toBe(false);
    expect(exportKeys).toContain('CLOSE_CODES');
    expect(exportKeys).toContain('createWebSocketRuntimeClasses');
    expect(exportKeys).toContain('MultiVersionWebsocketServer');
    expect(exportKeys).toContain('wsWebSocketConnection');
});

test('ws module exports seam-compatible runtime contract', () => {
    expect(typeof WsModule.createWebSocketRuntimeClasses).toBe('function');
    expect(typeof WsModule.MultiVersionWebsocketServer).toBe('function');
    expect(typeof WsModule.wsWebSocketConnection).toBe('function');
    expect(typeof WsModule.CLOSE_CODES.NORMAL).toBe('number');
});
