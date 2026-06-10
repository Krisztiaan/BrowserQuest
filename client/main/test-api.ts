import type App from '../app';
import type Game from '../game';
import Mob from '../mob';
import Types from '../../shared/gametypes-browser';
import type { EntityKind } from '../../shared/entity-kind-domain';
import { getZoneGroupIdFromGrid } from '../../shared/world/coordinate-contract';
import { entityIdFromWire } from '../../shared/domain/ids';

type TestEntity = {
    id: number;
    kind: EntityKind;
    gridX?: number;
    gridY?: number;
};

type ZoneTarget = { x: number; y: number; group: string };
type TestEntities = { mobs: TestEntity[]; items: TestEntity[] };
type DoorDestination = {
    x: number;
    y: number;
    orientation: number;
    cameraX?: number;
    cameraY?: number;
    portal: boolean;
};
type TestApi = {
    isBootstrapped: () => boolean;
    startSession: (name: string) => void;
    isReady: () => boolean;
    getPlayerPos: () => { ok: boolean; reason?: string; x: number | null; y: number | null };
    setMapDebugOverlayMode: (mode: string) => { ok: boolean; reason?: string };
    getOverlayTileValue: (x: number, y: number) => number | null;
    getIntentStatus: (seq: number) => { status: 'invalid' | 'pending' | 'acked' | 'rejected'; intentTypeId?: string; reason?: string };
    sendClaimCreateIntent: (payload: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        editors?: string[];
    }) => { ok: boolean; reason?: string; seq: number | null };
    sendTileEditIntent: (x: number, y: number, value: number | null) => { ok: boolean; reason?: string; seq: number | null };
    clickTile: (x: number, y: number) => { ok: boolean; reason?: string };
    getDoorDestination: (x: number, y: number) => { ok: boolean; reason?: string; destination: DoorDestination | null };
    moveToDifferentZone: () => { ok: boolean; reason?: string; from?: ZoneTarget; to?: ZoneTarget };
    getActionTargets: () => {
        ready: boolean;
        mobId: string | number | null;
        itemId: string | number | null;
        mobCount: number;
        itemCount: number;
    };
    sendCombatLootProbe: () => {
        ok: boolean;
        reason?: string;
        mobId?: string | number;
        itemId?: string | number;
        mobCount?: number;
        itemCount?: number;
        itemX?: number;
        itemY?: number;
    };
    sendAggroProbe: () => {
        ok: boolean;
        reason?: string;
        mobId?: string | number;
        mobCount?: number;
    };
    moveNearNearestMobProbe: () => {
        ok: boolean;
        reason?: string;
        mobId?: string | number;
        mobCount?: number;
        targetX?: number;
        targetY?: number;
    };
    getAggroProbeStatus: () => {
        ready: boolean;
        mobId: string | number | null;
        dist: number | null;
        mobIsAttacking: boolean | null;
        mobIsMoving: boolean | null;
        mobHasTargetPlayer: boolean | null;
        mobIsAdjacentNonDiagonal: boolean | null;
    };
    sendKillDespawnProbe: () => {
        ok: boolean;
        reason?: string;
        mobId?: string | number;
        mobCount?: number;
        targetX?: number;
        targetY?: number;
    };
    getKillDespawnStatus: () => {
        ready: boolean;
        requestedMobId: string | number | null;
        mobPresent: boolean;
        mobId: string | number | null;
        dist: number | null;
        mobIsDead: boolean | null;
        playerTargetId: string | number | null;
        nearestMobId: string | number | null;
    };
};

declare global {
    interface GlobalThis {
        __BQ_TEST_MODE__?: boolean;
        __BQ_TEST_API?: TestApi;
    }
}

const TEST_ZONE_WIDTH = 28;
const TEST_ZONE_HEIGHT = 12;
const isSafeInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);

const getZoneGroupId = function (x: number, y: number): string {
    return getZoneGroupIdFromGrid(x, y, TEST_ZONE_WIDTH, TEST_ZONE_HEIGHT);
};

const getTestEntities = function (game: Game): TestEntities {
    if (!game.started) {
        return { mobs: [], items: [] };
    }

    const mobs: TestEntity[] = [];
    const items: TestEntity[] = [];

    Object.values(game.entities).forEach(function (entity?: TestEntity) {
        if (!entity || !isSafeInteger(entity.id) || !isSafeInteger(entity.kind)) {
            return;
        }
        if (entity.id === game.player.id) {
            return;
        }

        if (Types.isMob(entity.kind)) {
            mobs.push(entity);
        }
        if (Types.isItem(entity.kind)) {
            items.push(entity);
        }
    });

    return { mobs, items };
};
export const installTestApi = function ({ app, game }: { app: App; game: Game }): void {
    const testGlobals = globalThis as typeof globalThis & {
        __BQ_TEST_MODE__?: boolean;
        __BQ_TEST_API?: TestApi;
    };
    if (!testGlobals.__BQ_TEST_MODE__) {
        return;
    }

    let lastAggroMobId: string | number | null = null;
    let lastKillProbeMobId: string | number | null = null;
    let killProbeInterval: ReturnType<typeof setInterval> | null = null;
    let killProbeTimeout: ReturnType<typeof setTimeout> | null = null;
    const intentResults = new Map<number, { status: 'pending' | 'acked' | 'rejected'; intentTypeId?: string; reason?: string }>();
    let intentListenersBound = false;

    const stopKillProbe = (): void => {
        if (killProbeInterval) {
            clearInterval(killProbeInterval);
            killProbeInterval = null;
        }
        if (killProbeTimeout) {
            clearTimeout(killProbeTimeout);
            killProbeTimeout = null;
        }
    };

    const bindIntentListeners = function (): void {
        if (intentListenersBound || !game.client) {
            return;
        }
        intentListenersBound = true;
        game.client.on('intentAcked', function (seq: number) {
            intentResults.set(seq, { status: 'acked' });
        });
        game.client.on('intentRejected', function (seq: number, intentTypeId: string, reason: string) {
            intentResults.set(seq, { status: 'rejected', intentTypeId, reason });
        });
    };

    testGlobals.__BQ_TEST_API = {
        isBootstrapped: function () {
            return !!(app.ready && (game.map as NonNullable<Game['map']>).isLoaded);
        },

        startSession: function (name: string) {
            if (typeof name !== 'string') {
                return;
            }
            intentResults.clear();
            const trimmed = name.trim();
            const input = document.getElementById('nameinput') as HTMLInputElement | null;
            if (input) {
                input.value = trimmed;
                input.setAttribute('value', trimmed);
                input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
            }
            app.tryStartingGame(trimmed, undefined);
        },

        isReady: function () {
            return Boolean(game.started && game.client && (game.map as NonNullable<Game['map']>).isLoaded && game.player);
        },

        getPlayerPos: function () {
            if (!(game.map as NonNullable<Game['map']>).isLoaded) {
                return { ok: false, reason: 'not_ready', x: null, y: null };
            }
            return { ok: true, x: game.player.gridX, y: game.player.gridY };
        },

        setMapDebugOverlayMode: function (mode: string) {
            if (mode !== 'none' && mode !== 'passability') {
                return { ok: false, reason: 'invalid_mode' };
            }
            game.setMapDebugOverlayMode(mode);
            return { ok: true };
        },

        getOverlayTileValue: function (x: number, y: number) {
            if (!(game.map as NonNullable<Game['map']>).isLoaded || !Number.isInteger(x) || !Number.isInteger(y)) {
                return null;
            }
            return game.kernel.clientChunkOverlayCache.getGlobal(x, y);
        },

        getIntentStatus: function (seq: number) {
            if (!isSafeInteger(seq) || seq < 0) {
                return { status: 'invalid' };
            }
            return intentResults.get(seq) ?? { status: 'pending' };
        },

        sendClaimCreateIntent: function ({
            x1,
            y1,
            x2,
            y2,
            editors,
        }: {
            x1: number;
            y1: number;
            x2: number;
            y2: number;
            editors?: string[];
        }) {
            if (!game.client || !(game.map as NonNullable<Game['map']>).isLoaded) {
                return { ok: false, reason: 'not_ready', seq: null };
            }
            bindIntentListeners();
            const seq = game.client.sendClaimCreate({ x1, y1, x2, y2, editors: Array.isArray(editors) ? editors : [] });
            if (seq === null) {
                return { ok: false, reason: 'unsupported_or_invalid', seq: null };
            }
            intentResults.set(seq, { status: 'pending' });
            return { ok: true, seq };
        },

        sendTileEditIntent: function (x: number, y: number, value: number | null) {
            if (!game.client || !(game.map as NonNullable<Game['map']>).isLoaded) {
                return { ok: false, reason: 'not_ready', seq: null };
            }
            bindIntentListeners();
            const seq = game.client.sendTileEdit(x, y, value);
            if (seq === null) {
                return { ok: false, reason: 'unsupported_or_invalid', seq: null };
            }
            intentResults.set(seq, { status: 'pending' });
            return { ok: true, seq };
        },

        clickTile: function (x: number, y: number) {
            if (!(game.map as NonNullable<Game['map']>).isLoaded) {
                return { ok: false, reason: 'not_ready' };
            }
            if (typeof x !== 'number' || typeof y !== 'number' || !Number.isInteger(x) || !Number.isInteger(y)) {
                return { ok: false, reason: 'invalid_coords' };
            }
            game.kernel.setClientClickIntent({ x, y });
            return { ok: true };
        },

        getDoorDestination: function (x: number, y: number) {
            if (!(game.map as NonNullable<Game['map']>).isLoaded) {
                return { ok: false, reason: 'not_ready', destination: null };
            }
            if (!(game.map as NonNullable<Game['map']>).isDoor(x, y)) {
                return { ok: true, destination: null };
            }
            const destination = (game.map as NonNullable<Game['map']>).getDoorDestination(x, y);
            if (!destination) {
                return { ok: true, destination: null };
            }
            return { ok: true, destination };
        },

        moveToDifferentZone: function () {
            if (!game.client || !(game.map as NonNullable<Game['map']>).isLoaded) {
                return { ok: false, reason: 'not_ready' };
            }

            const currentX = game.player.gridX,
                currentY = game.player.gridY,
                currentGroup = getZoneGroupId(currentX, currentY),
                width = (game.map as NonNullable<Game['map']>).width,
                height = (game.map as NonNullable<Game['map']>).height,
                offsets = [28, -28, 56, -56, 84, -84, 112, -112],
                yOffsets = [0, 12, -12, 24, -24, 36, -36];
            let target: ZoneTarget | null = null;
            for (const xOffset of offsets) {
                for (const yOffset of yOffsets) {
                    const x = currentX + xOffset;
                    const y = currentY + yOffset;

                    if (x <= 1 || y <= 1 || x >= width || y >= height) {
                        continue;
                    }
                    if ((game.map as NonNullable<Game['map']>).isColliding(x, y)) {
                        continue;
                    }

                    const group = getZoneGroupId(x, y);
                    if (group === currentGroup) {
                        continue;
                    }

                    target = { x, y, group };
                    break;
                }
                if (target) {
                    break;
                }
            }

            if (target === null) {
                return { ok: false, reason: 'no_target' };
            }

            game.kernel.enqueueClientCommand({ type: 'clientSendMove', x: target.x, y: target.y });
            game.kernel.enqueueClientCommand({ type: 'clientSendZone' });

            return {
                ok: true,
                from: { x: currentX, y: currentY, group: currentGroup },
                to: target,
            };
        },

        getActionTargets: function () {
            if (!game.client || !(game.map as NonNullable<Game['map']>).isLoaded) {
                return { ready: false, mobId: null, itemId: null, mobCount: 0, itemCount: 0 };
            }

            const entities = getTestEntities(game),
                mob = entities.mobs[0],
                item = entities.items[0];

            return {
                ready: true,
                mobId: mob ? mob.id : null,
                itemId: item ? item.id : null,
                mobCount: entities.mobs.length,
                itemCount: entities.items.length,
            };
        },

        sendCombatLootProbe: function () {
            if (!game.client || !(game.map as NonNullable<Game['map']>).isLoaded) {
                return { ok: false, reason: 'not_ready' };
            }

            const entities = getTestEntities(game),
                mob = entities.mobs[0],
                item = entities.items[0];

            if (!mob) {
                return {
                    ok: false,
                    reason: 'no_mob',
                    mobCount: entities.mobs.length,
                    itemCount: entities.items.length,
                };
            }
            if (!item) {
                return {
                    ok: false,
                    reason: 'no_item',
                    mobCount: entities.mobs.length,
                    itemCount: entities.items.length,
                };
            }
            if (!isSafeInteger(item.gridX) || !isSafeInteger(item.gridY)) {
                return { ok: false, reason: 'item_position_invalid', itemId: item.id };
            }
            if (!isSafeInteger(mob.id) || !isSafeInteger(item.id)) {
                return { ok: false, reason: 'entity_id_invalid' };
            }
            const itemX = item.gridX;
            const itemY = item.gridY;
            if (!isSafeInteger(itemX) || !isSafeInteger(itemY)) {
                return { ok: false, reason: 'item_position_invalid', itemId: item.id };
            }

            const mobId = entityIdFromWire(mob.id);
            const itemId = entityIdFromWire(item.id);

            game.kernel.enqueueClientCommand({ type: 'clientSendAttack', mobId });
            game.kernel.enqueueClientCommand({
                type: 'clientSendLootMove',
                itemId,
                x: itemX,
                y: itemY,
            });

            return {
                ok: true,
                mobId: mob.id,
                itemId: item.id,
                itemX,
                itemY,
            };
        },
	        sendAggroProbe: function () {
	            if (!game.client || !(game.map as NonNullable<Game['map']>).isLoaded) {
	                return { ok: false, reason: 'not_ready' };
	            }
                const activeGame = game;
                const activeMap = (activeGame.map as NonNullable<Game['map']>);

	            const entities = getTestEntities(game);

	            const playerX = activeGame.player.gridX;
	            const playerY = activeGame.player.gridY;
	            let mob: TestEntity | null = null;
	            let tile: { x: number; y: number } | null = null;
	            let bestDist = Number.POSITIVE_INFINITY;

            for (const candidate of entities.mobs) {
                const candidateX = candidate.gridX;
                const candidateY = candidate.gridY;
                if (!isSafeInteger(candidateX) || !isSafeInteger(candidateY)) {
                    continue;
                }
	                const candidateTiles = [
	                    { x: candidateX - 1, y: candidateY },
	                    { x: candidateX + 1, y: candidateY },
	                    { x: candidateX, y: candidateY - 1 },
	                    { x: candidateX, y: candidateY + 1 },
	                ].filter(
                        (nextTile) =>
                            !activeMap.isOutOfBounds(nextTile.x, nextTile.y) && !activeMap.isColliding(nextTile.x, nextTile.y)
                    );

	                if (candidateTiles.length === 0) {
	                    continue;
	                }

	                candidateTiles.sort((a, b) => {
	                    const da = Math.abs(a.x - playerX) + Math.abs(a.y - playerY);
	                    const db = Math.abs(b.x - playerX) + Math.abs(b.y - playerY);
	                    return da - db;
	                });

	                const nextTile = candidateTiles[0];
	                if (!nextTile) {
	                    continue;
	                }

                const dist = Math.abs(candidateX - playerX) + Math.abs(candidateY - playerY);
	                if (dist < bestDist) {
	                    bestDist = dist;
	                    mob = candidate;
	                    tile = nextTile;
	                }
	            }

	            if (!mob || !tile) {
	                return { ok: false, reason: 'no_mob', mobCount: entities.mobs.length };
	            }

	            activeGame.kernel.enqueueClientCommand({ type: 'clientSendMove', x: tile.x, y: tile.y });

	            lastAggroMobId = mob.id;
	            activeGame.kernel.enqueueClientCommand({ type: 'clientSendAggro', mobId: entityIdFromWire(mob.id) });

	            return {
	                ok: true,
	                mobId: mob.id,
	                mobCount: entities.mobs.length,
	                targetX: tile.x,
	                targetY: tile.y,
	            };
	        },
        getAggroProbeStatus: function () {
            if (!game.client || !(game.map as NonNullable<Game['map']>).isLoaded) {
                return {
                    ready: false,
                    mobId: null,
                    dist: null,
                    mobIsAttacking: null,
                    mobIsMoving: null,
                    mobHasTargetPlayer: null,
                    mobIsAdjacentNonDiagonal: null,
                };
            }

            const player = game.player;

            let mob: Mob | null = null;

            if (lastAggroMobId !== null) {
                const entity = game.entities[String(lastAggroMobId)];
                if (entity instanceof Mob) {
                    mob = entity;
                }
            }

            if (!mob) {
                let bestDist = Number.POSITIVE_INFINITY;
                for (const entity of Object.values(game.entities)) {
                    if (!(entity instanceof Mob)) {
                        continue;
                    }
                    if (entity.id === player.id) {
                        continue;
                    }
                    const dist = Math.abs(entity.gridX - player.gridX) + Math.abs(entity.gridY - player.gridY);
                    if (dist < bestDist) {
                        bestDist = dist;
                        mob = entity;
                    }
                }
            }

            if (!mob) {
                return {
                    ready: true,
                    mobId: null,
                    dist: null,
                    mobIsAttacking: null,
                    mobIsMoving: null,
                    mobHasTargetPlayer: null,
                    mobIsAdjacentNonDiagonal: null,
                };
            }

            const dist = Math.abs(mob.gridX - player.gridX) + Math.abs(mob.gridY - player.gridY);
            const hasTargetPlayer = Boolean(mob.target?.id === player.id);

            return {
                ready: true,
                mobId: mob.id,
                dist,
                mobIsAttacking: mob.isAttacking(),
                mobIsMoving: mob.isMoving(),
                mobHasTargetPlayer: hasTargetPlayer,
                mobIsAdjacentNonDiagonal: mob.isAdjacentNonDiagonal(player),
            };
        },
        moveNearNearestMobProbe: function () {
            if (!game.client || !(game.map as NonNullable<Game['map']>).isLoaded) {
                return { ok: false, reason: 'not_ready' };
            }
            const activeGame = game;
            const activeMap = (activeGame.map as NonNullable<Game['map']>);

            const entities = getTestEntities(game);
            const player = activeGame.player;
            const rankMobForKillProbe = (entity: TestEntity): number => {
                if (entity.kind === Types.Entities.RAT) {
                    return 0;
                }
                if (entity.kind === Types.Entities.BAT) {
                    return 1;
                }
                if (entity.kind === Types.Entities.GOBLIN) {
                    return 2;
                }
                return 10;
            };

            let mob: TestEntity | null = null;
            let bestRank = Number.POSITIVE_INFINITY;
            let bestDist = Number.POSITIVE_INFINITY;

            for (const candidate of entities.mobs) {
                const candidateX = candidate.gridX;
                const candidateY = candidate.gridY;
                if (!isSafeInteger(candidateX) || !isSafeInteger(candidateY)) {
                    continue;
                }
                const rank = rankMobForKillProbe(candidate);
                const dist = Math.abs(candidateX - player.gridX) + Math.abs(candidateY - player.gridY);
                if (rank < bestRank || (rank === bestRank && dist < bestDist)) {
                    bestRank = rank;
                    bestDist = dist;
                    mob = candidate;
                }
            }

            if (!mob) {
                return { ok: false, reason: 'no_mob', mobCount: entities.mobs.length };
            }

            const mobX = mob.gridX;
            const mobY = mob.gridY;
            if (!isSafeInteger(mobX) || !isSafeInteger(mobY)) {
                return { ok: false, reason: 'mob_position_invalid', mobId: mob.id };
            }

            const candidateTiles = [
                { x: mobX - 1, y: mobY },
                { x: mobX + 1, y: mobY },
                { x: mobX, y: mobY - 1 },
                { x: mobX, y: mobY + 1 },
            ].filter((tile) => !activeMap.isOutOfBounds(tile.x, tile.y) && !activeMap.isColliding(tile.x, tile.y));

            candidateTiles.sort((a, b) => {
                const da = Math.abs(a.x - player.gridX) + Math.abs(a.y - player.gridY);
                const db = Math.abs(b.x - player.gridX) + Math.abs(b.y - player.gridY);
                return da - db;
            });

            const tile = candidateTiles[0];
            if (!tile) {
                return { ok: false, reason: 'no_adjacent_tile', mobId: mob.id };
            }

            lastAggroMobId = mob.id;
            activeGame.kernel.enqueueClientCommand({ type: 'clientSendMove', x: tile.x, y: tile.y });

            return {
                ok: true,
                mobId: mob.id,
                mobCount: entities.mobs.length,
                targetX: tile.x,
                targetY: tile.y,
            };
        },
        sendKillDespawnProbe: function () {
            if (!game.client || !(game.map as NonNullable<Game['map']>).isLoaded) {
                return { ok: false, reason: 'not_ready' };
            }
            const activeGame = game;
            const activeMap = (activeGame.map as NonNullable<Game['map']>);

            const entities = getTestEntities(game);
            const player = activeGame.player;

            const rankMobForKillProbe = (entity: TestEntity): number => {
                if (entity.kind === Types.Entities.RAT) {
                    return 0;
                }
                if (entity.kind === Types.Entities.BAT) {
                    return 1;
                }
                if (entity.kind === Types.Entities.GOBLIN) {
                    return 2;
                }
                return 10;
            };

            let mob: TestEntity | null = null;
            let bestRank = Number.POSITIVE_INFINITY;
            let bestDist = Number.POSITIVE_INFINITY;

            for (const candidate of entities.mobs) {
                const candidateX = candidate.gridX;
                const candidateY = candidate.gridY;
                if (!isSafeInteger(candidateX) || !isSafeInteger(candidateY)) {
                    continue;
                }
                const rank = rankMobForKillProbe(candidate);
                const dist = Math.abs(candidateX - player.gridX) + Math.abs(candidateY - player.gridY);
                if (rank < bestRank || (rank === bestRank && dist < bestDist)) {
                    bestRank = rank;
                    bestDist = dist;
                    mob = candidate;
                }
            }

            if (!mob) {
                return { ok: false, reason: 'no_mob', mobCount: entities.mobs.length };
            }

            const mobX = mob.gridX;
            const mobY = mob.gridY;
            if (!isSafeInteger(mobX) || !isSafeInteger(mobY)) {
                return { ok: false, reason: 'mob_position_invalid', mobId: mob.id };
            }

            const candidateTiles = [
                { x: mobX - 1, y: mobY },
                { x: mobX + 1, y: mobY },
                { x: mobX, y: mobY - 1 },
                { x: mobX, y: mobY + 1 },
            ].filter((tile) => !activeMap.isOutOfBounds(tile.x, tile.y) && !activeMap.isColliding(tile.x, tile.y));

            candidateTiles.sort((a, b) => {
                const da = Math.abs(a.x - player.gridX) + Math.abs(a.y - player.gridY);
                const db = Math.abs(b.x - player.gridX) + Math.abs(b.y - player.gridY);
                return da - db;
            });

            const tile = candidateTiles[0];
            if (!tile) {
                return { ok: false, reason: 'no_adjacent_tile', mobId: mob.id };
            }

            lastKillProbeMobId = mob.id;

            stopKillProbe();

            const killMobId = mob.id;
            const runKillProbeTick = () => {
                const currentGame = game;
                if (!currentGame.client || !(currentGame.map as NonNullable<Game['map']>).isLoaded) {
                    stopKillProbe();
                    return;
                }
                const currentMap = (currentGame.map as NonNullable<Game['map']>);

                const liveMob = currentGame.entities[String(killMobId)];
                if (!(liveMob instanceof Mob) || liveMob.isDead) {
                    stopKillProbe();
                    return;
                }

                if (!liveMob.isAdjacentNonDiagonal(currentGame.player)) {
                    const chaseTiles = [
                        { x: liveMob.gridX - 1, y: liveMob.gridY },
                        { x: liveMob.gridX + 1, y: liveMob.gridY },
                        { x: liveMob.gridX, y: liveMob.gridY - 1 },
                        { x: liveMob.gridX, y: liveMob.gridY + 1 },
                    ].filter((candidate) =>
                        !currentMap.isOutOfBounds(candidate.x, candidate.y) && !currentMap.isColliding(candidate.x, candidate.y)
                    );

                    chaseTiles.sort((a, b) => {
                        const da = Math.abs(a.x - currentGame.player.gridX) + Math.abs(a.y - currentGame.player.gridY);
                        const db = Math.abs(b.x - currentGame.player.gridX) + Math.abs(b.y - currentGame.player.gridY);
                        return da - db;
                    });

                    const chaseTile = chaseTiles[0];
                    if (chaseTile) {
                        currentGame.kernel.enqueueClientCommand({ type: 'clientSendMove', x: chaseTile.x, y: chaseTile.y });
                    }
                }

                currentGame.kernel.enqueueClientCommand({ type: 'clientSendAttack', mobId: entityIdFromWire(killMobId) });
            };

            runKillProbeTick();
            const interval = setInterval(runKillProbeTick, 250);
            killProbeInterval = interval;
            killProbeTimeout = setTimeout(() => {
                if (killProbeInterval === interval) {
                    stopKillProbe();
                }
            }, 12_000);

            return {
                ok: true,
                mobId: mob.id,
                mobCount: entities.mobs.length,
                targetX: tile.x,
                targetY: tile.y,
            };
        },
        getKillDespawnStatus: function () {
            if (!game.client || !(game.map as NonNullable<Game['map']>).isLoaded) {
                return {
                    ready: false,
                    requestedMobId: null,
                    mobPresent: false,
                    mobId: null,
                    dist: null,
                    mobIsDead: null,
                    playerTargetId: null,
                    nearestMobId: null,
                };
            }
            const activeGame = game;

            const requestedMobId = lastKillProbeMobId;
            const requestedEntity = requestedMobId !== null ? activeGame.entities[String(requestedMobId)] : null;
            const requestedMob = requestedEntity instanceof Mob ? requestedEntity : null;

            let nearestMobId: string | number | null = null;
            let nearestDist = Number.POSITIVE_INFINITY;
            for (const entity of Object.values(activeGame.entities)) {
                if (!(entity instanceof Mob)) {
                    continue;
                }
                const dist = Math.abs(entity.gridX - activeGame.player.gridX) + Math.abs(entity.gridY - activeGame.player.gridY);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestMobId = entity.id;
                }
            }

            const playerTargetId = activeGame.player.target ? activeGame.player.target.id : null;

            if (!requestedMob) {
                return {
                    ready: true,
                    requestedMobId,
                    mobPresent: false,
                    mobId: null,
                    dist: null,
                    mobIsDead: null,
                    playerTargetId,
                    nearestMobId,
                };
            }

            const dist = Math.abs(requestedMob.gridX - activeGame.player.gridX) + Math.abs(requestedMob.gridY - activeGame.player.gridY);
            return {
                ready: true,
                requestedMobId,
                mobPresent: true,
                mobId: requestedMob.id,
                dist,
                mobIsDead: requestedMob.isDead,
                playerTargetId,
                nearestMobId,
            };
        },
    };
};
