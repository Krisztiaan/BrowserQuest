import * as MainRuntimeModule from './main-runtime.js';
const MainRuntime = /** @type {typeof import('./main-runtime')} */ (
    'default' in MainRuntimeModule ? MainRuntimeModule.default : MainRuntimeModule
);

export const main = MainRuntime.main;
export const getWorldDistribution = MainRuntime.getWorldDistribution;
export const createRuntimeDependencies = MainRuntime.createRuntimeDependencies;
export const createServerAndMetrics = MainRuntime.createServerAndMetrics;
export const createWorlds = MainRuntime.createWorlds;
export const createPopulationChangeHandler = MainRuntime.createPopulationChangeHandler;
export const installWorldPopulationHooks = MainRuntime.installWorldPopulationHooks;
export const initializeMetricsPopulation = MainRuntime.initializeMetricsPopulation;
export const createServerEventEmitter = MainRuntime.createServerEventEmitter;
export const createPopulationCheckTimer = MainRuntime.createPopulationCheckTimer;
export const createPopulationCheckCleanup = MainRuntime.createPopulationCheckCleanup;
export const createFatalReporter = MainRuntime.createFatalReporter;
export const installFatalHandlers = MainRuntime.installFatalHandlers;
export const triggerFatalTestEvent = MainRuntime.triggerFatalTestEvent;
export const createRuntimeCleanup = MainRuntime.createRuntimeCleanup;
export default MainRuntime;
