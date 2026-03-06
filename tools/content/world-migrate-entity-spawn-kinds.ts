import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

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

function toRelative(filePath: string): string {
    return path.relative(process.cwd(), filePath).split(path.sep).join('/');
}

function propertyList(record: UnknownRecord): UnknownRecord[] {
    return asArray(record.properties)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
}

function getPropertyIndex(properties: UnknownRecord[], name: string): number {
    for (let i = 0; i < properties.length; i += 1) {
        if (asString(properties[i]?.name) === name) {
            return i;
        }
    }
    return -1;
}

function readProperty(properties: UnknownRecord[], name: string): unknown {
    const index = getPropertyIndex(properties, name);
    return index >= 0 ? properties[index]?.value : undefined;
}

function upsertProperty(
    properties: UnknownRecord[],
    name: string,
    type: 'string' | 'int' | 'bool',
    value: string | number | boolean
): { changed: boolean } {
    const index = getPropertyIndex(properties, name);
    const next = { name, type, value };
    if (index >= 0) {
        const existing = properties[index] ?? {};
        const changed = existing.name !== next.name || existing.type !== next.type || existing.value !== next.value;
        properties[index] = next;
        return { changed };
    }
    properties.push(next);
    return { changed: true };
}

function removeProperty(properties: UnknownRecord[], name: string): { changed: boolean } {
    const index = getPropertyIndex(properties, name);
    if (index < 0) {
        return { changed: false };
    }
    properties.splice(index, 1);
    return { changed: true };
}

function resolveMobKindFromTilesetTiles(tileset: UnknownRecord): Map<number, string> {
    const out = new Map<number, string>();
    const tiles = asArray(tileset.tiles)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
    for (const tileRecord of tiles) {
        const tileId = asInteger(tileRecord.id);
        if (tileId === null || tileId < 0) {
            continue;
        }
        const props = propertyList(tileRecord);
        const kind = asString(readProperty(props, 'type'));
        if (kind && kind.trim().length > 0) {
            out.set(tileId + 1, kind.trim());
        }
    }
    return out;
}

function resolveMobLocalIdByKind(tilesetRoot: UnknownRecord): Map<string, number> {
    const out = new Map<string, number>();
    const tiles = asArray(tilesetRoot.tiles)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
    for (const tileRecord of tiles) {
        const tileId = asInteger(tileRecord.id);
        if (tileId === null || tileId < 0) {
            continue;
        }
        const props = propertyList(tileRecord);
        const kind = asString(readProperty(props, 'type'));
        if (kind && kind.trim().length > 0) {
            out.set(kind.trim(), tileId + 1);
        }
    }
    return out;
}

function printUsage(): never {
    console.log(
        'Usage: bun tools/content/world-migrate-entity-spawn-kinds.ts [--world <path>] [--original <path>] [--mobs <path>] [--write]'
    );
    process.exit(0);
}

async function main(): Promise<void> {
    const args = parseCliArgs(
        process.argv.slice(2),
        [
            { key: 'world', kind: 'string', defaultValue: 'assets/maps/tiled/world.json' },
            { key: 'original', kind: 'string', defaultValue: 'assets/maps/tiled/world.original.json' },
            { key: 'mobs', kind: 'string', defaultValue: 'assets/maps/tiled/mobs.tsj' },
            { key: 'write', kind: 'boolean', defaultValue: false },
        ],
        { onHelp: printUsage }
    );

    const worldPath = path.resolve(process.cwd(), String(args.world));
    const originalPath = path.resolve(process.cwd(), String(args.original));
    const mobsPath = path.resolve(process.cwd(), String(args.mobs));
    const write = Boolean(args.write);

    const worldRoot = asRecord(JSON.parse(await fs.readFile(worldPath, 'utf8')));
    if (!worldRoot) {
        fail(`Invalid world root: ${toRelative(worldPath)}`);
    }
    const originalRoot = asRecord(JSON.parse(await fs.readFile(originalPath, 'utf8')));
    if (!originalRoot) {
        fail(`Invalid original world root: ${toRelative(originalPath)}`);
    }
    const mobsRoot = asRecord(JSON.parse(await fs.readFile(mobsPath, 'utf8')));
    if (!mobsRoot) {
        fail(`Invalid mobs tileset root: ${toRelative(mobsPath)}`);
    }

    const originalTilesets = asArray(originalRoot.tilesets)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
    const originalMobsTileset = originalTilesets.find((entry) => asString(entry.name) === 'Mobs');
    if (!originalMobsTileset) {
        fail(`Could not find embedded tileset "Mobs" in ${toRelative(originalPath)}.`);
    }
    const originalMobsFirstgid = asInteger(originalMobsTileset.firstgid);
    if (originalMobsFirstgid === null || originalMobsFirstgid <= 0) {
        fail(`Embedded Mobs tileset missing firstgid in ${toRelative(originalPath)}.`);
    }

    const oldKindByLocalId = resolveMobKindFromTilesetTiles(originalMobsTileset);
    const newLocalIdByKind = resolveMobLocalIdByKind(mobsRoot);

    const layers = asArray(worldRoot.layers)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
    const entitySpawnsLayer = layers.find(
        (layer) => asString(layer.type) === 'objectgroup' && asString(layer.name) === 'static_entities'
    );
    if (!entitySpawnsLayer) {
        fail(`Missing object layer "static_entities" in ${toRelative(worldPath)}.`);
    }

    const objects = asArray(entitySpawnsLayer.objects)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
    entitySpawnsLayer.objects = objects;

    let addedMobKind = 0;
    let rewrittenMobGid = 0;
    let removedMobGid = 0;
    let skipped = 0;

    for (const objectRecord of objects) {
        const props = propertyList(objectRecord);
        const existingKind = asString(readProperty(props, 'entity_kind'));
        if (existingKind && existingKind.trim().length > 0) {
            skipped += 1;
            continue;
        }

        const entityGidValue = asInteger(readProperty(props, 'entity_gid'));
        if (entityGidValue === null || entityGidValue <= 0) {
            skipped += 1;
            continue;
        }

        const oldLocalId =
            entityGidValue >= originalMobsFirstgid ? entityGidValue - originalMobsFirstgid + 1 : entityGidValue;
        const kind = oldKindByLocalId.get(oldLocalId);
        if (!kind) {
            skipped += 1;
            continue;
        }

        if (upsertProperty(props, 'entity_kind', 'string', kind).changed) {
            addedMobKind += 1;
        }

        const newLocalId = newLocalIdByKind.get(kind) ?? null;
        if (newLocalId !== null) {
            if (upsertProperty(props, 'entity_gid', 'int', newLocalId).changed) {
                rewrittenMobGid += 1;
            }
        } else {
            if (removeProperty(props, 'entity_gid').changed) {
                removedMobGid += 1;
            }
        }

        objectRecord.properties = props;
    }

    if (write) {
        await fs.writeFile(worldPath, `${JSON.stringify(worldRoot, null, 2)}\n`, 'utf8');
    }

    console.log(
        JSON.stringify(
            {
                world: toRelative(worldPath),
                original: toRelative(originalPath),
                mobs: toRelative(mobsPath),
                write,
                totals: {
                    objects: objects.length,
                    addedMobKind,
                    rewrittenMobGid,
                    removedMobGid,
                    skipped,
                },
            },
            null,
            2
        )
    );
}

void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
