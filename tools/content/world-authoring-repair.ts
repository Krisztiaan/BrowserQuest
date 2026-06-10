import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

export type RepairKind =
    | 'remove_duplicate_covered_paint'
    | 'remove_accidental_tiny_component'
    | 'normalize_door_portal_semantics'
    | 'normalize_target_map'
    | 'add_map_property';

export type RepairChange = Readonly<{
    kind: RepairKind;
    confidence: 'high';
    layerPath?: string;
    x?: number;
    y?: number;
    objectLayerPath?: string;
    objectId?: number;
    before: unknown;
    after: unknown;
    reason: string;
}>;

export type RepairPlan = Readonly<{
    generatedAt: string;
    world: string;
    write: boolean;
    changes: ReadonlyArray<RepairChange>;
    summary: Readonly<Record<RepairKind, number>>;
}>;

type TileLayerRef = Readonly<{
    path: string;
    parentPath: string;
    layer: UnknownRecord;
    width: number;
    height: number;
    data: number[];
    className: string;
    opacity: number;
    renderOrder: number;
}>;

export const defaultWorld = 'assets/maps/tiled/world.json';
export const defaultGrammar = 'assets/maps/tiled/terrain-authoring.json';
export const defaultOutDir = 'artifacts/map-authoring';
export const repairPlanJson = 'world-authoring-repair-plan.json';
export const repairPlanMarkdown = 'world-authoring-repair-plan.md';

const repairKinds: readonly RepairKind[] = [
    'remove_duplicate_covered_paint',
    'remove_accidental_tiny_component',
    'normalize_door_portal_semantics',
    'normalize_target_map',
    'add_map_property',
];

function asRecord(value: unknown): UnknownRecord | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : null;
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

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function typedTileData(layer: UnknownRecord): number[] | null {
    const data = layer.data;
    if (!Array.isArray(data)) {
        return null;
    }
    return data.map((entry) => asInteger(entry) ?? 0);
}

function flattenTileLayers(root: UnknownRecord): TileLayerRef[] {
    const tileLayers: TileLayerRef[] = [];

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
            if (type !== 'tilelayer') {
                continue;
            }
            const data = typedTileData(layer);
            if (!data) {
                continue;
            }
            tileLayers.push({
                path: layerPath,
                parentPath: trail.join('/'),
                layer,
                width: asInteger(layer.width) ?? 0,
                height: asInteger(layer.height) ?? 0,
                data,
                className: asString(layer.class) ?? '',
                opacity: isNumber(layer.opacity) ? layer.opacity : 1,
                renderOrder: tileLayers.length,
            });
        }
    }

    walk(asArray(root.layers), []);
    return tileLayers;
}

function isRepairableRenderLayer(layer: TileLayerRef): boolean {
    return layer.path.startsWith('render_world/') && layer.className !== 'Foreground' && layer.opacity >= 1;
}

function getProperties(record: UnknownRecord): UnknownRecord[] {
    return asArray(record.properties)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
}

function getGrammarRequiredProperties(grammar: UnknownRecord): string[] {
    return asArray(grammar.mapPropertiesRequired)
        .map((entry) => asString(entry))
        .filter((entry): entry is string => entry !== null && entry.trim().length > 0);
}

function defaultMapProperty(name: string, grammar: UnknownRecord): UnknownRecord {
    if (name === 'map_id') {
        return { name, type: 'string', value: 'world' };
    }
    if (name === 'authoring_version') {
        return { name, type: 'int', value: asInteger(grammar.version) ?? 1 };
    }
    if (name === 'default_music') {
        return { name, type: 'string', value: 'world' };
    }
    if (name === 'default_biome') {
        return { name, type: 'string', value: 'mixed' };
    }
    return { name, type: 'string', value: 'todo' };
}

function cellLocation(layer: TileLayerRef, index: number): { x: number; y: number } {
    const width = Math.max(1, layer.width);
    return { x: index % width, y: Math.floor(index / width) };
}

function summarizePlan(changes: ReadonlyArray<RepairChange>): Record<RepairKind, number> {
    const summary = Object.fromEntries(repairKinds.map((kind) => [kind, 0])) as Record<RepairKind, number>;
    for (const change of changes) {
        summary[change.kind] += 1;
    }
    return summary;
}

function findMapPropertyChanges(worldRoot: UnknownRecord, grammarRoot: UnknownRecord): RepairChange[] {
    const properties = getProperties(worldRoot);
    const existing = new Set(properties.map((property) => asString(property.name)).filter((name): name is string => name !== null));
    const changes: RepairChange[] = [];

    for (const name of getGrammarRequiredProperties(grammarRoot)) {
        if (existing.has(name)) {
            continue;
        }
        changes.push({
            kind: 'add_map_property',
            confidence: 'high',
            before: null,
            after: defaultMapProperty(name, grammarRoot),
            reason: `Add required terrain-authoring map property "${name}" with conservative value.`,
        });
    }

    return changes;
}

function findDuplicateCoveredPaintChanges(layers: readonly TileLayerRef[]): RepairChange[] {
    const changes: RepairChange[] = [];
    const renderLayers = layers.filter(isRepairableRenderLayer);
    const topByCell = new Map<number, { layer: TileLayerRef; gid: number }>();

    for (const layer of renderLayers) {
        for (let index = 0; index < layer.data.length; index += 1) {
            const gid = layer.data[index] ?? 0;
            if (gid <= 0) {
                continue;
            }
            const higher = topByCell.get(index);
            if (higher?.gid === gid && higher.layer.parentPath === layer.parentPath) {
                const { x, y } = cellLocation(higher.layer, index);
                changes.push({
                    kind: 'remove_duplicate_covered_paint',
                    confidence: 'high',
                    layerPath: higher.layer.path,
                    x,
                    y,
                    before: gid,
                    after: 0,
                    reason: `Clear duplicate lower paint because ${layer.path} paints the same gid later at this cell.`,
                });
            }
            topByCell.set(index, { layer, gid });
        }
    }

    return changes;
}

function componentCells(layer: TileLayerRef, start: number, seen: Uint8Array): number[] {
    const gid = layer.data[start] ?? 0;
    const width = Math.max(1, layer.width);
    const height = Math.max(1, layer.height);
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

    return component;
}

function isCoveredByHigherRenderLayer(layer: TileLayerRef, index: number, layers: readonly TileLayerRef[]): boolean {
    const gid = layer.data[index] ?? 0;
    return layers.some((candidate) => {
        if (
            !isRepairableRenderLayer(candidate)
            || candidate.renderOrder <= layer.renderOrder
            || candidate.parentPath !== layer.parentPath
        ) {
            return false;
        }
        return candidate.data[index] === gid;
    });
}

function findTinyCoveredComponentChanges(layers: readonly TileLayerRef[]): RepairChange[] {
    const changes: RepairChange[] = [];
    const renderLayers = layers.filter(isRepairableRenderLayer);

    for (const layer of renderLayers) {
        const seen = new Uint8Array(layer.data.length);
        for (let start = 0; start < layer.data.length; start += 1) {
            const gid = layer.data[start] ?? 0;
            if (gid <= 0 || seen[start]) {
                continue;
            }
            const cells = componentCells(layer, start, seen);
            if (cells.length > 2 || !cells.every((index) => isCoveredByHigherRenderLayer(layer, index, renderLayers))) {
                continue;
            }
            const { x, y } = cellLocation(layer, cells[0] ?? start);
            changes.push({
                kind: 'remove_accidental_tiny_component',
                confidence: 'high',
                layerPath: layer.path,
                x,
                y,
                before: cells.map((index) => ({ index, gid: layer.data[index] ?? 0 })),
                after: cells.map((index) => ({ index, gid: 0 })),
                reason: `Clear ${cells.length}-tile component because every tile is covered by the same gid in a later sibling render layer.`,
            });
        }
    }

    return changes;
}

export function createRepairPlan({
    world,
    grammar,
    worldPath = defaultWorld,
    write = false,
    generatedAt = new Date().toISOString(),
}: {
    world: UnknownRecord;
    grammar: UnknownRecord;
    worldPath?: string;
    write?: boolean;
    generatedAt?: string;
}): RepairPlan {
    const tileLayers = flattenTileLayers(world);
    const duplicateChanges = findDuplicateCoveredPaintChanges(tileLayers);
    const duplicateCells = new Set(
        duplicateChanges.map((change) => `${change.layerPath ?? ''}:${change.x ?? -1}:${change.y ?? -1}`)
    );
    const tinyChanges = findTinyCoveredComponentChanges(tileLayers).filter((change) => {
        return !duplicateCells.has(`${change.layerPath ?? ''}:${change.x ?? -1}:${change.y ?? -1}`);
    });
    const changes = [
        ...findMapPropertyChanges(world, grammar),
        ...duplicateChanges,
        ...tinyChanges,
    ];

    return {
        generatedAt,
        world: worldPath,
        write,
        changes,
        summary: summarizePlan(changes),
    };
}

function findTileLayerByPath(root: UnknownRecord, layerPath: string): UnknownRecord | null {
    const parts = layerPath.split('/');

    function walk(entries: unknown[], depth: number): UnknownRecord | null {
        for (const entry of entries) {
            const layer = asRecord(entry);
            if (!layer || asString(layer.name) !== parts[depth]) {
                continue;
            }
            if (depth === parts.length - 1) {
                return layer;
            }
            return walk(asArray(layer.layers), depth + 1);
        }
        return null;
    }

    return walk(asArray(root.layers), 0);
}

export function applyRepairPlan(worldRoot: UnknownRecord, plan: RepairPlan): void {
    const properties = getProperties(worldRoot);
    const propertyNames = new Set(properties.map((property) => asString(property.name)).filter((name): name is string => name !== null));

    for (const change of plan.changes) {
        if (change.kind === 'add_map_property') {
            const property = asRecord(change.after);
            const name = property ? asString(property.name) : null;
            if (!property || !name || propertyNames.has(name)) {
                continue;
            }
            const nextProperties = Array.isArray(worldRoot.properties) ? worldRoot.properties : [];
            nextProperties.push({ ...property });
            worldRoot.properties = nextProperties;
            propertyNames.add(name);
            continue;
        }

        if (change.kind !== 'remove_duplicate_covered_paint' && change.kind !== 'remove_accidental_tiny_component') {
            continue;
        }

        const layerPath = change.layerPath;
        if (!layerPath) {
            continue;
        }
        const layer = findTileLayerByPath(worldRoot, layerPath);
        if (!layer || !Array.isArray(layer.data)) {
            continue;
        }
        if (change.kind === 'remove_duplicate_covered_paint') {
            const x = change.x;
            const y = change.y;
            const width = asInteger(layer.width) ?? 0;
            if (x === undefined || y === undefined || width <= 0) {
                continue;
            }
            layer.data[y * width + x] = 0;
            continue;
        }
        const before = Array.isArray(change.before) ? change.before : [];
        for (const entry of before) {
            const cell = asRecord(entry);
            const index = cell ? asInteger(cell.index) : null;
            if (index === null || index < 0 || index >= layer.data.length) {
                continue;
            }
            layer.data[index] = 0;
        }
    }
}

export function renderRepairPlanMarkdown(plan: RepairPlan): string {
    const lines = [
        '# World Authoring Repair Plan',
        '',
        `Generated: ${plan.generatedAt}`,
        `World: \`${plan.world}\``,
        `Mode: ${plan.write ? 'write' : 'dry-run'}`,
        '',
        '## Summary',
        '',
        '| Kind | Count |',
        '| --- | ---: |',
    ];

    for (const kind of repairKinds) {
        lines.push(`| ${kind} | ${plan.summary[kind]} |`);
    }

    lines.push('', '## Changes', '');
    if (plan.changes.length === 0) {
        lines.push('No high-confidence repairs are currently planned.', '');
        return lines.join('\n');
    }

    for (const [index, change] of plan.changes.entries()) {
        const location = [
            change.layerPath ? `layer=${change.layerPath}` : null,
            change.objectLayerPath ? `object_layer=${change.objectLayerPath}` : null,
            change.objectId !== undefined ? `object_id=${change.objectId}` : null,
            change.x !== undefined && change.y !== undefined ? `cell=${change.x},${change.y}` : null,
        ]
            .filter((entry): entry is string => entry !== null)
            .join('; ');
        lines.push(`${index + 1}. ${change.kind}`);
        lines.push(`   - confidence: ${change.confidence}`);
        lines.push(`   - location: ${location || 'map'}`);
        lines.push(`   - reason: ${change.reason}`);
    }
    lines.push('');

    return lines.join('\n');
}

async function readJsonFile(filePath: string): Promise<UnknownRecord> {
    const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
    const record = asRecord(parsed);
    if (!record) {
        throw new Error(`Expected JSON object: ${filePath}`);
    }
    return record;
}

async function assertCleanTargetForWrite(worldPath: string): Promise<void> {
    const proc = Bun.spawn(['git', 'status', '--short', '--', worldPath], { stdout: 'pipe' });
    const status = (await new Response(proc.stdout).text()).trim();
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
        throw new Error(`git status failed with exit code ${exitCode}`);
    }
    if (status.length > 0) {
        throw new Error(`Refusing --write because ${worldPath} has unstaged or uncommitted changes:\n${status}`);
    }
}

async function writePlanFiles(plan: RepairPlan, outDir: string): Promise<void> {
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, repairPlanJson), `${JSON.stringify(plan, null, 2)}\n`);
    await writeFile(path.join(outDir, repairPlanMarkdown), renderRepairPlanMarkdown(plan));
}

function printHelp(): never {
    console.log('Usage: bun tools/content/world-authoring-repair.ts [--world <path>] [--grammar <path>] [--out-dir <path>] [--write]');
    process.exit(0);
}

export async function main(argv = Bun.argv.slice(2)): Promise<void> {
    const args = parseCliArgs(
        argv,
        [
            { key: 'world', kind: 'string', defaultValue: defaultWorld },
            { key: 'grammar', kind: 'string', defaultValue: defaultGrammar },
            { key: 'out-dir', kind: 'string', defaultValue: defaultOutDir },
            { key: 'write', kind: 'boolean', defaultValue: false },
        ],
        { onHelp: printHelp }
    );

    const worldPath = String(args.world);
    const grammarPath = String(args.grammar);
    const outDir = String(args['out-dir']);
    const write = args.write === true;
    const worldRoot = await readJsonFile(worldPath);
    const grammarRoot = await readJsonFile(grammarPath);
    const plan = createRepairPlan({ world: worldRoot, grammar: grammarRoot, worldPath, write });

    await writePlanFiles(plan, outDir);
    console.log(`Wrote ${path.join(outDir, repairPlanJson)}`);
    console.log(`Wrote ${path.join(outDir, repairPlanMarkdown)}`);
    console.log(`Planned high-confidence repairs: ${plan.changes.length}`);

    if (!write) {
        console.log('Dry run only; pass --write to modify world.json.');
        return;
    }

    await assertCleanTargetForWrite(worldPath);
    applyRepairPlan(worldRoot, plan);
    await writeFile(worldPath, `${JSON.stringify(worldRoot, null, 2)}\n`);
    console.log(`Wrote ${worldPath}`);
}

if (import.meta.main) {
    main().catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    });
}
