import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
    TERRAIN_AUTHORING_CATEGORIES,
    type TerrainAuthoringAudit,
    type TerrainAuthoringCategory,
    type TerrainAuthoringFinding,
    type TerrainAuthoringSeverity,
} from './terrain-authoring-contract';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;
type TileLayer = Readonly<{ path: string; name: string; width: number; height: number; data: number[]; className: string; opacity: number }>;
type ObjectLayer = Readonly<{ path: string; name: string; objects: UnknownRecord[] }>;
type WangTile = Readonly<{ tileId: number; wangId: number[] }>;

export const defaultWorld = 'assets/maps/tiled/world.json';
export const defaultTileset = 'assets/maps/tiled/tilesheet.wang.tsj';
export const defaultOutDir = 'artifacts/map-authoring';
export const minimumMixedTransitionsForPair = 16;
export const mostlyPureRatio = 0.9;

function asRecord(value: unknown): UnknownRecord | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
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

function finding({
    id,
    severity,
    category,
    title,
    detail,
    location,
    evidence,
}: {
    id: string;
    severity: TerrainAuthoringSeverity;
    category: TerrainAuthoringCategory;
    title: string;
    detail: string;
    location: TerrainAuthoringFinding['location'];
    evidence: readonly string[];
}): TerrainAuthoringFinding {
    return { id, severity, category, title, detail, location, evidence };
}

export function summarize(findings: readonly TerrainAuthoringFinding[]): TerrainAuthoringAudit['summary'] {
    const summary = Object.fromEntries(TERRAIN_AUTHORING_CATEGORIES.map((category) => [category, 0])) as Record<
        TerrainAuthoringCategory,
        number
    >;
    for (const entry of findings) {
        summary[entry.category] += 1;
    }
    return summary;
}

function getProperties(record: UnknownRecord): UnknownRecord[] {
    return asArray(record.properties)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
}

function hasEmptyPropertyValue(property: UnknownRecord): boolean {
    const name = asString(property.name)?.trim() ?? '';
    const value = property.value;
    return name.length === 0 || value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0);
}

export function findMapPropertyFindings(worldRoot: UnknownRecord, worldPath = defaultWorld): TerrainAuthoringFinding[] {
    const properties = getProperties(worldRoot);
    if (properties.length === 0) {
        return [
            finding({
                id: 'MAP_PROPERTIES_EMPTY',
                severity: 'high',
                category: 'map_properties',
                title: 'Map has no authoring properties',
                detail: 'The world map should declare authoring metadata such as biome taxonomy, review status, and content ownership.',
                location: { map: worldPath },
                evidence: ['properties array is missing or empty'],
            }),
        ];
    }
    const empty = properties.filter(hasEmptyPropertyValue);
    if (empty.length === 0) {
        return [];
    }
    return [
        finding({
            id: 'MAP_PROPERTIES_EMPTY',
            severity: 'medium',
            category: 'map_properties',
            title: 'Map has empty authoring properties',
            detail: 'One or more map-level properties have an empty name or value.',
            location: { map: worldPath },
            evidence: [`empty_properties=${empty.length}`],
        }),
    ];
}

function normalizeWangId(value: unknown): number[] {
    return asArray(value)
        .map((entry) => asInteger(entry))
        .filter((entry): entry is number => entry !== null);
}

function parseWangTiles(wangset: UnknownRecord): WangTile[] {
    return asArray(wangset.wangtiles)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null)
        .map((entry) => ({ tileId: asInteger(entry.tileid), wangId: normalizeWangId(entry.wangid) }))
        .filter((entry): entry is WangTile => entry.tileId !== null && entry.wangId.length === 8);
}

function isPureWangTile(tile: WangTile): boolean {
    const colors = new Set(tile.wangId.filter((entry) => entry > 0));
    return colors.size <= 1;
}

function mixedWangTileCount(tiles: readonly WangTile[]): number {
    return tiles.filter((tile) => !isPureWangTile(tile)).length;
}

export function findWangTilesetFindings(tilesetRoot: UnknownRecord, tilesetPath = defaultTileset): TerrainAuthoringFinding[] {
    const findings: TerrainAuthoringFinding[] = [];
    const image = asString(tilesetRoot.image);
    if (!image) {
        findings.push(
            finding({
                id: 'TILESET_IMAGE_REFERENCE',
                severity: 'error',
                category: 'asset_reference',
                title: 'Tileset has no image reference',
                detail: 'The Wang tileset must reference the source image used by Tiled.',
                location: { tileset: tilesetPath },
                evidence: ['image field is missing or empty'],
            })
        );
    } else {
        findings.push(
            finding({
                id: 'TILESET_IMAGE_REFERENCE',
                severity: 'info',
                category: 'asset_reference',
                title: 'Tileset image reference',
                detail: 'The Wang tileset declares an image reference.',
                location: { tileset: tilesetPath },
                evidence: [`image=${image}`],
            })
        );
    }

    for (const wangset of asArray(tilesetRoot.wangsets)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null)) {
        const name = asString(wangset.name) ?? '<unnamed>';
        const colors = asArray(wangset.colors)
            .map((entry) => asRecord(entry))
            .filter((entry): entry is UnknownRecord => entry !== null);
        const tiles = parseWangTiles(wangset);
        if (tiles.length === 0) {
            continue;
        }
        const pureCount = tiles.filter(isPureWangTile).length;
        const pureRatio = pureCount / tiles.length;
        if (pureRatio >= mostlyPureRatio) {
            findings.push(
                finding({
                    id: 'WANG_SET_MOSTLY_PURE',
                    severity: 'medium',
                    category: 'wang_tileset',
                    title: 'Wang set is mostly pure tiles',
                    detail: 'A transition Wang set needs enough mixed entries to describe edges and corners.',
                    location: { tileset: tilesetPath },
                    evidence: [`set=${name}`, `pure=${pureCount}`, `total=${tiles.length}`, `ratio=${pureRatio.toFixed(2)}`],
                })
            );
        }
        if (colors.length === 2) {
            const mixedTransitionCount = mixedWangTileCount(tiles);
            if (mixedTransitionCount === 0) {
                findings.push(
                    finding({
                        id: 'WANG_PAIR_HAS_NO_MIXED_TRANSITIONS',
                        severity: 'high',
                        category: 'wang_tileset',
                        title: 'Pair Wang set has no mixed transitions',
                        detail: 'A two-color Wang set with no mixed entries cannot paint transitions between its colors.',
                        location: { tileset: tilesetPath },
                        evidence: [`set=${name}`, 'mixed=0'],
                    })
                );
            } else if (mixedTransitionCount < minimumMixedTransitionsForPair) {
                findings.push(
                    finding({
                        id: 'WANG_PAIR_HAS_TOO_FEW_MIXED_TRANSITIONS',
                        severity: 'medium',
                        category: 'wang_tileset',
                        title: 'Pair Wang set has too few mixed transitions',
                        detail: 'A two-color Wang set has some mixed entries but fewer than the review threshold.',
                        location: { tileset: tilesetPath },
                        evidence: [`set=${name}`, `mixed=${mixedTransitionCount}`, `minimum=${minimumMixedTransitionsForPair}`],
                    })
                );
            }
        }
    }
    return findings;
}

function flattenLayers(root: UnknownRecord): { tileLayers: TileLayer[]; objectLayers: ObjectLayer[] } {
    const tileLayers: TileLayer[] = [];
    const objectLayers: ObjectLayer[] = [];

    function walk(entries: unknown[], trail: string[]): void {
        for (const entry of entries) {
            const layer = asRecord(entry);
            if (!layer) {
                continue;
            }
            const name = asString(layer.name) ?? '<unnamed>';
            const nextTrail = [...trail, name];
            const layerPath = nextTrail.join('/');
            const type = asString(layer.type);
            if (type === 'group') {
                walk(asArray(layer.layers), nextTrail);
                continue;
            }
            if (type === 'tilelayer') {
                tileLayers.push({
                    path: layerPath,
                    name,
                    width: asInteger(layer.width) ?? 0,
                    height: asInteger(layer.height) ?? 0,
                    data: asArray(layer.data).map((value) => asInteger(value) ?? 0),
                    className: asString(layer.class) ?? '',
                    opacity: typeof layer.opacity === 'number' && Number.isFinite(layer.opacity) ? layer.opacity : 1,
                });
                continue;
            }
            if (type === 'objectgroup') {
                objectLayers.push({
                    path: layerPath,
                    name,
                    objects: asArray(layer.objects)
                        .map((object) => asRecord(object))
                        .filter((object): object is UnknownRecord => object !== null),
                });
            }
        }
    }

    walk(asArray(root.layers), []);
    return { tileLayers, objectLayers };
}

function firstPaintedTile(layer: TileLayer): { x: number; y: number; gid: number } | null {
    for (let index = 0; index < layer.data.length; index += 1) {
        const gid = layer.data[index] ?? 0;
        if (gid <= 0) {
            continue;
        }
        return { x: index % Math.max(1, layer.width), y: Math.floor(index / Math.max(1, layer.width)), gid };
    }
    return null;
}

function tileObjectGridPosition(object: UnknownRecord): { x: number; y: number; gid: number } | null {
    const gid = asInteger(object.gid);
    const x = typeof object.x === 'number' && Number.isFinite(object.x) ? object.x : null;
    const y = typeof object.y === 'number' && Number.isFinite(object.y) ? object.y : null;
    if (gid === null || gid <= 0 || x === null || y === null) {
        return null;
    }
    return { x: Math.round(x / 16), y: Math.round((y - 16) / 16), gid };
}

function isBlankTileObject(object: UnknownRecord): boolean {
    return (
        asString(object.name)?.trim()
        ?? asString(object.type)?.trim()
        ?? asString(object.class)?.trim()
        ?? asString(object.template)?.trim()
        ?? ''
    ).length === 0 && getProperties(object).length === 0;
}

function findTinyPaintComponents(layer: TileLayer, maxFindings: number): TerrainAuthoringFinding[] {
    const findings: TerrainAuthoringFinding[] = [];
    const width = Math.max(1, layer.width);
    const height = Math.max(1, layer.height);
    const seen = new Uint8Array(layer.data.length);

    for (let start = 0; start < layer.data.length && findings.length < maxFindings; start += 1) {
        const gid = layer.data[start] ?? 0;
        if (gid <= 0 || seen[start]) {
            continue;
        }
        const queue = [start];
        const component: number[] = [];
        seen[start] = 1;
        while (queue.length > 0) {
            const current = queue.pop();
            if (current === undefined) {
                continue;
            }
            component.push(current);
            const x = current % width;
            const y = Math.floor(current / width);
            const neighbors = [
                x > 0 ? current - 1 : -1,
                x + 1 < width ? current + 1 : -1,
                y > 0 ? current - width : -1,
                y + 1 < height ? current + width : -1,
            ];
            for (const next of neighbors) {
                if (next < 0 || next >= layer.data.length || seen[next] || layer.data[next] !== gid) {
                    continue;
                }
                seen[next] = 1;
                queue.push(next);
            }
        }
        if (component.length <= 2) {
            const index = component[0] ?? start;
            findings.push(
                finding({
                    id: 'TINY_SUSPICIOUS_PAINT_COMPONENT',
                    severity: 'medium',
                    category: 'terrain_paint',
                    title: 'Tiny suspicious paint component',
                    detail: 'A one- or two-tile paint island should be reviewed as possible accidental brush noise.',
                    location: { layerPath: layer.path, x: index % width, y: Math.floor(index / width), gid },
                    evidence: [`size=${component.length}`],
                })
            );
        }
    }
    return findings;
}

export function findWorldAuthoringFindings(worldRoot: UnknownRecord, worldPath = defaultWorld): TerrainAuthoringFinding[] {
    const findings: TerrainAuthoringFinding[] = [];
    const { tileLayers, objectLayers } = flattenLayers(worldRoot);

    const baseTerrainLayers = tileLayers.filter((layer) => /ground|grass|sand|mud|floor|cave|forest|maze/.test(layer.name));
    const paintedBaseTiles = baseTerrainLayers.reduce((count, layer) => count + layer.data.filter((gid) => gid > 0).length, 0);
    findings.push(
        finding({
            id: 'BASE_TERRAIN_FILL_COUNT',
            severity: 'info',
            category: 'terrain_paint',
            title: 'Base terrain fill count',
            detail: 'Counts painted base terrain tiles across current terrain-like layers.',
            location: { map: worldPath },
            evidence: [`layers=${baseTerrainLayers.length}`, `painted_tiles=${paintedBaseTiles}`],
        })
    );

    for (const layer of tileLayers.filter((entry) => entry.opacity < 1 || entry.className === 'Foreground').slice(0, 25)) {
        findings.push(
            finding({
                id: 'TRANSPARENT_OVERLAY_LAYER',
                severity: 'info',
                category: 'overlay_layering',
                title: 'Transparent or foreground overlay layer',
                detail: 'Overlay-like layers should be reviewed for bucket placement and foreground semantics.',
                location: { layerPath: layer.path },
                evidence: [`opacity=${layer.opacity}`, `class=${layer.className || '<none>'}`],
            })
        );
    }

    for (const layer of tileLayers.filter((entry) => /shoreline|boundaries|variations|river|lava|cliffs/.test(entry.name)).slice(0, 25)) {
        const sample = firstPaintedTile(layer);
        findings.push(
            finding({
                id: 'TERRAIN_TRANSITION_LAYER',
                severity: 'info',
                category: 'terrain_paint',
                title: 'Terrain transition layer',
                detail: 'Transition layers are inventoried for later Wang and terrain-family review.',
                location: { layerPath: layer.path, ...(sample ? { x: sample.x, y: sample.y, gid: sample.gid } : {}) },
                evidence: [`painted_tiles=${layer.data.filter((gid) => gid > 0).length}`],
            })
        );
    }

    for (const layer of tileLayers) {
        findings.push(...findTinyPaintComponents(layer, 3));
    }

    const paintedByCell = new Map<number, Array<{ layer: TileLayer; gid: number }>>();
    for (const layer of tileLayers) {
        for (let index = 0; index < layer.data.length; index += 1) {
            const gid = layer.data[index] ?? 0;
            if (gid <= 0) {
                continue;
            }
            const stack = paintedByCell.get(index) ?? [];
            stack.push({ layer, gid });
            paintedByCell.set(index, stack);
        }
    }
    let duplicateCount = 0;
    for (const [index, stack] of paintedByCell.entries()) {
        if (duplicateCount >= 25) {
            break;
        }
        for (let a = 0; a < stack.length; a += 1) {
            for (let b = a + 1; b < stack.length; b += 1) {
                const lower = stack[a];
                const higher = stack[b];
                if (!lower || lower.gid !== higher?.gid) {
                    continue;
                }
                duplicateCount += 1;
                findings.push(
                    finding({
                        id: 'DUPLICATE_FULLY_COVERED_PAINT',
                        severity: 'low',
                        category: 'terrain_paint',
                        title: 'Duplicate paint stack',
                        detail: 'The same gid appears in multiple layers at the same coordinate.',
                        location: { layerPath: higher.layer.path, x: index % Math.max(1, higher.layer.width), y: Math.floor(index / Math.max(1, higher.layer.width)), gid: higher.gid },
                        evidence: [`lower=${lower.layer.path}`, `higher=${higher.layer.path}`],
                    })
                );
            }
        }
    }

    for (const layer of tileLayers.filter((entry) => /foreground/.test(entry.name) && entry.className !== 'Foreground').slice(0, 25)) {
        findings.push(
            finding({
                id: 'FOREGROUND_MISBUCKET_CANDIDATE',
                severity: 'low',
                category: 'overlay_layering',
                title: 'Foreground-named layer lacks Foreground class',
                detail: 'Foreground render layers should use the explicit Foreground class.',
                location: { layerPath: layer.path },
                evidence: [`class=${layer.className || '<none>'}`],
            })
        );
    }

    for (const layer of tileLayers.filter((entry) => /water|river|lake|sea/.test(entry.path) && !/sea|shoreline|river|lakes|cave_river|forest_lakes/.test(entry.name)).slice(0, 25)) {
        findings.push(
            finding({
                id: 'WRONG_LAYER_TILE_CANDIDATE',
                severity: 'low',
                category: 'wrong_layer',
                title: 'Water-family path has unexpected leaf layer',
                detail: 'Layer naming suggests water content but the leaf name is outside the current water family.',
                location: { layerPath: layer.path },
                evidence: [`layer=${layer.name}`],
            })
        );
    }

    for (const objectLayer of objectLayers) {
        for (const object of objectLayer.objects.filter(isBlankTileObject).slice(0, 25)) {
            const pos = tileObjectGridPosition(object);
            findings.push(
                finding({
                    id: 'BLANK_TILE_OBJECT',
                    severity: 'medium',
                    category: 'tile_object',
                    title: 'Blank tile object',
                    detail: 'Renderable tile objects should have a class, type, template, name, or semantic properties.',
                    location: {
                        objectLayerPath: objectLayer.path,
                        objectId: asInteger(object.id) ?? undefined,
                        ...(pos ? { x: pos.x, y: pos.y, gid: pos.gid } : {}),
                    },
                    evidence: ['missing name/type/class/template/properties'],
                })
            );
        }
    }

    for (const objectLayer of objectLayers.filter((layer) => layer.name === 'doors')) {
        for (const object of objectLayer.objects) {
            const props = getProperties(object);
            const hasTargetMap = props.some((property) => asString(property.name) === 'target_map');
            const hasTargetDoor = props.some((property) => asString(property.name) === 'target_door');
            const hasPortalKind = props.some(
                (property) => asString(property.name) === 'door_kind' && asString(property.value)?.trim() === 'portal'
            );
            if (hasTargetMap !== hasTargetDoor || (asString(object.class) === 'Portal' && !hasPortalKind)) {
                findings.push(
                    finding({
                        id: 'DOOR_PORTAL_SEMANTIC_MISMATCH',
                        severity: 'high',
                        category: 'door_portal_gate',
                        title: 'Door, gate, or portal semantic mismatch',
                        detail: 'Door graph and portal semantics must be explicit and internally consistent.',
                        location: { objectLayerPath: objectLayer.path, objectId: asInteger(object.id) ?? undefined },
                        evidence: [`target_map=${hasTargetMap}`, `target_door=${hasTargetDoor}`, `portal_kind=${hasPortalKind}`],
                    })
                );
            }
        }
    }

    const objectLayerCounts = new Map(objectLayers.map((layer) => [layer.name, layer.objects.length]));
    for (const layerName of ['resource_nodes', 'static_entities', 'chest_spawns', 'chest_areas', 'roaming_areas', 'checkpoints']) {
        findings.push(
            finding({
                id: 'SPAWN_REGION_LAYER_COUNT',
                severity: 'info',
                category: 'spawn_region',
                title: 'Spawn and region layer inventory',
                detail: 'Gameplay object layer counts are included for authoring review.',
                location: { map: worldPath, objectLayerPath: layerName },
                evidence: [`objects=${objectLayerCounts.get(layerName) ?? 0}`],
            })
        );
    }
    findings.push(
        finding({
            id: 'MUSIC_REGION_LAYER_COUNT',
            severity: 'info',
            category: 'music_region',
            title: 'Music zone inventory',
            detail: 'Music zone counts are included for authoring review.',
            location: { map: worldPath, objectLayerPath: 'music_zones' },
            evidence: [`objects=${objectLayerCounts.get('music_zones') ?? 0}`],
        })
    );

    const blockingLayer = tileLayers.find((layer) => layer.name === 'blocking');
    findings.push(
        finding({
            id: 'COLLIDER_PASSABILITY_METADATA_GAP',
            severity: blockingLayer ? 'info' : 'medium',
            category: 'collision_passability',
            title: 'Collider and passability metadata inventory',
            detail: 'Records whether an authored blocking layer exists alongside tileset collision metadata.',
            location: { map: worldPath, layerPath: blockingLayer?.path },
            evidence: [`blocking_layer=${blockingLayer ? 'present' : 'missing'}`],
        })
    );

    return findings;
}

export function collectTerrainAuthoringFindings(
    worldRoot: UnknownRecord,
    tilesetRoot: UnknownRecord,
    paths: Readonly<{ world?: string; tileset?: string }> = {}
): TerrainAuthoringFinding[] {
    const world = paths.world ?? defaultWorld;
    const tileset = paths.tileset ?? defaultTileset;
    return [
        ...findMapPropertyFindings(worldRoot, world),
        ...findWangTilesetFindings(tilesetRoot, tileset),
        ...findWorldAuthoringFindings(worldRoot, world),
    ];
}

export function renderMarkdown(audit: TerrainAuthoringAudit): string {
    const lines = [
        '# Terrain Authoring Audit',
        '',
        `Generated: ${audit.generatedAt}`,
        `World: ${audit.world}`,
        `Tileset: ${audit.tileset}`,
        '',
        '## Summary',
        '',
        ...TERRAIN_AUTHORING_CATEGORIES.map((category) => `- ${category}: ${audit.summary[category]}`),
        '',
        '## Findings',
        '',
    ];
    for (const entry of audit.findings) {
        lines.push(`### ${entry.id}: ${entry.title}`);
        lines.push('');
        lines.push(`- Severity: ${entry.severity}`);
        lines.push(`- Category: ${entry.category}`);
        lines.push(`- Detail: ${entry.detail}`);
        lines.push(`- Location: \`${JSON.stringify(entry.location)}\``);
        lines.push(`- Evidence: ${entry.evidence.join('; ') || 'none'}`);
        lines.push('');
    }
    return `${lines.join('\n')}\n`;
}

export async function buildTerrainAuthoringAudit(options: {
    worldPath?: string;
    tilesetPath?: string;
    generatedAt?: string;
} = {}): Promise<TerrainAuthoringAudit> {
    const worldPath = path.resolve(process.cwd(), options.worldPath ?? defaultWorld);
    const tilesetPath = path.resolve(process.cwd(), options.tilesetPath ?? defaultTileset);
    const worldRoot = asRecord(JSON.parse(await readFile(worldPath, 'utf8')));
    const tilesetRoot = asRecord(JSON.parse(await readFile(tilesetPath, 'utf8')));
    if (!worldRoot || !tilesetRoot) {
        throw new Error('World and tileset roots must be JSON objects.');
    }
    const findings = collectTerrainAuthoringFindings(worldRoot, tilesetRoot, {
        world: rel(worldPath),
        tileset: rel(tilesetPath),
    });
    return {
        generatedAt: options.generatedAt ?? new Date().toISOString(),
        world: rel(worldPath),
        tileset: rel(tilesetPath),
        findings,
        summary: summarize(findings),
    };
}

function printUsage(): never {
    console.log('Usage: bun tools/content/terrain-authoring-audit.ts [--world <path>] [--tileset <path>] [--out-dir <path>]');
    process.exit(0);
}

async function main(): Promise<void> {
    const parsedArgs = parseCliArgs(
        process.argv.slice(2),
        [
            { key: 'world', kind: 'string', defaultValue: defaultWorld },
            { key: 'tileset', kind: 'string', defaultValue: defaultTileset },
            { key: 'out-dir', kind: 'string', defaultValue: defaultOutDir },
        ],
        { onHelp: printUsage }
    );

    const outDir = path.resolve(process.cwd(), String(parsedArgs['out-dir'] ?? defaultOutDir));
    const audit = await buildTerrainAuthoringAudit({
        worldPath: String(parsedArgs.world ?? defaultWorld),
        tilesetPath: String(parsedArgs.tileset ?? defaultTileset),
    });

    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, 'terrain-authoring-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
    await writeFile(path.join(outDir, 'terrain-authoring-audit.md'), renderMarkdown(audit));
    console.log(`Wrote ${path.relative(process.cwd(), outDir)}/terrain-authoring-audit.json`);
}

if (import.meta.main) {
    await main();
}
