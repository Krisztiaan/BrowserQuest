export type TerrainAuthoringSeverity = 'error' | 'high' | 'medium' | 'low' | 'info';

export type TerrainAuthoringCategory =
    | 'map_properties'
    | 'wang_tileset'
    | 'terrain_paint'
    | 'overlay_layering'
    | 'wrong_layer'
    | 'tile_object'
    | 'door_portal_gate'
    | 'collision_passability'
    | 'spawn_region'
    | 'music_region'
    | 'asset_reference';

export const TERRAIN_AUTHORING_CATEGORIES: readonly TerrainAuthoringCategory[] = [
    'map_properties',
    'wang_tileset',
    'terrain_paint',
    'overlay_layering',
    'wrong_layer',
    'tile_object',
    'door_portal_gate',
    'collision_passability',
    'spawn_region',
    'music_region',
    'asset_reference',
] as const;

export type TerrainAuthoringLocation = Readonly<{
    map?: string;
    layerPath?: string;
    x?: number;
    y?: number;
    objectLayerPath?: string;
    objectId?: number;
    tileset?: string;
    tileId?: number;
    gid?: number;
}>;

export type TerrainAuthoringFinding = Readonly<{
    id: string;
    severity: TerrainAuthoringSeverity;
    category: TerrainAuthoringCategory;
    title: string;
    detail: string;
    location: TerrainAuthoringLocation;
    evidence: ReadonlyArray<string>;
}>;

export type TerrainAuthoringAudit = Readonly<{
    generatedAt: string;
    world: string;
    tileset: string;
    findings: ReadonlyArray<TerrainAuthoringFinding>;
    summary: Readonly<Record<TerrainAuthoringCategory, number>>;
}>;
