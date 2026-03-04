import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

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

async function resolveTilesetRoot(mapPath: string, tilesetRecord: UnknownRecord): Promise<UnknownRecord> {
    const sourceRef = asString(tilesetRecord.source);
    if (!sourceRef || sourceRef.trim().length === 0) {
        return tilesetRecord;
    }
    const sourcePath = path.resolve(path.dirname(mapPath), sourceRef);
    const payload = await fs.readFile(sourcePath, 'utf8');
    const parsed = asRecord(JSON.parse(payload));
    if (!parsed) {
        fail(`Tileset source "${sourceRef}" is not a valid JSON object.`);
    }
    return parsed;
}

function parseIntegerCsv(raw: string): number[] {
    if (!raw || raw.trim().length === 0) {
        return [];
    }
    const values: number[] = [];
    for (const chunk of raw.split(',')) {
        const token = chunk.trim();
        if (token.length === 0) {
            continue;
        }
        const parsed = Number(token);
        if (!Number.isInteger(parsed) || parsed < 0) {
            fail(`Expected non-negative integer list, got token: ${token}`);
        }
        values.push(parsed);
    }
    return values;
}

class MinHeap {
    private readonly entries: Array<{ index: number; cost: number }> = [];

    push(index: number, cost: number): void {
        this.entries.push({ index, cost });
        this.bubbleUp(this.entries.length - 1);
    }

    pop(): { index: number; cost: number } | null {
        if (this.entries.length === 0) {
            return null;
        }
        const root = this.entries[0] ?? null;
        const tail = this.entries.pop() ?? null;
        if (!root || !tail) {
            return root;
        }
        if (this.entries.length > 0) {
            this.entries[0] = tail;
            this.bubbleDown(0);
        }
        return root;
    }

    private bubbleUp(startIndex: number): void {
        let index = startIndex;
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            const parent = this.entries[parentIndex];
            const current = this.entries[index];
            if (!parent || !current || parent.cost <= current.cost) {
                return;
            }
            this.entries[parentIndex] = current;
            this.entries[index] = parent;
            index = parentIndex;
        }
    }

    private bubbleDown(startIndex: number): void {
        let index = startIndex;
        for (;;) {
            const left = index * 2 + 1;
            const right = left + 1;
            let smallest = index;

            if (
                left < this.entries.length &&
                (this.entries[left]?.cost ?? Number.POSITIVE_INFINITY) <
                    (this.entries[smallest]?.cost ?? Number.POSITIVE_INFINITY)
            ) {
                smallest = left;
            }
            if (
                right < this.entries.length &&
                (this.entries[right]?.cost ?? Number.POSITIVE_INFINITY) <
                    (this.entries[smallest]?.cost ?? Number.POSITIVE_INFINITY)
            ) {
                smallest = right;
            }
            if (smallest === index) {
                return;
            }
            const current = this.entries[index];
            const next = this.entries[smallest];
            if (!current || !next) {
                return;
            }
            this.entries[index] = next;
            this.entries[smallest] = current;
            index = smallest;
        }
    }
}

function detectTransparentBorderGids(params: {
    imagePath: string;
    tileWidth: number;
    tileHeight: number;
    firstGid: number;
    minBorderTransparentRatio: number;
    alphaThreshold: number;
}): Set<number> {
    const pythonScript = [
        'import json, sys',
        'from PIL import Image',
        'image_path = sys.argv[1]',
        'tile_w = int(float(sys.argv[2]))',
        'tile_h = int(float(sys.argv[3]))',
        'first_gid = int(float(sys.argv[4]))',
        'min_ratio = float(sys.argv[5])',
        'alpha_threshold = int(float(sys.argv[6]))',
        'img = Image.open(image_path).convert("RGBA")',
        'width, height = img.size',
        'columns = width // tile_w',
        'rows = height // tile_h',
        'pixels = img.load()',
        'gids = []',
        'for tile_id in range(columns * rows):',
        '    x0 = (tile_id % columns) * tile_w',
        '    y0 = (tile_id // columns) * tile_h',
        '    border_total = tile_w * 2 + tile_h * 2 - 4',
        '    if border_total <= 0:',
        '        continue',
        '    border_transparent = 0',
        '    border_opaque = 0',
        '    for y in range(tile_h):',
        '        for x in range(tile_w):',
        '            if x != 0 and x != tile_w - 1 and y != 0 and y != tile_h - 1:',
        '                continue',
        '            alpha = pixels[x0 + x, y0 + y][3]',
        '            if alpha <= alpha_threshold:',
        '                border_transparent += 1',
        '            else:',
        '                border_opaque += 1',
        '    ratio = border_transparent / border_total',
        '    if border_transparent > 0 and border_opaque > 0 and ratio >= min_ratio:',
        '        gids.append(first_gid + tile_id)',
        'print(json.dumps({"gids": gids, "count": len(gids)}))',
    ].join('\n');

    const processResult = spawnSync(
        'python3',
        [
            '-c',
            pythonScript,
            params.imagePath,
            String(params.tileWidth),
            String(params.tileHeight),
            String(params.firstGid),
            String(params.minBorderTransparentRatio),
            String(params.alphaThreshold),
        ],
        { encoding: 'utf8' }
    );

    if (processResult.status !== 0) {
        const stderr = processResult.stderr?.trim() || '(no stderr)';
        fail(`Failed transparent-border detection via python3/Pillow: ${stderr}`);
    }

    const stdout = processResult.stdout?.trim() || '';
    const parsed = asRecord(JSON.parse(stdout));
    if (!parsed) {
        fail('Transparent-border detector returned invalid JSON.');
    }
    const gidsRaw = asArray(parsed.gids);
    const gids = new Set<number>();
    for (const entry of gidsRaw) {
        if (typeof entry === 'number' && Number.isInteger(entry) && entry > 0) {
            gids.add(entry);
        }
    }
    return gids;
}

function printUsage(): never {
    console.log(
        'Usage: bun tools/content/world-null-outside-void.ts [--map <path>] [--tile-id <int>] [--tileset <name>] [--also-tile-ids <csv>] [--occlusion-depth <int>] [--enable-transparent-soft] [--soft-border-min-ratio <float>] [--alpha-threshold <int>] [--write]'
    );
    process.exit(0);
}

async function main(): Promise<void> {
    const parsedArgs = parseCliArgs(
        process.argv.slice(2),
        [
            { key: 'map', kind: 'string', defaultValue: 'assets/maps/tiled/world.json' },
            { key: 'tile-id', kind: 'number', defaultValue: 3 },
            { key: 'tileset', kind: 'string', defaultValue: 'tilesheet' },
            { key: 'also-tile-ids', kind: 'string', defaultValue: '' },
            { key: 'occlusion-depth', kind: 'number', defaultValue: 0 },
            { key: 'enable-transparent-soft', kind: 'boolean', defaultValue: false },
            { key: 'soft-border-min-ratio', kind: 'number', defaultValue: 0.08 },
            { key: 'alpha-threshold', kind: 'number', defaultValue: 0 },
            { key: 'write', kind: 'boolean', defaultValue: false },
        ],
        { onHelp: printUsage }
    );

    const mapPath = path.resolve(process.cwd(), String(parsedArgs.map ?? 'assets/maps/tiled/world.json'));
    const tileId = Number(parsedArgs['tile-id'] ?? 3);
    const tilesetName = String(parsedArgs.tileset ?? 'tilesheet');
    const additionalTileIds = parseIntegerCsv(String(parsedArgs['also-tile-ids'] ?? ''));
    const occlusionDepth = Number(parsedArgs['occlusion-depth'] ?? 0);
    const enableTransparentSoft = Boolean(parsedArgs['enable-transparent-soft']);
    const softBorderMinRatio = Number(parsedArgs['soft-border-min-ratio'] ?? 0.08);
    const alphaThreshold = Number(parsedArgs['alpha-threshold'] ?? 0);
    const write = Boolean(parsedArgs.write);

    if (!Number.isInteger(tileId) || tileId < 0) {
        fail(`--tile-id must be a non-negative integer. Received: ${tileId}`);
    }
    if (!Number.isInteger(occlusionDepth) || occlusionDepth < 0) {
        fail(`--occlusion-depth must be a non-negative integer. Received: ${occlusionDepth}`);
    }
    if (typeof softBorderMinRatio !== 'number' || !Number.isFinite(softBorderMinRatio) || softBorderMinRatio < 0) {
        fail(`--soft-border-min-ratio must be a non-negative number. Received: ${softBorderMinRatio}`);
    }
    if (!Number.isInteger(alphaThreshold) || alphaThreshold < 0 || alphaThreshold > 255) {
        fail(`--alpha-threshold must be an integer in [0,255]. Received: ${alphaThreshold}`);
    }

    const payload = await fs.readFile(mapPath, 'utf8');
    const root = asRecord(JSON.parse(payload));
    if (!root) {
        fail('Map root must be an object.');
    }

    const mapWidth = asInteger(root.width);
    const mapHeight = asInteger(root.height);
    if (!mapWidth || !mapHeight) {
        fail('Map dimensions are missing or invalid.');
    }
    const cellCount = mapWidth * mapHeight;

    const tilesets = asArray(root.tilesets)
        .map((entry) => asRecord(entry))
        .filter((tilesetRecord): tilesetRecord is UnknownRecord => tilesetRecord !== null);
    const preferredTileset = tilesets.find((tilesetRecord) => {
        const name = asString(tilesetRecord.name);
        if (name === tilesetName) {
            return true;
        }
        const source = asString(tilesetRecord.source);
        if (!source) {
            return false;
        }
        const sourceBase = path.basename(source, path.extname(source)).replace(/\.wang$/, '');
        return sourceBase === tilesetName;
    });
    const fallbackTileset = tilesets[0] ?? null;
    const tileset = preferredTileset ?? fallbackTileset;
    if (!tileset) {
        fail('No tilesets found in map.');
    }
    const tilesetRoot = await resolveTilesetRoot(mapPath, tileset);

    const firstGid = asInteger(tileset.firstgid);
    if (!firstGid) {
        fail('Tileset is missing firstgid.');
    }
    const targetGid = firstGid + tileId;
    const removableGids = new Set<number>([targetGid]);
    for (const extraTileId of additionalTileIds) {
        removableGids.add(firstGid + extraTileId);
    }
    const mapTileWidth = asInteger(root.tilewidth) ?? 16;
    const mapTileHeight = asInteger(root.tileheight) ?? 16;
    const tilesetTileWidth = asInteger(tileset.tilewidth) ?? asInteger(tilesetRoot.tilewidth) ?? mapTileWidth;
    const tilesetTileHeight = asInteger(tileset.tileheight) ?? asInteger(tilesetRoot.tileheight) ?? mapTileHeight;

    const softBlockerGids = new Set<number>();
    let transparentSoftCount = 0;
    if (enableTransparentSoft) {
        const imageRef = asString(tileset.image) ?? asString(tilesetRoot.image);
        if (!imageRef) {
            fail('Selected tileset has no `image` path for transparent-border analysis.');
        }
        const imageBasePath = asString(tileset.image) ? path.dirname(mapPath) : path.dirname(path.resolve(path.dirname(mapPath), asString(tileset.source) ?? '.'));
        const imagePath = path.resolve(imageBasePath, imageRef);
        const detectedGids = detectTransparentBorderGids({
            imagePath,
            tileWidth: tilesetTileWidth,
            tileHeight: tilesetTileHeight,
            firstGid,
            minBorderTransparentRatio: softBorderMinRatio,
            alphaThreshold,
        });
        for (const gid of detectedGids) {
            softBlockerGids.add(gid);
        }
        transparentSoftCount = softBlockerGids.size;
    }

    const tileLayers = asArray(root.layers)
        .map((entry) => asRecord(entry))
        .filter((layerRecord): layerRecord is UnknownRecord => layerRecord !== null)
        .filter((layerRecord) => asString(layerRecord.type) === 'tilelayer');

    if (tileLayers.length === 0) {
        fail('Map has no tile layers.');
    }

    const blockerCost = new Uint8Array(cellCount);
    const containsTarget = new Uint8Array(cellCount);
    const containsRemovable = new Uint8Array(cellCount);
    const normalizedLayerData: Array<{ layer: string; data: number[] }> = [];

    for (const layerRecord of tileLayers) {
        const layerName = asString(layerRecord.name) ?? '(unnamed)';
        const rawData = asArray(layerRecord.data);
        if (rawData.length !== cellCount) {
            fail(`Tile layer ${layerName} has invalid data length ${rawData.length}; expected ${cellCount}.`);
        }

        const data: number[] = [];
        for (let index = 0; index < rawData.length; index += 1) {
            const value = rawData[index];
            if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
                fail(`Tile layer ${layerName} has invalid gid at index ${index}.`);
            }
            data.push(value);
            if (value === targetGid) {
                containsTarget[index] = 1;
            }
            if (removableGids.has(value)) {
                containsRemovable[index] = 1;
            }
        }

        normalizedLayerData.push({ layer: layerName, data });
        layerRecord.data = data;
    }

    for (let index = 0; index < cellCount; index += 1) {
        let hasHardBlocker = false;
        let hasSoftBlocker = false;
        for (const layerData of normalizedLayerData) {
            const gid = layerData.data[index] ?? 0;
            if (gid === 0 || removableGids.has(gid)) {
                continue;
            }
            if (softBlockerGids.has(gid)) {
                hasSoftBlocker = true;
                continue;
            }
            hasHardBlocker = true;
            break;
        }
        blockerCost[index] = hasHardBlocker ? 1 : hasSoftBlocker ? 0 : 0;
    }

    const unreachableCost = 1_000_000_000;
    const reachableCost = new Int32Array(cellCount);
    reachableCost.fill(unreachableCost);
    const heap = new MinHeap();

    const seedBoundary = (index: number): void => {
        if (index < 0 || index >= cellCount) {
            return;
        }
        const seedCost = blockerCost[index] ?? 0;
        if (seedCost < (reachableCost[index] ?? unreachableCost)) {
            reachableCost[index] = seedCost;
            heap.push(index, seedCost);
        }
    };

    for (let x = 0; x < mapWidth; x += 1) {
        seedBoundary(x);
        seedBoundary((mapHeight - 1) * mapWidth + x);
    }
    for (let y = 0; y < mapHeight; y += 1) {
        seedBoundary(y * mapWidth);
        seedBoundary(y * mapWidth + (mapWidth - 1));
    }

    for (;;) {
        const current = heap.pop();
        if (!current) {
            break;
        }
        const currentCost = current.cost;
        const currentIndex = current.index;
        if (currentCost !== reachableCost[currentIndex]) {
            continue;
        }
        if (currentCost > occlusionDepth + 1) {
            continue;
        }
        const x = currentIndex % mapWidth;
        const y = Math.floor(currentIndex / mapWidth);

        const relax = (neighbor: number): void => {
            if (neighbor < 0 || neighbor >= cellCount) {
                return;
            }
            const neighborCost = currentCost + (blockerCost[neighbor] ?? 0);
            if (neighborCost < reachableCost[neighbor]) {
                reachableCost[neighbor] = neighborCost;
                heap.push(neighbor, neighborCost);
            }
        };

        if (x > 0) {
            relax(currentIndex - 1);
        }
        if (x + 1 < mapWidth) {
            relax(currentIndex + 1);
        }
        if (y > 0) {
            relax(currentIndex - mapWidth);
        }
        if (y + 1 < mapHeight) {
            relax(currentIndex + mapWidth);
        }
    }

    let totalBefore = 0;
    let totalRemoved = 0;
    let totalKept = 0;
    const perGid = new Map<number, { before: number; removed: number; kept: number }>();
    const perLayer: Array<{
        layer: string;
        before: number;
        removed: number;
        kept: number;
    }> = [];

    for (const layerData of normalizedLayerData) {
        let before = 0;
        let removed = 0;
        let kept = 0;
        for (let index = 0; index < layerData.data.length; index += 1) {
            const gid = layerData.data[index] ?? 0;
            if (!removableGids.has(gid)) {
                continue;
            }
            const gidStats = perGid.get(gid) ?? { before: 0, removed: 0, kept: 0 };
            perGid.set(gid, gidStats);
            before += 1;
            totalBefore += 1;
            gidStats.before += 1;
            if (reachableCost[index] <= occlusionDepth) {
                layerData.data[index] = 0;
                removed += 1;
                totalRemoved += 1;
                gidStats.removed += 1;
            } else {
                kept += 1;
                totalKept += 1;
                gidStats.kept += 1;
            }
        }
        if (before > 0) {
            perLayer.push({
                layer: layerData.layer,
                before,
                removed,
                kept,
            });
        }
    }

    if (write) {
        await fs.writeFile(mapPath, `${JSON.stringify(root, null, 2)}\n`, 'utf8');
    }

    const outsideTargetCells = (() => {
        let count = 0;
        for (let index = 0; index < cellCount; index += 1) {
            if (containsTarget[index] && reachableCost[index] <= occlusionDepth) {
                count += 1;
            }
        }
        return count;
    })();
    const outsideRemovableCells = (() => {
        let count = 0;
        for (let index = 0; index < cellCount; index += 1) {
            if (containsRemovable[index] && reachableCost[index] <= occlusionDepth) {
                count += 1;
            }
        }
        return count;
    })();

    const perGidSummary = [...perGid.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([gid, stats]) => ({
            gid,
            before: stats.before,
            removed: stats.removed,
            kept: stats.kept,
        }));

    console.log(
        JSON.stringify(
            {
                mapPath,
                write,
                tileset: asString(tileset.name) ?? '(unnamed)',
                tileId,
                targetGid,
                removableGids: [...removableGids].sort((left, right) => left - right),
                additionalTileIds,
                occlusionDepth,
                enableTransparentSoft,
                softBorderMinRatio,
                alphaThreshold,
                transparentSoftCount,
                totals: {
                    before: totalBefore,
                    removed: totalRemoved,
                    kept: totalKept,
                    outsideTargetCells,
                    outsideRemovableCells,
                },
                perGid: perGidSummary,
                perLayer,
            },
            null,
            2
        )
    );
}

void main();
