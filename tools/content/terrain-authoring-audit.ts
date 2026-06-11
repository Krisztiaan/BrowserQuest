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
export const defaultGrammar = 'assets/maps/tiled/terrain-authoring.json';
export const defaultOutDir = 'artifacts/map-authoring';
export const minimumMixedTransitionsForPair = 16;
export const mostlyPureRatio = 0.9;

type TerrainFamilyMeta = Readonly<{
    id: string;
    kind: string;
    passability: string;
}>;

const requiredCollisionShapeProperties = ['collision_kind', 'blocks_player', 'blocks_mobs', 'blocks_projectiles'] as const;
const blockingCollisionKinds = new Set(['solid', 'water', 'hazard', 'ledge']);
const requiredSemanticTileProperties = ['asset_family', 'asset_part', 'tile_kind', 'occlusion_kind', 'render_height'] as const;
const semanticTileClasses: ReadonlyMap<string, string> = new Map([
    ['PropTile', 'prop'],
    ['StructureTile', 'structure'],
    ['TransitionTile', 'transition'],
] as const);
const semanticTileExtraProperties: ReadonlyMap<string, readonly string[]> = new Map([['TransitionTile', ['transition_kind']]] as const);

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

function getPropertyValue(record: UnknownRecord, propertyName: string): unknown {
    return getProperties(record).find((property) => asString(property.name) === propertyName)?.value;
}

function parseTerrainFamilies(grammarRoot: UnknownRecord | null | undefined): Map<string, TerrainFamilyMeta> {
    const families = new Map<string, TerrainFamilyMeta>();
    if (!grammarRoot) {
        return families;
    }
    for (const entry of asArray(grammarRoot.families)) {
        const family = asRecord(entry);
        if (!family) {
            continue;
        }
        const id = asString(family.id)?.trim();
        const kind = asString(family.kind)?.trim();
        const passability = asString(family.passability)?.trim();
        if (!id || !kind || !passability) {
            continue;
        }
        families.set(id, { id, kind, passability });
    }
    return families;
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

export function findWangTilesetFindings(
    tilesetRoot: UnknownRecord,
    tilesetPath = defaultTileset,
    grammarRoot?: UnknownRecord | null
): TerrainAuthoringFinding[] {
    const findings: TerrainAuthoringFinding[] = [];
    const terrainFamilies = parseTerrainFamilies(grammarRoot);
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
        for (const color of colors) {
            const colorName = asString(color.name)?.trim() ?? '<unnamed_color>';
            const material = asString(getPropertyValue(color, 'material'))?.trim();
            const terrainFamily = asString(getPropertyValue(color, 'terrain_family'))?.trim();
            const terrainKind = asString(getPropertyValue(color, 'terrain_kind'))?.trim();
            const passability = asString(getPropertyValue(color, 'passability'))?.trim();
            const missing = [
                ['material', material],
                ['terrain_family', terrainFamily],
                ['terrain_kind', terrainKind],
                ['passability', passability],
            ]
                .filter(([, value]) => !value)
                .map(([propertyName]) => propertyName);
            if (missing.length > 0) {
                findings.push(
                    finding({
                        id: 'WANG_COLOR_METADATA_MISSING',
                        severity: 'medium',
                        category: 'wang_tileset',
                        title: 'Wang color lacks terrain metadata',
                        detail: 'Every Wang color should declare material, terrain family, terrain kind, and passability so terrain brushes carry semantic truth.',
                        location: { tileset: tilesetPath },
                        evidence: [`set=${name}`, `color=${colorName}`, `missing=${missing.join(',')}`],
                    })
                );
                continue;
            }
            const family = terrainFamilies.get(terrainFamily ?? '');
            if (!family && terrainFamilies.size > 0) {
                findings.push(
                    finding({
                        id: 'WANG_COLOR_FAMILY_UNKNOWN',
                        severity: 'high',
                        category: 'wang_tileset',
                        title: 'Wang color references unknown terrain family',
                        detail: 'Wang color terrain_family must match a family declared in terrain-authoring.json.',
                        location: { tileset: tilesetPath },
                        evidence: [`set=${name}`, `color=${colorName}`, `terrain_family=${terrainFamily ?? '<missing>'}`],
                    })
                );
                continue;
            }
            if (family && (terrainKind !== family.kind || passability !== family.passability)) {
                findings.push(
                    finding({
                        id: 'WANG_COLOR_METADATA_MISMATCH',
                        severity: 'medium',
                        category: 'wang_tileset',
                        title: 'Wang color terrain metadata disagrees with grammar',
                        detail: 'Wang color terrain_kind/passability should mirror its declared terrain family.',
                        location: { tileset: tilesetPath },
                        evidence: [
                            `set=${name}`,
                            `color=${colorName}`,
                            `terrain_family=${terrainFamily}`,
                            `terrain_kind=${terrainKind}`,
                            `expected_kind=${family.kind}`,
                            `passability=${passability}`,
                            `expected_passability=${family.passability}`,
                        ],
                    })
                );
            }
        }
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

export function findTilesetCollisionShapeFindings(tilesetRoot: UnknownRecord, tilesetPath = defaultTileset): TerrainAuthoringFinding[] {
    const findings: TerrainAuthoringFinding[] = [];
    for (const tile of asArray(tilesetRoot.tiles)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null)) {
        const tileId = asInteger(tile.id);
        const tileProps = getProperties(tile);
        const isPassableTile = tileProps.some((property) => asString(property.name) === 'passable' && property.value === true);
        const objects = asArray(asRecord(tile.objectgroup)?.objects)
            .map((entry) => asRecord(entry))
            .filter((entry): entry is UnknownRecord => entry !== null);
        for (const object of objects) {
            const objectId = asInteger(object.id);
            const props = new Map(getProperties(object).map((property) => [asString(property.name), property]));
            const collisionKind = asString(props.get('collision_kind')?.value)?.trim();
            const missing = requiredCollisionShapeProperties.filter((propertyName) => !props.has(propertyName));
            if (asString(object.class) !== 'CollisionShape' || missing.length > 0 || !collisionKind) {
                findings.push(
                    finding({
                        id: 'COLLISION_SHAPE_METADATA_MISSING',
                        severity: 'medium',
                        category: 'collision_passability',
                        title: 'Tileset collision shape lacks semantic metadata',
                        detail: 'Every tileset collision object should use class CollisionShape and declare collision kind plus blocking booleans.',
                        location: { tileset: tilesetPath, tileId: tileId ?? undefined, objectId: objectId ?? undefined },
                        evidence: [
                            `class=${asString(object.class) ?? '<none>'}`,
                            `collision_kind=${collisionKind ?? '<missing>'}`,
                            `missing=${missing.join(',') || '<none>'}`,
                        ],
                    })
                );
                continue;
            }
            const collisionKindProperty = props.get('collision_kind');
            if (asString(collisionKindProperty?.propertytype) !== 'CollisionKind') {
                findings.push(
                    finding({
                        id: 'COLLISION_SHAPE_KIND_UNTYPED',
                        severity: 'medium',
                        category: 'collision_passability',
                        title: 'Tileset collision kind is not typed',
                        detail: 'collision_kind should be backed by the Tiled CollisionKind enum so invalid shape semantics are not free-form strings.',
                        location: { tileset: tilesetPath, tileId: tileId ?? undefined, objectId: objectId ?? undefined },
                        evidence: [`propertytype=${asString(collisionKindProperty?.propertytype) ?? '<none>'}`],
                    })
                );
            }
            const shouldBlock = !isPassableTile && blockingCollisionKinds.has(collisionKind);
            const mismatchedBlocks = ['blocks_player', 'blocks_mobs', 'blocks_projectiles'].filter(
                (propertyName) => props.get(propertyName)?.value !== shouldBlock
            );
            if (mismatchedBlocks.length > 0) {
                findings.push(
                    finding({
                        id: 'COLLISION_SHAPE_BLOCKING_MISMATCH',
                        severity: 'medium',
                        category: 'collision_passability',
                        title: 'Tileset collision shape blocking flags disagree with tile passability',
                        detail: 'Blocking flags should mirror the current runtime rule: passable tiles carve collision, other collision shapes block.',
                        location: { tileset: tilesetPath, tileId: tileId ?? undefined, objectId: objectId ?? undefined },
                        evidence: [
                            `collision_kind=${collisionKind}`,
                            `tile_passable=${isPassableTile}`,
                            `expected_blocks=${shouldBlock}`,
                            `mismatch=${mismatchedBlocks.join(',')}`,
                        ],
                    })
                );
            }
        }
    }
    return findings;
}

export function findTilesetTileSemanticFindings(tilesetRoot: UnknownRecord, tilesetPath = defaultTileset): TerrainAuthoringFinding[] {
    const findings: TerrainAuthoringFinding[] = [];
    for (const tile of asArray(tilesetRoot.tiles)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null)) {
        const tileClass = asString(tile.class);
        const expectedTileKind = tileClass ? semanticTileClasses.get(tileClass) : undefined;
        if (!tileClass || !expectedTileKind) {
            continue;
        }
        const semanticTileClass: string = tileClass;
        const tileId = asInteger(tile.id);
        const legacyType = asString(tile.type)?.trim();
        const props = new Map(getProperties(tile).map((property) => [asString(property.name), property]));
        const requiredProperties = [...requiredSemanticTileProperties, ...(semanticTileExtraProperties.get(semanticTileClass) ?? [])];
        const missing = requiredProperties.filter((propertyName) => !props.has(propertyName));
        const assetFamily = asString(props.get('asset_family')?.value)?.trim();
        const assetPart = asString(props.get('asset_part')?.value)?.trim();
        const tileKind = asString(props.get('tile_kind')?.value)?.trim();
        const occlusionKind = asString(props.get('occlusion_kind')?.value)?.trim();
        const transitionKind = asString(props.get('transition_kind')?.value)?.trim();
        const renderHeight = asInteger(props.get('render_height')?.value);
        if (missing.length > 0 || !assetFamily || !assetPart || !tileKind || !occlusionKind || renderHeight === null) {
            findings.push(
                finding({
                    id: 'TILE_SEMANTIC_METADATA_MISSING',
                    severity: 'medium',
                    category: 'asset_reference',
                    title: 'Tile lacks semantic metadata',
                    detail: 'Semantic tile records should declare asset family, asset part, typed tile kind, typed occlusion kind, and render height.',
                    location: { tileset: tilesetPath, tileId: tileId ?? undefined },
                    evidence: [
                        `class=${tileClass}`,
                        `missing=${missing.join(',') || '<none>'}`,
                        `asset_family=${assetFamily ?? '<missing>'}`,
                        `asset_part=${assetPart ?? '<missing>'}`,
                        `tile_kind=${tileKind ?? '<missing>'}`,
                        `occlusion_kind=${occlusionKind ?? '<missing>'}`,
                        `transition_kind=${transitionKind ?? '<missing>'}`,
                        `render_height=${renderHeight ?? '<missing>'}`,
                    ],
                })
            );
            continue;
        }
        if (legacyType && assetFamily !== legacyType) {
            findings.push(
                finding({
                    id: 'TILE_SEMANTIC_ASSET_FAMILY_MISMATCH',
                    severity: 'medium',
                    category: 'asset_reference',
                    title: 'Tile asset family disagrees with legacy tile type',
                    detail: 'During migration, asset_family should preserve the existing Tiled tile type so runtime/editor references remain traceable.',
                    location: { tileset: tilesetPath, tileId: tileId ?? undefined },
                    evidence: [`class=${tileClass}`, `type=${legacyType}`, `asset_family=${assetFamily}`],
                })
            );
        }
        const tileKindProperty = props.get('tile_kind');
        const occlusionKindProperty = props.get('occlusion_kind');
        const transitionKindProperty = props.get('transition_kind');
        const transitionKindUntyped = semanticTileClass === 'TransitionTile' && asString(transitionKindProperty?.propertytype) !== 'TransitionKind';
        if (
            asString(tileKindProperty?.propertytype) !== 'TileKind' ||
            asString(occlusionKindProperty?.propertytype) !== 'TileOcclusionKind' ||
            transitionKindUntyped
        ) {
            findings.push(
                finding({
                    id: 'TILE_SEMANTIC_ENUM_UNTYPED',
                    severity: 'medium',
                    category: 'asset_reference',
                    title: 'Tile semantic enum is not typed',
                    detail: 'Semantic tile enums should be backed by Tiled enum property types, not free-form strings.',
                    location: { tileset: tilesetPath, tileId: tileId ?? undefined },
                    evidence: [
                        `class=${tileClass}`,
                        `tile_kind_propertytype=${asString(tileKindProperty?.propertytype) ?? '<none>'}`,
                        `occlusion_kind_propertytype=${asString(occlusionKindProperty?.propertytype) ?? '<none>'}`,
                        `transition_kind_propertytype=${asString(transitionKindProperty?.propertytype) ?? '<none>'}`,
                    ],
                })
            );
        }
        if (tileKind !== expectedTileKind) {
            findings.push(
                finding({
                    id: 'TILE_SEMANTIC_KIND_MISMATCH',
                    severity: 'medium',
                    category: 'asset_reference',
                    title: 'Tile kind disagrees with semantic tile class',
                    detail: 'Semantic tile classes should carry the matching tile_kind value so class and property contracts stay aligned.',
                    location: { tileset: tilesetPath, tileId: tileId ?? undefined },
                    evidence: [`class=${tileClass}`, `tile_kind=${tileKind}`, `expected=${expectedTileKind}`],
                })
            );
        }
        if (renderHeight < 0) {
            findings.push(
                finding({
                    id: 'TILE_SEMANTIC_RENDER_HEIGHT_INVALID',
                    severity: 'medium',
                    category: 'asset_reference',
                    title: 'Tile render height is invalid',
                    detail: 'render_height should be a non-negative integer measured in rows above the prop base.',
                    location: { tileset: tilesetPath, tileId: tileId ?? undefined },
                    evidence: [`class=${tileClass}`, `render_height=${renderHeight}`],
                })
            );
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
    grammarRoot?: UnknownRecord | null,
    paths: Readonly<{ world?: string; tileset?: string }> = {}
): TerrainAuthoringFinding[] {
    const world = paths.world ?? defaultWorld;
    const tileset = paths.tileset ?? defaultTileset;
    return [
        ...findMapPropertyFindings(worldRoot, world),
        ...findWangTilesetFindings(tilesetRoot, tileset, grammarRoot),
        ...findTilesetCollisionShapeFindings(tilesetRoot, tileset),
        ...findTilesetTileSemanticFindings(tilesetRoot, tileset),
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
    while (lines.at(-1) === '') {
        lines.pop();
    }
    return `${lines.join('\n')}\n`;
}

export async function buildTerrainAuthoringAudit(options: {
    worldPath?: string;
    tilesetPath?: string;
    grammarPath?: string;
    generatedAt?: string;
} = {}): Promise<TerrainAuthoringAudit> {
    const worldPath = path.resolve(process.cwd(), options.worldPath ?? defaultWorld);
    const tilesetPath = path.resolve(process.cwd(), options.tilesetPath ?? defaultTileset);
    const grammarPath = path.resolve(process.cwd(), options.grammarPath ?? defaultGrammar);
    const worldRoot = asRecord(JSON.parse(await readFile(worldPath, 'utf8')));
    const tilesetRoot = asRecord(JSON.parse(await readFile(tilesetPath, 'utf8')));
    const grammarRoot = asRecord(JSON.parse(await readFile(grammarPath, 'utf8')));
    if (!worldRoot || !tilesetRoot || !grammarRoot) {
        throw new Error('World, tileset, and grammar roots must be JSON objects.');
    }
    const findings = collectTerrainAuthoringFindings(worldRoot, tilesetRoot, grammarRoot, {
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
    console.log('Usage: bun tools/content/terrain-authoring-audit.ts [--world <path>] [--tileset <path>] [--grammar <path>] [--out-dir <path>]');
    process.exit(0);
}

async function main(): Promise<void> {
    const parsedArgs = parseCliArgs(
        process.argv.slice(2),
        [
            { key: 'world', kind: 'string', defaultValue: defaultWorld },
            { key: 'tileset', kind: 'string', defaultValue: defaultTileset },
            { key: 'grammar', kind: 'string', defaultValue: defaultGrammar },
            { key: 'out-dir', kind: 'string', defaultValue: defaultOutDir },
        ],
        { onHelp: printUsage }
    );

    const outDir = path.resolve(process.cwd(), String(parsedArgs['out-dir'] ?? defaultOutDir));
    const audit = await buildTerrainAuthoringAudit({
        worldPath: String(parsedArgs.world ?? defaultWorld),
        tilesetPath: String(parsedArgs.tileset ?? defaultTileset),
        grammarPath: String(parsedArgs.grammar ?? defaultGrammar),
    });

    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, 'terrain-authoring-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
    await writeFile(path.join(outDir, 'terrain-authoring-audit.md'), renderMarkdown(audit));
    console.log(`Wrote ${path.relative(process.cwd(), outDir)}/terrain-authoring-audit.json`);
}

if (import.meta.main) {
    await main();
}
