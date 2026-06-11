export const CANONICAL_LAYER_PREFIXES = [
    'render_world/terrain',
    'render_world/water',
    'render_world/roads',
    'render_world/floors',
    'render_world/walls',
    'render_world/structures',
    'render_world/props',
    'render_world/foreground',
    'collision',
    'gameplay_markup',
] as const;

export const LAYER_ROLE_VALUES = [
    'base',
    'transition',
    'hazard',
    'decal',
    'structure',
    'object_depth',
    'object_fixed',
    'foreground',
    'occluder',
    'lighting',
    'gameplay',
    'debug',
] as const;

export const COLLISION_SOURCE_VALUES = ['none', 'tile', 'object', 'explicit'] as const;

export const OCCLUSION_MODE_VALUES = ['none', 'always_front', 'fade', 'cutaway', 'hide'] as const;

export type LayerRole = typeof LAYER_ROLE_VALUES[number];
export type CollisionSource = typeof COLLISION_SOURCE_VALUES[number];
export type OcclusionMode = typeof OCCLUSION_MODE_VALUES[number];

export type SemanticLayerStructureRule = Readonly<{
    allowedTypes: readonly string[];
    allowedCollisionSources: readonly CollisionSource[];
    allowedOcclusionModes: readonly OcclusionMode[];
    requiredVisible?: boolean;
    requiredClass?: string;
}>;

export const REQUIRED_SEMANTIC_LAYER_PROPERTIES = [
    'layer_role',
    'collision_source',
    'occlusion',
    'material',
    'biome',
    'area_id',
] as const;

export const SEMANTIC_LAYER_ENUM_PROPERTY_TYPES = {
    layer_role: 'LayerRole',
    collision_source: 'CollisionSource',
    occlusion: 'OcclusionMode',
} as const;

export const SEMANTIC_LAYER_STRUCTURE_RULES: Record<LayerRole, SemanticLayerStructureRule> = {
    base: {
        allowedTypes: ['tilelayer'],
        allowedCollisionSources: ['tile'],
        allowedOcclusionModes: ['none'],
        requiredVisible: true,
    },
    transition: {
        allowedTypes: ['tilelayer'],
        allowedCollisionSources: ['tile'],
        allowedOcclusionModes: ['none'],
        requiredVisible: true,
    },
    hazard: {
        allowedTypes: ['tilelayer'],
        allowedCollisionSources: ['tile'],
        allowedOcclusionModes: ['none'],
        requiredVisible: true,
    },
    decal: {
        allowedTypes: ['tilelayer'],
        allowedCollisionSources: ['none'],
        allowedOcclusionModes: ['none'],
        requiredVisible: true,
    },
    structure: {
        allowedTypes: ['tilelayer'],
        allowedCollisionSources: ['tile'],
        allowedOcclusionModes: ['none'],
        requiredVisible: true,
    },
    object_depth: {
        allowedTypes: ['objectgroup'],
        allowedCollisionSources: ['object'],
        allowedOcclusionModes: ['none'],
        requiredVisible: true,
        requiredClass: 'DepthSorted',
    },
    object_fixed: {
        allowedTypes: ['tilelayer', 'objectgroup'],
        allowedCollisionSources: ['none', 'tile', 'object'],
        allowedOcclusionModes: ['none'],
        requiredVisible: true,
    },
    foreground: {
        allowedTypes: ['tilelayer', 'objectgroup'],
        allowedCollisionSources: ['none'],
        allowedOcclusionModes: ['always_front'],
        requiredVisible: true,
        requiredClass: 'Foreground',
    },
    occluder: {
        allowedTypes: ['tilelayer', 'objectgroup'],
        allowedCollisionSources: ['none', 'tile', 'object'],
        allowedOcclusionModes: ['fade', 'cutaway', 'hide'],
        requiredVisible: true,
    },
    lighting: {
        allowedTypes: ['tilelayer', 'imagelayer', 'objectgroup'],
        allowedCollisionSources: ['none'],
        allowedOcclusionModes: ['none'],
        requiredVisible: true,
    },
    gameplay: {
        allowedTypes: ['objectgroup'],
        allowedCollisionSources: ['none'],
        allowedOcclusionModes: ['none'],
        requiredVisible: false,
    },
    debug: {
        allowedTypes: ['tilelayer', 'objectgroup', 'imagelayer'],
        allowedCollisionSources: ['none'],
        allowedOcclusionModes: ['none'],
        requiredVisible: false,
    },
};

export const SEMANTIC_LAYER_PHASE_ORDER: Record<LayerRole, number> = {
    base: 0,
    transition: 0,
    hazard: 0,
    decal: 0,
    structure: 0,
    object_depth: 0,
    object_fixed: 0,
    foreground: 1,
    occluder: 1,
    lighting: 1,
    gameplay: 2,
    debug: 2,
};

const LAYER_ROLE_SET = new Set<string>(LAYER_ROLE_VALUES);
const COLLISION_SOURCE_SET = new Set<string>(COLLISION_SOURCE_VALUES);
const OCCLUSION_MODE_SET = new Set<string>(OCCLUSION_MODE_VALUES);

export const CURRENT_CANONICAL_LAYER_PATHS = [
    'render_world/beach_biome/sand',
    'render_world/beach_biome/shoreline',
    'render_world/beach_biome/sea',
    'render_world/beach_biome/beach_props',
    'render_world/village_biome/ground',
    'render_world/village_biome/ground_variations',
    'render_world/village_biome/mud',
    'render_world/village_biome/grass',
    'render_world/village_biome/stone',
    'render_world/village_biome/grass_variations',
    'render_world/village_biome/lakes',
    'render_world/village_biome/village_boundaries',
    'render_world/village_biome/river',
    'render_world/village_biome/houses',
    'render_world/deadlands_biome/dry_ground',
    'render_world/deadlands_biome/big_rocks',
    'render_world/deadlands_biome/graveyard_mud',
    'render_world/deadlands_biome/dead_grass',
    'render_world/deadlands_biome/dead_leaves',
    'render_world/deadlands_biome/graveyard',
    'render_world/deadlands_biome/dead_trees',
    'render_world/deadlands_biome/camps',
    'render_world/deadlands_biome/bones',
    'render_world/badlands_biome/lava',
    'render_world/badlands_biome/canyon',
    'render_world/badlands_biome/cliffs',
    'render_world/badlands_biome/totems',
    'render_world/badlands_biome/cactus',
    'render_world/badlands_biome/lava_falls',
    'render_world/badlands_biome/lava_boundaries',
    'render_world/subterranean_region/cave',
    'render_world/subterranean_region/trees',
    'render_world/subterranean_region/cave_river',
    'render_world/subterranean_region/cave_walls',
    'render_world/subterranean_region/indoor',
    'render_world/subterranean_region/indoor_walls',
    'render_world/subterranean_region/indoor_doors',
    'render_world/subterranean_region/carpets',
    'render_world/subterranean_region/indoor_props',
    'render_world/forest_region/forest_paths',
    'render_world/forest_region/forest',
    'render_world/forest_region/forest_lakes',
    'render_world/forest_region/forest_boundaries',
    'render_world/forest_region/forest_trees',
    'render_world/forest_region/bridge_shadows',
    'render_world/forest_region/bridge',
    'render_world/forest_region/forest_props',
    'render_world/forest_region/maze_floor',
    'render_world/forest_region/maze_walls',
] as const;

export const LEGACY_LAYER_PATH_ALLOWLIST = [
    'render_world/village_biome/village_boundaries_level_2',
    'render_world/deadlands_biome/dry_ground_2',
    'render_world/badlands_biome/cliffs_2',
    'render_world/foreground_overlays',
    'render_world/foreground_overlays/cliffs_foreground',
    'render_world/foreground_overlays/cave_walls_foreground',
    'render_world/foreground_overlays/indoor_doors_foreground',
    'render_world/foreground_overlays/bridge_shadows_foreground',
    'render_world/foreground_overlays/maze_walls_foreground',
] as const;

export function isKnownLayerPath(path: string): boolean {
    return (
        CANONICAL_LAYER_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
        || (CURRENT_CANONICAL_LAYER_PATHS as readonly string[]).includes(path)
        || (LEGACY_LAYER_PATH_ALLOWLIST as readonly string[]).includes(path)
    );
}

export function isLayerRole(value: string): value is typeof LAYER_ROLE_VALUES[number] {
    return LAYER_ROLE_SET.has(value);
}

export function isCollisionSource(value: string): value is typeof COLLISION_SOURCE_VALUES[number] {
    return COLLISION_SOURCE_SET.has(value);
}

export function isOcclusionMode(value: string): value is typeof OCCLUSION_MODE_VALUES[number] {
    return OCCLUSION_MODE_SET.has(value);
}

export function getSemanticLayerStructureRule(role: LayerRole): SemanticLayerStructureRule {
    return SEMANTIC_LAYER_STRUCTURE_RULES[role];
}

export function getSemanticLayerPhaseOrder(role: LayerRole): number {
    return SEMANTIC_LAYER_PHASE_ORDER[role];
}
