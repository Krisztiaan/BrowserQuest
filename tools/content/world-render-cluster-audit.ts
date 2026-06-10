import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

type LoadedTileset = Readonly<{
    source: string;
    firstgid: number;
    lastgid: number;
    tileWidth: number;
    tileHeight: number;
    objectAlignment: string;
    collidingGlobalGids: Set<number>;
}>;

type TileEntry = Readonly<{
    id: string;
    layerName: string;
    family: string;
    bucket: 'base' | 'foreground';
    tileX: number;
    tileY: number;
    gid: number;
    collidable: boolean;
}>;

type Component = Readonly<{
    id: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    positionCount: number;
    tileCount: number;
    layerNames: string[];
    families: string[];
    buckets: Array<'base' | 'foreground'>;
    collidableTiles: number;
    sameCellStacks: number;
    entries: TileEntry[];
}>;

type SignatureSummary = Readonly<{
    count: number;
    layers: string[];
    families: string[];
    width: number;
    height: number;
    tiles: number;
    collidableTiles: number;
    sameCellStacks: number;
    sampleOrigin: number[];
}>;

type FamilySplitSummary = Readonly<{
    count: number;
    splitFamilies: Array<{ family: string; layers: string[] }>;
    width: number;
    height: number;
    tiles: number;
    collidableTiles: number;
    sameCellStacks: number;
    sampleOrigin: number[];
}>;

type LayerCoverageSummary = Readonly<{
    layer: string;
    family: string;
    bucket: 'base' | 'foreground';
    tiles: number;
    collidableTiles: number;
    sameBucketSharedTiles: number;
    sameFamilyOtherLayerSharedTiles: number;
    otherBucketSharedTiles: number;
    sameCellStackedTiles: number;
}>;

const GLOBAL_TILE_ID_MASK = 0x1fffffff;

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

function isVisibleLayer(layer: UnknownRecord): boolean {
    return layer.visible !== false;
}

function isForegroundLayer(layer: UnknownRecord): boolean {
    return asString(layer.class) === 'Foreground';
}

function flattenVisibleLayers(
    layers: unknown[],
    state: Readonly<{ visible: boolean; offsetX: number; offsetY: number }> = { visible: true, offsetX: 0, offsetY: 0 }
): UnknownRecord[] {
    const flattened: UnknownRecord[] = [];
    for (const rawLayer of layers) {
        const layer = asRecord(rawLayer);
        if (!layer) {
            continue;
        }
        const type = asString(layer.type);
        const visible = state.visible && isVisibleLayer(layer);
        const ownOffsetX = typeof layer.offsetx === 'number' && Number.isFinite(layer.offsetx) ? layer.offsetx : 0;
        const ownOffsetY = typeof layer.offsety === 'number' && Number.isFinite(layer.offsety) ? layer.offsety : 0;
        const offsetX = state.offsetX + ownOffsetX;
        const offsetY = state.offsetY + ownOffsetY;
        if (type === 'group') {
            flattened.push(...flattenVisibleLayers(asArray(layer.layers), { visible, offsetX, offsetY }));
            continue;
        }
        if (type === 'objectgroup') {
            flattened.push({
                ...layer,
                visible,
                offsetx: 0,
                offsety: 0,
                objects: asArray(layer.objects)
                    .map((entry) => asRecord(entry))
                    .filter((entry): entry is UnknownRecord => entry !== null)
                    .map((objectRecord) => ({
                        ...objectRecord,
                        x: (typeof objectRecord.x === 'number' ? objectRecord.x : 0) + offsetX,
                        y: (typeof objectRecord.y === 'number' ? objectRecord.y : 0) + offsetY,
                    })),
            });
            continue;
        }
        flattened.push({
            ...layer,
            visible,
            offsetx: 0,
            offsety: 0,
        });
    }
    return flattened;
}

function familyName(layerName: string): string {
    return layerName.endsWith('_foreground') ? layerName.slice(0, -'_foreground'.length) : layerName;
}

function alignmentOffsetX(alignment: string, width: number): number {
    switch (alignment) {
        case 'top':
        case 'center':
        case 'bottom':
            return width / 2;
        case 'topright':
        case 'right':
        case 'bottomright':
            return width;
        default:
            return 0;
    }
}

function alignmentOffsetY(alignment: string, height: number): number {
    switch (alignment) {
        case 'left':
        case 'center':
        case 'right':
            return height / 2;
        case 'bottomleft':
        case 'bottom':
        case 'bottomright':
            return height;
        default:
            return 0;
    }
}

async function loadTilesets(worldPath: string, worldRoot: UnknownRecord): Promise<LoadedTileset[]> {
    const worldDir = path.dirname(worldPath);
    const tilesets = asArray(worldRoot.tilesets)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null)
        .filter((entry) => typeof entry.firstgid === 'number' && Number.isFinite(entry.firstgid))
        .sort((a, b) => (asInteger(a.firstgid) ?? 0) - (asInteger(b.firstgid) ?? 0));

    const loaded: LoadedTileset[] = [];
    for (let index = 0; index < tilesets.length; index += 1) {
        const tilesetRef = tilesets[index];
        if (!tilesetRef) {
            continue;
        }
        const source = asString(tilesetRef.source);
        if (!source) {
            continue;
        }
        const firstgid = asInteger(tilesetRef.firstgid);
        if (firstgid === null || firstgid <= 0) {
            continue;
        }
        const nextFirstgid = asInteger(tilesets[index + 1]?.firstgid);
        const lastgid = nextFirstgid !== null && nextFirstgid > firstgid ? nextFirstgid - 1 : Number.MAX_SAFE_INTEGER;
        const tilesetPath = path.resolve(worldDir, source);
        const tilesetRoot = asRecord(JSON.parse(await fs.readFile(tilesetPath, 'utf8')));
        if (!tilesetRoot) {
            fail(`Invalid tileset JSON: ${relPath(tilesetPath)}`);
        }
        const tileWidth = asInteger(tilesetRoot.tilewidth) ?? 16;
        const tileHeight = asInteger(tilesetRoot.tileheight) ?? 16;
        const objectAlignment = asString(tilesetRoot.objectalignment) ?? 'unspecified';
        const collidingGlobalGids = new Set<number>();
        for (const tile of asArray(tilesetRoot.tiles)
            .map((entry) => asRecord(entry))
            .filter((entry): entry is UnknownRecord => entry !== null)) {
            const localId = asInteger(tile.id);
            const objectgroup = asRecord(tile.objectgroup);
            const objects = asArray(objectgroup?.objects);
            if (localId === null || objects.length === 0) {
                continue;
            }
            collidingGlobalGids.add(firstgid + localId);
        }
        loaded.push({
            source: relPath(tilesetPath),
            firstgid,
            lastgid,
            tileWidth,
            tileHeight,
            objectAlignment,
            collidingGlobalGids,
        });
    }
    return loaded;
}

function resolveTileset(tilesets: readonly LoadedTileset[], gid: number): LoadedTileset | null {
    for (const tileset of tilesets) {
        if (gid >= tileset.firstgid && gid <= tileset.lastgid) {
            return tileset;
        }
    }
    return null;
}

function tileObjectToTileEntry(
    layer: UnknownRecord,
    object: UnknownRecord,
    tilesets: readonly LoadedTileset[],
    index: number,
    mapTileSize: number
): TileEntry | null {
    const gidRaw = asInteger(object.gid);
    if (gidRaw === null || gidRaw <= 0) {
        return null;
    }
    const gid = normalizeGid(gidRaw);
    const tileset = resolveTileset(tilesets, gid);
    if (!tileset) {
        return null;
    }
    const width = typeof object.width === 'number' ? object.width : tileset.tileWidth;
    const height = typeof object.height === 'number' ? object.height : tileset.tileHeight;
    const alignment = tileset.objectAlignment === 'unspecified' ? 'bottomleft' : tileset.objectAlignment;
    const x = typeof object.x === 'number' ? object.x : 0;
    const y = typeof object.y === 'number' ? object.y : 0;
    const pixelLeft = x - alignmentOffsetX(alignment, width);
    const pixelTop = y - alignmentOffsetY(alignment, height);
    const tileX = Math.floor(pixelLeft / mapTileSize);
    const tileY = Math.floor(pixelTop / mapTileSize);
    const layerName = asString(layer.name) ?? '<unnamed>';
    return {
        id: `${layerName}:${index}`,
        layerName,
        family: familyName(layerName),
        bucket: isForegroundLayer(layer) ? 'foreground' : 'base',
        tileX,
        tileY,
        gid,
        collidable: tileset.collidingGlobalGids.has(gid),
    };
}

function buildComponents(entries: readonly TileEntry[]): Component[] {
    const entriesByPosition = new Map<string, TileEntry[]>();
    for (const entry of entries) {
        const key = `${entry.tileX},${entry.tileY}`;
        const bucket = entriesByPosition.get(key);
        if (bucket) {
            bucket.push(entry);
        } else {
            entriesByPosition.set(key, [entry]);
        }
    }

    const visited = new Set<string>();
    const components: Component[] = [];
    let componentId = 1;

    for (const [startKey] of entriesByPosition) {
        if (visited.has(startKey)) {
            continue;
        }
        const queue = [startKey];
        visited.add(startKey);
        const componentEntries: TileEntry[] = [];
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        let sameCellStacks = 0;

        while (queue.length > 0) {
            const key = queue.shift();
            if (!key) {
                continue;
            }
            const [rawX, rawY] = key.split(',');
            const x = Number.parseInt(rawX ?? '0', 10);
            const y = Number.parseInt(rawY ?? '0', 10);
            const positionEntries = entriesByPosition.get(key) ?? [];
            if (positionEntries.length > 1) {
                sameCellStacks += 1;
            }
            componentEntries.push(...positionEntries);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);

            const neighbors = [`${x - 1},${y}`, `${x + 1},${y}`, `${x},${y - 1}`, `${x},${y + 1}`];
            for (const neighbor of neighbors) {
                if (!entriesByPosition.has(neighbor) || visited.has(neighbor)) {
                    continue;
                }
                visited.add(neighbor);
                queue.push(neighbor);
            }
        }

        const layerNames = [...new Set(componentEntries.map((entry) => entry.layerName))].sort();
        const families = [...new Set(componentEntries.map((entry) => entry.family))].sort();
        const buckets = [...new Set(componentEntries.map((entry) => entry.bucket))].sort();
        const collidableTiles = componentEntries.reduce((count, entry) => count + (entry.collidable ? 1 : 0), 0);
        components.push({
            id: componentId++,
            minX,
            minY,
            maxX,
            maxY,
            positionCount: (maxX - minX + 1) * (maxY - minY + 1),
            tileCount: componentEntries.length,
            layerNames,
            families,
            buckets,
            collidableTiles,
            sameCellStacks,
            entries: componentEntries.sort(
                (a, b) => a.tileY - b.tileY || a.tileX - b.tileX || a.layerName.localeCompare(b.layerName)
            ),
        });
    }

    return components;
}

function summarizeLayerCoverage(
    entries: readonly TileEntry[],
    components: readonly Component[]
): LayerCoverageSummary[] {
    const componentByEntryId = new Map<string, Component>();
    for (const component of components) {
        for (const entry of component.entries) {
            componentByEntryId.set(entry.id, component);
        }
    }

    const byLayer = new Map<string, TileEntry[]>();
    for (const entry of entries) {
        const bucket = byLayer.get(entry.layerName);
        if (bucket) {
            bucket.push(entry);
        } else {
            byLayer.set(entry.layerName, [entry]);
        }
    }

    return [...byLayer.entries()]
        .map(([layerName, layerEntries]): LayerCoverageSummary => {
            let sameBucketShared = 0;
            let foregroundShared = 0;
            let sameFamilyOtherLayerShared = 0;
            let stacked = 0;
            for (const entry of layerEntries) {
                const component = componentByEntryId.get(entry.id);
                if (!component) {
                    continue;
                }
                const otherEntries = component.entries.filter((candidate) => candidate.id !== entry.id);
                if (
                    otherEntries.some(
                        (candidate) => candidate.bucket === entry.bucket && candidate.layerName !== entry.layerName
                    )
                ) {
                    sameBucketShared += 1;
                }
                if (otherEntries.some((candidate) => candidate.bucket !== entry.bucket)) {
                    foregroundShared += 1;
                }
                if (
                    otherEntries.some(
                        (candidate) => candidate.family === entry.family && candidate.layerName !== entry.layerName
                    )
                ) {
                    sameFamilyOtherLayerShared += 1;
                }
                if (
                    otherEntries.some(
                        (candidate) =>
                            candidate.tileX === entry.tileX &&
                            candidate.tileY === entry.tileY &&
                            candidate.layerName !== entry.layerName
                    )
                ) {
                    stacked += 1;
                }
            }
            return {
                layer: layerName,
                family: familyName(layerName),
                bucket: layerName.endsWith('_foreground') ? 'foreground' : 'base',
                tiles: layerEntries.length,
                collidableTiles: layerEntries.reduce((count, entry) => count + (entry.collidable ? 1 : 0), 0),
                sameBucketSharedTiles: sameBucketShared,
                sameFamilyOtherLayerSharedTiles: sameFamilyOtherLayerShared,
                otherBucketSharedTiles: foregroundShared,
                sameCellStackedTiles: stacked,
            };
        })
        .sort((a, b) => String(a.layer).localeCompare(String(b.layer)));
}

function topRepeatedSignatures(
    components: readonly Component[],
    kind: 'sameBucket' | 'foreground'
): SignatureSummary[] {
    const buckets = new Map<string, { count: number; sample: Component }>();
    for (const component of components) {
        const hasForeground = component.buckets.includes('foreground');
        const baseLayerCount = component.layerNames.filter((layer) => !layer.endsWith('_foreground')).length;
        if (kind === 'sameBucket') {
            if (hasForeground || baseLayerCount < 2) {
                continue;
            }
        } else {
            if (!hasForeground) {
                continue;
            }
        }
        const signature = JSON.stringify({
            layers: component.layerNames,
            size: [component.maxX - component.minX + 1, component.maxY - component.minY + 1],
            tiles: component.tileCount,
            stacked: component.sameCellStacks > 0,
        });
        const bucket = buckets.get(signature);
        if (bucket) {
            bucket.count += 1;
        } else {
            buckets.set(signature, { count: 1, sample: component });
        }
    }
    return [...buckets.values()]
        .sort((a, b) => b.count - a.count || b.sample.tileCount - a.sample.tileCount)
        .slice(0, 15)
        .map(({ count, sample }) => ({
            count,
            layers: sample.layerNames,
            families: sample.families,
            width: sample.maxX - sample.minX + 1,
            height: sample.maxY - sample.minY + 1,
            tiles: sample.tileCount,
            collidableTiles: sample.collidableTiles,
            sameCellStacks: sample.sameCellStacks,
            sampleOrigin: [sample.minX, sample.minY],
        }));
}

function topSameFamilySplitSignatures(components: readonly Component[]): FamilySplitSummary[] {
    const buckets = new Map<string, { count: number; sample: Component }>();
    for (const component of components) {
        const familyCounts = new Map<string, Set<string>>();
        for (const entry of component.entries) {
            const layerNames = familyCounts.get(entry.family) ?? new Set<string>();
            layerNames.add(entry.layerName);
            familyCounts.set(entry.family, layerNames);
        }
        const splitFamilies = [...familyCounts.entries()]
            .filter(([, layerNames]) => layerNames.size > 1)
            .map(([family, layerNames]) => ({ family, layerNames: [...layerNames].sort() }))
            .sort((a, b) => a.family.localeCompare(b.family));
        if (splitFamilies.length === 0) {
            continue;
        }
        const signature = JSON.stringify({
            splitFamilies,
            size: [component.maxX - component.minX + 1, component.maxY - component.minY + 1],
            tiles: component.tileCount,
            stacked: component.sameCellStacks > 0,
        });
        const bucket = buckets.get(signature);
        if (bucket) {
            bucket.count += 1;
        } else {
            buckets.set(signature, { count: 1, sample: component });
        }
    }
    return [...buckets.values()]
        .sort((a, b) => b.count - a.count || b.sample.tileCount - a.sample.tileCount)
        .slice(0, 15)
        .map(({ count, sample }) => {
            const splitFamilies = [...new Set(sample.entries.map((entry) => entry.family))]
                .map((family) => ({
                    family,
                    layers: [
                        ...new Set(
                            sample.entries.filter((entry) => entry.family === family).map((entry) => entry.layerName)
                        ),
                    ].sort(),
                }))
                .filter((entry) => entry.layers.length > 1);
            return {
                count,
                splitFamilies,
                width: sample.maxX - sample.minX + 1,
                height: sample.maxY - sample.minY + 1,
                tiles: sample.tileCount,
                collidableTiles: sample.collidableTiles,
                sameCellStacks: sample.sameCellStacks,
                sampleOrigin: [sample.minX, sample.minY],
            };
        });
}

function printUsage(): never {
    console.log('Usage: bun tools/content/world-render-cluster-audit.ts [--map <path>] [--json]');
    process.exit(0);
}

async function main(): Promise<void> {
    const parsedArgs = parseCliArgs(
        process.argv.slice(2),
        [
            { key: 'map', kind: 'string', defaultValue: 'assets/maps/tiled/world.json' },
            { key: 'json', kind: 'boolean', defaultValue: false },
        ],
        { onHelp: printUsage }
    );

    const mapPath = path.resolve(process.cwd(), String(parsedArgs.map ?? 'assets/maps/tiled/world.json'));
    const printJson = Boolean(parsedArgs.json);
    const worldRoot = asRecord(JSON.parse(await fs.readFile(mapPath, 'utf8')));
    if (!worldRoot) {
        fail(`Invalid world JSON: ${relPath(mapPath)}`);
    }
    const mapTileSize = asInteger(worldRoot.tilewidth) ?? 16;
    const loadedTilesets = await loadTilesets(mapPath, worldRoot);
    const layers = flattenVisibleLayers(asArray(worldRoot.layers))
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);

    const renderObjectLayers = layers.filter(
        (layer) =>
            asString(layer.type) === 'objectgroup' &&
            isVisibleLayer(layer) &&
            asArray(layer.objects).some((entry) => asInteger(asRecord(entry)?.gid) !== null)
    );

    const tileEntries: TileEntry[] = [];
    for (const layer of renderObjectLayers) {
        const objects = asArray(layer.objects)
            .map((entry) => asRecord(entry))
            .filter((entry): entry is UnknownRecord => entry !== null);
        for (let index = 0; index < objects.length; index += 1) {
            const entry = tileObjectToTileEntry(layer, objects[index] ?? {}, loadedTilesets, index, mapTileSize);
            if (entry) {
                tileEntries.push(entry);
            }
        }
    }

    const components = buildComponents(tileEntries);
    const summary = {
        generatedAt: new Date().toISOString(),
        map: relPath(mapPath),
        renderObjectLayers: renderObjectLayers.map((layer) => ({
            name: asString(layer.name) ?? '<unnamed>',
            bucket: isForegroundLayer(layer) ? 'foreground' : 'base',
            tileObjects: asArray(layer.objects).filter((entry) => asInteger(asRecord(entry)?.gid) !== null).length,
        })),
        tileObjects: tileEntries.length,
        components: components.length,
        sameBucketMultiLayerComponents: components.filter(
            (component) => !component.buckets.includes('foreground') && component.layerNames.length > 1
        ).length,
        foregroundSplitComponents: components.filter((component) => component.buckets.includes('foreground')).length,
        repeatedSameBucketSignatures: topRepeatedSignatures(components, 'sameBucket'),
        repeatedForegroundSignatures: topRepeatedSignatures(components, 'foreground'),
        repeatedSameFamilySplitSignatures: topSameFamilySplitSignatures(components),
        layerCoverage: summarizeLayerCoverage(tileEntries, components),
    };

    if (printJson) {
        console.log(JSON.stringify(summary, null, 2));
        return;
    }

    console.log(`Renderable cluster audit for ${summary.map}`);
    console.log(`Visible tile-object layers: ${summary.renderObjectLayers.length}`);
    console.log(`Tile objects: ${summary.tileObjects}`);
    console.log(`Connected components: ${summary.components}`);
    console.log(`Same-bucket multi-layer components: ${summary.sameBucketMultiLayerComponents}`);
    console.log(`Foreground-split components: ${summary.foregroundSplitComponents}`);
    console.log('');

    console.log('Top repeated same-bucket split signatures:');
    for (const item of summary.repeatedSameBucketSignatures) {
        console.log(
            `- count=${item.count} layers=${item.layers.join('+')} size=${item.width}x${item.height} tiles=${item.tiles} collidable=${item.collidableTiles} stacked=${item.sameCellStacks} sample=${item.sampleOrigin.join(',')}`
        );
    }

    console.log('');
    console.log('Top repeated foreground split signatures:');
    for (const item of summary.repeatedForegroundSignatures) {
        console.log(
            `- count=${item.count} layers=${item.layers.join('+')} size=${item.width}x${item.height} tiles=${item.tiles} collidable=${item.collidableTiles} stacked=${item.sameCellStacks} sample=${item.sampleOrigin.join(',')}`
        );
    }

    console.log('');
    console.log('Top repeated same-family split signatures:');
    for (const item of summary.repeatedSameFamilySplitSignatures) {
        const splitFamilies = item.splitFamilies.map((entry) => `${entry.family}=${entry.layers.join('+')}`).join(' ');
        console.log(
            `- count=${item.count} families=${splitFamilies} size=${item.width}x${item.height} tiles=${item.tiles} collidable=${item.collidableTiles} stacked=${item.sameCellStacks} sample=${item.sampleOrigin.join(',')}`
        );
    }

    console.log('');
    console.log('Layer coverage:');
    for (const item of summary.layerCoverage) {
        console.log(
            `- ${item.layer}: tiles=${item.tiles} collidable=${item.collidableTiles} same_bucket_shared=${item.sameBucketSharedTiles} same_family_split=${item.sameFamilyOtherLayerSharedTiles} other_bucket_shared=${item.otherBucketSharedTiles} same_cell_stacked=${item.sameCellStackedTiles}`
        );
    }
}

await main();
