import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

type TiledProperty = Readonly<{
    name?: unknown;
    value?: unknown;
}>;

type TiledTileset = Readonly<{
    firstgid?: unknown;
    source?: unknown;
    image?: unknown;
    imagewidth?: unknown;
    imageheight?: unknown;
    tilewidth?: unknown;
    tileheight?: unknown;
    columns?: unknown;
    objectalignment?: unknown;
}>;

type TiledLayer = UnknownRecord & {
    name?: unknown;
    type?: unknown;
    visible?: unknown;
    layers?: unknown;
    data?: unknown;
    objects?: unknown;
};

type TiledMap = Readonly<{
    width?: unknown;
    height?: unknown;
    tilewidth?: unknown;
    tileheight?: unknown;
    tilesets?: unknown;
    layers?: unknown;
}>;

type ResolvedTileset = Readonly<{
    firstgid: number;
    lastgid: number;
    imagePath: string;
    imageWidth: number;
    imageHeight: number;
    tileWidth: number;
    tileHeight: number;
    columns: number;
    objectAlignment: string;
}>;

type FlattenedLayer = TiledLayer & {
    path: string;
};

type Marker = Readonly<{
    x: number;
    y: number;
    label: string;
    color: string;
}>;

const GLOBAL_TILE_ID_MASK = 0x1fffffff;
const DATA_URI_IMAGE_SCALE = 1;

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
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function asFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asInteger(value: unknown): number | null {
    return Number.isInteger(value) ? (value as number) : null;
}

function requirePositiveInteger(value: unknown, label: string): number {
    const n = asInteger(value);
    if (n === null || n <= 0) {
        fail(`Invalid ${label}: expected a positive integer.`);
    }
    return n;
}

async function readJson(filePath: string): Promise<unknown> {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function normalizeGid(value: unknown): number {
    const n = asInteger(value);
    return n === null ? 0 : n & GLOBAL_TILE_ID_MASK;
}

function flattenLayers(layers: unknown, prefix: string[] = [], parentVisible = true): FlattenedLayer[] {
    const out: FlattenedLayer[] = [];
    for (const entry of asArray(layers)) {
        const layer = asRecord(entry);
        if (!layer) {
            continue;
        }
        const name = asString(layer.name) ?? 'unnamed';
        const visible = parentVisible && layer.visible !== false;
        const currentPath = [...prefix, name];
        if (layer.type === 'group') {
            out.push(...flattenLayers(layer.layers, currentPath, visible));
            continue;
        }
        out.push({
            ...layer,
            path: currentPath.join('/'),
            visible,
        });
    }
    return out;
}

function parseLayerFilter(value: string): ReadonlySet<string> | null {
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed === 'all') {
        return null;
    }
    return new Set(
        trimmed
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
    );
}

function layerMatchesFilter(layer: FlattenedLayer, layerFilter: ReadonlySet<string> | null): boolean {
    if (!layerFilter) {
        return true;
    }
    const name = asString(layer.name) ?? '';
    return layerFilter.has(layer.path) || layerFilter.has(name);
}

async function resolveTilesets(mapPath: string, map: TiledMap): Promise<ResolvedTileset[]> {
    const mapDir = path.dirname(mapPath);
    const rawTilesets = asArray(map.tilesets);
    const resolved: Array<Omit<ResolvedTileset, 'lastgid'>> = [];

    for (const rawTileset of rawTilesets) {
        const tilesetRef = asRecord(rawTileset) as TiledTileset | null;
        if (!tilesetRef) {
            continue;
        }
        const firstgid = requirePositiveInteger(tilesetRef.firstgid, 'tileset firstgid');
        let tileset = tilesetRef;
        let tilesetDir = mapDir;
        const source = asString(tilesetRef.source);
        if (source) {
            const sourcePath = path.resolve(mapDir, source);
            tileset = (await readJson(sourcePath)) as TiledTileset;
            tilesetDir = path.dirname(sourcePath);
        }
        const image = asString(tileset.image);
        if (!image) {
            continue;
        }
        const tileWidth = requirePositiveInteger(tileset.tilewidth, 'tileset tilewidth');
        const tileHeight = requirePositiveInteger(tileset.tileheight, 'tileset tileheight');
        const imageWidth = requirePositiveInteger(tileset.imagewidth, 'tileset imagewidth');
        const imageHeight = requirePositiveInteger(tileset.imageheight, 'tileset imageheight');
        const columns = asInteger(tileset.columns) ?? Math.floor(imageWidth / tileWidth);
        if (columns <= 0) {
            fail(`Invalid tileset columns for ${image}.`);
        }
        resolved.push({
            firstgid,
            imagePath: path.resolve(tilesetDir, image),
            imageWidth,
            imageHeight,
            tileWidth,
            tileHeight,
            columns,
            objectAlignment: asString(tileset.objectalignment) ?? 'unspecified',
        });
    }

    resolved.sort((a, b) => a.firstgid - b.firstgid);
    return resolved.map((tileset, index) => {
        const next = resolved[index + 1];
        return {
            ...tileset,
            lastgid: next ? next.firstgid - 1 : Number.MAX_SAFE_INTEGER,
        };
    });
}

function tilesetForGid(gid: number, tilesets: ReadonlyArray<ResolvedTileset>): ResolvedTileset | null {
    for (let i = tilesets.length - 1; i >= 0; i -= 1) {
        const tileset = tilesets[i];
        if (tileset && gid >= tileset.firstgid && gid <= tileset.lastgid) {
            return tileset;
        }
    }
    return null;
}

function tileImageCacheKey(tileset: ResolvedTileset, localId: number): string {
    return `${tileset.imagePath}:${localId}`;
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
        case 'unspecified':
            return height;
        default:
            return 0;
    }
}

async function buildTileImageCache(gids: ReadonlySet<number>, tilesets: ReadonlyArray<ResolvedTileset>): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bq-map-region-'));
    try {
        for (const gid of gids) {
            const normalized = normalizeGid(gid);
            if (normalized <= 0) {
                continue;
            }
            const tileset = tilesetForGid(normalized, tilesets);
            if (!tileset) {
                continue;
            }
            const localId = normalized - tileset.firstgid;
            const sx = (localId % tileset.columns) * tileset.tileWidth;
            const sy = Math.floor(localId / tileset.columns) * tileset.tileHeight;
            if (
                sx < 0
                || sy < 0
                || sx + tileset.tileWidth > tileset.imageWidth
                || sy + tileset.tileHeight > tileset.imageHeight
            ) {
                continue;
            }
            const cacheKey = tileImageCacheKey(tileset, localId);
            if (out.has(cacheKey)) {
                continue;
            }
            const tilePath = path.join(tempDir, `${out.size}.png`);
            execFileSync(
                'convert',
                [
                    tileset.imagePath,
                    '-crop',
                    `${tileset.tileWidth}x${tileset.tileHeight}+${sx}+${sy}`,
                    '+repage',
                    '-filter',
                    'point',
                    '-resize',
                    `${tileset.tileWidth * DATA_URI_IMAGE_SCALE}x${tileset.tileHeight * DATA_URI_IMAGE_SCALE}`,
                    tilePath,
                ],
                { stdio: 'pipe' }
            );
            const base64 = await fs.readFile(tilePath, 'base64');
            out.set(cacheKey, `data:image/png;base64,${base64}`);
        }
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
    return out;
}

function renderTileUse({
    gid,
    destX,
    destY,
    destWidth,
    destHeight,
    tilesets,
    tileImageCache,
}: {
    gid: number;
    destX: number;
    destY: number;
    destWidth: number;
    destHeight: number;
    tilesets: ReadonlyArray<ResolvedTileset>;
    tileImageCache: ReadonlyMap<string, string>;
}): string {
    const normalized = normalizeGid(gid);
    if (normalized <= 0) {
        return '';
    }
    const tileset = tilesetForGid(normalized, tilesets);
    if (!tileset) {
        return '';
    }
    const localId = normalized - tileset.firstgid;
    const dataUri = tileImageCache.get(tileImageCacheKey(tileset, localId));
    if (!dataUri) {
        return '';
    }
    return `<image href="${escapeXml(dataUri)}" x="${destX}" y="${destY}" width="${destWidth}" height="${destHeight}"/>`;
}

function getObjectProperties(object: UnknownRecord): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const rawProperty of asArray(object.properties)) {
        const property = asRecord(rawProperty) as TiledProperty | null;
        const name = asString(property?.name);
        if (!name) {
            continue;
        }
        out[name] = property?.value;
    }
    return out;
}

function markerObjects({
    map,
    crop,
    markerMode,
    layerFilter,
}: {
    map: TiledMap;
    crop: { x: number; y: number; w: number; h: number };
    markerMode: string;
    layerFilter: ReadonlySet<string> | null;
}): Marker[] {
    if (markerMode === 'none') {
        return [];
    }
    const tileWidth = requirePositiveInteger(map.tilewidth, 'map tilewidth');
    const tileHeight = requirePositiveInteger(map.tileheight, 'map tileheight');
    const out: Marker[] = [];
    const layers = flattenLayers(map.layers, [], true);
    for (const layer of layers) {
        if (layer.type !== 'objectgroup') {
            continue;
        }
        if (!layerMatchesFilter(layer, layerFilter)) {
            continue;
        }
        const layerName = asString(layer.name) ?? '';
        const includeDoors = markerMode === 'doors' || markerMode === 'all';
        const includeObjects = markerMode === 'objects' || markerMode === 'all';
        if (!includeObjects && !(includeDoors && layerName === 'doors')) {
            continue;
        }
        for (const rawObject of asArray(layer.objects)) {
            const object = asRecord(rawObject);
            if (!object) {
                continue;
            }
            const objectX = asFiniteNumber(object.x);
            const objectY = asFiniteNumber(object.y);
            if (objectX === null || objectY === null) {
                continue;
            }
            const tx = Math.floor(objectX / tileWidth);
            const ty = Math.floor(objectY / tileHeight);
            if (tx < crop.x || ty < crop.y || tx >= crop.x + crop.w || ty >= crop.y + crop.h) {
                continue;
            }
            const props = getObjectProperties(object);
            const label =
                asString(props.door_id)
                ?? asString(object.name)
                ?? asString(object.type)
                ?? asString(object.class)
                ?? layerName;
            out.push({
                x: tx,
                y: ty,
                label,
                color: layerName === 'doors' ? '#ff4040' : '#40a0ff',
            });
        }
    }
    return out;
}

function renderMarkers({
    markers,
    crop,
    tileSize,
}: {
    markers: ReadonlyArray<Marker>;
    crop: { x: number; y: number; w: number; h: number };
    tileSize: number;
}): string {
    const parts: string[] = [];
    for (const marker of markers) {
        const x = (marker.x - crop.x) * tileSize;
        const y = (marker.y - crop.y) * tileSize;
        parts.push(
            `<rect x="${x}" y="${y}" width="${tileSize}" height="${tileSize}" fill="none" stroke="${marker.color}" stroke-width="2"/>`
        );
        parts.push(
            `<text x="${x + 1}" y="${Math.max(10, y - 2)}" fill="${marker.color}" font-family="monospace" font-size="10">${escapeXml(marker.label)}</text>`
        );
    }
    return parts.join('\n');
}

async function renderSvg({
    mapPath,
    crop,
    markerMode,
    layerFilter,
}: {
    mapPath: string;
    crop: { x: number; y: number; w: number; h: number };
    markerMode: string;
    layerFilter: ReadonlySet<string> | null;
}): Promise<string> {
    const map = (await readJson(mapPath)) as TiledMap;
    const mapWidth = requirePositiveInteger(map.width, 'map width');
    const mapHeight = requirePositiveInteger(map.height, 'map height');
    const tileWidth = requirePositiveInteger(map.tilewidth, 'map tilewidth');
    const tileHeight = requirePositiveInteger(map.tileheight, 'map tileheight');
    if (tileWidth !== tileHeight) {
        fail(`Unsupported non-square tiles: ${tileWidth}x${tileHeight}.`);
    }
    if (crop.x < 0 || crop.y < 0 || crop.w <= 0 || crop.h <= 0 || crop.x + crop.w > mapWidth || crop.y + crop.h > mapHeight) {
        fail(`Invalid crop ${JSON.stringify(crop)} for map ${mapWidth}x${mapHeight}.`);
    }
    const tilesets = await resolveTilesets(mapPath, map);
    const uniqueGids = new Set<number>();
    for (const layer of flattenLayers(map.layers, [], true)) {
        if (layer.visible === false) {
            continue;
        }
        if (!layerMatchesFilter(layer, layerFilter)) {
            continue;
        }
        if (layer.type === 'tilelayer') {
            const data = asArray(layer.data);
            for (let y = crop.y; y < crop.y + crop.h; y += 1) {
                for (let x = crop.x; x < crop.x + crop.w; x += 1) {
                    const gid = normalizeGid(data[y * mapWidth + x]);
                    if (gid > 0) {
                        uniqueGids.add(gid);
                    }
                }
            }
            continue;
        }
        if (layer.type === 'objectgroup') {
            for (const rawObject of asArray(layer.objects)) {
                const object = asRecord(rawObject);
                if (!object) {
                    continue;
                }
                const gid = normalizeGid(object.gid);
                if (gid <= 0) {
                    continue;
                }
                const objectX = asFiniteNumber(object.x);
                const objectY = asFiniteNumber(object.y);
                if (objectX === null || objectY === null) {
                    continue;
                }
                const tileset = tilesetForGid(gid, tilesets);
                if (!tileset) {
                    continue;
                }
                const objectWidth = asFiniteNumber(object.width) ?? tileset.tileWidth;
                const objectHeight = asFiniteNumber(object.height) ?? tileset.tileHeight;
                const alignment = tileset.objectAlignment === 'unspecified' ? 'bottomleft' : tileset.objectAlignment;
                const px = objectX - alignmentOffsetX(alignment, objectWidth) - crop.x * tileWidth;
                const py = objectY - alignmentOffsetY(alignment, objectHeight) - crop.y * tileHeight;
                if (px + objectWidth <= 0 || py + objectHeight <= 0 || px >= crop.w * tileWidth || py >= crop.h * tileHeight) {
                    continue;
                }
                uniqueGids.add(gid);
            }
        }
    }
    const tileImageCache = await buildTileImageCache(uniqueGids, tilesets);
    const body: string[] = [];
    for (const layer of flattenLayers(map.layers, [], true)) {
        if (layer.visible === false) {
            continue;
        }
        if (!layerMatchesFilter(layer, layerFilter)) {
            continue;
        }
        if (layer.type === 'tilelayer') {
            const data = asArray(layer.data);
            for (let y = crop.y; y < crop.y + crop.h; y += 1) {
                for (let x = crop.x; x < crop.x + crop.w; x += 1) {
                    const gid = normalizeGid(data[y * mapWidth + x]);
                    if (gid <= 0) {
                        continue;
                    }
                    body.push(
                        renderTileUse({
                            gid,
                            destX: (x - crop.x) * tileWidth,
                            destY: (y - crop.y) * tileHeight,
                            destWidth: tileWidth,
                            destHeight: tileHeight,
                            tilesets,
                            tileImageCache,
                        })
                    );
                }
            }
            continue;
        }
        if (layer.type === 'objectgroup') {
            for (const rawObject of asArray(layer.objects)) {
                const object = asRecord(rawObject);
                if (!object) {
                    continue;
                }
                const gid = normalizeGid(object.gid);
                if (gid <= 0) {
                    continue;
                }
                const objectX = asFiniteNumber(object.x);
                const objectY = asFiniteNumber(object.y);
                if (objectX === null || objectY === null) {
                    continue;
                }
                const tileset = tilesetForGid(gid, tilesets);
                if (!tileset) {
                    continue;
                }
                const objectWidth = asFiniteNumber(object.width) ?? tileset.tileWidth;
                const objectHeight = asFiniteNumber(object.height) ?? tileset.tileHeight;
                const alignment = tileset.objectAlignment === 'unspecified' ? 'bottomleft' : tileset.objectAlignment;
                const px = objectX - alignmentOffsetX(alignment, objectWidth) - crop.x * tileWidth;
                const py = objectY - alignmentOffsetY(alignment, objectHeight) - crop.y * tileHeight;
                if (px + objectWidth <= 0 || py + objectHeight <= 0 || px >= crop.w * tileWidth || py >= crop.h * tileHeight) {
                    continue;
                }
                body.push(
                    renderTileUse({
                        gid,
                        destX: Math.round(px),
                        destY: Math.round(py),
                        destWidth: objectWidth,
                        destHeight: objectHeight,
                        tilesets,
                        tileImageCache,
                    })
                );
            }
        }
    }
    body.push(renderMarkers({ markers: markerObjects({ map, crop, markerMode, layerFilter }), crop, tileSize: tileWidth }));
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${crop.w * tileWidth}" height="${crop.h * tileHeight}" viewBox="0 0 ${crop.w * tileWidth} ${crop.h * tileHeight}">`,
        '<rect width="100%" height="100%" fill="#141418"/>',
        ...body.filter((entry) => entry.length > 0),
        '</svg>',
        '',
    ].join('\n');
}

async function main(): Promise<void> {
    const parsed = parseCliArgs(process.argv.slice(2), [
        { key: 'map', kind: 'string', defaultValue: 'assets/maps/tiled/world.json' },
        { key: 'x', kind: 'number', defaultValue: 0 },
        { key: 'y', kind: 'number', defaultValue: 0 },
        { key: 'w', kind: 'number', defaultValue: 16 },
        { key: 'h', kind: 'number', defaultValue: 16 },
        { key: 'out', kind: 'string', defaultValue: '.data/map-region.png' },
        { key: 'markers', kind: 'string', defaultValue: 'doors' },
        { key: 'layers', kind: 'string', defaultValue: 'all' },
        { key: 'keepSvg', kind: 'boolean', defaultValue: false },
    ]);

    const mapPath = path.resolve(String(parsed.map));
    const outPath = path.resolve(String(parsed.out));
    const crop = {
        x: Number(parsed.x),
        y: Number(parsed.y),
        w: Number(parsed.w),
        h: Number(parsed.h),
    };
    const markerMode = String(parsed.markers);
    if (!['none', 'doors', 'objects', 'all'].includes(markerMode)) {
        fail('Invalid --markers value: expected none, doors, objects, or all.');
    }
    const layerFilter = parseLayerFilter(String(parsed.layers));

    const svg = await renderSvg({ mapPath, crop, markerMode, layerFilter });
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    if (outPath.endsWith('.svg')) {
        await fs.writeFile(outPath, svg, 'utf8');
        console.log(`Rendered ${outPath}`);
        return;
    }

    const svgPath = `${outPath}.svg`;
    await fs.writeFile(svgPath, svg, 'utf8');
    execFileSync('convert', [svgPath, outPath], { stdio: 'pipe' });
    if (parsed.keepSvg !== true) {
        await fs.rm(svgPath, { force: true });
    }
    console.log(`Rendered ${outPath}`);
}

void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
