import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type UnknownRecord = Record<string, unknown>;

type TerrainGrammar = Readonly<{
    mapPropertiesRequired: readonly string[];
    families: readonly Readonly<{ id: string }>[];
    transitionPairs: readonly Readonly<{ id: string; requiredShapes: readonly string[] }>[];
    layerRoles: Readonly<Record<string, readonly string[]>>;
}>;

export type TerrainGrammarReport = Readonly<{
    missingMapProperties: readonly string[];
    missingFamiliesUsedByMap: readonly string[];
    missingTransitionShapes: readonly { pair: string; shape: string }[];
    wrongLayerRoleSamples: readonly { layerPath: string; tileId: number; expectedRoles: readonly string[] }[];
}>;

const defaultGrammar = 'assets/maps/tiled/terrain-authoring.json';
const defaultWorld = 'assets/maps/tiled/world.json';
const defaultTileset = 'assets/maps/tiled/tilesheet.wang.tsj';
const defaultOut = 'artifacts/map-authoring/terrain-grammar-report.json';

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

function stringArray(value: unknown): string[] {
    return asArray(value)
        .map((entry) => asString(entry))
        .filter((entry): entry is string => entry !== null);
}

function parseGrammar(value: unknown): TerrainGrammar {
    const root = asRecord(value);
    if (!root) {
        throw new Error('Terrain grammar must be a JSON object.');
    }
    return {
        mapPropertiesRequired: stringArray(root.mapPropertiesRequired),
        families: asArray(root.families)
            .map((entry) => asRecord(entry))
            .filter((entry): entry is UnknownRecord => entry !== null)
            .map((entry) => ({ id: asString(entry.id) ?? '' }))
            .filter((entry) => entry.id.length > 0),
        transitionPairs: asArray(root.transitionPairs)
            .map((entry) => asRecord(entry))
            .filter((entry): entry is UnknownRecord => entry !== null)
            .map((entry) => ({ id: asString(entry.id) ?? '', requiredShapes: stringArray(entry.requiredShapes) }))
            .filter((entry) => entry.id.length > 0),
        layerRoles: Object.fromEntries(
            Object.entries(asRecord(root.layerRoles) ?? {}).map(([role, entries]) => [role, stringArray(entries)])
        ),
    };
}

function propertyNames(record: UnknownRecord): Set<string> {
    return new Set(
        asArray(record.properties)
            .map((entry) => asRecord(entry))
            .filter((entry): entry is UnknownRecord => entry !== null)
            .map((entry) => asString(entry.name))
            .filter((entry): entry is string => entry !== null && entry.trim().length > 0)
    );
}

function flattenLayerLeaves(root: UnknownRecord): Array<{ path: string; name: string; firstGid: number }> {
    const leaves: Array<{ path: string; name: string; firstGid: number }> = [];

    function walk(entries: unknown[], trail: string[]): void {
        for (const raw of entries) {
            const layer = asRecord(raw);
            if (!layer) {
                continue;
            }
            const name = asString(layer.name) ?? '<unnamed>';
            const nextTrail = [...trail, name];
            const type = asString(layer.type);
            if (type === 'group') {
                walk(asArray(layer.layers), nextTrail);
                continue;
            }
            let firstGid = 0;
            if (type === 'tilelayer') {
                for (const gid of asArray(layer.data).map((entry) => asInteger(entry) ?? 0)) {
                    if (gid > 0) {
                        firstGid = gid;
                        break;
                    }
                }
            }
            leaves.push({ path: nextTrail.join('/'), name, firstGid });
        }
    }

    walk(asArray(root.layers), []);
    return leaves;
}

function transitionShapeTags(tilesetRoot: UnknownRecord): Set<string> {
    const tags = new Set<string>();
    for (const tile of asArray(tilesetRoot.tiles)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null)) {
        const properties = propertyNames(tile);
        const propertyRecords = asArray(tile.properties)
            .map((entry) => asRecord(entry))
            .filter((entry): entry is UnknownRecord => entry !== null);
        const pair = propertyRecords.find((entry) => asString(entry.name) === 'terrain_pair');
        const shape = propertyRecords.find((entry) => asString(entry.name) === 'transition_shape');
        const pairValue = asString(pair?.value);
        const shapeValue = asString(shape?.value);
        if (pairValue && shapeValue) {
            tags.add(`${pairValue}:${shapeValue}`);
        }
        for (const name of properties) {
            const [prefix, pairName, shapeName] = name.split(':');
            if (prefix === 'terrain_shape' && pairName && shapeName) {
                tags.add(`${pairName}:${shapeName}`);
            }
        }
    }
    return tags;
}

function expectedRolesForLayer(layerName: string, grammar: TerrainGrammar): string[] {
    const roles: string[] = [];
    for (const [role, names] of Object.entries(grammar.layerRoles)) {
        if (names.includes(layerName)) {
            roles.push(role);
        }
    }
    return roles;
}

function inferFamilyFromLayer(layerName: string): string {
    if (/sea|river|lake|shoreline/.test(layerName)) {
        return 'water';
    }
    if (/lava/.test(layerName)) {
        return 'lava';
    }
    if (/forest/.test(layerName)) {
        return 'forest';
    }
    if (/cave/.test(layerName)) {
        return 'cave';
    }
    if (/indoor|carpet/.test(layerName)) {
        return 'indoor';
    }
    if (/maze/.test(layerName)) {
        return 'maze';
    }
    if (/sand|shoreline|beach/.test(layerName)) {
        return 'sand';
    }
    if (/mud|soil|ground_variations/.test(layerName)) {
        return 'soil';
    }
    if (/dead|graveyard|bone/.test(layerName)) {
        return 'deadlands';
    }
    if (/canyon|cliff|totem|cactus/.test(layerName)) {
        return 'badlands';
    }
    if (/stone|wall|bridge/.test(layerName)) {
        return 'stone';
    }
    if (/prop|tree|house|camp/.test(layerName)) {
        return 'props';
    }
    return 'grass';
}

export function validateTerrainGrammar({
    grammar,
    world,
    tileset,
}: {
    grammar: unknown;
    world: unknown;
    tileset: unknown;
}): TerrainGrammarReport {
    const parsedGrammar = parseGrammar(grammar);
    const worldRoot = asRecord(world);
    const tilesetRoot = asRecord(tileset);
    if (!worldRoot || !tilesetRoot) {
        throw new Error('World and tileset inputs must be JSON objects.');
    }

    const mapProperties = propertyNames(worldRoot);
    const missingMapProperties = parsedGrammar.mapPropertiesRequired.filter((name) => !mapProperties.has(name));
    const familyIds = new Set(parsedGrammar.families.map((family) => family.id));
    const leaves = flattenLayerLeaves(worldRoot);
    const usedFamilies = new Set(leaves.map((layer) => inferFamilyFromLayer(layer.name)));
    const missingFamiliesUsedByMap = [...usedFamilies].filter((family) => !familyIds.has(family)).sort();
    const tags = transitionShapeTags(tilesetRoot);
    const missingTransitionShapes = parsedGrammar.transitionPairs.flatMap((pair) =>
        pair.requiredShapes
            .filter((shape) => !tags.has(`${pair.id}:${shape}`))
            .map((shape) => ({ pair: pair.id, shape }))
    );
    const wrongLayerRoleSamples = leaves
        .filter((layer) => expectedRolesForLayer(layer.name, parsedGrammar).length === 0)
        .slice(0, 50)
        .map((layer) => ({
            layerPath: layer.path,
            tileId: Math.max(0, layer.firstGid - 1),
            expectedRoles: Object.keys(parsedGrammar.layerRoles),
        }));

    return {
        missingMapProperties,
        missingFamiliesUsedByMap,
        missingTransitionShapes,
        wrongLayerRoleSamples,
    };
}

async function main(): Promise<void> {
    const [grammar, world, tileset] = await Promise.all([
        readFile(path.resolve(process.cwd(), defaultGrammar), 'utf8').then((text) => JSON.parse(text) as unknown),
        readFile(path.resolve(process.cwd(), defaultWorld), 'utf8').then((text) => JSON.parse(text) as unknown),
        readFile(path.resolve(process.cwd(), defaultTileset), 'utf8').then((text) => JSON.parse(text) as unknown),
    ]);
    const report = validateTerrainGrammar({ grammar, world, tileset });
    const outPath = path.resolve(process.cwd(), defaultOut);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);
}

if (import.meta.main) {
    await main();
}
