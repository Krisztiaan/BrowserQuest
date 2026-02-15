import { expect, test } from 'bun:test';
import Types from '../../../shared/gametypes-browser';
import Player from '../../../server/player';
import { gridPos } from '../../../shared/domain/positions';
import { WorldEcsCommandPipeline } from '../../../server/world/ecs-command-pipeline';
import { ClientChunkOverlayCache } from '../../../client/world/chunks/client-chunk-overlay-cache';
import { decodeChunkSnapshotPayloadJson, encodeChunkSnapshotPayloadJson, encodeChunkSnapshotPayloadJsonParts } from '../../../shared/protocol/chunks/chunk-snapshot-codec';

function createTestPlayer(wireId: number): Player {
    const connection = {
        id: String(wireId),
        listen() {},
        onClose() {},
        send() {},
        sendUTF8() {},
        close() {},
    };
    const player = new Player(connection as never, null);
    player.resetHitPoints(100);
    player.isDead = false;
    player.setPosition(0, 0);
    return player;
}

function isChunkSnapshotPartMessage(msg: unknown): msg is [number, number, number, number, number, number, string] {
    return (
        Array.isArray(msg)
        && msg[0] === Types.Messages.CHUNK_SNAPSHOT_PART
        && typeof msg[1] === 'number'
        && typeof msg[2] === 'number'
        && typeof msg[3] === 'number'
        && typeof msg[4] === 'number'
        && typeof msg[5] === 'number'
        && typeof msg[6] === 'string'
    );
}

test('WorldEcsCommandPipeline.setServerConfig applies chunk snapshot caps (no env override)', () => {
    const prev = process.env.BQ_TEST_CHUNK_SNAPSHOT_MAX_UTF8_BYTES;
    try {
        delete process.env.BQ_TEST_CHUNK_SNAPSHOT_MAX_UTF8_BYTES;

        const maxValue = 0xffff_ffff;
        const fullOverrides: Array<[number, number, number]> = [];
        for (let i = 0; i < 32 * 32; i += 1) {
            fullOverrides.push([i % 32, Math.floor(i / 32), (maxValue - i) >>> 0]);
        }

        const single = encodeChunkSnapshotPayloadJson({
            chunkSize: 32,
            overrides: [[0, 0, maxValue]],
            maxUtf8Bytes: 10_000,
        });

        let cap: number | null = null;
        for (let candidate = Math.max(1, single.length); candidate <= 5000; candidate += 25) {
            const fullFits = (() => {
                try {
                    encodeChunkSnapshotPayloadJson({ chunkSize: 32, overrides: fullOverrides, maxUtf8Bytes: candidate });
                    return true;
                } catch (_) {
                    return false;
                }
            })();
            if (fullFits) continue;
            try {
                const parts = encodeChunkSnapshotPayloadJsonParts({ chunkSize: 32, overrides: fullOverrides, maxUtf8Bytes: candidate });
                if (parts.length > 1 && parts.length <= 128) {
                    cap = candidate;
                    break;
                }
            } catch (_) {
                // keep searching
            }
        }
        expect(cap).not.toBeNull();
        if (cap === null) return;

        const player = createTestPlayer(24001);
        player.setPosition(1, 1);

        const delivered: unknown[] = [];
        const host: Record<string, unknown> = {
            ups: 50,
            map: {
                getCheckpoint() {
                    return null;
                },
                isDoor() {
                    return false;
                },
                getDoorDestination() {
                    return null;
                },
                getGroupIdFromPosition() {
                    return 'g';
                },
                forEachAdjacentGroup(_groupId: string | null | undefined, cb: (groupId: string) => void) {
                    cb('g');
                },
            },
            getConnectionPlayerById(id: number) {
                return id === player.id ? player : null;
            },
            removeEntityFromAreas() {},
            scheduleMobRespawn() {},
            scheduleStaticItemRespawn() {},
            getEntityById() {
                return null;
            },
            addPlayer() {},
            emitPlayerEnter() {},
            isPlayerActive(id: number) {
                return id === player.id;
            },
            pushSpawnsToPlayerId() {},
            isValidPosition() {
                return true;
            },
            getDroppedItem() {
                return null;
            },
            handleItemDespawn() {},
            moveEntity(entity: unknown, x: number, y: number) {
                (entity as { setPosition: (nextX: number, nextY: number) => void }).setPosition(x, y);
            },
            removeEntity() {},
            addItemFromChest() {
                return null;
            },
            pushToPlayerId(playerId: number, message: unknown) {
                if (playerId === player.id) {
                    delivered.push(message);
                }
            },
            persistPlayerEquipment() {},
            persistPlayerCheckpoint() {},
            persistPlayerAchievementUnlock() {},
            recordPlayerMobKill() {},
            recordPlayerDamageTaken() {},
            recordPlayerRevive() {},
        };

        const pipeline = new WorldEcsCommandPipeline(host as never);
        pipeline.setServerConfig({
            port: 0,
            nb_worlds: 1,
            nb_players_per_world: 1,
            map_filepath: '',
            metrics_enabled: false,
            debug_level: 'info',
            chunk_snapshot_payload_max_utf8_bytes: cap,
            chunk_snapshot_max_parts: 128,
        });

        pipeline.state.world.ensureEntity(player.id);
        pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, Types.Entities.WARRIOR);
        pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(1, 1));
        pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
        pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);

        for (let i = 0; i < 32 * 32; i += 1) {
            pipeline.chunkOverlays.setGlobal(i % 32, Math.floor(i / 32), (maxValue - i) >>> 0);
        }

        pipeline.enqueue({
            type: 'CHUNK_SUBSCRIBE',
            source: { connectionId: 'c', playerId: player.id },
            chunkX: 0,
            chunkY: 0,
            radius: 0,
        });

        const cache = new ClientChunkOverlayCache();
        let seenParts = 0;
        let applied = false;
        let cursor = 0;
        for (let tick = 0; tick < 50 && !applied; tick += 1) {
            pipeline.tick();
            const slice = delivered.slice(cursor);
            cursor = delivered.length;
            const parts = slice.filter(isChunkSnapshotPartMessage);
            seenParts += parts.length;
            for (const part of parts) {
                const [, chunkX, chunkY, version, partIndex, partCount, payloadJson] = part;
                const decoded = decodeChunkSnapshotPayloadJson(payloadJson);
                expect(decoded).toBeTruthy();
                if (!decoded) continue;
                const res = cache.applySnapshotPart({
                    chunkX,
                    chunkY,
                    version,
                    partIndex,
                    partCount,
                    chunkSize: decoded.chunkSize,
                    overrides: decoded.overrides,
                });
                if (res.applied) {
                    applied = true;
                }
            }
        }

        expect(seenParts).toBeGreaterThan(1);
        expect(applied).toBe(true);
        expect(cache.getGlobal(0, 0)).toBe(maxValue >>> 0);
    } finally {
        if (prev === undefined) {
            delete process.env.BQ_TEST_CHUNK_SNAPSHOT_MAX_UTF8_BYTES;
        } else {
            process.env.BQ_TEST_CHUNK_SNAPSHOT_MAX_UTF8_BYTES = prev;
        }
    }
});

test('snapshot overflow fallback streams high-part snapshots instead of indefinite requeue', () => {
    const prev = process.env.BQ_TEST_CHUNK_SNAPSHOT_MAX_UTF8_BYTES;
    try {
        delete process.env.BQ_TEST_CHUNK_SNAPSHOT_MAX_UTF8_BYTES;

        const maxValue = 0xffff_ffff;
        const fullOverrides: Array<[number, number, number]> = [];
        for (let i = 0; i < 32 * 32; i += 1) {
            fullOverrides.push([i % 32, Math.floor(i / 32), (maxValue - i) >>> 0]);
        }

        let cap: number | null = null;
        for (let candidate = 64; candidate <= 5000; candidate += 25) {
            try {
                const parts = encodeChunkSnapshotPayloadJsonParts({ chunkSize: 32, overrides: fullOverrides, maxUtf8Bytes: candidate });
                if (parts.length > 2) {
                    cap = candidate;
                    break;
                }
            } catch (_) {
                // keep searching
            }
        }
        expect(cap).not.toBeNull();
        if (cap === null) return;

        const player = createTestPlayer(24002);
        player.setPosition(1, 1);

        const delivered: unknown[] = [];
        const host: Record<string, unknown> = {
            ups: 50,
            map: {
                getCheckpoint() {
                    return null;
                },
                isDoor() {
                    return false;
                },
                getDoorDestination() {
                    return null;
                },
                getGroupIdFromPosition() {
                    return 'g';
                },
                forEachAdjacentGroup(_groupId: string | null | undefined, cb: (groupId: string) => void) {
                    cb('g');
                },
            },
            getConnectionPlayerById(id: number) {
                return id === player.id ? player : null;
            },
            removeEntityFromAreas() {},
            scheduleMobRespawn() {},
            scheduleStaticItemRespawn() {},
            getEntityById() {
                return null;
            },
            addPlayer() {},
            emitPlayerEnter() {},
            isPlayerActive(id: number) {
                return id === player.id;
            },
            pushSpawnsToPlayerId() {},
            isValidPosition() {
                return true;
            },
            getDroppedItem() {
                return null;
            },
            handleItemDespawn() {},
            moveEntity(entity: unknown, x: number, y: number) {
                (entity as { setPosition: (nextX: number, nextY: number) => void }).setPosition(x, y);
            },
            removeEntity() {},
            addItemFromChest() {
                return null;
            },
            pushToPlayerId(playerId: number, message: unknown) {
                if (playerId === player.id) {
                    delivered.push(message);
                }
            },
            persistPlayerEquipment() {},
            persistPlayerCheckpoint() {},
            persistPlayerAchievementUnlock() {},
            recordPlayerMobKill() {},
            recordPlayerDamageTaken() {},
            recordPlayerRevive() {},
        };

        const pipeline = new WorldEcsCommandPipeline(host as never);
        pipeline.setServerConfig({
            port: 0,
            nb_worlds: 1,
            nb_players_per_world: 1,
            map_filepath: '',
            metrics_enabled: false,
            debug_level: 'info',
            chunk_snapshot_payload_max_utf8_bytes: cap,
            chunk_snapshot_max_parts: 2,
        });

        pipeline.state.world.ensureEntity(player.id);
        pipeline.state.world.addComponent(player.id, pipeline.replication.Kind, Types.Entities.WARRIOR);
        pipeline.state.world.addComponent(player.id, pipeline.Position, gridPos(1, 1));
        pipeline.state.world.addComponent(player.id, pipeline.combat.HitPoints, 100);
        pipeline.state.world.addComponent(player.id, pipeline.combat.MaxHitPoints, 100);

        for (let i = 0; i < 32 * 32; i += 1) {
            pipeline.chunkOverlays.setGlobal(i % 32, Math.floor(i / 32), (maxValue - i) >>> 0);
        }

        pipeline.enqueue({
            type: 'CHUNK_SUBSCRIBE',
            source: { connectionId: 'c', playerId: player.id },
            chunkX: 0,
            chunkY: 0,
            radius: 0,
        });

        const cache = new ClientChunkOverlayCache();
        let seenParts = 0;
        let applied = false;
        let cursor = 0;
        for (let tick = 0; tick < 200 && !applied; tick += 1) {
            pipeline.tick();
            const slice = delivered.slice(cursor);
            cursor = delivered.length;
            const parts = slice.filter(isChunkSnapshotPartMessage);
            seenParts += parts.length;
            for (const part of parts) {
                const [, chunkX, chunkY, version, partIndex, partCount, payloadJson] = part;
                const decoded = decodeChunkSnapshotPayloadJson(payloadJson);
                expect(decoded).toBeTruthy();
                if (!decoded) continue;
                const res = cache.applySnapshotPart({
                    chunkX,
                    chunkY,
                    version,
                    partIndex,
                    partCount,
                    chunkSize: decoded.chunkSize,
                    overrides: decoded.overrides,
                });
                if (res.applied) {
                    applied = true;
                }
            }
        }

        expect(seenParts).toBeGreaterThan(2);
        expect(applied).toBe(true);
        expect(cache.getGlobal(0, 0)).toBe(maxValue >>> 0);
    } finally {
        if (prev === undefined) {
            delete process.env.BQ_TEST_CHUNK_SNAPSHOT_MAX_UTF8_BYTES;
        } else {
            process.env.BQ_TEST_CHUNK_SNAPSHOT_MAX_UTF8_BYTES = prev;
        }
    }
});
