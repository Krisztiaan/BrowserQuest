import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

type LayerSpec = Readonly<{
    name: string;
    className: string;
}>;

const CANONICAL_OBJECT_LAYERS: ReadonlyArray<LayerSpec> = [
    { name: 'resource_nodes', className: 'ResourceNode' },
    { name: 'entity_spawns', className: 'EntitySpawn' },
    { name: 'chest_spawns', className: 'ChestSpawn' },
    { name: 'chest_areas', className: 'ChestArea' },
    { name: 'doors', className: 'Door' },
    { name: 'roaming_areas', className: 'RoamingArea' },
    { name: 'zones', className: 'Zone' },
    { name: 'music_zones', className: 'MusicZone' },
    { name: 'checkpoints', className: 'Checkpoint' },
    { name: 'mobile_zones', className: 'MobileZone' },
];

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

function propertyValue(record: UnknownRecord, key: string): unknown {
    for (const property of propertyList(record)) {
        if (asString(property.name) === key) {
            return property.value;
        }
    }
    return undefined;
}

function hasNonEmptyProperty(record: UnknownRecord, key: string): boolean {
    const value = propertyValue(record, key);
    if (typeof value === 'string') {
        return value.trim().length > 0;
    }
    return value !== undefined && value !== null;
}

function printUsage(): never {
    console.log('Usage: bun tools/content/world-prefill-authoring.ts [--map <path>] [--write]');
    process.exit(0);
}

async function main(): Promise<void> {
    const args = parseCliArgs(
        process.argv.slice(2),
        [
            { key: 'map', kind: 'string', defaultValue: 'assets/maps/tiled/world.json' },
            { key: 'write', kind: 'boolean', defaultValue: false },
        ],
        { onHelp: printUsage }
    );

    const mapPath = path.resolve(process.cwd(), String(args.map ?? 'assets/maps/tiled/world.json'));
    const write = Boolean(args.write);
    const root = asRecord(JSON.parse(await fs.readFile(mapPath, 'utf8')));
    if (!root) {
        fail(`Invalid map root in ${toRelative(mapPath)}.`);
    }

    const layers = asArray(root.layers)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null);
    root.layers = layers;

    const layerByName = new Map<string, UnknownRecord>();
    let maxLayerId = 0;
    for (const layer of layers) {
        const name = asString(layer.name);
        if (name) {
            layerByName.set(name, layer);
        }
        const layerId = asInteger(layer.id);
        if (layerId !== null && layerId > maxLayerId) {
            maxLayerId = layerId;
        }
    }

    let addedLayers = 0;
    let setLayerClass = 0;
    let setLayerVisibility = 0;
    let setLayerDraworder = 0;
    let setLayerOpacity = 0;
    let setObjectClass = 0;
    let removedLegacyObjectType = 0;

    for (const spec of CANONICAL_OBJECT_LAYERS) {
        let layer = layerByName.get(spec.name);
        if (!layer) {
            maxLayerId += 1;
            layer = {
                id: maxLayerId,
                name: spec.name,
                class: spec.className,
                type: 'objectgroup',
                visible: false,
                opacity: 1,
                draworder: 'topdown',
                objects: [],
            };
            layers.push(layer);
            layerByName.set(spec.name, layer);
            addedLayers += 1;
        }

        if (asString(layer.type) !== 'objectgroup') {
            fail(`Layer "${spec.name}" must be objectgroup in ${toRelative(mapPath)}.`);
        }

        if (asString(layer.class) !== spec.className) {
            layer.class = spec.className;
            setLayerClass += 1;
        }
        if (layer.visible !== false) {
            layer.visible = false;
            setLayerVisibility += 1;
        }
        if (asString(layer.draworder) !== 'topdown') {
            layer.draworder = 'topdown';
            setLayerDraworder += 1;
        }
        if (typeof layer.opacity !== 'number' || !Number.isFinite(layer.opacity)) {
            layer.opacity = 1;
            setLayerOpacity += 1;
        }

        const objects = asArray(layer.objects)
            .map((entry) => asRecord(entry))
            .filter((entry): entry is UnknownRecord => entry !== null);
        layer.objects = objects;

        for (const objectRecord of objects) {
            const currentClass = asString(objectRecord.class);
            let expectedClass = spec.className;
            if (spec.name === 'doors') {
                const isPortalClass = currentClass === 'Portal';
                const isPortalType = asString(objectRecord.type) === 'portal';
                const hasTargetLink = hasNonEmptyProperty(objectRecord, 'target_map') || hasNonEmptyProperty(objectRecord, 'target_door');
                expectedClass = isPortalClass || isPortalType || hasTargetLink ? 'Portal' : 'Door';
            }
            if (currentClass !== expectedClass) {
                objectRecord.class = expectedClass;
                setObjectClass += 1;
            }
            if (asString(objectRecord.type) !== null) {
                delete objectRecord.type;
                removedLegacyObjectType += 1;
            }
        }
    }

    const existingNextLayerId = asInteger(root.nextlayerid) ?? 0;
    if (existingNextLayerId <= maxLayerId) {
        root.nextlayerid = maxLayerId + 1;
    }

    const changed =
        addedLayers > 0 ||
        setLayerClass > 0 ||
        setLayerVisibility > 0 ||
        setLayerDraworder > 0 ||
        setLayerOpacity > 0 ||
        setObjectClass > 0 ||
        removedLegacyObjectType > 0;

    if (write && changed) {
        await fs.writeFile(mapPath, `${JSON.stringify(root, null, 2)}\n`, 'utf8');
    }

    console.log(
        JSON.stringify(
            {
                map: toRelative(mapPath),
                write,
                changed,
                totals: {
                    addedLayers,
                    setLayerClass,
                    setLayerVisibility,
                    setLayerDraworder,
                    setLayerOpacity,
                    setObjectClass,
                    removedLegacyObjectType,
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
