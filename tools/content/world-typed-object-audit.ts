import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

type TypePlacement = Readonly<{
    typeName: string;
    x: number;
    y: number;
    layerPath: string;
    sourceKind: 'tilelayer' | 'objectlayer';
}>;

type TypeComponent = Readonly<{
    typeName: string;
    tileDefCount: number;
    size: number;
    layers: readonly string[];
    coords: readonly string[];
}>;

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
    return typeof value === 'string' ? value : null;
}

function asInteger(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function rel(filePath: string): string {
    return path.relative(process.cwd(), filePath).split(path.sep).join('/');
}

function printUsage(): never {
    console.log('Usage: bun tools/content/world-typed-object-audit.ts [--map <path>] [--tileset <path>] [--json]');
    process.exit(0);
}

function resolveTilesetFirstGid(root: UnknownRecord, tilesetSource: string): number {
    const tilesets = asArray(root.tilesets)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
    const match = tilesets.find((entry) => asString(entry.source) === tilesetSource);
    return asInteger(match?.firstgid) ?? 1;
}

function buildTypeMaps(tilesetRoot: UnknownRecord): {
    typeByTileId: Map<number, string>;
    tileCountByType: Map<string, number>;
} {
    const typeByTileId = new Map<number, string>();
    const tileCountByType = new Map<string, number>();
    for (const entry of asArray(tilesetRoot.tiles)) {
        const tile = asRecord(entry);
        if (!tile) {
            continue;
        }
        const id = asInteger(tile.id);
        const typeName = asString(tile.type)?.trim();
        if (id === null || !typeName) {
            continue;
        }
        typeByTileId.set(id, typeName);
        tileCountByType.set(typeName, (tileCountByType.get(typeName) ?? 0) + 1);
    }
    return { typeByTileId, tileCountByType };
}

function collectPlacements(root: UnknownRecord, firstgid: number, typeByTileId: ReadonlyMap<number, string>): TypePlacement[] {
    const placements: TypePlacement[] = [];

    function walk(entries: unknown[], trail: string[]): void {
        for (const entry of entries) {
            const layer = asRecord(entry);
            if (!layer) {
                continue;
            }
            const name = asString(layer.name) ?? '(unnamed)';
            const nextTrail = [...trail, name];
            const layerPath = nextTrail.join('/');
            const type = asString(layer.type) ?? '';
            if (type === 'group') {
                walk(asArray(layer.layers), nextTrail);
                continue;
            }
            if (layer.visible === false) {
                continue;
            }

            if (type === 'tilelayer') {
                const width = asInteger(layer.width);
                if (width === null) {
                    continue;
                }
                const data = asArray(layer.data).map((value) => asInteger(value) ?? 0);
                for (let index = 0; index < data.length; index += 1) {
                    const gid = data[index] ?? 0;
                    if (gid <= 0) {
                        continue;
                    }
                    const typeName = typeByTileId.get(gid - firstgid);
                    if (!typeName) {
                        continue;
                    }
                    placements.push({
                        typeName,
                        x: index % width,
                        y: Math.floor(index / width),
                        layerPath,
                        sourceKind: 'tilelayer',
                    });
                }
                continue;
            }

            if (type === 'objectgroup') {
                for (const rawObject of asArray(layer.objects)) {
                    const objectRecord = asRecord(rawObject);
                    if (!objectRecord) {
                        continue;
                    }
                    const gid = asInteger(objectRecord.gid) ?? 0;
                    if (gid <= 0) {
                        continue;
                    }
                    const typeName = typeByTileId.get(gid - firstgid);
                    if (!typeName) {
                        continue;
                    }
                    const x = typeof objectRecord.x === 'number' ? objectRecord.x : null;
                    const y = typeof objectRecord.y === 'number' ? objectRecord.y : null;
                    if (x === null || y === null) {
                        continue;
                    }
                    placements.push({
                        typeName,
                        x: Math.round(x / 16),
                        y: Math.round((y - 16) / 16),
                        layerPath,
                        sourceKind: 'objectlayer',
                    });
                }
            }
        }
    }

    walk(asArray(root.layers), []);
    return placements;
}

function buildComponents(placements: readonly TypePlacement[], tileCountByType: ReadonlyMap<string, number>): Map<string, TypeComponent[]> {
    const byType = new Map<string, TypePlacement[]>();
    for (const placement of placements) {
        const list = byType.get(placement.typeName);
        if (list) {
            list.push(placement);
        } else {
            byType.set(placement.typeName, [placement]);
        }
    }

    const componentsByType = new Map<string, TypeComponent[]>();
    for (const [typeName, list] of byType.entries()) {
        const visited = new Set<string>();
        const components: TypeComponent[] = [];
        for (const placement of list) {
            const key = `${placement.x},${placement.y},${placement.layerPath}`;
            if (visited.has(key)) {
                continue;
            }
            const queue = [placement];
            visited.add(key);
            const component: TypePlacement[] = [];
            while (queue.length > 0) {
                const current = queue.pop();
                if (!current) {
                    continue;
                }
                component.push(current);
                for (const candidate of list) {
                    const candidateKey = `${candidate.x},${candidate.y},${candidate.layerPath}`;
                    if (visited.has(candidateKey)) {
                        continue;
                    }
                    const dx = Math.abs(candidate.x - current.x);
                    const dy = Math.abs(candidate.y - current.y);
                    if (dx + dy === 1 || (dx === 0 && dy === 0 && candidate.layerPath !== current.layerPath)) {
                        visited.add(candidateKey);
                        queue.push(candidate);
                    }
                }
            }

            components.push({
                typeName,
                tileDefCount: tileCountByType.get(typeName) ?? 0,
                size: component.length,
                layers: [...new Set(component.map((entry) => entry.layerPath))],
                coords: component
                    .map((entry) => `${entry.x},${entry.y}@${entry.layerPath.split('/').slice(-1)[0]}`)
                    .sort(),
            });
        }
        componentsByType.set(typeName, components);
    }

    return componentsByType;
}

async function main(): Promise<void> {
    const args = parseCliArgs(
        process.argv.slice(2),
        [
            { key: 'map', kind: 'string', defaultValue: 'assets/maps/tiled/world.json' },
            { key: 'tileset', kind: 'string', defaultValue: 'assets/maps/tiled/tilesheet.wang.tsj' },
            { key: 'json', kind: 'boolean', defaultValue: false },
        ],
        { onHelp: printUsage }
    );

    const mapPath = path.resolve(process.cwd(), String(args.map ?? 'assets/maps/tiled/world.json'));
    const tilesetPath = path.resolve(process.cwd(), String(args.tileset ?? 'assets/maps/tiled/tilesheet.wang.tsj'));
    const mapRoot = asRecord(JSON.parse(await fs.readFile(mapPath, 'utf8')));
    const tilesetRoot = asRecord(JSON.parse(await fs.readFile(tilesetPath, 'utf8')));
    if (!mapRoot || !tilesetRoot) {
        fail('Invalid map or tileset JSON.');
    }

    const tilesetSource = path.relative(path.dirname(mapPath), tilesetPath).split(path.sep).join('/');
    const firstgid = resolveTilesetFirstGid(mapRoot, tilesetSource);
    const { typeByTileId, tileCountByType } = buildTypeMaps(tilesetRoot);
    const placements = collectPlacements(mapRoot, firstgid, typeByTileId);
    const componentsByType = buildComponents(placements, tileCountByType);

    const splitAcrossLayers: TypeComponent[] = [];
    const incompleteStable: TypeComponent[] = [];

    for (const [typeName, components] of componentsByType.entries()) {
        const tileDefCount = tileCountByType.get(typeName) ?? 0;
        const exactCount = components.filter((entry) => entry.size === tileDefCount).length;
        for (const component of components) {
            if (component.layers.length > 1) {
                splitAcrossLayers.push(component);
            }
        }
        if (tileDefCount > 0 && exactCount >= Math.max(2, components.length - 1)) {
            for (const component of components) {
                if (component.size < tileDefCount) {
                    incompleteStable.push(component);
                }
            }
        }
    }

    if (args.json) {
        console.log(
            JSON.stringify(
                {
                    map: rel(mapPath),
                    tileset: rel(tilesetPath),
                    typedTileFamilies: tileCountByType.size,
                    splitAcrossLayers,
                    incompleteStable,
                },
                null,
                2
            )
        );
        return;
    }

    console.log(`Typed object audit for ${rel(mapPath)} using ${rel(tilesetPath)}`);
    console.log(`Typed tile families: ${tileCountByType.size}`);
    console.log(`Cross-layer instances: ${splitAcrossLayers.length}`);
    console.log(`Incomplete stable instances: ${incompleteStable.length}`);

    if (splitAcrossLayers.length > 0) {
        console.log('\nCross-layer instances:');
        for (const component of splitAcrossLayers) {
            console.log(
                `- ${component.typeName}: size=${component.size}/${component.tileDefCount}; layers=${component.layers.join(', ')}; coords=${component.coords.join(' ')}`
            );
        }
    }

    if (incompleteStable.length > 0) {
        console.log('\nIncomplete stable instances:');
        for (const component of incompleteStable) {
            console.log(
                `- ${component.typeName}: size=${component.size}/${component.tileDefCount}; layers=${component.layers.join(', ')}; coords=${component.coords.join(' ')}`
            );
        }
    }
}

void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
