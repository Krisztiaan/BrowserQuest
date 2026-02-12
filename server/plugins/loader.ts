import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SERVER_PLUGIN_API_VERSION, type ServerPlugin } from './contracts';
import type { RuntimeServer, RuntimeWorld, RuntimeWorldServerConstructor } from '../runtime-types';

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getPluginSpecsFromConfig(config: object): string[] {
    if (!isPlainObject(config)) {
        return [];
    }
    const plugins = config.plugins;
    if (!Array.isArray(plugins)) {
        return [];
    }
    const specs = plugins.filter(isNonEmptyString).map((spec) => spec.trim());
    return specs;
}

function normalizePluginExports(mod: Record<string, unknown>): unknown[] {
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

function parsePlugin(value: unknown, origin: string): ServerPlugin {
    if (!isPlainObject(value)) {
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

    return value as unknown as ServerPlugin;
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
        const mod = (await import(resolved)) as Record<string, unknown>;
        const exports = normalizePluginExports(mod);
        if (exports.length === 0) {
            throw new Error(`Plugin module ${spec} did not export a default plugin.`);
        }

        for (let j = 0; j < exports.length; j += 1) {
            const plugin = parsePlugin(exports[j], spec);
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
    return class WorldServerWithPlugins extends (BaseWorldServer as unknown as {
        new (id: string, capacity: number, server: RuntimeServer, plugins?: readonly unknown[]): RuntimeWorld;
    }) {
        constructor(id: string, capacity: number, server: RuntimeServer) {
            super(id, capacity, server, pluginList);
        }
    } as unknown as RuntimeWorldServerConstructor;
}
