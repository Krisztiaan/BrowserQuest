import { afterEach, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WorldServer from '../../server/world-server';
import Player from '../../server/player';
import Types from '../../shared/gametypes-browser';
import { loadRuntimeMapPackFromSource } from '../../server/runtime-map-pack-source';

type RuntimeServerMap = {
    staticEntities?: Record<string, string>;
    staticChests?: Array<{ x: number; y: number; i: number[] }>;
    roamingAreas?: Array<{ mobKind: string; count: number }>;
};

type RuntimeMapPack = {
    maps: Array<{ id: string; server: RuntimeServerMap }>;
};

const tmpDirs: string[] = [];

afterEach(() => {
    for (const dir of tmpDirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

function createWorld(): WorldServer {
    const server = {
        getConnection() {
            return undefined;
        },
    };
    return new WorldServer('map-pack-bootstrap-test', 2000, server as never);
}

function createPlayer(connectionId: string): Player {
    const connection = {
        id: connectionId,
        listen() {},
        onClose() {},
        send() {},
        sendUTF8() {},
        close() {},
    };
    return new Player(connection as never, null);
}

function createScopedPersistenceEnv(): { restore(): void } {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-map-pack-bootstrap-'));
    tmpDirs.push(tmpDir);

    const prevChunk = process.env.BQ_CHUNK_OVERLAY_DB_PATH;
    const prevClaims = process.env.BQ_CLAIMS_DB_PATH;

    process.env.BQ_CHUNK_OVERLAY_DB_PATH = path.join(tmpDir, 'chunk-overlays.{world}.sqlite');
    process.env.BQ_CLAIMS_DB_PATH = path.join(tmpDir, 'claims.{world}.sqlite');

    return {
        restore() {
            if (prevChunk === undefined) {
                delete process.env.BQ_CHUNK_OVERLAY_DB_PATH;
            } else {
                process.env.BQ_CHUNK_OVERLAY_DB_PATH = prevChunk;
            }

            if (prevClaims === undefined) {
                delete process.env.BQ_CLAIMS_DB_PATH;
            } else {
                process.env.BQ_CLAIMS_DB_PATH = prevClaims;
            }
        },
    };
}

function countExpectedKinds(serverMap: RuntimeServerMap): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const kind of Object.values(serverMap.staticEntities ?? {})) {
        counts[kind] = (counts[kind] ?? 0) + 1;
    }

    for (let i = 0; i < (serverMap.staticChests ?? []).length; i += 1) {
        counts.chest = (counts.chest ?? 0) + 1;
    }

    for (const area of serverMap.roamingAreas ?? []) {
        counts[area.mobKind] = (counts[area.mobKind] ?? 0) + Number(area.count);
    }

    return counts;
}

function countBootstrappedKinds(world: WorldServer): Record<string, number> {
    const counts: Record<string, number> = {};

    world.ecsPipeline.replication.Kind.store.forEach((_id, kind) => {
        const name = Types.getKindAsString(kind);
        if (typeof name !== 'string' || name.length === 0) {
            return;
        }
        counts[name] = (counts[name] ?? 0) + 1;
    });

    return counts;
}

test('world runtime bootstraps authored static entities, chests, and roaming mobs from world.json', async () => {
    const restoreEnv = createScopedPersistenceEnv();
    const world = createWorld();
    world.setUpdatesPerSecond(1);

    try {
        const pack = (await loadRuntimeMapPackFromSource('./assets/maps/tiled/world.json')) as RuntimeMapPack;
        const worldMap = pack.maps.find((map) => map.id === 'world_01');
        expect(worldMap).toBeDefined();
        const serverMap = worldMap?.server;
        expect(serverMap).toBeDefined();

        await new Promise<void>((resolve, reject) => {
            let settled = false;
            world.on('ready', () => {
                settled = true;
                resolve();
            });
            world.run('./assets/maps/tiled/world.json');
            setTimeout(() => {
                if (!settled) {
                    reject(new Error('Timed out waiting for world runtime bootstrap.'));
                }
            }, 5000);
        });

        const expectedKinds = countExpectedKinds(serverMap as RuntimeServerMap);
        const actualKinds = countBootstrappedKinds(world);

        expect(actualKinds).toEqual(expectedKinds);
    } finally {
        world.closePersistence();
        restoreEnv.restore();
    }
});

test('world runtime can bootstrap directly from authored world.json without a prebuilt map-pack file', async () => {
    const restoreEnv = createScopedPersistenceEnv();
    const world = createWorld();
    world.setUpdatesPerSecond(1);

    try {
        await new Promise<void>((resolve, reject) => {
            let settled = false;
            world.on('ready', () => {
                settled = true;
                resolve();
            });
            world.run('./assets/maps/tiled/world.json');
            setTimeout(() => {
                if (!settled) {
                    reject(new Error('Timed out waiting for authored world.json bootstrap.'));
                }
            }, 5000);
        });

        const counts = countBootstrappedKinds(world);
        expect((counts.chest ?? 0) > 0).toBe(true);
        expect((counts.rat ?? 0) > 0).toBe(true);
        expect((counts.spectre ?? 0) > 0).toBe(true);
    } finally {
        world.closePersistence();
        restoreEnv.restore();
    }
});

test('player entering beside a real authored chest receives chest and nearby mob SPAWN actions', async () => {
    const restoreEnv = createScopedPersistenceEnv();
    const world = createWorld();
    world.setUpdatesPerSecond(1);

    try {
        await new Promise<void>((resolve, reject) => {
            let settled = false;
            world.on('ready', () => {
                settled = true;
                resolve();
            });
            world.run('./assets/maps/tiled/world.json');
            setTimeout(() => {
                if (!settled) {
                    reject(new Error('Timed out waiting for world runtime bootstrap.'));
                }
            }, 5000);
        });

        const player = createPlayer('5101');
        // Adjacent to a known static chest at (157,141) in world_01.
        player.setPositionResolver(() => ({ x: 157, y: 141 }));
        world.pendingPlayers[String(player.id)] = player;

        const messages: unknown[] = [];
        const originalPushToPlayerId = world.pushToPlayerId.bind(world) as typeof world.pushToPlayerId;
        world.pushToPlayerId = ((playerId, message) => {
            messages.push(message);
            originalPushToPlayerId(playerId, message);
        }) as typeof world.pushToPlayerId;

        world.ecsPipeline.enqueue({
            type: 'HELLO',
            source: { connectionId: String(player.id), playerId: player.id },
            player,
            name: 'probe',
            armorKind: Types.Entities.CLOTHARMOR,
            weaponKind: Types.Entities.SWORD1,
        });
        world.ecsPipeline.tick();

        const spawnMessages = messages.filter(
            (message): message is unknown[] => Array.isArray(message) && message[0] === Types.Messages.SPAWN
        );

        const chestSpawns = spawnMessages.filter((message) => message[2] === Types.Entities.CHEST);
        const mobSpawns = spawnMessages.filter((message) => typeof message[2] === 'number' && Types.isMob(message[2]));

        expect(player.hasEnteredGame).toBe(true);
        expect(chestSpawns.length).toBeGreaterThan(0);
        expect(chestSpawns.some((message) => message[3] === 157 && message[4] === 141)).toBe(true);
        expect(mobSpawns.length).toBeGreaterThan(0);
    } finally {
        world.closePersistence();
        restoreEnv.restore();
    }
});
