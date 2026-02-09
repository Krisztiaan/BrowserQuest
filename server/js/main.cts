const fs = require('node:fs/promises');

type RuntimeConfig = Record<string, unknown>;
type NullableRuntimeConfig = RuntimeConfig | null;

interface MainRuntimeContract {
    main(config: RuntimeConfig): void;
    getWorldDistribution(...args: unknown[]): unknown;
    createRuntimeDependencies(...args: unknown[]): unknown;
    createServerAndMetrics(...args: unknown[]): unknown;
    createWorlds(...args: unknown[]): unknown;
    createPopulationChangeHandler(...args: unknown[]): unknown;
    installWorldPopulationHooks(...args: unknown[]): unknown;
    initializeMetricsPopulation(...args: unknown[]): unknown;
    createServerEventEmitter(...args: unknown[]): unknown;
    createPopulationCheckTimer(...args: unknown[]): unknown;
    createPopulationCheckCleanup(...args: unknown[]): unknown;
    createFatalReporter(...args: unknown[]): unknown;
    installFatalHandlers(...args: unknown[]): unknown;
    triggerFatalTestEvent(...args: unknown[]): unknown;
    createRuntimeCleanup(...args: unknown[]): unknown;
}

const MainRuntime = require('./main-runtime') as MainRuntimeContract;

async function getConfigFile(path: string): Promise<NullableRuntimeConfig> {
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

if (require.main === module) {
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
            MainRuntime.main(localConfig);
            return;
        }
        if (defaultConfig) {
            MainRuntime.main(defaultConfig);
            return;
        }
        console.error('Server cannot start without any configuration file.');
        process.exit(1);
    })();
}

module.exports = {
    main: MainRuntime.main,
    getConfigFile,
    getWorldDistribution: MainRuntime.getWorldDistribution,
    createRuntimeDependencies: MainRuntime.createRuntimeDependencies,
    createServerAndMetrics: MainRuntime.createServerAndMetrics,
    createWorlds: MainRuntime.createWorlds,
    createPopulationChangeHandler: MainRuntime.createPopulationChangeHandler,
    installWorldPopulationHooks: MainRuntime.installWorldPopulationHooks,
    initializeMetricsPopulation: MainRuntime.initializeMetricsPopulation,
    createServerEventEmitter: MainRuntime.createServerEventEmitter,
    createPopulationCheckTimer: MainRuntime.createPopulationCheckTimer,
    createPopulationCheckCleanup: MainRuntime.createPopulationCheckCleanup,
    createFatalReporter: MainRuntime.createFatalReporter,
    installFatalHandlers: MainRuntime.installFatalHandlers,
    triggerFatalTestEvent: MainRuntime.triggerFatalTestEvent,
    createRuntimeCleanup: MainRuntime.createRuntimeCleanup,
};
