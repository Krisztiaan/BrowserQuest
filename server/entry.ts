import { runWebSocketBridgeProbeIfEnabled } from './main/bridge-probe';
import { runMainEsmBootEnvelope } from './main/boot-envelope';
import { createProbeEventEmitter, createStructuredEventEmitter } from './main/structured-event';
import { validateConfig } from './config-preflight';
import { resolveStartupRuntimeOptions } from './main/runtime-options';
import type {
    MainRuntimeDependencies,
    MainRuntimeOptions,
    ServerConfig,
} from './main-runtime-types';
import Utils from './utils';
import { createRuntimeDependencies, main as startServer } from './main-runtime';

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
    fail: (code: number) => process.exit(code),
    startupParams: {
        env: process.env,
        emitStructuredEvent,
        emitProbeEvent,
        importWsEsm: () => import('./ws-runtime-esm'),
        createRuntimeDependencies,
        startServer,
        fail: (code: number) => process.exit(code),
        runBridgeProbeFn: runWebSocketBridgeProbeIfEnabled,
        resolveRuntimeOptionsFn: resolveStartupRuntimeOptions,
    },
});
