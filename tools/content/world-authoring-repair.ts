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

type TileLayerTextSpan = Readonly<{
    path: string;
    objectStart: number;
    objectEnd: number;
    dataStart: number;
    dataEnd: number;
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

function findMatchingBrace(text: string, openIndex: number): number {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = openIndex; i < text.length; i += 1) {
        const char = text[i];
        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }
        if (char === '"') {
            inString = true;
            continue;
        }
        if (char === '{') {
            depth += 1;
            continue;
        }
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return i;
            }
        }
    }

    throw new Error(`No matching brace for object at byte ${openIndex}`);
}

function findDataArraySpan(objectText: string, objectStart: number): { dataStart: number; dataEnd: number } {
    const dataMatch = /"data"\s*:\s*\[/.exec(objectText);
    if (!dataMatch) {
        throw new Error(`Tile layer object at byte ${objectStart} has no data array.`);
    }
    const dataStart = objectStart + dataMatch.index + dataMatch[0].length;
    let depth = 1;
    let inString = false;
    let escaped = false;

    for (let i = dataStart; i < objectStart + objectText.length; i += 1) {
        const char = objectText[i - objectStart];
        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }
        if (char === '"') {
            inString = true;
            continue;
        }
        if (char === '[') {
            depth += 1;
            continue;
        }
        if (char === ']') {
            depth -= 1;
            if (depth === 0) {
                return { dataStart, dataEnd: i };
            }
        }
    }

    throw new Error(`Tile layer object at byte ${objectStart} has an unterminated data array.`);
}

function findTileLayerTextSpans(worldText: string, worldRoot: UnknownRecord): Map<string, TileLayerTextSpan> {
    const parsedLayers = flattenTileLayers(worldRoot);
    const spans = new Map<string, TileLayerTextSpan>();
    const tileTypePattern = /"type"\s*:\s*"tilelayer"/g;
    let match: RegExpExecArray | null;
    let parsedIndex = 0;

    while ((match = tileTypePattern.exec(worldText)) !== null) {
        let objectStart = worldText.lastIndexOf('{', match.index);
        while (objectStart >= 0) {
            const objectEnd = findMatchingBrace(worldText, objectStart);
            if (objectEnd >= match.index) {
                const objectText = worldText.slice(objectStart, objectEnd + 1);
                const object = JSON.parse(objectText) as unknown;
                const record = asRecord(object);
                if (record && asString(record.type) === 'tilelayer' && Array.isArray(record.data)) {
                    const parsedLayer = parsedLayers[parsedIndex];
                    if (!parsedLayer) {
                        throw new Error('World text has more tile layers than parsed world.');
                    }
                    const { dataStart, dataEnd } = findDataArraySpan(objectText, objectStart);
                    spans.set(parsedLayer.path, {
                        path: parsedLayer.path,
                        objectStart,
                        objectEnd,
                        dataStart,
                        dataEnd,
                    });
                    parsedIndex += 1;
                    tileTypePattern.lastIndex = objectEnd + 1;
                    break;
                }
            }
            objectStart = worldText.lastIndexOf('{', objectStart - 1);
        }
        if (objectStart < 0) {
            throw new Error(`Could not locate tile layer object around byte ${match.index}.`);
        }
    }

    if (parsedIndex !== parsedLayers.length) {
        throw new Error(`World text tile layer count ${parsedIndex} did not match parsed count ${parsedLayers.length}.`);
    }

    return spans;
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

function replacementForTileChange(change: RepairChange, layer: UnknownRecord): { index: number; before: number; after: number }[] {
    if (change.kind === 'remove_duplicate_covered_paint') {
        const x = change.x;
        const y = change.y;
        const width = asInteger(layer.width) ?? 0;
        const before = asInteger(change.before);
        const after = asInteger(change.after);
        if (x === undefined || y === undefined || width <= 0 || before === null || after === null) {
            throw new Error(`Invalid duplicate paint change for ${change.layerPath ?? '<unknown layer>'}`);
        }
        return [{ index: y * width + x, before, after }];
    }

    const before = Array.isArray(change.before) ? change.before : [];
    const after = Array.isArray(change.after) ? change.after : [];
    return before.map((entry, entryIndex) => {
        const beforeCell = asRecord(entry);
        const afterCell = asRecord(after[entryIndex]);
        const index = beforeCell ? asInteger(beforeCell.index) : null;
        const beforeGid = beforeCell ? asInteger(beforeCell.gid) : null;
        const afterGid = afterCell ? asInteger(afterCell.gid) : null;
        if (index === null || beforeGid === null || afterGid === null) {
            throw new Error(`Invalid tiny component change for ${change.layerPath ?? '<unknown layer>'}`);
        }
        return { index, before: beforeGid, after: afterGid };
    });
}

function findNumberToken(dataText: string, index: number): { start: number; end: number; value: number } {
    const tokenPattern = /-?\d+/g;
    let tokenIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = tokenPattern.exec(dataText)) !== null) {
        if (tokenIndex === index) {
            return {
                start: match.index,
                end: match.index + match[0].length,
                value: Number(match[0]),
            };
        }
        tokenIndex += 1;
    }
    throw new Error(`Could not find data token index ${index}.`);
}

export function applyRepairPlanToWorldText(worldText: string, worldRoot: UnknownRecord, plan: RepairPlan): string {
    const spans = findTileLayerTextSpans(worldText, worldRoot);
    const replacements: Array<{ start: number; end: number; value: string }> = [];

    for (const change of plan.changes) {
        if (change.kind === 'add_map_property') {
            throw new Error('Text-preserving write mode does not add map properties; add required map properties before write.');
        }
        if (change.kind !== 'remove_duplicate_covered_paint' && change.kind !== 'remove_accidental_tiny_component') {
            continue;
        }
        const layerPath = change.layerPath;
        if (!layerPath) {
            continue;
        }
        const layer = findTileLayerByPath(worldRoot, layerPath);
        const span = spans.get(layerPath);
        if (!layer || !span) {
            throw new Error(`Could not locate tile layer for text-preserving repair: ${layerPath}`);
        }
        const dataText = worldText.slice(span.dataStart, span.dataEnd);
        for (const replacement of replacementForTileChange(change, layer)) {
            const token = findNumberToken(dataText, replacement.index);
            if (token.value !== replacement.before) {
                throw new Error(
                    `Refusing repair for ${layerPath} cell ${replacement.index}: expected ${replacement.before}, found ${token.value}.`
                );
            }
            replacements.push({
                start: span.dataStart + token.start,
                end: span.dataStart + token.end,
                value: String(replacement.after),
            });
        }
    }

    const seen = new Set<string>();
    for (const replacement of replacements) {
        const key = `${replacement.start}:${replacement.end}`;
        if (seen.has(key)) {
            throw new Error(`Duplicate text replacement for byte range ${key}.`);
        }
        seen.add(key);
    }

    let nextText = worldText;
    for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
        nextText = `${nextText.slice(0, replacement.start)}${replacement.value}${nextText.slice(replacement.end)}`;
    }
    return nextText;
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
    const worldText = await readFile(worldPath, 'utf8');
    const worldRoot = JSON.parse(worldText) as UnknownRecord;
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
    await writeFile(worldPath, applyRepairPlanToWorldText(worldText, worldRoot, plan));
    console.log(`Wrote ${worldPath}`);
}

if (import.meta.main) {
    main().catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    });
}
