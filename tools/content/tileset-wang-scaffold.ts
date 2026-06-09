import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

type PairSpec = Readonly<{
    name: string;
    colors: readonly [string, string];
    layers: readonly string[];
}>;

const GLOBAL_TILE_ID_MASK = 0x1fffffff;
const DEFAULT_PAIR_SPECS: ReadonlyArray<PairSpec> = [
    { name: 'shoreline', colors: ['water', 'sand'], layers: ['shoreline', 'sea'] },
    { name: 'riverbank', colors: ['water', 'grass'], layers: ['river', 'lakes', 'forest_lakes'] },
    { name: 'village_ground', colors: ['sand', 'grass'], layers: ['village_boundaries', 'village_boundaries_level_2'] },
    { name: 'field_edges', colors: ['soil', 'grass'], layers: ['ground_variations', 'grass_variations'] },
    { name: 'forest_edges', colors: ['grass', 'forest'], layers: ['forest_boundaries'] },
    { name: 'cave_rock', colors: ['rock', 'cave'], layers: ['cave_walls'] },
    { name: 'lava_rock', colors: ['lava', 'rock'], layers: ['lava_boundaries', 'cliffs', 'cliffs_2'] },
    { name: 'lava_cave', colors: ['lava', 'cave'], layers: ['lava_boundaries', 'cave'] },
];

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
    return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

function asInteger(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function relPath(filePath: string): string {
    return path.relative(process.cwd(), filePath).split(path.sep).join('/');
}

function cloneRecord<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeGid(gid: number): number {
    return gid & GLOBAL_TILE_ID_MASK;
}

function getTilesetFirstgidBySource(worldRoot: UnknownRecord, sourceSuffix: string): number | null {
    const tilesets = asArray(worldRoot.tilesets)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
    const normalizedSuffix = sourceSuffix.toLowerCase().replace(/\\/g, '/');
    for (const tileset of tilesets) {
        const source = asString(tileset.source);
        if (!source) {
            continue;
        }
        const normalizedSource = source.replace(/\\/g, '/').toLowerCase();
        if (!normalizedSource.endsWith(normalizedSuffix) && !normalizedSource.endsWith('tilesheet.wang.tsj')) {
            continue;
        }
        const firstgid = asInteger(tileset.firstgid);
        if (firstgid !== null && firstgid > 0) {
            return firstgid;
        }
    }
    return null;
}

function nextFirstgid(worldRoot: UnknownRecord, after: number): number {
    const tilesets = asArray(worldRoot.tilesets)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
    let out = Number.POSITIVE_INFINITY;
    for (const tileset of tilesets) {
        const firstgid = asInteger(tileset.firstgid);
        if (firstgid !== null && firstgid > after && firstgid < out) {
            out = firstgid;
        }
    }
    return out;
}

function collectLayersByName(rootLayers: unknown, name: string, out: UnknownRecord[] = []): UnknownRecord[] {
    const layers = asArray(rootLayers)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
    for (const layer of layers) {
        if (asString(layer.name) === name) {
            out.push(layer);
        }
        if (asString(layer.type) === 'group') {
            collectLayersByName(layer.layers, name, out);
        }
    }
    return out;
}

function parsePairSpecs(): PairSpec[] {
    return [...DEFAULT_PAIR_SPECS];
}

function printUsage(): never {
    console.log(
        'Usage: bun tools/content/tileset-wang-scaffold.ts [--tileset <path>] [--source-set <name>] [--world <path>] [--out-candidates <path>] [--write]'
    );
    process.exit(0);
}

async function main(): Promise<void> {
    const parsedArgs = parseCliArgs(
        process.argv.slice(2),
        [
            { key: 'tileset', kind: 'string', defaultValue: 'assets/maps/tiled/tilesheet.wang.tsj' },
            { key: 'source-set', kind: 'string', defaultValue: 'browserquest-terrain' },
            { key: 'world', kind: 'string', defaultValue: 'assets/maps/tiled/world.json' },
            { key: 'out-candidates', kind: 'string', defaultValue: 'assets/maps/tiled/terrain-transition-candidates.json' },
            { key: 'write', kind: 'boolean', defaultValue: false },
        ],
        { onHelp: printUsage }
    );

    const tilesetPath = path.resolve(process.cwd(), String(parsedArgs.tileset));
    const worldPath = path.resolve(process.cwd(), String(parsedArgs.world));
    const outCandidatesPath = path.resolve(process.cwd(), String(parsedArgs['out-candidates']));
    const sourceSetName = String(parsedArgs['source-set'] ?? 'browserquest-terrain').trim();
    if (sourceSetName.length === 0) {
        fail('--source-set must not be empty.');
    }
    const write = Boolean(parsedArgs.write);
    const pairSpecs = parsePairSpecs();

    const tilesetRoot = asRecord(JSON.parse(await fs.readFile(tilesetPath, 'utf8')));
    if (!tilesetRoot) {
        fail(`Invalid tileset root in ${relPath(tilesetPath)}.`);
    }

    const wangsets = asArray(tilesetRoot.wangsets)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
    tilesetRoot.wangsets = wangsets;

    const sourceSet = wangsets.find((entry) => asString(entry.name) === sourceSetName);
    if (!sourceSet) {
        fail(`Could not find source Wang set "${sourceSetName}" in ${relPath(tilesetPath)}.`);
    }

    const sourceType = asString(sourceSet.type) ?? 'corner';
    const sourceTile = asInteger(sourceSet.tile) ?? 0;
    const sourceColors = asArray(sourceSet.colors)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
    const sourceWangTiles = asArray(sourceSet.wangtiles)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);

    const sourceColorIndexByName = new Map<string, number>();
    for (let index = 0; index < sourceColors.length; index += 1) {
        const color = sourceColors[index];
        if (!color) {
            continue;
        }
        const name = asString(color.name);
        if (!name || name.trim().length === 0) {
            continue;
        }
        sourceColorIndexByName.set(name.trim(), index + 1);
    }

    const nextWangsets: UnknownRecord[] = [];
    let preservedWangsets = 0;
    for (const wangset of wangsets) {
        const name = asString(wangset.name) ?? '';
        if (!name.startsWith('scaffold-')) {
            nextWangsets.push(wangset);
            preservedWangsets += 1;
        }
    }

    const scaffoldSummaries: UnknownRecord[] = [];
    for (const pair of pairSpecs) {
        const [firstColorName, secondColorName] = pair.colors;
        const sourceFirstIndex = sourceColorIndexByName.get(firstColorName);
        const sourceSecondIndex = sourceColorIndexByName.get(secondColorName);
        if (!sourceFirstIndex || !sourceSecondIndex) {
            scaffoldSummaries.push({
                pair: pair.name,
                status: 'skipped_missing_color',
                colors: pair.colors,
            });
            continue;
        }

        const colorRemap = new Map<number, number>([
            [sourceFirstIndex, 1],
            [sourceSecondIndex, 2],
        ]);

        const scaffoldColors: UnknownRecord[] = [];
        for (const sourceIndex of [sourceFirstIndex, sourceSecondIndex]) {
            const sourceColor = sourceColors[sourceIndex - 1];
            if (!sourceColor) {
                continue;
            }
            const clonedColor = cloneRecord(sourceColor);
            scaffoldColors.push(clonedColor);
        }

        const dedupedWangTiles = new Map<number, number[]>();
        for (const sourceWangTile of sourceWangTiles) {
            const tileId = asInteger(sourceWangTile.tileid);
            if (tileId === null || tileId < 0) {
                continue;
            }
            const wangId = asArray(sourceWangTile.wangid)
                .map((entry) => asInteger(entry))
                .filter((entry): entry is number => entry !== null);
            if (wangId.length !== 8) {
                continue;
            }

            let supported = true;
            const remapped: number[] = [];
            for (const entry of wangId) {
                if (entry === 0) {
                    remapped.push(0);
                    continue;
                }
                const mapped = colorRemap.get(entry);
                if (!mapped) {
                    supported = false;
                    remapped.push(0);
                    continue;
                }
                remapped.push(mapped);
            }
            if (!supported) {
                continue;
            }
            dedupedWangTiles.set(tileId, remapped);
        }

        const wangtiles = [...dedupedWangTiles.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([tileid, wangid]) => ({ tileid, wangid }));

        const scaffoldName = `scaffold-${pair.name}`;
        const scaffoldSet: UnknownRecord = {
            name: scaffoldName,
            class: 'TerrainPairScaffold',
            type: sourceType,
            tile: asInteger(scaffoldColors[0]?.tile) ?? sourceTile,
            colors: scaffoldColors,
            properties: [
                { name: 'scaffold', type: 'bool', value: true },
                { name: 'source_set', type: 'string', value: sourceSetName },
                { name: 'pair', type: 'string', value: `${firstColorName}/${secondColorName}` },
            ],
            wangtiles,
        };

        nextWangsets.push(scaffoldSet);
        scaffoldSummaries.push({
            pair: pair.name,
            status: 'created',
            colors: pair.colors,
            wangtiles: wangtiles.length,
        });
    }

    tilesetRoot.wangsets = nextWangsets;

    const worldRoot = asRecord(JSON.parse(await fs.readFile(worldPath, 'utf8')));
    if (!worldRoot) {
        fail(`Invalid world map root in ${relPath(worldPath)}.`);
    }
    const tilesetFirstgid = getTilesetFirstgidBySource(worldRoot, '/tilesheet.wang.tsj');
    if (!tilesetFirstgid) {
        fail(`Could not resolve tilesheet firstgid from ${relPath(worldPath)}.`);
    }
    const nextTilesetFirstgid = nextFirstgid(worldRoot, tilesetFirstgid);
    const tilecount = asInteger(tilesetRoot.tilecount) ?? Number.POSITIVE_INFINITY;

    const pairCandidates: UnknownRecord[] = [];
    for (const pair of pairSpecs) {
        const byTile = new Map<number, number>();
        const perLayer: UnknownRecord[] = [];

        for (const layerName of pair.layers) {
            const matchingLayers = collectLayersByName(worldRoot.layers, layerName).filter(
                (entry) => asString(entry.type) === 'tilelayer'
            );
            for (const layer of matchingLayers) {
                const data = asArray(layer.data);
                let contributingCells = 0;
                const layerByTile = new Map<number, number>();

                for (const entry of data) {
                    if (typeof entry !== 'number' || !Number.isFinite(entry) || entry <= 0) {
                        continue;
                    }
                    const normalized = normalizeGid(entry);
                    if (normalized < tilesetFirstgid || normalized >= nextTilesetFirstgid) {
                        continue;
                    }
                    const localTileId = normalized - tilesetFirstgid;
                    if (localTileId < 0 || localTileId >= tilecount) {
                        continue;
                    }
                    contributingCells += 1;
                    layerByTile.set(localTileId, (layerByTile.get(localTileId) ?? 0) + 1);
                    byTile.set(localTileId, (byTile.get(localTileId) ?? 0) + 1);
                }

                if (contributingCells <= 0) {
                    continue;
                }
                const topTiles = [...layerByTile.entries()]
                    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
                    .slice(0, 40)
                    .map(([tileid, count]) => ({ tileid, count }));
                perLayer.push({
                    layer: layerName,
                    cells: contributingCells,
                    distinctTiles: layerByTile.size,
                    topTiles,
                });
            }
        }

        const topTiles = [...byTile.entries()]
            .sort((a, b) => b[1] - a[1] || a[0] - b[0])
            .slice(0, 120)
            .map(([tileid, count]) => ({ tileid, count }));
        pairCandidates.push({
            pair: pair.name,
            colors: pair.colors,
            sourceLayers: pair.layers,
            distinctTiles: byTile.size,
            topTiles,
            layers: perLayer,
        });
    }

    const candidatesOutput: UnknownRecord = {
        generatedAt: new Date().toISOString(),
        world: relPath(worldPath),
        tileset: relPath(tilesetPath),
        sourceSet: sourceSetName,
        pairs: pairCandidates,
    };

    if (write) {
        await fs.writeFile(tilesetPath, `${JSON.stringify(tilesetRoot, null, 2)}\n`, 'utf8');
        await fs.writeFile(outCandidatesPath, `${JSON.stringify(candidatesOutput, null, 2)}\n`, 'utf8');
    }

    console.log(
        JSON.stringify(
            {
                write,
                tileset: relPath(tilesetPath),
                world: relPath(worldPath),
                outCandidates: relPath(outCandidatesPath),
                sourceSet: sourceSetName,
                totals: {
                    preservedWangsets,
                    scaffoldWangsets: scaffoldSummaries.filter((entry) => entry.status === 'created').length,
                },
                scaffolds: scaffoldSummaries,
                candidates: pairCandidates.map((entry) => ({
                    pair: entry.pair,
                    distinctTiles: entry.distinctTiles,
                    layers: asArray(entry.layers).length,
                })),
            },
            null,
            2
        )
    );
}

void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
