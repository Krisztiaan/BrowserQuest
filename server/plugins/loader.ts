import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SERVER_PLUGIN_API_VERSION, type ServerPlugin } from './contracts';
import type { RuntimeServer, RuntimeWorldServerConstructor } from '../runtime-types';

type ConfigLike = {
    plugins?: string[];
};

type PluginLooseValue = string | number | boolean | object | null | undefined;

type PluginCandidate = {
    id?: string;
    apiVersion?: number;
    install?: ServerPlugin['install'];
    version?: string;
};

type PluginModuleLike = {
    default?: PluginLooseValue;
    plugins?: PluginLooseValue;
};

function isNonEmptyString(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function isObjectRecord(value: PluginLooseValue): value is Record<string, PluginLooseValue> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isConfigLike(value: PluginLooseValue): value is ConfigLike {
    return isObjectRecord(value);
}

function isPluginCandidate(value: PluginLooseValue): value is PluginCandidate {
    return isObjectRecord(value);
}

export function getPluginSpecsFromConfig(config: PluginLooseValue): string[] {
    if (!isConfigLike(config)) {
        return [];
    }
    const plugins = config.plugins;
    if (!Array.isArray(plugins)) {
        return [];
    }
    const specs = plugins.filter((spec): spec is string => isNonEmptyString(spec)).map((spec) => spec.trim());
    return specs;
}

function normalizePluginExports(mod: PluginModuleLike): PluginLooseValue[] {
    const defaultExport = mod.default;
    if (Array.isArray(defaultExport)) {
        return defaultExport;
    }
    if (defaultExport !== undefined) {
        return [defaultExport];
    }
    if (Array.isArray(mod.plugins)) {
        return mod.plugins;
    }
    return [];
}

function parsePlugin(value: PluginLooseValue, origin: string): ServerPlugin {
    if (!isPluginCandidate(value)) {
        throw new Error(`Plugin export from ${origin} must be an object.`);
    }
    const id = value.id;
    const apiVersion = value.apiVersion;
    const install = value.install;
    const version = value.version;

    if (!isNonEmptyString(id)) {
        throw new Error(`Plugin export from ${origin} must define a non-empty "id".`);
    }
    if (apiVersion !== SERVER_PLUGIN_API_VERSION) {
        throw new Error(
            `Plugin "${id}" from ${origin} has incompatible apiVersion=${String(apiVersion)} (expected ${SERVER_PLUGIN_API_VERSION}).`
        );
    }
    if (typeof install !== 'function') {
        throw new Error(`Plugin "${id}" from ${origin} must define an "install(ctx)" function.`);
    }
    if (version !== undefined && !isNonEmptyString(version)) {
        throw new Error(`Plugin "${id}" from ${origin} has invalid "version" field.`);
    }

    return {
        id,
        apiVersion,
        install,
        ...(version ? { version } : {}),
    };
}

function resolvePluginSpecifier(spec: string, baseDir: string): string {
    if (spec.startsWith('file:')) {
        return spec;
    }
    if (path.isAbsolute(spec)) {
        return pathToFileURL(spec).href;
    }
    return pathToFileURL(path.resolve(baseDir, spec)).href;
}

export async function loadServerPlugins(
    specs: readonly string[],
    { baseDir }: { baseDir: string }
): Promise<ServerPlugin[]> {
    const plugins: ServerPlugin[] = [];
    const seenIds = new Set<string>();

    for (let i = 0; i < specs.length; i += 1) {
        const spec = specs[i];
        if (!spec) {
            continue;
        }
        const resolved = resolvePluginSpecifier(spec, baseDir);
        const importedModule: PluginLooseValue = await import(resolved);
        if (!isObjectRecord(importedModule)) {
            throw new Error(`Plugin module ${spec} did not export an object module namespace.`);
        }
        const mod: PluginModuleLike = importedModule;
        const exports = normalizePluginExports(mod);
        if (exports.length === 0) {
            throw new Error(`Plugin module ${spec} did not export a default plugin.`);
        }

        for (let j = 0; j < exports.length; j += 1) {
            const pluginExport = exports[j];
            if (!pluginExport) {
                continue;
            }
            const plugin = parsePlugin(pluginExport, spec);
            if (seenIds.has(plugin.id)) {
                throw new Error(`Duplicate plugin id "${plugin.id}" from ${spec}.`);
            }
            seenIds.add(plugin.id);
            plugins.push(plugin);
        }
    }

    return plugins;
}

export function wrapWorldServerConstructorWithPlugins(
    BaseWorldServer: RuntimeWorldServerConstructor,
    plugins: readonly ServerPlugin[]
): RuntimeWorldServerConstructor {
    const pluginList = [...plugins];
    class WorldServerWithPlugins extends BaseWorldServer {
        constructor(id: string, capacity: number, server: RuntimeServer) {
            super(id, capacity, server, pluginList);
        }
    }
    return WorldServerWithPlugins;
}
