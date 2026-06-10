import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../../shared/cli-args';

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

function ensureObjectProperties(objectRecord: UnknownRecord): UnknownRecord[] {
    const properties: UnknownRecord[] = [];
    for (const entry of asArray(objectRecord.properties)) {
        const propertyRecord = asRecord(entry);
        if (propertyRecord) {
            properties.push(propertyRecord);
        }
    }
    objectRecord.properties = properties;
    return properties;
}

function getPropertyValue(properties: ReadonlyArray<UnknownRecord>, name: string): string | null {
    for (const propertyRecord of properties) {
        if (asString(propertyRecord.name) === name) {
            const value = propertyRecord.value;
            if (typeof value === 'string') {
                return value;
            }
            if (typeof value === 'number' && Number.isFinite(value)) {
                return String(value);
            }
            return null;
        }
    }
    return null;
}

function setProperty(properties: UnknownRecord[], name: string, value: string): boolean {
    for (const propertyRecord of properties) {
        if (asString(propertyRecord.name) === name) {
            if (propertyRecord.value === value && propertyRecord.type === 'string') {
                return false;
            }
            propertyRecord.value = value;
            propertyRecord.type = 'string';
            return true;
        }
    }
    properties.push({ name, type: 'string', value });
    return true;
}

type PortalEntry = {
    id: number | null;
    tx: number;
    ty: number;
    properties: UnknownRecord[];
    targetTx: number;
    targetTy: number;
};

function parseTargetCoordinate(raw: string | null, label: string, objectId: number | null): number {
    if (!raw || raw.trim().length === 0) {
        fail(`Portal object ${objectId ?? 'no-id'} is missing ${label}.`);
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        fail(`Portal object ${objectId ?? 'no-id'} has invalid ${label}: ${raw}`);
    }
    return parsed;
}

function nearestPortalTarget(
    source: PortalEntry,
    portals: ReadonlyArray<PortalEntry>
): PortalEntry | null {
    let best: PortalEntry | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of portals) {
        if (candidate === source) {
            continue;
        }
        const distance = Math.abs(candidate.tx - source.targetTx) + Math.abs(candidate.ty - source.targetTy);
        if (distance < bestDistance) {
            best = candidate;
            bestDistance = distance;
            continue;
        }
        if (distance === bestDistance && best) {
            const candidateId = candidate.id ?? Number.MAX_SAFE_INTEGER;
            const bestId = best.id ?? Number.MAX_SAFE_INTEGER;
            if (candidateId < bestId) {
                best = candidate;
            }
        }
    }
    return best;
}

function printUsage(): never {
    console.log('Usage: bun tools/content/legacy/world-curate-portals.ts [--map <path>] [--write]');
    process.exit(0);
}

async function main(): Promise<void> {
    const parsedArgs = parseCliArgs(
        process.argv.slice(2),
        [
            { key: 'map', kind: 'string', defaultValue: 'assets/maps/tiled/world.json' },
            { key: 'write', kind: 'boolean', defaultValue: false },
        ],
        { onHelp: printUsage }
    );

    const mapPath = path.resolve(process.cwd(), String(parsedArgs.map ?? 'assets/maps/tiled/world.json'));
    const write = Boolean(parsedArgs.write);

    const payload = await fs.readFile(mapPath, 'utf8');
    const root = asRecord(JSON.parse(payload));
    if (!root) {
        fail('Map root must be an object.');
    }

    const layers = asArray(root.layers)
        .map((entry) => asRecord(entry))
        .filter((layerRecord): layerRecord is UnknownRecord => layerRecord !== null);
    const doorsLayer = layers.find(
        (layerRecord) => asString(layerRecord.name) === 'doors' && asString(layerRecord.type) === 'objectgroup'
    );
    if (!doorsLayer) {
        fail('Could not find objectgroup layer named `doors`.');
    }

    const doors = asArray(doorsLayer.objects)
        .map((entry) => asRecord(entry))
        .filter((objectRecord): objectRecord is UnknownRecord => objectRecord !== null);

    const portals: PortalEntry[] = [];
    let changedProperties = 0;
    let reassignedToNearest = 0;
    let unresolvedBefore = 0;
    const assignments: Array<{
        id: number | null;
        at: string;
        door_id: string;
        target_door: string;
        target_map: string;
        target_source: 'direct' | 'nearest';
    }> = [];

    for (const doorRecord of doors) {
        const type = asString(doorRecord.type) ?? '';
        if (type !== 'portal') {
            continue;
        }

        const objectId = asInteger(doorRecord.id);
        const xPixels = asInteger(doorRecord.x);
        const yPixels = asInteger(doorRecord.y);
        if (xPixels === null || yPixels === null) {
            fail(`Portal object ${objectId ?? 'no-id'} has invalid x/y.`);
        }
        if (xPixels % 16 !== 0 || yPixels % 16 !== 0) {
            fail(`Portal object ${objectId ?? 'no-id'} is not tile-aligned (x=${xPixels}, y=${yPixels}).`);
        }
        const tx = xPixels / 16;
        const ty = yPixels / 16;

        const properties = ensureObjectProperties(doorRecord);
        const targetTx = parseTargetCoordinate(getPropertyValue(properties, 'target_tx'), 'target_tx', objectId);
        const targetTy = parseTargetCoordinate(getPropertyValue(properties, 'target_ty'), 'target_ty', objectId);

        portals.push({
            id: objectId,
            tx,
            ty,
            properties,
            targetTx,
            targetTy,
        });
    }

    const doorIds = new Set(portals.map((portal) => `world_portal_${portal.tx}_${portal.ty}`));
    const unresolved: PortalEntry[] = [];

    for (const portal of portals) {
        const doorId = `world_portal_${portal.tx}_${portal.ty}`;
        const directTargetDoor = `world_portal_${portal.targetTx}_${portal.targetTy}`;
        let targetDoor = directTargetDoor;
        let targetSource: 'direct' | 'nearest' = 'direct';
        if (!doorIds.has(directTargetDoor)) {
            unresolvedBefore += 1;
            const nearest = nearestPortalTarget(portal, portals);
            if (!nearest) {
                fail(`Could not resolve nearest portal target for portal ${doorId}.`);
            }
            targetDoor = `world_portal_${nearest.tx}_${nearest.ty}`;
            targetSource = 'nearest';
            reassignedToNearest += 1;
            unresolved.push(portal);
        }
        const targetMap = 'world';

        if (setProperty(portal.properties, 'door_id', doorId)) {
            changedProperties += 1;
        }
        if (setProperty(portal.properties, 'target_door', targetDoor)) {
            changedProperties += 1;
        }
        if (setProperty(portal.properties, 'target_map', targetMap)) {
            changedProperties += 1;
        }

        assignments.push({
            id: portal.id,
            at: `${portal.tx},${portal.ty}`,
            door_id: doorId,
            target_door: targetDoor,
            target_map: targetMap,
            target_source: targetSource,
        });
    }

    if (write) {
        await fs.writeFile(mapPath, `${JSON.stringify(root, null, 2)}\n`, 'utf8');
    }

    const relativePath = path.relative(process.cwd(), mapPath).split(path.sep).join('/');
    console.log(
        JSON.stringify(
            {
                map: relativePath,
                write,
                portalCount: portals.length,
                changedProperties,
                unresolvedBefore,
                reassignedToNearest,
                assignments,
            },
            null,
            2
        )
    );
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(message);
    process.exit(1);
});
