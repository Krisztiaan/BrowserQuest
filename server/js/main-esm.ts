// @ts-nocheck
import { runWebSocketBridgeProbeIfEnabled } from './main-esm-bridge-probe';
import { runMainEsmBootEnvelope } from './main-esm-boot-envelope';
import { createProbeEventEmitter, createStructuredEventEmitter } from './main-esm-structured-event';
import { validateConfig } from './config-preflight-esm';
import { resolveStartupRuntimeOptions } from './main-esm-runtime-options';
import Utils from './utils-esm';
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
        importWsEsm: () => import('./ws-runtime-esm'),
        createRuntimeDependencies,
        startServer,
        fail: (code) => process.exit(code),
        runBridgeProbeFn: runWebSocketBridgeProbeIfEnabled,
        resolveRuntimeOptionsFn: resolveStartupRuntimeOptions,
    },
});
