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
