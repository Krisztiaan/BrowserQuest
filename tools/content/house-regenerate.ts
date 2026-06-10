import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

type TiledProperty = Readonly<{
    name: string;
    value: unknown;
}>;

type TiledObject = Readonly<{
    id?: number;
    x?: number;
    y?: number;
    properties?: TiledProperty[];
}>;

type TiledLayer = Readonly<{
    name?: string;
    type?: string;
    layers?: unknown[];
    objects?: unknown[];
}>;

type TiledMap = Readonly<{
    width?: number;
    height?: number;
    tilewidth?: number;
    tileheight?: number;
    layers?: unknown[];
    tiledversion?: string;
    version?: string | number;
}>;

type HouseDoorContract = Readonly<{
    houseId: string;
    houseDoorId: string;
    worldDoorId: string;
}>;

const HOUSE_WIDTH = 12;
const HOUSE_HEIGHT = 10;
const TILE_SIZE = 16;
const FLOOR_GID = 1;
const BLOCKING_GID = 1;
const DOOR_TILE_X = 5;
const DOOR_TILE_Y = 8;

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

function asNonEmptyString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function tileIndex(x: number, y: number, width: number): number {
    return y * width + x;
}

function renderTiledMapJson(map: unknown): string {
    return `${JSON.stringify(map, null, 2)}\n`;
}

async function readJsonFile(filePath: string): Promise<unknown> {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as unknown;
}

function propertyMap(object: TiledObject): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const props = asArray(object.properties);
    for (let i = 0; i < props.length; i += 1) {
        const prop = asRecord(props[i]);
        const name = asNonEmptyString(prop?.name);
        if (!name) {
            continue;
        }
        out[name] = prop?.value;
    }
    return out;
}

function visitLayers(layers: unknown[], visit: (layer: TiledLayer) => void): void {
    for (let i = 0; i < layers.length; i += 1) {
        const layer = asRecord(layers[i]) as TiledLayer | null;
        if (!layer) {
            continue;
        }
        visit(layer);
        visitLayers(asArray(layer.layers), visit);
    }
}

function extractHouseDoorContracts(world: TiledMap): HouseDoorContract[] {
    const contracts: HouseDoorContract[] = [];

    visitLayers(asArray(world.layers), (layer) => {
        if (layer.type !== 'objectgroup' || layer.name !== 'doors') {
            return;
        }
        const objects = asArray(layer.objects) as TiledObject[];
        for (let i = 0; i < objects.length; i += 1) {
            const object = objects[i];
            if (!object) {
                continue;
            }
            const props = propertyMap(object);
            const houseId = asNonEmptyString(props.target_map);
            if (!houseId?.startsWith('house_')) {
                continue;
            }
            const houseDoorId = asNonEmptyString(props.target_door);
            const worldDoorId = asNonEmptyString(props.door_id) ?? asNonEmptyString(props.id);
            const x = asNumber(object.x);
            const y = asNumber(object.y);
            if (!houseDoorId || !worldDoorId || x === null || y === null) {
                fail(`House door targeting "${houseId}" must include x/y, door_id, and target_door.`);
            }
            contracts.push({
                houseId,
                houseDoorId,
                worldDoorId,
            });
        }
    });

    contracts.sort((a, b) => a.houseId.localeCompare(b.houseId));
    const seen = new Set<string>();
    for (const contract of contracts) {
        if (seen.has(contract.houseId)) {
            fail(`Duplicate house target "${contract.houseId}" in world doors.`);
        }
        seen.add(contract.houseId);
    }
    return contracts;
}

function makeBlockingData(): number[] {
    const data = new Array(HOUSE_WIDTH * HOUSE_HEIGHT).fill(0) as number[];
    for (let y = 0; y < HOUSE_HEIGHT; y += 1) {
        for (let x = 0; x < HOUSE_WIDTH; x += 1) {
            if (x === 0 || y === 0 || x === HOUSE_WIDTH - 1 || y === HOUSE_HEIGHT - 1) {
                data[tileIndex(x, y, HOUSE_WIDTH)] = BLOCKING_GID;
            }
        }
    }
    return data;
}

function buildStubHouseMap(contract: HouseDoorContract): unknown {
    return {
        compressionlevel: -1,
        height: HOUSE_HEIGHT,
        infinite: false,
        layers: [
            {
                data: new Array(HOUSE_WIDTH * HOUSE_HEIGHT).fill(FLOOR_GID),
                height: HOUSE_HEIGHT,
                id: 1,
                name: 'floor',
                opacity: 1,
                type: 'tilelayer',
                visible: true,
                width: HOUSE_WIDTH,
                x: 0,
                y: 0,
            },
            {
                data: makeBlockingData(),
                height: HOUSE_HEIGHT,
                id: 2,
                name: 'blocking',
                opacity: 1,
                type: 'tilelayer',
                visible: true,
                width: HOUSE_WIDTH,
                x: 0,
                y: 0,
            },
            {
                draworder: 'topdown',
                id: 3,
                name: 'doors',
                objects: [
                    {
                        class: 'Door',
                        height: TILE_SIZE,
                        id: 1,
                        name: '',
                        properties: [
                            { name: 'door_id', type: 'string', value: contract.houseDoorId },
                            { name: 'orientation', type: 'string', value: 'd' },
                            { name: 'target_map', type: 'string', value: 'world_01' },
                            { name: 'target_door', type: 'string', value: contract.worldDoorId },
                        ],
                        rotation: 0,
                        type: '',
                        visible: true,
                        width: TILE_SIZE,
                        x: DOOR_TILE_X * TILE_SIZE,
                        y: DOOR_TILE_Y * TILE_SIZE,
                    },
                ],
                opacity: 1,
                type: 'objectgroup',
                visible: true,
                x: 0,
                y: 0,
            },
        ],
        nextlayerid: 4,
        nextobjectid: 2,
        orientation: 'orthogonal',
        renderorder: 'right-down',
        tiledversion: '1.11.2',
        tileheight: TILE_SIZE,
        tilesets: [{ firstgid: 1, source: '../tilesheet.wang.tsj' }],
        tilewidth: TILE_SIZE,
        type: 'map',
        version: '1.10',
        width: HOUSE_WIDTH,
    };
}

async function loadContracts(worldPath: string): Promise<HouseDoorContract[]> {
    const world = await readJsonFile(worldPath) as TiledMap;
    const contracts = extractHouseDoorContracts(world);
    if (contracts.length === 0) {
        fail(`No house doors found in world map "${worldPath}".`);
    }
    return contracts;
}

async function runGenerate(contracts: HouseDoorContract[], outDir: string): Promise<void> {
    await fs.mkdir(outDir, { recursive: true });
    for (const contract of contracts) {
        const outPath = path.join(outDir, `${contract.houseId}.json`);
        await fs.writeFile(outPath, renderTiledMapJson(buildStubHouseMap(contract)), 'utf8');
    }
    console.log(`Regenerated ${contracts.length} stub house maps in ${outDir}.`);
}

async function runCheck(contracts: HouseDoorContract[], outDir: string): Promise<void> {
    const mismatches: string[] = [];
    for (const contract of contracts) {
        const outPath = path.join(outDir, `${contract.houseId}.json`);
        const expected = renderTiledMapJson(buildStubHouseMap(contract));
        const existing = await fs.readFile(outPath, 'utf8').catch(() => '');
        if (existing !== expected) {
            mismatches.push(contract.houseId);
        }
    }
    if (mismatches.length > 0) {
        fail(
            `House maps are out of date (${mismatches.length} mismatched). Example: ${mismatches.slice(0, 5).join(', ')}. Run: bun tools/content/house-regenerate.ts generate`
        );
    }
    console.log(`House maps are up to date (${contracts.length} maps).`);
}

function runReport(contracts: HouseDoorContract[]): void {
    console.log(JSON.stringify(contracts, null, 2));
}

async function main(): Promise<void> {
    const command = process.argv[2];
    if (command !== 'check' && command !== 'generate' && command !== 'report') {
        fail('Usage: bun tools/content/house-regenerate.ts <check|generate|report> [--world <path>] [--outDir <path>]');
    }

    const parsed = parseCliArgs(process.argv.slice(3), [
        { key: 'world', kind: 'string', defaultValue: 'assets/maps/tiled/world.json' },
        { key: 'outDir', kind: 'string', defaultValue: 'assets/maps/tiled/maps' },
    ]);

    const worldPath = path.resolve(String(parsed.world));
    const outDir = path.resolve(String(parsed.outDir));
    const contracts = await loadContracts(worldPath);

    if (command === 'generate') {
        await runGenerate(contracts, outDir);
        return;
    }
    if (command === 'check') {
        await runCheck(contracts, outDir);
        return;
    }
    runReport(contracts);
}

void main();
