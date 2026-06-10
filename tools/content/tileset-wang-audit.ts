import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

type PairSpec = Readonly<{
    name: string;
    colors: readonly [string, string];
    layers: readonly string[];
    scaffold: string;
}>;

type AuditSummary = Readonly<{
    generatedAt: string;
    world: string;
    tileset: string;
    sourceSet: string;
    sets: ReadonlyArray<UnknownRecord>;
    pairs: ReadonlyArray<UnknownRecord>;
}>;

const GLOBAL_TILE_ID_MASK = 0x1fffffff;

const DEFAULT_PAIR_SPECS: ReadonlyArray<PairSpec> = [
    { name: 'shoreline', colors: ['water', 'sand'], layers: ['shoreline', 'sea'], scaffold: 'scaffold-shoreline' },
    {
        name: 'riverbank',
        colors: ['water', 'grass'],
        layers: ['river', 'lakes', 'forest_lakes'],
        scaffold: 'scaffold-riverbank',
    },
    {
        name: 'village_ground',
        colors: ['sand', 'grass'],
        layers: ['village_boundaries', 'village_boundaries_level_2'],
        scaffold: 'scaffold-village_ground',
    },
    {
        name: 'field_edges',
        colors: ['soil', 'grass'],
        layers: ['ground_variations', 'grass_variations'],
        scaffold: 'scaffold-field_edges',
    },
    {
        name: 'forest_edges',
        colors: ['grass', 'forest'],
        layers: ['forest_boundaries'],
        scaffold: 'scaffold-forest_edges',
    },
    { name: 'cave_rock', colors: ['rock', 'cave'], layers: ['cave_walls'], scaffold: 'scaffold-cave_rock' },
    {
        name: 'lava_rock',
        colors: ['lava', 'rock'],
        layers: ['lava_boundaries', 'cliffs', 'cliffs_2'],
        scaffold: 'scaffold-lava_rock',
    },
    {
        name: 'lava_cave',
        colors: ['lava', 'cave'],
        layers: ['lava_boundaries', 'cave'],
        scaffold: 'scaffold-lava_cave',
    },
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

function normalizeGid(gid: number): number {
    return gid & GLOBAL_TILE_ID_MASK;
}

function relPath(filePath: string): string {
    return path.relative(process.cwd(), filePath).split(path.sep).join('/');
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
        const normalizedSource = source.toLowerCase().replace(/\\/g, '/');
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

function getTileLayerData(layer: UnknownRecord): number[] {
    return asArray(layer.data)
        .map((entry) => asInteger(entry))
        .filter((entry): entry is number => entry !== null);
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

function summarizeCounts(counts: Map<number, number>, limit: number): UnknownRecord[] {
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, limit)
        .map(([tileid, count]) => ({ tileid, count }));
}

function buildUsedTileCounts(
    worldRoot: UnknownRecord,
    firstgid: number,
    layers: readonly string[]
): Map<number, number> {
    const counts = new Map<number, number>();
    for (const layerName of layers) {
        const matchingLayers = collectLayersByName(worldRoot.layers, layerName).filter(
            (layer) => asString(layer.type) === 'tilelayer'
        );
        for (const layer of matchingLayers) {
            for (const gid of getTileLayerData(layer)) {
                if (!gid) {
                    continue;
                }
                const tileid = normalizeGid(gid) - firstgid;
                if (tileid < 0) {
                    continue;
                }
                counts.set(tileid, (counts.get(tileid) ?? 0) + 1);
            }
        }
    }
    return counts;
}

function setFromNames(names: readonly string[]): Set<string> {
    return new Set(names);
}

function printUsage(): never {
    console.log(
        'Usage: bun tools/content/tileset-wang-audit.ts [--tileset <path>] [--world <path>] [--source-set <name>] [--json]'
    );
    process.exit(0);
}

async function main(): Promise<void> {
    const parsedArgs = parseCliArgs(
        process.argv.slice(2),
        [
            { key: 'tileset', kind: 'string', defaultValue: 'assets/maps/tiled/tilesheet.wang.tsj' },
            { key: 'world', kind: 'string', defaultValue: 'assets/maps/tiled/world.json' },
            { key: 'source-set', kind: 'string', defaultValue: 'browserquest-terrain' },
            { key: 'json', kind: 'boolean', defaultValue: false },
        ],
        { onHelp: printUsage }
    );

    const tilesetPath = path.resolve(process.cwd(), String(parsedArgs.tileset));
    const worldPath = path.resolve(process.cwd(), String(parsedArgs.world));
    const sourceSetName = String(parsedArgs['source-set'] ?? 'browserquest-terrain').trim();
    const printJson = Boolean(parsedArgs.json);

    const tilesetRoot = asRecord(JSON.parse(await fs.readFile(tilesetPath, 'utf8')));
    const worldRoot = asRecord(JSON.parse(await fs.readFile(worldPath, 'utf8')));
    if (!tilesetRoot || !worldRoot) {
        fail('Tileset and world roots must both be JSON objects.');
    }

    const firstgid = getTilesetFirstgidBySource(worldRoot, '/tilesheet.wang.tsj');
    if (!firstgid) {
        fail(`Could not resolve firstgid for ${relPath(tilesetPath)} from ${relPath(worldPath)}.`);
    }

    const wangsets = asArray(tilesetRoot.wangsets)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
    const sourceSet = wangsets.find((entry) => asString(entry.name) === sourceSetName);
    if (!sourceSet) {
        fail(`Could not find source Wang set "${sourceSetName}" in ${relPath(tilesetPath)}.`);
    }

    const sourceColors = asArray(sourceSet.colors)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
    const sourceColorIndexByName = new Map<string, number>();
    for (let index = 0; index < sourceColors.length; index += 1) {
        const name = asString(sourceColors[index]?.name);
        if (name) {
            sourceColorIndexByName.set(name, index + 1);
        }
    }

    const setSummaries = wangsets.map((wangset) => {
        const colors = asArray(wangset.colors)
            .map((entry) => asRecord(entry))
            .filter((entry): entry is UnknownRecord => entry !== null);
        const wangtiles = asArray(wangset.wangtiles)
            .map((entry) => asRecord(entry))
            .filter((entry): entry is UnknownRecord => entry !== null);
        const missingRepresentativeColors = colors
            .map((color, index) => ({
                index: index + 1,
                name: asString(color.name) ?? `color_${index + 1}`,
                tile: asInteger(color.tile),
            }))
            .filter((color) => color.tile === null || color.tile < 0);
        return {
            name: asString(wangset.name) ?? '<unnamed>',
            class: asString(wangset.class) ?? '',
            type: asString(wangset.type) ?? '',
            tile: asInteger(wangset.tile),
            colorCount: colors.length,
            wangtileCount: wangtiles.length,
            missingRepresentativeColors,
        };
    });

    const pairSummaries = DEFAULT_PAIR_SPECS.map((pair) => {
        const usedTileCounts = buildUsedTileCounts(worldRoot, firstgid, pair.layers);
        const usedTileIds = [...usedTileCounts.keys()].sort((a, b) => a - b);
        const scaffold = wangsets.find((entry) => asString(entry.name) === pair.scaffold) ?? null;
        const scaffoldTileIds = new Set(
            asArray(scaffold?.wangtiles)
                .map((entry) => asRecord(entry))
                .filter((entry): entry is UnknownRecord => entry !== null)
                .map((entry) => asInteger(entry.tileid))
                .filter((entry): entry is number => entry !== null)
        );

        const firstColor = sourceColorIndexByName.get(pair.colors[0]);
        const secondColor = sourceColorIndexByName.get(pair.colors[1]);
        const allowedColorIndexes = new Set<number>([0, firstColor ?? -1, secondColor ?? -1]);
        const pairColorNames = setFromNames(pair.colors);

        const usedTileIdsMissingFromScaffold = usedTileIds.filter((tileid) => !scaffoldTileIds.has(tileid));
        const sourceTaggedForUsedTiles: UnknownRecord[] = [];
        const sourceTaggedWithForeignColors: UnknownRecord[] = [];
        const sourceWangTileById = new Map<number, number[]>();
        for (const entry of asArray(sourceSet.wangtiles)
            .map((item) => asRecord(item))
            .filter((item): item is UnknownRecord => item !== null)) {
            const tileid = asInteger(entry.tileid);
            const wangid = asArray(entry.wangid)
                .map((item) => asInteger(item))
                .filter((item): item is number => item !== null);
            if (tileid === null || wangid.length !== 8) {
                continue;
            }
            sourceWangTileById.set(tileid, wangid);
        }

        for (const tileid of usedTileIds) {
            const wangid = sourceWangTileById.get(tileid);
            if (!wangid) {
                sourceTaggedForUsedTiles.push({
                    tileid,
                    count: usedTileCounts.get(tileid) ?? 0,
                    issue: 'missing_source_wangtag',
                });
                continue;
            }

            const uniqueIndexes = new Set(wangid);
            let hasForeignColor = false;
            for (const index of uniqueIndexes) {
                if (!allowedColorIndexes.has(index)) {
                    hasForeignColor = true;
                    break;
                }
            }
            if (!hasForeignColor) {
                continue;
            }

            const foreignColorNames = [...uniqueIndexes]
                .filter((index) => index !== 0 && !allowedColorIndexes.has(index))
                .map((index) => asString(sourceColors[index - 1]?.name) ?? `color_${index}`)
                .filter((name) => !pairColorNames.has(name));
            sourceTaggedWithForeignColors.push({
                tileid,
                count: usedTileCounts.get(tileid) ?? 0,
                foreignColors: foreignColorNames,
            });
        }

        return {
            pair: pair.name,
            colors: pair.colors,
            sourceLayers: pair.layers,
            scaffold: pair.scaffold,
            usedTileCount: usedTileIds.length,
            topUsedTiles: summarizeCounts(usedTileCounts, 12),
            usedTileIdsMissingFromScaffold,
            sourceUsedTilesMissingWangTags: sourceTaggedForUsedTiles,
            sourceUsedTilesWithForeignColors: sourceTaggedWithForeignColors,
        };
    });

    const summary: AuditSummary = {
        generatedAt: new Date().toISOString(),
        world: relPath(worldPath),
        tileset: relPath(tilesetPath),
        sourceSet: sourceSetName,
        sets: setSummaries,
        pairs: pairSummaries,
    };

    if (printJson) {
        console.log(JSON.stringify(summary, null, 2));
        return;
    }

    console.log(`Wang audit for ${summary.tileset} against ${summary.world}`);
    console.log(`Source set: ${summary.sourceSet}`);
    console.log('');

    const setProblems = setSummaries.filter((entry) => asArray(entry.missingRepresentativeColors).length > 0);
    if (setProblems.length === 0) {
        console.log('Wang sets: all colors have representative tiles.');
    } else {
        console.log('Wang sets with missing representative tiles:');
        for (const entry of setProblems) {
            const missing = asArray(entry.missingRepresentativeColors)
                .map((item) => asRecord(item))
                .filter((item): item is UnknownRecord => item !== null)
                .map((item) => `${asString(item.name) ?? '<unnamed>'}@${asInteger(item.index) ?? '?'}`)
                .join(', ');
            console.log(`- ${asString(entry.name) ?? '<unnamed>'}: ${missing}`);
        }
    }

    console.log('');
    console.log('Pair coverage:');
    for (const pair of pairSummaries) {
        const missingFromScaffold = asArray(pair.usedTileIdsMissingFromScaffold).length;
        const missingWangTags = asArray(pair.sourceUsedTilesMissingWangTags).length;
        const foreignColors = asArray(pair.sourceUsedTilesWithForeignColors).length;
        console.log(
            `- ${asString(pair.pair) ?? '<pair>'}: used=${asInteger(pair.usedTileCount) ?? 0}, ` +
                `missing_scaffold=${missingFromScaffold}, missing_source_tags=${missingWangTags}, foreign_color_tags=${foreignColors}`
        );
    }
}

await main();
