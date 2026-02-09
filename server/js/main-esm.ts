import { runWebSocketBridgeProbeIfEnabled } from './main-esm-bridge-probe.ts';
import { runMainEsmBootEnvelope } from './main-esm-boot-envelope.ts';
import { createProbeEventEmitter, createStructuredEventEmitter } from './main-esm-structured-event.ts';
import { validateConfig } from './config-preflight-esm.ts';
import { resolveStartupRuntimeOptions } from './main-esm-runtime-options.ts';
import Utils from './utils-esm.ts';
import MainRuntime from './main-runtime.cts';
const createRuntimeDependencies = MainRuntime.createRuntimeDependencies;
const startServer = MainRuntime.main;

const defaultConfigPath = './server/config.json';
const customConfigPath = process.argv[2] || './server/config_local.json';

const emitStructuredEvent = createStructuredEventEmitter();
const emitProbeEvent = createProbeEventEmitter({ emitStructuredEvent });

await runMainEsmBootEnvelope({
    defaultConfigPath,
    customConfigPath,
    validateConfig,
    limitUtf8Bytes: Utils.limitUtf8Bytes,
    emitError: (message) => console.error(message),
    fail: (code) => process.exit(code),
    startupParams: {
        env: process.env,
        emitStructuredEvent,
        emitProbeEvent,
        importWsEsm: () => import('./ws-runtime-esm.ts'),
        createRuntimeDependencies,
        startServer,
        fail: (code) => process.exit(code),
        runBridgeProbeFn: runWebSocketBridgeProbeIfEnabled,
        resolveRuntimeOptionsFn: resolveStartupRuntimeOptions,
    },
});
