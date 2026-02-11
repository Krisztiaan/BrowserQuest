import { expect, test } from 'bun:test';
import BridgeProbeModule, { runBridgeProbeIfEnabled } from '../../../../server/startup/bridge-probe';
import BootEnvelopeModule, { runEntryBoot } from '../../../../server/startup/boot';
import ConfigSourceModule, { loadConfigFile, resolveActiveConfig } from '../../../../server/startup/config';
import PreflightFailuresModule, {
    ensureConfigPreflightValid,
    ensureConfigSourcePresent,
} from '../../../../server/startup/preflight';
import StartupRunnerModule, { runStartup } from '../../../../server/startup/runner';
import StructuredEventModule, {
    createProbeEventEmitter,
    createStructuredEventEmitter,
} from '../../../../server/startup/events';
import RuntimeOptionsModule, { resolveRuntimeOptions } from '../../../../server/startup/options';

test('startup bridge probe helper exports stable named/default contract', () => {
    expect(typeof runBridgeProbeIfEnabled).toBe('function');
    expect(typeof BridgeProbeModule).toBe('object');
    expect(BridgeProbeModule.runBridgeProbeIfEnabled).toBe(runBridgeProbeIfEnabled);
});

test('startup boot helper exports stable named/default contract', () => {
    expect(typeof runEntryBoot).toBe('function');
    expect(typeof BootEnvelopeModule).toBe('object');
    expect(BootEnvelopeModule.runEntryBoot).toBe(runEntryBoot);
});

test('startup options helper exports stable named/default contract', () => {
    expect(typeof resolveRuntimeOptions).toBe('function');
    expect(typeof RuntimeOptionsModule).toBe('object');
    expect(RuntimeOptionsModule.resolveRuntimeOptions).toBe(resolveRuntimeOptions);
});

test('startup preflight helper exports stable named/default contract', () => {
    expect(typeof ensureConfigSourcePresent).toBe('function');
    expect(typeof ensureConfigPreflightValid).toBe('function');
    expect(typeof PreflightFailuresModule).toBe('object');
    expect(PreflightFailuresModule.ensureConfigSourcePresent).toBe(ensureConfigSourcePresent);
    expect(PreflightFailuresModule.ensureConfigPreflightValid).toBe(ensureConfigPreflightValid);
});

test('startup config helper exports stable named/default contract', () => {
    expect(typeof loadConfigFile).toBe('function');
    expect(typeof resolveActiveConfig).toBe('function');
    expect(typeof ConfigSourceModule).toBe('object');
    expect(ConfigSourceModule.loadConfigFile).toBe(loadConfigFile);
    expect(ConfigSourceModule.resolveActiveConfig).toBe(resolveActiveConfig);
});

test('startup runner helper exports stable named/default contract', () => {
    expect(typeof runStartup).toBe('function');
    expect(typeof StartupRunnerModule).toBe('object');
    expect(StartupRunnerModule.runStartup).toBe(runStartup);
});

test('startup events helper exports stable named/default contract', () => {
    expect(typeof createStructuredEventEmitter).toBe('function');
    expect(typeof createProbeEventEmitter).toBe('function');
    expect(typeof StructuredEventModule).toBe('object');
    expect(StructuredEventModule.createStructuredEventEmitter).toBe(createStructuredEventEmitter);
    expect(StructuredEventModule.createProbeEventEmitter).toBe(createProbeEventEmitter);
});
