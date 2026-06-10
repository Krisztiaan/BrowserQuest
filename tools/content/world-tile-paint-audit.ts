import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

type TileLayer = Readonly<{
    path: string;
    name: string;
    className: string;
    width: number;
    height: number;
    data: number[];
}>;

type SuspiciousComponent = Readonly<{
    layer: string;
    size: number;
    coveredCount: number;
    coords: ReadonlyArray<readonly [number, number]>;
    topNeighborLayer: string | null;
    topNeighborCount: number;
    sameGidAsLaterLayer: boolean;
    reason: string;
}>;

type DuplicatePaint = Readonly<{
    x: number;
    y: number;
    gid: number;
    lowerLayer: string;
    higherLayer: string;
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
    return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

function asInteger(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function rel(filePath: string): string {
    return path.relative(process.cwd(), filePath).split(path.sep).join('/');
}

function printUsage(): never {
    console.log('Usage: bun tools/content/world-tile-paint-audit.ts [--map <path>] [--json]');
    process.exit(0);
}

function collectVisibleTileLayers(root: UnknownRecord): TileLayer[] {
    const layers: TileLayer[] = [];

    function walk(entries: unknown[], trail: string[]): void {
        for (const entry of entries) {
            const layer = asRecord(entry);
            if (!layer) {
                continue;
            }
            const name = asString(layer.name) ?? '(unnamed)';
            const nextTrail = [...trail, name];
            const type = asString(layer.type) ?? '';
            if (type === 'group') {
                walk(asArray(layer.layers), nextTrail);
                continue;
            }
            if (type !== 'tilelayer' || layer.visible === false) {
                continue;
            }
            const width = asInteger(layer.width);
            const height = asInteger(layer.height);
            if (width === null || height === null) {
                fail(`Visible tile layer ${nextTrail.join('/')} is missing width/height.`);
            }
            const data = asArray(layer.data).map((value) => asInteger(value) ?? 0);
            layers.push({
                path: nextTrail.join('/'),
                name,
                className: asString(layer.class) ?? '',
                width,
                height,
                data,
            });
        }
    }

    walk(asArray(root.layers), []);
    return layers;
}

function indexOf(x: number, y: number, width: number): number {
    return y * width + x;
}

function neighbors4(index: number, width: number, height: number): number[] {
    const x = index % width;
    const y = Math.floor(index / width);
    const neighbors: number[] = [];
    if (x > 0) {
        neighbors.push(index - 1);
    }
    if (x + 1 < width) {
        neighbors.push(index + 1);
    }
    if (y > 0) {
        neighbors.push(index - width);
    }
    if (y + 1 < height) {
        neighbors.push(index + width);
    }
    return neighbors;
}

function neighbors8(index: number, width: number, height: number): number[] {
    const x = index % width;
    const y = Math.floor(index / width);
    const neighbors: number[] = [];
    for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) {
                continue;
            }
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
                continue;
            }
            neighbors.push(indexOf(nx, ny, width));
        }
    }
    return neighbors;
}

function buildLaterOccupancy(layers: readonly TileLayer[], cellCount: number): Uint8Array[] {
    const later = layers.map(() => new Uint8Array(cellCount));
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
        const mask = later[layerIndex];
        if (!mask) {
            continue;
        }
        for (let nextIndex = layerIndex + 1; nextIndex < layers.length; nextIndex += 1) {
            const data = layers[nextIndex]?.data ?? [];
            for (let cell = 0; cell < cellCount; cell += 1) {
                if (data[cell]) {
                    mask[cell] = 1;
                }
            }
        }
    }
    return later;
}

function findDuplicatePaints(layers: readonly TileLayer[], width: number, height: number): DuplicatePaint[] {
    const duplicates: DuplicatePaint[] = [];
    const total = width * height;
    for (let cell = 0; cell < total; cell += 1) {
        const stack: Array<{ layer: string; gid: number }> = [];
        for (const layer of layers) {
            const gid = layer.data[cell] ?? 0;
            if (gid) {
                stack.push({ layer: layer.path, gid });
            }
        }
        for (let a = 0; a < stack.length; a += 1) {
            for (let b = a + 1; b < stack.length; b += 1) {
                const lower = stack[a];
                const higher = stack[b];
                if (!lower || lower.gid !== higher?.gid) {
                    continue;
                }
                duplicates.push({
                    x: cell % width,
                    y: Math.floor(cell / width),
                    gid: lower.gid,
                    lowerLayer: lower.layer,
                    higherLayer: higher.layer,
                });
            }
        }
    }
    return duplicates;
}

function findSuspiciousComponents(layers: readonly TileLayer[], width: number, height: number): SuspiciousComponent[] {
    const suspicious: SuspiciousComponent[] = [];
    const cellCount = width * height;
    const later = buildLaterOccupancy(layers, cellCount);

    for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
        const layer = layers[layerIndex];
        if (!layer || layer.className === 'Foreground') {
            continue;
        }
        const seen = new Uint8Array(cellCount);
        for (let cell = 0; cell < cellCount; cell += 1) {
            if (!layer.data[cell] || seen[cell]) {
                continue;
            }
            const component: number[] = [];
            const queue = [cell];
            seen[cell] = 1;
            while (queue.length > 0) {
                const current = queue.pop();
                if (current === undefined) {
                    continue;
                }
                component.push(current);
                for (const neighbor of neighbors4(current, width, height)) {
                    if ((layer.data[neighbor] ?? 0) === 0 || seen[neighbor]) {
                        continue;
                    }
                    seen[neighbor] = 1;
                    queue.push(neighbor);
                }
            }

            if (component.length > 2) {
                continue;
            }

            let coveredCount = 0;
            let sameGidAsLaterLayer = false;
            const neighborLayerCounts = new Map<string, number>();
            for (const current of component) {
                if (later[layerIndex]?.[current]) {
                    coveredCount += 1;
                }
                const currentGid = layer.data[current] ?? 0;
                for (let nextIndex = layerIndex + 1; nextIndex < layers.length; nextIndex += 1) {
                    if ((layers[nextIndex]?.data[current] ?? 0) === currentGid && currentGid !== 0) {
                        sameGidAsLaterLayer = true;
                    }
                }
                for (const neighbor of neighbors8(current, width, height)) {
                    for (let nextIndex = 0; nextIndex < layers.length; nextIndex += 1) {
                        if (nextIndex === layerIndex) {
                            continue;
                        }
                        const neighborLayer = layers[nextIndex];
                        if (!neighborLayer || (neighborLayer.data[neighbor] ?? 0) === 0) {
                            continue;
                        }
                        neighborLayerCounts.set(
                            neighborLayer.name,
                            (neighborLayerCounts.get(neighborLayer.name) ?? 0) + 1
                        );
                    }
                }
            }

            const sortedNeighbors = [...neighborLayerCounts.entries()].sort((left, right) => right[1] - left[1]);
            const [topNeighborLayer, topNeighborCount] = sortedNeighbors[0] ?? [null, 0];

            let reason: string | null = null;
            if (coveredCount === component.length && sameGidAsLaterLayer) {
                reason = 'duplicate paint fully covered by a later layer';
            } else if (coveredCount === component.length && topNeighborCount >= 5) {
                reason = 'tiny component fully covered by later layers';
            } else if (component.length <= 2 && topNeighborCount >= 8) {
                reason = 'tiny component strongly mismatches surrounding layer';
            }

            if (!reason) {
                continue;
            }

            suspicious.push({
                layer: layer.path,
                size: component.length,
                coveredCount,
                coords: component.map((current) => [current % width, Math.floor(current / width)] as const),
                topNeighborLayer,
                topNeighborCount,
                sameGidAsLaterLayer,
                reason,
            });
        }
    }

    return suspicious;
}

async function main(): Promise<void> {
    const args = parseCliArgs(
        process.argv.slice(2),
        [
            { key: 'map', kind: 'string', defaultValue: 'assets/maps/tiled/world.json' },
            { key: 'json', kind: 'boolean', defaultValue: false },
        ],
        { onHelp: printUsage }
    );

    const mapPath = path.resolve(process.cwd(), String(args.map ?? 'assets/maps/tiled/world.json'));
    const root = asRecord(JSON.parse(await fs.readFile(mapPath, 'utf8')));
    if (!root) {
        fail(`Invalid map root in ${rel(mapPath)}.`);
    }

    const layers = collectVisibleTileLayers(root);
    if (layers.length === 0) {
        fail(`No visible tile layers found in ${rel(mapPath)}.`);
    }

    const width = layers[0]?.width ?? 0;
    const height = layers[0]?.height ?? 0;
    const duplicates = findDuplicatePaints(layers, width, height);
    const suspicious = findSuspiciousComponents(layers, width, height);

    if (args.json) {
        console.log(
            JSON.stringify(
                {
                    map: rel(mapPath),
                    layers: layers.length,
                    suspiciousCount: suspicious.length,
                    duplicatePaintCount: duplicates.length,
                    suspicious: suspicious.slice(0, 100),
                    duplicatePaints: duplicates.slice(0, 100),
                },
                null,
                2
            )
        );
        return;
    }

    console.log(`Tile paint audit for ${rel(mapPath)}`);
    console.log(`Visible tile layers: ${layers.length}`);
    console.log(`Suspicious tiny components: ${suspicious.length}`);
    console.log(`Exact duplicate stacked paints: ${duplicates.length}`);

    const groupedDuplicates = new Map<string, number>();
    for (const duplicate of duplicates) {
        const key = `${duplicate.lowerLayer} -> ${duplicate.higherLayer}`;
        groupedDuplicates.set(key, (groupedDuplicates.get(key) ?? 0) + 1);
    }

    console.log('\nTop duplicate paint pairs:');
    for (const [pair, count] of [...groupedDuplicates.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 10)) {
        console.log(`- ${pair}: ${count}`);
    }

    console.log('\nTop suspicious components:');
    for (const entry of suspicious.slice(0, 25)) {
        const coords = entry.coords.map(([x, y]) => `${x},${y}`).join(' ');
        const neighbor = entry.topNeighborLayer ? `${entry.topNeighborLayer} (${entry.topNeighborCount})` : 'none';
        console.log(
            `- ${entry.layer}: ${entry.reason}; coords=${coords}; size=${entry.size}; covered=${entry.coveredCount}/${entry.size}; surrounding=${neighbor}; duplicateLater=${entry.sameGidAsLaterLayer}`
        );
    }
}

void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
