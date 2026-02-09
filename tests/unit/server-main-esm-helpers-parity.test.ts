import { expect, test } from 'bun:test';
import BridgeProbeModule, { runWebSocketBridgeProbeIfEnabled } from '../../server/js/main-esm-bridge-probe';
import BootEnvelopeModule, { runMainEsmBootEnvelope } from '../../server/js/main-esm-boot-envelope';
import ConfigSourceModule, { loadConfigFile, resolveActiveConfig } from '../../server/js/main-esm-config-source';
import PreflightFailuresModule, {
    ensureConfigPreflightValid,
    ensureConfigSourcePresent,
} from '../../server/js/main-esm-preflight-failures';
import StartupRunnerModule, { runStartupWithConfig } from '../../server/js/main-esm-startup-runner';
import StructuredEventModule, {
    createProbeEventEmitter,
    createStructuredEventEmitter,
} from '../../server/js/main-esm-structured-event';
import RuntimeOptionsModule, { resolveStartupRuntimeOptions } from '../../server/js/main-esm-runtime-options';

test('main-esm bridge probe helper exports stable named/default contract', () => {
    expect(typeof runWebSocketBridgeProbeIfEnabled).toBe('function');
    expect(typeof BridgeProbeModule).toBe('object');
    expect(BridgeProbeModule.runWebSocketBridgeProbeIfEnabled).toBe(runWebSocketBridgeProbeIfEnabled);
});

test('main-esm boot-envelope helper exports stable named/default contract', () => {
    expect(typeof runMainEsmBootEnvelope).toBe('function');
    expect(typeof BootEnvelopeModule).toBe('object');
    expect(BootEnvelopeModule.runMainEsmBootEnvelope).toBe(runMainEsmBootEnvelope);
});

test('main-esm runtime-options helper exports stable named/default contract', () => {
    expect(typeof resolveStartupRuntimeOptions).toBe('function');
    expect(typeof RuntimeOptionsModule).toBe('object');
    expect(RuntimeOptionsModule.resolveStartupRuntimeOptions).toBe(resolveStartupRuntimeOptions);
});

test('main-esm preflight-failures helper exports stable named/default contract', () => {
    expect(typeof ensureConfigSourcePresent).toBe('function');
    expect(typeof ensureConfigPreflightValid).toBe('function');
    expect(typeof PreflightFailuresModule).toBe('object');
    expect(PreflightFailuresModule.ensureConfigSourcePresent).toBe(ensureConfigSourcePresent);
    expect(PreflightFailuresModule.ensureConfigPreflightValid).toBe(ensureConfigPreflightValid);
});

test('main-esm config-source helper exports stable named/default contract', () => {
    expect(typeof loadConfigFile).toBe('function');
    expect(typeof resolveActiveConfig).toBe('function');
    expect(typeof ConfigSourceModule).toBe('object');
    expect(ConfigSourceModule.loadConfigFile).toBe(loadConfigFile);
    expect(ConfigSourceModule.resolveActiveConfig).toBe(resolveActiveConfig);
});

test('main-esm startup-runner helper exports stable named/default contract', () => {
    expect(typeof runStartupWithConfig).toBe('function');
    expect(typeof StartupRunnerModule).toBe('object');
    expect(StartupRunnerModule.runStartupWithConfig).toBe(runStartupWithConfig);
});

test('main-esm structured-event helper exports stable named/default contract', () => {
    expect(typeof createStructuredEventEmitter).toBe('function');
    expect(typeof createProbeEventEmitter).toBe('function');
    expect(typeof StructuredEventModule).toBe('object');
    expect(StructuredEventModule.createStructuredEventEmitter).toBe(createStructuredEventEmitter);
    expect(StructuredEventModule.createProbeEventEmitter).toBe(createProbeEventEmitter);
});
