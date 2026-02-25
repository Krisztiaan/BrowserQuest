import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';
import { compileMapPack, renderMapPackJson, type MapPackBuildMapInput } from '../../shared/maps/map-pack';
import type { MapGraphEdge } from '../../shared/maps/map-graph';

type UnknownRecord = Record<string, unknown>;

type MapPackConfig = Readonly<{
    maps: ReadonlyArray<Readonly<{ id: string; filepath: string }>>;
    edges: ReadonlyArray<MapGraphEdge>;
    worldFilepath?: string;
}>;

function fail(message: string): never {
    throw new Error(message);
}

function asRecord(value: unknown): UnknownRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as UnknownRecord;
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? (value as unknown[]) : [];
}

function asNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return null;
    }
    return value;
}

function toPosixPath(value: string): string {
    return value.split(path.sep).join('/');
}

function resolveAgainstConfig(configPath: string, candidatePath: string): string {
    if (path.isAbsolute(candidatePath)) {
        return path.normalize(candidatePath);
    }
    return path.resolve(path.dirname(configPath), candidatePath);
}

function mapIdFromFilename(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
}

async function readJsonFile(filePath: string): Promise<unknown> {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as unknown;
}

function parseConfig(configPath: string, raw: unknown): MapPackConfig {
    const root = asRecord(raw);
    if (!root) {
        fail('Invalid map-pack config: root must be an object.');
    }

    const explicitMaps: Array<{ id: string; filepath: string }> = [];
    const mapsRaw = asArray(root.maps);
    for (let i = 0; i < mapsRaw.length; i += 1) {
        const entry = asRecord(mapsRaw[i]);
        if (!entry) {
            fail(`Invalid map-pack config: maps[${i}] must be an object.`);
        }
        const id = asNonEmptyString(entry.id);
        const filepath = asNonEmptyString(entry.filepath);
        if (!id || !filepath) {
            fail(`Invalid map-pack config: maps[${i}] requires non-empty id and filepath.`);
        }
        explicitMaps.push({ id, filepath: resolveAgainstConfig(configPath, filepath) });
    }

    const edgesRaw = asArray(root.edges);
    const edges: MapGraphEdge[] = [];
    for (let i = 0; i < edgesRaw.length; i += 1) {
        const edge = asRecord(edgesRaw[i]);
        if (!edge) {
            fail(`Invalid map-pack config: edges[${i}] must be an object.`);
        }
        edges.push(edge as unknown as MapGraphEdge);
    }

    const worldFilepathRaw = asNonEmptyString(root.world_filepath);
    const worldFilepath = worldFilepathRaw ? resolveAgainstConfig(configPath, worldFilepathRaw) : undefined;

    return {
        maps: explicitMaps,
        edges,
        worldFilepath,
    };
}

async function readWorldMaps(worldFilepath: string): Promise<Array<{ id: string; filepath: string }>> {
    const raw = await readJsonFile(worldFilepath);
    const root = asRecord(raw);
    if (!root) {
        fail(`Invalid Tiled world file: ${worldFilepath}`);
    }
    const mapsRaw = asArray(root.maps);
    const out: Array<{ id: string; filepath: string }> = [];

    for (let i = 0; i < mapsRaw.length; i += 1) {
        const entry = asRecord(mapsRaw[i]);
        if (!entry) {
            fail(`Invalid Tiled world file: maps[${i}] must be an object.`);
        }

        const fileName = asNonEmptyString(entry.fileName) ?? asNonEmptyString(entry.filepath);
        if (!fileName) {
            fail(`Invalid Tiled world file: maps[${i}] requires fileName.`);
        }

        const explicitId = asNonEmptyString(entry.id);
        const resolvedFilepath = resolveAgainstConfig(worldFilepath, fileName);
        const id = explicitId ?? mapIdFromFilename(fileName);
        out.push({ id, filepath: resolvedFilepath });
    }

    return out;
}

async function compilePackFromConfig(configPath: string): Promise<{ json: string; outputPath: string }> {
    const configRaw = await readJsonFile(configPath);
    const parsed = parseConfig(configPath, configRaw);

    const mapsFromWorld = parsed.worldFilepath ? await readWorldMaps(parsed.worldFilepath) : [];
    const allMaps = [...mapsFromWorld, ...parsed.maps];
    if (allMaps.length === 0) {
        fail('Invalid map-pack config: no maps declared (maps/world_filepath are both empty).');
    }

    const seenMapIds = new Set<string>();
    const inputs: MapPackBuildMapInput[] = [];
    for (let i = 0; i < allMaps.length; i += 1) {
        const mapEntry = allMaps[i];
        if (!mapEntry) {
            continue;
        }
        if (seenMapIds.has(mapEntry.id)) {
            fail(`Invalid map-pack config: duplicate map id "${mapEntry.id}".`);
        }
        seenMapIds.add(mapEntry.id);

        const tiled = await readJsonFile(mapEntry.filepath);
        inputs.push({
            id: mapEntry.id,
            tiled,
            sourcePath: toPosixPath(path.relative(process.cwd(), mapEntry.filepath)),
        });
    }

    const pack = compileMapPack({
        maps: inputs,
        edges: parsed.edges,
    });

    const outputPath = path.resolve(path.dirname(configPath), '../runtime/map-pack.json');
    return {
        json: renderMapPackJson(pack),
        outputPath,
    };
}

async function generate(configPath: string): Promise<void> {
    const { json, outputPath } = await compilePackFromConfig(configPath);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, json, 'utf8');
    console.log(`Generated ${outputPath}`);
}

async function check(configPath: string): Promise<void> {
    const { json, outputPath } = await compilePackFromConfig(configPath);
    const existing = await fs.readFile(outputPath, 'utf8').catch(() => '');
    if (existing !== json) {
        fail(`Map pack is out of date. Run \`bun run build:maps\` to refresh ${toPosixPath(path.relative(process.cwd(), outputPath))}.`);
    }
    console.log(`Map pack is up to date: ${outputPath}`);
}

async function main(): Promise<void> {
    const command = process.argv[2];
    const parsedArgs = parseCliArgs(process.argv.slice(3), [
        { key: 'config', kind: 'string', defaultValue: 'assets/maps/tiled/map-pack.config.json' },
    ]);
    const configPath = path.resolve(String(parsedArgs.config));

    if (command === 'generate') {
        await generate(configPath);
        return;
    }
    if (command === 'check') {
        await check(configPath);
        return;
    }

    fail('Usage: bun tools/content/map-pack.ts <generate|check> [--config <path>]');
}

void main();
