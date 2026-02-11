import { expect, test } from 'bun:test';
import BridgeProbeModule, { runWebSocketBridgeProbeIfEnabled } from '../../server/main/bridge-probe';
import BootEnvelopeModule, { runMainEsmBootEnvelope } from '../../server/main/boot-envelope';
import ConfigSourceModule, { loadConfigFile, resolveActiveConfig } from '../../server/main/config-source';
import PreflightFailuresModule, {
    ensureConfigPreflightValid,
    ensureConfigSourcePresent,
} from '../../server/main/preflight-failures';
import StartupRunnerModule, { runStartupWithConfig } from '../../server/main/startup-runner';
import StructuredEventModule, {
    createProbeEventEmitter,
    createStructuredEventEmitter,
} from '../../server/main/structured-event';
import RuntimeOptionsModule, { resolveStartupRuntimeOptions } from '../../server/main/runtime-options';

test('main-entry bridge probe helper exports stable named/default contract', () => {
    expect(typeof runWebSocketBridgeProbeIfEnabled).toBe('function');
    expect(typeof BridgeProbeModule).toBe('object');
    expect(BridgeProbeModule.runWebSocketBridgeProbeIfEnabled).toBe(runWebSocketBridgeProbeIfEnabled);
});

test('main-entry boot-envelope helper exports stable named/default contract', () => {
    expect(typeof runMainEsmBootEnvelope).toBe('function');
    expect(typeof BootEnvelopeModule).toBe('object');
    expect(BootEnvelopeModule.runMainEsmBootEnvelope).toBe(runMainEsmBootEnvelope);
});

test('main-entry runtime-options helper exports stable named/default contract', () => {
    expect(typeof resolveStartupRuntimeOptions).toBe('function');
    expect(typeof RuntimeOptionsModule).toBe('object');
    expect(RuntimeOptionsModule.resolveStartupRuntimeOptions).toBe(resolveStartupRuntimeOptions);
});

test('main-entry preflight-failures helper exports stable named/default contract', () => {
    expect(typeof ensureConfigSourcePresent).toBe('function');
    expect(typeof ensureConfigPreflightValid).toBe('function');
    expect(typeof PreflightFailuresModule).toBe('object');
    expect(PreflightFailuresModule.ensureConfigSourcePresent).toBe(ensureConfigSourcePresent);
    expect(PreflightFailuresModule.ensureConfigPreflightValid).toBe(ensureConfigPreflightValid);
});

test('main-entry config-source helper exports stable named/default contract', () => {
    expect(typeof loadConfigFile).toBe('function');
    expect(typeof resolveActiveConfig).toBe('function');
    expect(typeof ConfigSourceModule).toBe('object');
    expect(ConfigSourceModule.loadConfigFile).toBe(loadConfigFile);
    expect(ConfigSourceModule.resolveActiveConfig).toBe(resolveActiveConfig);
});

test('main-entry startup-runner helper exports stable named/default contract', () => {
    expect(typeof runStartupWithConfig).toBe('function');
    expect(typeof StartupRunnerModule).toBe('object');
    expect(StartupRunnerModule.runStartupWithConfig).toBe(runStartupWithConfig);
});

test('main-entry structured-event helper exports stable named/default contract', () => {
    expect(typeof createStructuredEventEmitter).toBe('function');
    expect(typeof createProbeEventEmitter).toBe('function');
    expect(typeof StructuredEventModule).toBe('object');
    expect(StructuredEventModule.createStructuredEventEmitter).toBe(createStructuredEventEmitter);
    expect(StructuredEventModule.createProbeEventEmitter).toBe(createProbeEventEmitter);
});
