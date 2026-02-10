import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    main as runtimeMain,
    getWorldDistribution,
    createRuntimeDependencies,
    createServerAndMetrics,
    createWorlds,
    createPopulationChangeHandler,
    installWorldPopulationHooks,
    initializeMetricsPopulation,
    createServerEventEmitter,
    createPopulationCheckTimer,
    createPopulationCheckCleanup,
    createFatalReporter,
    installFatalHandlers,
    triggerFatalTestEvent,
    createRuntimeCleanup,
} from './main-runtime';
import type { ServerConfig } from './main-runtime-types';

type RuntimeConfig = ServerConfig;
type NullableRuntimeConfig = RuntimeConfig | null;

export async function getConfigFile(path: string): Promise<NullableRuntimeConfig> {
    try {
        const jsonString = await fs.readFile(path, 'utf8');
        return JSON.parse(jsonString) as RuntimeConfig;
    } catch (err) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'ENOENT') {
            console.error('Could not open config file:', path);
            return null;
        }
        const message = err instanceof Error ? err.message : String(err);
        console.error('Could not parse config file:', path, message);
        return null;
    }
}

const isMainEntry = (() => {
    const entryArg = process.argv[1];
    if (!entryArg) {
        return false;
    }
    return path.resolve(entryArg) === fileURLToPath(import.meta.url);
})();

if (isMainEntry) {
    const defaultConfigPath = './server/config.json';
    let customConfigPath = './server/config_local.json';

    process.argv.forEach((val, index) => {
        if (index === 2) {
            customConfigPath = val;
        }
    });

    void (async () => {
        const defaultConfig = await getConfigFile(defaultConfigPath);
        const localConfig = await getConfigFile(customConfigPath);

        if (localConfig) {
            runtimeMain(localConfig);
            return;
        }
        if (defaultConfig) {
            runtimeMain(defaultConfig);
            return;
        }
        console.error('Server cannot start without any configuration file.');
        process.exit(1);
    })();
}

export const main = runtimeMain;

export {
    getWorldDistribution,
    createRuntimeDependencies,
    createServerAndMetrics,
    createWorlds,
    createPopulationChangeHandler,
    installWorldPopulationHooks,
    initializeMetricsPopulation,
    createServerEventEmitter,
    createPopulationCheckTimer,
    createPopulationCheckCleanup,
    createFatalReporter,
    installFatalHandlers,
    triggerFatalTestEvent,
    createRuntimeCleanup,
};

export default {
    main,
    getConfigFile,
    getWorldDistribution,
    createRuntimeDependencies,
    createServerAndMetrics,
    createWorlds,
    createPopulationChangeHandler,
    installWorldPopulationHooks,
    initializeMetricsPopulation,
    createServerEventEmitter,
    createPopulationCheckTimer,
    createPopulationCheckCleanup,
    createFatalReporter,
    installFatalHandlers,
    triggerFatalTestEvent,
    createRuntimeCleanup,
};
