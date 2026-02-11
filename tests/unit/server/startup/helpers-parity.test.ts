import { expect, test } from 'bun:test';
import BridgeProbeModule, { runWebSocketBridgeProbeIfEnabled } from '../../../../server/startup/bridge-probe';
import BootEnvelopeModule, { runMainEntryBootEnvelope } from '../../../../server/startup/boot-envelope';
import ConfigSourceModule, { loadConfigFile, resolveActiveConfig } from '../../../../server/startup/config-source';
import PreflightFailuresModule, {
    ensureConfigPreflightValid,
    ensureConfigSourcePresent,
} from '../../../../server/startup/preflight-failures';
import StartupRunnerModule, { runStartupWithConfig } from '../../../../server/startup/startup-runner';
import StructuredEventModule, {
    createProbeEventEmitter,
    createStructuredEventEmitter,
} from '../../../../server/startup/structured-event';
import RuntimeOptionsModule, { resolveStartupRuntimeOptions } from '../../../../server/startup/runtime-options';

test('startup bridge probe helper exports stable named/default contract', () => {
    expect(typeof runWebSocketBridgeProbeIfEnabled).toBe('function');
    expect(typeof BridgeProbeModule).toBe('object');
    expect(BridgeProbeModule.runWebSocketBridgeProbeIfEnabled).toBe(runWebSocketBridgeProbeIfEnabled);
});

test('startup boot-envelope helper exports stable named/default contract', () => {
    expect(typeof runMainEntryBootEnvelope).toBe('function');
    expect(typeof BootEnvelopeModule).toBe('object');
    expect(BootEnvelopeModule.runMainEntryBootEnvelope).toBe(runMainEntryBootEnvelope);
});

test('startup runtime-options helper exports stable named/default contract', () => {
    expect(typeof resolveStartupRuntimeOptions).toBe('function');
    expect(typeof RuntimeOptionsModule).toBe('object');
    expect(RuntimeOptionsModule.resolveStartupRuntimeOptions).toBe(resolveStartupRuntimeOptions);
});

test('startup preflight-failures helper exports stable named/default contract', () => {
    expect(typeof ensureConfigSourcePresent).toBe('function');
    expect(typeof ensureConfigPreflightValid).toBe('function');
    expect(typeof PreflightFailuresModule).toBe('object');
    expect(PreflightFailuresModule.ensureConfigSourcePresent).toBe(ensureConfigSourcePresent);
    expect(PreflightFailuresModule.ensureConfigPreflightValid).toBe(ensureConfigPreflightValid);
});

test('startup config-source helper exports stable named/default contract', () => {
    expect(typeof loadConfigFile).toBe('function');
    expect(typeof resolveActiveConfig).toBe('function');
    expect(typeof ConfigSourceModule).toBe('object');
    expect(ConfigSourceModule.loadConfigFile).toBe(loadConfigFile);
    expect(ConfigSourceModule.resolveActiveConfig).toBe(resolveActiveConfig);
});

test('startup startup-runner helper exports stable named/default contract', () => {
    expect(typeof runStartupWithConfig).toBe('function');
    expect(typeof StartupRunnerModule).toBe('object');
    expect(StartupRunnerModule.runStartupWithConfig).toBe(runStartupWithConfig);
});

test('startup structured-event helper exports stable named/default contract', () => {
    expect(typeof createStructuredEventEmitter).toBe('function');
    expect(typeof createProbeEventEmitter).toBe('function');
    expect(typeof StructuredEventModule).toBe('object');
    expect(StructuredEventModule.createStructuredEventEmitter).toBe(createStructuredEventEmitter);
    expect(StructuredEventModule.createProbeEventEmitter).toBe(createProbeEventEmitter);
});
