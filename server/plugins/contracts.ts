import type { SchedulerStage } from '../ecs/scheduler';

export const SERVER_PLUGIN_API_VERSION = 1 as const;
export type ServerPluginApiVersion = typeof SERVER_PLUGIN_API_VERSION;

export type ServerPluginEcsApi = Readonly<{
    registerSystem(stage: SchedulerStage, name: string, run: (state: object, ctx: { tick: number }) => void): void;
}>;

export type ServerPluginContext = Readonly<{
    apiVersion: ServerPluginApiVersion;
    world: object;
    ecs: ServerPluginEcsApi;
}>;

export type ServerPlugin = Readonly<{
    id: string;
    apiVersion: ServerPluginApiVersion;
    version?: string;
    install(ctx: ServerPluginContext): void;
}>;
