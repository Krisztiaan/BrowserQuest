import { expect, test } from 'bun:test';
import BridgeProbeModule, { runWebSocketBridgeProbeIfEnabled } from '../../server/js/main-esm-bridge-probe.mjs';
import RuntimeOptionsModule, { resolveStartupRuntimeOptions } from '../../server/js/main-esm-runtime-options.mjs';

test('main-esm bridge probe helper exports stable named/default contract', () => {
    expect(typeof runWebSocketBridgeProbeIfEnabled).toBe('function');
    expect(typeof BridgeProbeModule).toBe('object');
    expect(BridgeProbeModule.runWebSocketBridgeProbeIfEnabled).toBe(runWebSocketBridgeProbeIfEnabled);
});

test('main-esm runtime-options helper exports stable named/default contract', () => {
    expect(typeof resolveStartupRuntimeOptions).toBe('function');
    expect(typeof RuntimeOptionsModule).toBe('object');
    expect(RuntimeOptionsModule.resolveStartupRuntimeOptions).toBe(resolveStartupRuntimeOptions);
});
