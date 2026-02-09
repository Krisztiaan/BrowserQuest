import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type TiledLayer = {
    type?: string;
    name?: string;
    data?: number[];
};

type TiledTileset = {
    name?: string;
    columns?: number;
    image?: string;
    imageheight?: number;
    imagewidth?: number;
    margin?: number;
    spacing?: number;
    tilecount?: number;
    tileheight?: number;
    tilewidth?: number;
    tiles?: unknown[];
    firstgid?: number;
};

type TiledMap = {
    layers?: TiledLayer[];
    tiledversion?: string;
    version?: string;
    tilesets?: TiledTileset[];
};

type TerrainKey =
    | "water"
    | "sand"
    | "soil"
    | "grass"
    | "forest"
    | "rock"
    | "lava"
    | "cave";

const GLOBAL_TILE_ID_MASK = 0x1fffffff;
const TILESET_NAME = "tilesheet";

const TERRAIN_LAYER_MAP: Record<string, TerrainKey> = {
    sand: "sand",
    "sand objects": "sand",
    ground: "soil",
    groundvariations: "soil",
    mud: "soil",
    dryground: "soil",
    dryground2: "soil",
    "graveyard mud": "soil",
    "dead grass": "soil",
    "dead leaves": "soil",
    grass: "grass",
    grassvariations: "grass",
    forest: "forest",
    "forest paths": "forest",
    "forest lakes": "forest",
    water: "water",
    lakes: "water",
    river: "water",
    sea: "water",
    caveriver: "water",
    stone: "rock",
    "small rocks": "rock",
    "Big Rocks": "rock",
    canyon: "rock",
    Cliffs: "rock",
    "Cliffs 2": "rock",
    mase: "rock",
    "mase walls": "rock",
    lava: "lava",
    lavafalls: "lava",
    "lava boundaries": "lava",
    cave: "cave",
    cavewalls: "cave",
};

const TERRAIN_COLORS: Record<TerrainKey, string> = {
    water: "#2f7ecf",
    sand: "#dbc07a",
    soil: "#8b6b4a",
    grass: "#67b347",
    forest: "#2d7a3e",
    rock: "#8d8e95",
    lava: "#db4a2a",
    cave: "#55586d",
};

const TERRAIN_ORDER: TerrainKey[] = ["water", "sand", "soil", "grass", "forest", "rock", "lava", "cave"];

const RULES_FILE_TEMPLATE = [
    "# BrowserQuest Tiled Automapping rules",
    "#",
    "# This file is intentionally scaffold-only for now.",
    "# Add one rule map path per line (relative to this file), e.g.:",
    "# rules/terrain-forest.tmj",
    "",
].join("\n");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultSourcePath = path.join(scriptDir, "tiled/world.json");
const defaultTilesetOutputPath = path.join(scriptDir, "tiled/tilesheet.wang.tsj");
const defaultRulesPath = path.join(scriptDir, "tiled/automapping.rules");

function normalizeGid(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return 0;
    }
    return value & GLOBAL_TILE_ID_MASK;
}

function stableStringify(value: unknown): string {
    return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeIfChanged(filePath: string, nextContent: string): Promise<boolean> {
    let current = "";
    try {
        current = await fs.readFile(filePath, "utf8");
    } catch (_) {
        current = "";
    }

    if (current === nextContent) {
        return false;
    }

    await fs.writeFile(filePath, nextContent, "utf8");
    return true;
}

function buildWangArtifacts(map: TiledMap) {
    const tileset = (map.tilesets || []).find((entry) => entry.name === TILESET_NAME);
    if (!tileset) {
        throw new Error(`Unable to find tileset "${TILESET_NAME}" in map source.`);
    }

    const firstGid = Number.isFinite(tileset.firstgid) ? (tileset.firstgid as number) : 1;
    const tileCount = Number.isFinite(tileset.tilecount) ? (tileset.tilecount as number) : 0;
    if (tileCount <= 0) {
        throw new Error(`Tileset "${TILESET_NAME}" does not expose a valid tilecount.`);
    }

    const terrainUsageByTile = new Map<number, Map<TerrainKey, number>>();

    for (const layer of map.layers || []) {
        if (layer.type !== "tilelayer") {
            continue;
        }

        const terrainKey = layer.name ? TERRAIN_LAYER_MAP[layer.name] : undefined;
        if (!terrainKey || !Array.isArray(layer.data)) {
            continue;
        }

        for (const value of layer.data) {
            const gid = normalizeGid(value);
            if (gid <= 0) {
                continue;
            }

            const localTileId = gid - firstGid;
            if (localTileId < 0 || localTileId >= tileCount) {
                continue;
            }

            const usage = terrainUsageByTile.get(localTileId) || new Map<TerrainKey, number>();
            usage.set(terrainKey, (usage.get(terrainKey) || 0) + 1);
            terrainUsageByTile.set(localTileId, usage);
        }
    }

    const winnerByTileId = new Map<number, TerrainKey>();
    for (const [tileId, usage] of terrainUsageByTile.entries()) {
        let bestTerrain: TerrainKey | null = null;
        let bestCount = -1;

        for (const terrainKey of TERRAIN_ORDER) {
            const count = usage.get(terrainKey) || 0;
            if (count > bestCount) {
                bestCount = count;
                bestTerrain = terrainKey;
            }
        }

        if (bestTerrain) {
            winnerByTileId.set(tileId, bestTerrain);
        }
    }

    const usedTerrains = TERRAIN_ORDER.filter((terrainKey) =>
        Array.from(winnerByTileId.values()).includes(terrainKey)
    );
    const terrainColorIndex = new Map<TerrainKey, number>();
    usedTerrains.forEach((terrainKey, index) => terrainColorIndex.set(terrainKey, index + 1));

    const representativeTileByTerrain = new Map<TerrainKey, number>();
    for (const [tileId, terrainKey] of Array.from(winnerByTileId.entries()).sort((a, b) => a[0] - b[0])) {
        if (!representativeTileByTerrain.has(terrainKey)) {
            representativeTileByTerrain.set(terrainKey, tileId);
        }
    }

    const wangtiles = Array.from(winnerByTileId.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([tileid, terrainKey]) => {
            const wangColorIndex = terrainColorIndex.get(terrainKey) || 0;
            return {
                tileid,
                wangid: Array.from({ length: 8 }, () => wangColorIndex),
            };
        });

    const colors = usedTerrains.map((terrainKey) => ({
        class: "",
        color: TERRAIN_COLORS[terrainKey],
        name: terrainKey,
        probability: 1,
        properties: [],
        tile: representativeTileByTerrain.get(terrainKey) ?? -1,
    }));

    const fallbackTile = colors.length > 0 ? colors[0].tile : 0;

    const wangsets = [
        {
            class: "",
            colors,
            name: "browserquest-terrain",
            properties: [],
            tile: fallbackTile,
            type: "corner",
            wangtiles,
        },
    ];

    const tilesetDocument = {
        columns: tileset.columns ?? 0,
        image: tileset.image ?? "",
        imageheight: tileset.imageheight ?? 0,
        imagewidth: tileset.imagewidth ?? 0,
        margin: tileset.margin ?? 0,
        name: `${TILESET_NAME}-wang`,
        spacing: tileset.spacing ?? 0,
        tilecount: tileset.tilecount ?? 0,
        tiledversion: map.tiledversion ?? "1.11.2",
        tileheight: tileset.tileheight ?? 0,
        tiles: Array.isArray(tileset.tiles) ? tileset.tiles : [],
        tilewidth: tileset.tilewidth ?? 0,
        type: "tileset",
        version: map.version ?? "1.11",
        wangsets,
    };

    return {
        tilesetDocument,
        wangTileCount: wangtiles.length,
        terrainCount: colors.length,
    };
}

export async function syncWangsetArtifacts(options?: {
    sourcePath?: string;
    tilesetOutputPath?: string;
    rulesPath?: string;
    checkOnly?: boolean;
    quiet?: boolean;
}): Promise<{ changed: boolean; wangTileCount: number; terrainCount: number }> {
    const sourcePath = options?.sourcePath || defaultSourcePath;
    const tilesetOutputPath = options?.tilesetOutputPath || defaultTilesetOutputPath;
    const rulesPath = options?.rulesPath || defaultRulesPath;
    const checkOnly = options?.checkOnly === true;
    const quiet = options?.quiet === true;

    const mapRaw = await fs.readFile(sourcePath, "utf8");
    const map = JSON.parse(mapRaw) as TiledMap;
    const artifacts = buildWangArtifacts(map);

    const tilesetContent = stableStringify(artifacts.tilesetDocument);
    const rulesContent = RULES_FILE_TEMPLATE;

    const [currentTileset, currentRules] = await Promise.all([
        fs.readFile(tilesetOutputPath, "utf8").catch(() => ""),
        fs.readFile(rulesPath, "utf8").catch(() => ""),
    ]);

    const tilesetDrift = currentTileset !== tilesetContent;
    const rulesDrift = currentRules !== rulesContent;
    const drifted = tilesetDrift || rulesDrift;

    if (checkOnly) {
        if (drifted) {
            const driftedFiles = [
                ...(tilesetDrift ? [tilesetOutputPath] : []),
                ...(rulesDrift ? [rulesPath] : []),
            ];
            throw new Error(
                `map-wang-sync-check: artifacts out of sync:\n - ${driftedFiles.join(
                    "\n - "
                )}\nRun \`bun run map:wang:sync\` to regenerate terrain wang artifacts.`
            );
        }
        if (!quiet) {
            console.log(
                `map-wang-sync-check: ok (${artifacts.wangTileCount} wang tiles across ${artifacts.terrainCount} terrain colors).`
            );
        }
        return {
            changed: false,
            wangTileCount: artifacts.wangTileCount,
            terrainCount: artifacts.terrainCount,
        };
    }

    await fs.mkdir(path.dirname(tilesetOutputPath), { recursive: true });
    await fs.mkdir(path.dirname(rulesPath), { recursive: true });

    const [tilesetChanged, rulesChanged] = await Promise.all([
        writeIfChanged(tilesetOutputPath, tilesetContent),
        writeIfChanged(rulesPath, rulesContent),
    ]);

    if (!quiet) {
        console.log(
            `map:wang:sync ${tilesetChanged || rulesChanged ? "updated" : "up-to-date"} (${artifacts.wangTileCount} wang tiles, ${artifacts.terrainCount} terrain colors).`
        );
    }

    return {
        changed: tilesetChanged || rulesChanged,
        wangTileCount: artifacts.wangTileCount,
        terrainCount: artifacts.terrainCount,
    };
}

if (import.meta.main) {
    const checkOnly = Bun.argv.includes("--check");
    syncWangsetArtifacts({ checkOnly })
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            console.error(message);
            process.exit(1);
        });
}
