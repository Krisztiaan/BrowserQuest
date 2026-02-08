import { runWebSocketBridgeProbeIfEnabled } from './main-esm-bridge-probe.mjs';
import { runMainEsmBootEnvelope } from './main-esm-boot-envelope.mjs';
import { createProbeEventEmitter, createStructuredEventEmitter } from './main-esm-structured-event.mjs';
import { validateConfig } from './config-preflight-esm.mjs';
import { createRuntimeDependencies, main as startServer } from './main-runtime-esm.mjs';
import { resolveStartupRuntimeOptions } from './main-esm-runtime-options.mjs';
import Utils from './utils-esm.mjs';

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
        importWsEsm: () => import('./ws-esm.mjs'),
        createRuntimeDependencies,
        startServer,
        fail: (code) => process.exit(code),
        runBridgeProbeFn: runWebSocketBridgeProbeIfEnabled,
        resolveRuntimeOptionsFn: resolveStartupRuntimeOptions,
    },
});
