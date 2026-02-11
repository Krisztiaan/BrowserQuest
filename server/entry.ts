import { runWebSocketBridgeProbeIfEnabled } from './startup/bridge-probe';
import { runMainEntryBootEnvelope } from './startup/boot';
import { createProbeEventEmitter, createStructuredEventEmitter } from './startup/events';
import { validateConfig } from './config-preflight';
import { resolveStartupRuntimeOptions } from './startup/options';
import Utils from './utils';
import { createRuntimeDependencies, main as startServer } from './runtime';

const defaultConfigPath = './server/config.json';
const customConfigPath = process.argv[2] || './server/config_local.json';

const emitStructuredEvent = createStructuredEventEmitter();
const emitProbeEvent = createProbeEventEmitter({ emitStructuredEvent });

await runMainEntryBootEnvelope({
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
        importWsRuntime: () => import('./ws-runtime'),
        createRuntimeDependencies,
        startServer,
        fail: (code: number) => process.exit(code),
        runBridgeProbeFn: runWebSocketBridgeProbeIfEnabled,
        resolveRuntimeOptionsFn: resolveStartupRuntimeOptions,
    },
});
