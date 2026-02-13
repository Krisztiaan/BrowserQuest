import App from './app';
import Detect from './platform/detect';
import log from './platform/log';
import Types from '../shared/gametypes-browser';
import type { EntityKind } from '../shared/entity-kind-domain';
import type { AchievementId } from './achievement-domain';
import { TRANSITIONEND } from './platform/util';
import type Game from './game';
import Mob from './mob';
import sprites from './sprites';

type TestEntity = {
    id: string | number;
    kind: EntityKind;
    gridX?: number;
    gridY?: number;
};

type ZoneTarget = { x: number; y: number; group: string };
type TestEntities = { mobs: TestEntity[]; items: TestEntity[] };
type TestApi = {
    isReady: () => boolean;
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

let app: App | null = null,
    game: Game | null = null;
const TEST_ZONE_WIDTH = 28;
const TEST_ZONE_HEIGHT = 12;
const SERVER_PLAYER_IMAGE_SRC = '/profile/preview.svg';
const SERVER_PLAYER_PREVIEW_JSON_URL = '/profile/preview.json';
const FALLBACK_PLAYER_IMAGE_SRC = '/img/common/thingy.png';
const DEFAULT_ARMOR_SPRITE = 'clotharmor';
const DEFAULT_WEAPON_SPRITE = 'sword1';
const SHADOW_SPRITE = 'shadow16';
const IDLE_ANIMATION_INTERVAL_MS = 260;

const getZoneGroupId = function (x: number, y: number): string {
    const gx = Math.floor((x - 1) / TEST_ZONE_WIDTH),
        gy = Math.floor((y - 1) / TEST_ZONE_HEIGHT);

    return gx + '-' + gy;
};

const getTestEntities = function (): TestEntities {
    if (!game?.entities || !game.started) {
        return { mobs: [], items: [] };
    }

    const mobs: TestEntity[] = [],
        items: TestEntity[] = [];

    Object.values(game.entities).forEach(function (entity?: TestEntity) {
        if (!entity || !Number.isSafeInteger(entity.id) || !Number.isSafeInteger(entity.kind)) {
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

    return { mobs: mobs, items: items };
};

type SpriteSpec = {
    width: number;
    height: number;
    offset_x?: number;
    offset_y?: number;
    animations?: Record<string, { row: number; length: number }>;
};
type PreviewPayload = {
    armorSpriteName?: unknown;
    weaponSpriteName?: unknown;
};
type PreviewRuntime = {
    armorSpec: SpriteSpec;
    weaponSpec: SpriteSpec;
    shadowSpec: SpriteSpec;
    armorImage: HTMLImageElement;
    weaponImage: HTMLImageElement;
    shadowImage: HTMLImageElement;
    armorIdleRow: number;
    weaponIdleRow: number;
    frameCount: number;
};

const getSpriteSpec = function (spriteName: string): SpriteSpec | null {
    const spriteSpec = sprites[spriteName];
    if (!spriteSpec) {
        return null;
    }
    if (!Number.isFinite(spriteSpec.width) || !Number.isFinite(spriteSpec.height)) {
        return null;
    }
    return spriteSpec as unknown as SpriteSpec;
};

const getSpriteOffset = function (spriteSpec: SpriteSpec): { x: number; y: number } {
    return {
        x: Number.isFinite(spriteSpec.offset_x) ? Number(spriteSpec.offset_x) : -16,
        y: Number.isFinite(spriteSpec.offset_y) ? Number(spriteSpec.offset_y) : -16,
    };
};

const getIdleDownRow = function (spriteSpec: SpriteSpec): number {
    const row = spriteSpec.animations?.idle_down?.row;
    if (typeof row !== 'number' || !Number.isFinite(row)) {
        return 0;
    }
    return Math.max(0, row);
};

const getIdleDownLength = function (spriteSpec: SpriteSpec): number {
    const length = spriteSpec.animations?.idle_down?.length;
    if (typeof length !== 'number' || !Number.isFinite(length)) {
        return 1;
    }
    return Math.max(1, Math.trunc(length));
};

const loadImageAsset = function (src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', function () {
            resolve(image);
        });
        image.addEventListener('error', function () {
            reject(new Error(`Failed to load image asset: ${src}`));
        });
        image.src = src;
    });
};

const resolveArmorSpriteName = function (raw: unknown): string {
    if (typeof raw !== 'string') {
        return DEFAULT_ARMOR_SPRITE;
    }
    const kind = Types.getKindFromString(raw);
    if (typeof kind !== 'number' || !Types.isArmor(kind)) {
        return DEFAULT_ARMOR_SPRITE;
    }
    return raw;
};

const resolveWeaponSpriteName = function (raw: unknown): string {
    if (typeof raw !== 'string') {
        return DEFAULT_WEAPON_SPRITE;
    }
    const kind = Types.getKindFromString(raw);
    if (typeof kind !== 'number' || !Types.isWeapon(kind)) {
        return DEFAULT_WEAPON_SPRITE;
    }
    return raw;
};

const loadLoadCharacterPreviewRuntime = async function (): Promise<PreviewRuntime | null> {
    const payload: PreviewPayload = {};
    try {
        const response = await fetch(SERVER_PLAYER_PREVIEW_JSON_URL, {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
        });
        if (response.ok) {
            const parsed = (await response.json()) as PreviewPayload;
            payload.armorSpriteName = parsed.armorSpriteName;
            payload.weaponSpriteName = parsed.weaponSpriteName;
        }
    } catch {
        // use defaults
    }

    const armorSpriteName = resolveArmorSpriteName(payload.armorSpriteName);
    const weaponSpriteName = resolveWeaponSpriteName(payload.weaponSpriteName);

    const armorSpec = getSpriteSpec(armorSpriteName) ?? getSpriteSpec(DEFAULT_ARMOR_SPRITE);
    const weaponSpec = getSpriteSpec(weaponSpriteName) ?? getSpriteSpec(DEFAULT_WEAPON_SPRITE);
    const shadowSpec = getSpriteSpec(SHADOW_SPRITE);
    if (!armorSpec || !weaponSpec || !shadowSpec) {
        return null;
    }

    let shadowImage: HTMLImageElement;
    let armorImage: HTMLImageElement;
    let weaponImage: HTMLImageElement;
    try {
        [shadowImage, armorImage, weaponImage] = await Promise.all([
            loadImageAsset(`/img/1/${SHADOW_SPRITE}.png`),
            loadImageAsset(`/img/1/${encodeURIComponent(armorSpriteName)}.png`),
            loadImageAsset(`/img/1/${encodeURIComponent(weaponSpriteName)}.png`),
        ]);
    } catch {
        return null;
    }

    return {
        armorSpec,
        weaponSpec,
        shadowSpec,
        armorImage,
        weaponImage,
        shadowImage,
        armorIdleRow: getIdleDownRow(armorSpec),
        weaponIdleRow: getIdleDownRow(weaponSpec),
        frameCount: Math.max(getIdleDownLength(armorSpec), getIdleDownLength(weaponSpec)),
    };
};

const hydrateLoadCharacterPreview = function (playerImage: HTMLImageElement): void {
    void loadLoadCharacterPreviewRuntime().then((runtime) => {
        if (!runtime) {
            playerImage.src = SERVER_PLAYER_IMAGE_SRC;
            return;
        }

        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = runtime.armorSpec.width;
        previewCanvas.height = runtime.armorSpec.height;
        const context = previewCanvas.getContext('2d');
        if (!context) {
            playerImage.src = SERVER_PLAYER_IMAGE_SRC;
            return;
        }

        context.imageSmoothingEnabled = false;
        const armorOffset = getSpriteOffset(runtime.armorSpec);
        const weaponOffset = getSpriteOffset(runtime.weaponSpec);

        const drawFrame = function (frameIndex: number): void {
            const armorFrameIndex = frameIndex % getIdleDownLength(runtime.armorSpec);
            const weaponFrameIndex = frameIndex % getIdleDownLength(runtime.weaponSpec);

            context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            context.drawImage(
                runtime.shadowImage,
                0,
                0,
                runtime.shadowSpec.width,
                runtime.shadowSpec.height,
                -armorOffset.x,
                -armorOffset.y,
                runtime.shadowSpec.width,
                runtime.shadowSpec.height
            );
            context.drawImage(
                runtime.armorImage,
                runtime.armorSpec.width * armorFrameIndex,
                runtime.armorSpec.height * runtime.armorIdleRow,
                runtime.armorSpec.width,
                runtime.armorSpec.height,
                0,
                0,
                runtime.armorSpec.width,
                runtime.armorSpec.height
            );
            context.drawImage(
                runtime.weaponImage,
                runtime.weaponSpec.width * weaponFrameIndex,
                runtime.weaponSpec.height * runtime.weaponIdleRow,
                runtime.weaponSpec.width,
                runtime.weaponSpec.height,
                weaponOffset.x - armorOffset.x,
                weaponOffset.y - armorOffset.y,
                runtime.weaponSpec.width,
                runtime.weaponSpec.height
            );
            playerImage.src = previewCanvas.toDataURL('image/png');
        };

        drawFrame(0);

        if (runtime.frameCount > 1) {
            let frameIndex = 1;
            setInterval(function () {
                if (!document.body.classList.contains('returning')) {
                    return;
                }
                drawFrame(frameIndex);
                frameIndex = (frameIndex + 1) % runtime.frameCount;
            }, IDLE_ANIMATION_INTERVAL_MS);
        }
    });
};

const installTestApi = function (): void {
    if (!globalThis.__BQ_TEST_MODE__) {
        return;
    }

    let lastAggroMobId: string | number | null = null;
    let lastKillProbeMobId: string | number | null = null;
    let killProbeInterval: ReturnType<typeof setInterval> | null = null;

    globalThis.__BQ_TEST_API = {
        isReady: function () {
            return !!(game && game.started && game.client && game.map && game.map.isLoaded && game.player);
        },

        moveToDifferentZone: function () {
            if (!game?.client || !game.map?.isLoaded) {
                return { ok: false, reason: 'not_ready' };
            }

            const currentX = game.player.gridX,
                currentY = game.player.gridY,
                currentGroup = getZoneGroupId(currentX, currentY),
                width = game.map.width,
                height = game.map.height,
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
                    if (game.map.isColliding(x, y)) {
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
            if (!game?.client || !game.map?.isLoaded) {
                return { ready: false, mobId: null, itemId: null, mobCount: 0, itemCount: 0 };
            }

            const entities = getTestEntities(),
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
            if (!game?.client || !game.map?.isLoaded) {
                return { ok: false, reason: 'not_ready' };
            }

            const entities = getTestEntities(),
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
            if (!Number.isSafeInteger(item.gridX) || !Number.isSafeInteger(item.gridY)) {
                return { ok: false, reason: 'item_position_invalid', itemId: item.id };
            }

            game.kernel.enqueueClientCommand({ type: 'clientSendAttack', mobId: mob.id as never });
            game.kernel.enqueueClientCommand({ type: 'clientSendHit', targetId: mob.id as never });
            game.kernel.enqueueClientCommand({
                type: 'clientSendLootMove',
                itemId: item.id as never,
                x: item.gridX,
                y: item.gridY,
            });

            return {
                ok: true,
                mobId: mob.id,
                itemId: item.id,
                itemX: item.gridX,
                itemY: item.gridY,
            };
        },
        sendAggroProbe: function () {
            if (!game?.client || !game.map?.isLoaded) {
                return { ok: false, reason: 'not_ready' };
            }

            const entities = getTestEntities();

            const playerX = game.player.gridX;
            const playerY = game.player.gridY;
            let mob: TestEntity | null = null;
            let bestDist = Number.POSITIVE_INFINITY;

            for (const candidate of entities.mobs) {
                if (!Number.isSafeInteger(candidate.gridX) || !Number.isSafeInteger(candidate.gridY)) {
                    continue;
                }
                const dist = Math.abs(candidate.gridX - playerX) + Math.abs(candidate.gridY - playerY);
                if (dist < bestDist) {
                    bestDist = dist;
                    mob = candidate;
                }
            }

            if (!mob) {
                return { ok: false, reason: 'no_mob', mobCount: entities.mobs.length };
            }

            const candidateTiles = [
                { x: (mob.gridX as number) - 1, y: mob.gridY as number },
                { x: (mob.gridX as number) + 1, y: mob.gridY as number },
                { x: mob.gridX as number, y: (mob.gridY as number) - 1 },
                { x: mob.gridX as number, y: (mob.gridY as number) + 1 },
            ].filter((tile) => !game.map.isOutOfBounds(tile.x, tile.y) && !game.map.isColliding(tile.x, tile.y));

            candidateTiles.sort((a, b) => {
                const da = Math.abs(a.x - playerX) + Math.abs(a.y - playerY);
                const db = Math.abs(b.x - playerX) + Math.abs(b.y - playerY);
                return da - db;
            });

            const tile = candidateTiles[0];
            if (tile) {
                game.kernel.enqueueClientCommand({ type: 'clientSendMove', x: tile.x, y: tile.y });
            }

            lastAggroMobId = mob.id;
            game.kernel.enqueueClientCommand({ type: 'clientSendAggro', mobId: mob.id as never });

            return {
                ok: true,
                mobId: mob.id,
                mobCount: entities.mobs.length,
            };
        },
        getAggroProbeStatus: function () {
            if (!game?.client || !game.map?.isLoaded) {
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
            const hasTargetPlayer = Boolean(mob.target && mob.target.id === player.id);

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
            if (!game?.client || !game.map?.isLoaded) {
                return { ok: false, reason: 'not_ready' };
            }

            const entities = getTestEntities();
            const player = game.player;
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
                if (!Number.isSafeInteger(candidate.gridX) || !Number.isSafeInteger(candidate.gridY)) {
                    continue;
                }
                const rank = rankMobForKillProbe(candidate);
                const dist = Math.abs(candidate.gridX - player.gridX) + Math.abs(candidate.gridY - player.gridY);
                if (rank < bestRank || (rank === bestRank && dist < bestDist)) {
                    bestRank = rank;
                    bestDist = dist;
                    mob = candidate;
                }
            }

            if (!mob) {
                return { ok: false, reason: 'no_mob', mobCount: entities.mobs.length };
            }

            const candidateTiles = [
                { x: (mob.gridX as number) - 1, y: mob.gridY as number },
                { x: (mob.gridX as number) + 1, y: mob.gridY as number },
                { x: mob.gridX as number, y: (mob.gridY as number) - 1 },
                { x: mob.gridX as number, y: (mob.gridY as number) + 1 },
            ].filter((tile) => !game.map.isOutOfBounds(tile.x, tile.y) && !game.map.isColliding(tile.x, tile.y));

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
            game.kernel.enqueueClientCommand({ type: 'clientSendMove', x: tile.x, y: tile.y });

            return {
                ok: true,
                mobId: mob.id,
                mobCount: entities.mobs.length,
                targetX: tile.x,
                targetY: tile.y,
            };
        },
        sendKillDespawnProbe: function () {
            if (!game?.client || !game.map?.isLoaded) {
                return { ok: false, reason: 'not_ready' };
            }

            const entities = getTestEntities();
            const player = game.player;

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
                if (!Number.isSafeInteger(candidate.gridX) || !Number.isSafeInteger(candidate.gridY)) {
                    continue;
                }
                const rank = rankMobForKillProbe(candidate);
                const dist = Math.abs(candidate.gridX - player.gridX) + Math.abs(candidate.gridY - player.gridY);
                if (rank < bestRank || (rank === bestRank && dist < bestDist)) {
                    bestRank = rank;
                    bestDist = dist;
                    mob = candidate;
                }
            }

            if (!mob) {
                return { ok: false, reason: 'no_mob', mobCount: entities.mobs.length };
            }

            const candidateTiles = [
                { x: (mob.gridX as number) - 1, y: mob.gridY as number },
                { x: (mob.gridX as number) + 1, y: mob.gridY as number },
                { x: mob.gridX as number, y: (mob.gridY as number) - 1 },
                { x: mob.gridX as number, y: (mob.gridY as number) + 1 },
            ].filter((tile) => !game.map.isOutOfBounds(tile.x, tile.y) && !game.map.isColliding(tile.x, tile.y));

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

            if (killProbeInterval) {
                clearInterval(killProbeInterval);
                killProbeInterval = null;
            }

            const killMobId = mob.id;
            const runKillProbeTick = () => {
                if (!game?.client || !game.map?.isLoaded) {
                    if (killProbeInterval) {
                        clearInterval(killProbeInterval);
                        killProbeInterval = null;
                    }
                    return;
                }

                const liveMob = game.entities[String(killMobId)];
                if (!(liveMob instanceof Mob) || liveMob.isDead) {
                    if (killProbeInterval) {
                        clearInterval(killProbeInterval);
                        killProbeInterval = null;
                    }
                    return;
                }

                if (!liveMob.isAdjacentNonDiagonal(game.player)) {
                    const chaseTiles = [
                        { x: liveMob.gridX - 1, y: liveMob.gridY },
                        { x: liveMob.gridX + 1, y: liveMob.gridY },
                        { x: liveMob.gridX, y: liveMob.gridY - 1 },
                        { x: liveMob.gridX, y: liveMob.gridY + 1 },
                    ].filter((candidate) =>
                        !game.map?.isOutOfBounds(candidate.x, candidate.y) && !game.map?.isColliding(candidate.x, candidate.y)
                    );

                    chaseTiles.sort((a, b) => {
                        const da = Math.abs(a.x - game.player.gridX) + Math.abs(a.y - game.player.gridY);
                        const db = Math.abs(b.x - game.player.gridX) + Math.abs(b.y - game.player.gridY);
                        return da - db;
                    });

                    const chaseTile = chaseTiles[0];
                    if (chaseTile) {
                        game.kernel.enqueueClientCommand({ type: 'clientSendMove', x: chaseTile.x, y: chaseTile.y });
                    }
                }

                game.kernel.enqueueClientCommand({ type: 'clientSendAttack', mobId: killMobId as never });
            };

            runKillProbeTick();
            killProbeInterval = setInterval(runKillProbeTick, 250);
            setTimeout(() => {
                if (killProbeInterval) {
                    clearInterval(killProbeInterval);
                    killProbeInterval = null;
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
            if (!game?.client || !game.map?.isLoaded) {
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

            const requestedMobId = lastKillProbeMobId;
            const requestedMob =
                requestedMobId !== null && game.entities[String(requestedMobId)] instanceof Mob
                    ? (game.entities[String(requestedMobId)] as Mob)
                    : null;

            let nearestMobId: string | number | null = null;
            let nearestDist = Number.POSITIVE_INFINITY;
            for (const entity of Object.values(game.entities)) {
                if (!(entity instanceof Mob)) {
                    continue;
                }
                const dist = Math.abs(entity.gridX - game.player.gridX) + Math.abs(entity.gridY - game.player.gridY);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestMobId = entity.id;
                }
            }

            const playerTargetId = game.player.target ? game.player.target.id : null;

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

            const dist = Math.abs(requestedMob.gridX - game.player.gridX) + Math.abs(requestedMob.gridY - game.player.gridY);
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

const initApp = function (): void {
    const onReady = function (): void {
        app = new App();
        app.center();

        if (Detect.isWindows()) {
            // Workaround for graphical glitches on text
            document.body.classList.add('windows');
        }

        if (Detect.isFirefoxAndroid()) {
            // Remove chat placeholder
            const chatInput = document.getElementById('chatinput');
            if (chatInput) {
                chatInput.removeAttribute('placeholder');
            }
        }

        const body = document.body,
            parchment = document.getElementById('parchment'),
            chatButton = document.getElementById('chatbutton'),
            helpButton = document.getElementById('helpbutton'),
            achievementsButton = document.getElementById('achievementsbutton'),
            instructions = document.getElementById('instructions'),
            playercount = document.getElementById('playercount'),
            population = document.getElementById('population'),
            toggleCredits = document.getElementById('toggle-credits'),
            toggleLegal = document.getElementById('toggle-legal'),
            createNew = document.querySelector('#create-new span'),
            cancel = document.querySelector('#cancel span'),
            nameInput = document.getElementById('nameinput'),
            previous = document.getElementById('previous'),
            next = document.getElementById('next'),
            achievements = document.getElementById('achievements'),
            lists = document.getElementById('lists'),
            notifications = document.querySelector('#notifications div'),
            playerName = document.getElementById('playername'),
            playerImage = document.getElementById('playerimage') as HTMLImageElement | null,
            resizeCheck = document.getElementById('resize-check');

        if (playerImage) {
            playerImage.src = FALLBACK_PLAYER_IMAGE_SRC;
            playerImage.addEventListener('error', function () {
                if (playerImage.src.endsWith(FALLBACK_PLAYER_IMAGE_SRC)) {
                    return;
                }
                playerImage.src = FALLBACK_PLAYER_IMAGE_SRC;
            });
            hydrateLoadCharacterPreview(playerImage);
        }

        body.addEventListener('click', function () {
            if (parchment?.classList.contains('credits')) {
                app.toggleScrollContent('credits');
            }

            if (parchment?.classList.contains('legal')) {
                app.toggleScrollContent('legal');
            }

            if (parchment?.classList.contains('about')) {
                app.toggleScrollContent('about');
            }
        });

        document.querySelectorAll('.barbutton').forEach(function (button: Element) {
            button.addEventListener('click', function () {
                button.classList.toggle('active');
            });
        });

        if (chatButton) {
            chatButton.addEventListener('click', function () {
                if (chatButton.classList.contains('active')) {
                    app.showChat();
                } else {
                    app.hideChat();
                }
            });
        }

        if (helpButton) {
            helpButton.addEventListener('click', function () {
                if (body.classList.contains('about')) {
                    app.closeInGameScroll('about');
                    helpButton.classList.remove('active');
                } else {
                    app.toggleScrollContent('about');
                }
            });
        }

        if (achievementsButton) {
            achievementsButton.addEventListener('click', function () {
                app.toggleAchievements();
                if (app.blinkInterval) {
                    clearInterval(app.blinkInterval);
                }
                achievementsButton.classList.remove('blink');
            });
        }

        if (instructions) {
            instructions.addEventListener('click', function () {
                app.hideWindows();
            });
        }

        if (playercount) {
            playercount.addEventListener('click', function () {
                app.togglePopulationInfo();
            });
        }

        if (population) {
            population.addEventListener('click', function () {
                app.togglePopulationInfo();
            });
        }

        document.querySelectorAll('.clickable').forEach(function (element: Element) {
            element.addEventListener('click', function (event: MouseEvent) {
                event.stopPropagation();
            });
        });

        if (toggleCredits) {
            toggleCredits.addEventListener('click', function () {
                app.toggleScrollContent('credits');
            });
        }

        if (toggleLegal) {
            toggleLegal.addEventListener('click', function () {
                app.toggleScrollContent('legal');
                if (game?.renderer?.mobile) {
                    if (parchment?.classList.contains('legal')) {
                        toggleLegal.textContent = 'close';
                    } else {
                        toggleLegal.textContent = 'Privacy';
                    }
                }
            });
        }

        if (createNew) {
            createNew.addEventListener('click', function () {
                app.animateParchment('loadcharacter', 'confirmation');
            });
        }

        document.querySelectorAll('.delete').forEach(function (element: Element) {
            element.addEventListener('click', function () {
                app.storage.clear();
                app.animateParchment('confirmation', 'createcharacter');
                body.classList.remove('returning');
            });
        });

        if (cancel) {
            cancel.addEventListener('click', function () {
                app.animateParchment('confirmation', 'loadcharacter');
            });
        }

        document.querySelectorAll('.ribbon').forEach(function (element: Element) {
            element.addEventListener('click', function () {
                app.toggleScrollContent('about');
            });
        });

        if (nameInput) {
            nameInput.addEventListener('keyup', function () {
                app.toggleButton();
            });
        }

        if (previous) {
            previous.addEventListener('click', function (event: MouseEvent) {
                if (app.currentPage === 1) {
                    event.preventDefault();
                    return false;
                } else {
                    app.currentPage -= 1;
                    if (achievements) {
                        achievements.className = 'active page' + app.currentPage;
                    }
                }
            });
        }

        if (next) {
            next.addEventListener('click', function (event: MouseEvent) {
                const nbPages = lists ? lists.querySelectorAll('ul').length : 0;

                if (app.currentPage === nbPages) {
                    event.preventDefault();
                    return false;
                } else {
                    app.currentPage += 1;
                    if (achievements) {
                        achievements.className = 'active page' + app.currentPage;
                    }
                }
            });
        }

        if (notifications) {
            notifications.addEventListener(TRANSITIONEND, () => app.resetMessagesPosition());
        }

        document.querySelectorAll('.close').forEach(function (element: Element) {
            element.addEventListener('click', function () {
                app.hideWindows();
            });
        });

        document.querySelectorAll('.twitter').forEach(function (element: Element) {
            element.addEventListener('click', function (event: MouseEvent) {
                const url = element.getAttribute('href');

                app.openPopup(url);
                event.preventDefault();
                return false;
            });
        });

        const data = app.storage.data;
        if (data.hasAlreadyPlayed) {
            if (data.player.name && data.player.name !== '') {
                if (playerName) {
                    playerName.innerHTML = data.player.name;
                }
                if (playerImage && data.player.image.trim().length > 0) {
                    playerImage.src = data.player.image;
                }
            }
        }

        document.querySelectorAll('.play div').forEach(function (element: Element) {
            element.addEventListener('click', function () {
                const nameFromInput = nameInput?.getAttribute('value') ?? '';
                const nameFromStorage = playerName?.innerHTML ?? '';
                const name = nameFromInput !== '' ? nameFromInput : nameFromStorage;

                app.tryStartingGame(name, undefined);
            });
        });

        document.addEventListener('touchstart', function () {}, false);

        if (resizeCheck) {
            resizeCheck.addEventListener(TRANSITIONEND, () => app.resizeUi());
        }

        log.info('App initialized.');

        initGame();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady, { once: true });
    } else {
        onReady();
    }
};

function initGame(): void {
    import('./game')
        .then(function (mod) {
            const Game = mod.default;

            const canvas = document.getElementById('entities') as HTMLCanvasElement | null,
                background = document.getElementById('background') as HTMLCanvasElement | null,
                foreground = document.getElementById('foreground') as HTMLCanvasElement | null,
                input = document.getElementById('chatinput') as HTMLInputElement | null;

            if (!app || !canvas || !background || !foreground || !input) {
                return;
            }

            game = new Game(app, '#bubbles', canvas, background, foreground, input);
            game.setStorage(app.storage);
            app.setGame(game);
            installTestApi();

            if (app.isDesktop && app.supportsWorkers) {
                game.loadMap();
            }

            game.on('gameStart', function () {
                app.initEquipmentIcons();
            });

            game.on('disconnect', function (message: string) {
                const deathParagraph = document.querySelector('#death p'),
                    respawn = document.getElementById('respawn');
                if (deathParagraph) {
                    deathParagraph.innerHTML = message + '<em>Please reload the page.</em>';
                }
                if (respawn) {
                    respawn.style.display = 'none';
                }
            });

            game.on('playerDeath', function () {
                if (document.body.classList.contains('credits')) {
                    document.body.classList.remove('credits');
                }
                document.body.classList.add('death');
            });

            game.on('playerEquipmentChange', function () {
                app.initEquipmentIcons();
            });

            game.on('playerInvincible', function () {
                const hitpoints = document.getElementById('hitpoints');
                if (hitpoints) {
                    hitpoints.classList.toggle('invincible');
                }
            });

            const instancePopulation = document.getElementById('instance-population'),
                playerCount = document.getElementById('playercount'),
                worldPopulation = document.getElementById('world-population');

            const setPopulationText = function (root: ParentNode | null, selector: string, value: string): void {
                if (!root) {
                    return;
                }
                const node = root.querySelector(selector);
                if (node) {
                    node.textContent = value;
                }
            };

            game.on('nbPlayersChange', function (worldPlayers: number, totalPlayers: number) {
                const worldCount = String(worldPlayers),
                    totalCount = String(totalPlayers),
                    worldLabel = worldPlayers === 1 ? 'player' : 'players',
                    totalLabel = totalPlayers === 1 ? 'player' : 'players';

                setPopulationText(playerCount, 'span.count', worldCount);
                setPopulationText(playerCount, 'span:nth-child(2)', worldLabel);
                setPopulationText(instancePopulation, 'span:nth-child(1)', worldCount);
                setPopulationText(instancePopulation, 'span:nth-child(2)', worldLabel);
                setPopulationText(worldPopulation, 'span:nth-child(1)', totalCount);
                setPopulationText(worldPopulation, 'span:nth-child(2)', totalLabel);
            });

            game.on('achievementUnlock', function (id: AchievementId, name: string, _description: string) {
                app.unlockAchievement(id, name);
            });

            game.on('notification', function (message: string) {
                app.showMessage(message);
            });

            app.initHealthBar();

            const nameInput = document.getElementById('nameinput') as HTMLInputElement | null,
                chatBox = document.getElementById('chatbox'),
                chatInput = document.getElementById('chatinput') as HTMLInputElement | null,
                createCharacterForm = document.getElementById('createcharacter-form') as HTMLFormElement | null,
                chatForm = document.getElementById('chat-form') as HTMLFormElement | null,
                foregroundEl = document.getElementById('foreground'),
                parchmentEl = document.getElementById('parchment'),
                nameTooltip = document.getElementById('name-tooltip'),
                respawnButton = document.getElementById('respawn'),
                muteButton = document.getElementById('mutebutton');
            if (nameInput) {
                nameInput.setAttribute('value', '');
            }
            if (chatBox) {
                chatBox.setAttribute('value', '');
            }

            if (game.renderer.mobile || game.renderer.tablet) {
                if (foregroundEl) {
                    let touchStartX = 0;
                    let touchStartY = 0;
                    let touchHasMoved = false;
                    const tapMoveThresholdPx = 10;

                    foregroundEl.addEventListener(
                        'touchstart',
                        function (event: TouchEvent) {
                            app.center();
                            touchHasMoved = false;
                            const touch = event.touches.item(0);
                            if (touch) {
                                touchStartX = touch.pageX;
                                touchStartY = touch.pageY;
                                app.setMouseCoordinates(touch);
                            }
                            event.preventDefault();
                        },
                        { passive: false }
                    );

                    foregroundEl.addEventListener(
                        'touchmove',
                        function (event: TouchEvent) {
                            const touch = event.touches.item(0);
                            if (touch) {
                                const dx = Math.abs(touch.pageX - touchStartX);
                                const dy = Math.abs(touch.pageY - touchStartY);
                                if (dx > tapMoveThresholdPx || dy > tapMoveThresholdPx) {
                                    touchHasMoved = true;
                                }
                                app.setMouseCoordinates(touch);
                            }
                            event.preventDefault();
                        },
                        { passive: false }
                    );

                    foregroundEl.addEventListener(
                        'touchend',
                        function (event: TouchEvent) {
                            const touch = event.changedTouches.item(0);
                            if (touch) {
                                app.setMouseCoordinates(touch);
                            }
                            if (!touchHasMoved) {
                                const pos = game.getMouseGridPosition();
                                game.kernel.setClientClickIntent({ x: pos.x, y: pos.y });
                                app.hideWindows();
                            }
                            event.preventDefault();
                        },
                        { passive: false }
                    );

                    foregroundEl.addEventListener(
                        'touchcancel',
                        function (event: TouchEvent) {
                            touchHasMoved = true;
                            event.preventDefault();
                        },
                        { passive: false }
                    );
                }
            } else {
                if (foregroundEl) {
                    foregroundEl.addEventListener('click', function (event: MouseEvent) {
                        app.center();
                        app.setMouseCoordinates(event);
                        if (game) {
                            const pos = game.getMouseGridPosition();
                            game.kernel.setClientClickIntent({ x: pos.x, y: pos.y });
                        }
                        app.hideWindows();
                    });
                }
            }

            document.body.onclick = function () {
                let hasClosedParchment = false;

                if (parchmentEl?.classList.contains('credits')) {
                    if (game.started) {
                        app.closeInGameScroll('credits');
                        hasClosedParchment = true;
                    } else {
                        app.toggleScrollContent('credits');
                    }
                }

                if (parchmentEl?.classList.contains('legal')) {
                    if (game.started) {
                        app.closeInGameScroll('legal');
                        hasClosedParchment = true;
                    } else {
                        app.toggleScrollContent('legal');
                    }
                }

                if (parchmentEl?.classList.contains('about')) {
                    if (game.started) {
                        app.closeInGameScroll('about');
                        hasClosedParchment = true;
                    } else {
                        app.toggleScrollContent('about');
                    }
                }

                if (game.started && !game.renderer.mobile && !hasClosedParchment) {
                    const pos = game.getMouseGridPosition();
                    game.kernel.setClientClickIntent({ x: pos.x, y: pos.y });
                }
            };

            if (respawnButton) {
                respawnButton.addEventListener('click', function () {
                    game.audioManager.playSound('revive');
                    game.restart();
                    document.body.classList.remove('death');
                });
            }

            document.addEventListener('mousemove', function (event: MouseEvent) {
                app.setMouseCoordinates(event);
            });

            document.addEventListener('keydown', function (e: KeyboardEvent) {
                const key = e.which;

                if (key === 13) {
                    if (chatBox?.classList.contains('active')) {
                        app.hideChat();
                    } else {
                        app.showChat();
                    }
                }
            });

            if (chatInput) {
                if (chatForm) {
                    chatForm.addEventListener('submit', function (event: Event) {
                        event.preventDefault();
                        return false;
                    });
                }

                chatInput.addEventListener('keydown', function (e: KeyboardEvent) {
                    const key = e.which,
                        placeholder = chatInput.getAttribute('placeholder');

                    if (!(e.shiftKey && e.keyCode === 16) && e.keyCode !== 9) {
                        if (chatInput.value === placeholder) {
                            chatInput.value = '';
                            chatInput.removeAttribute('placeholder');
                            chatInput.classList.remove('placeholder');
                        }
                    }

                    if (key === 13) {
                        if (chatInput.value !== '') {
                            game.say(chatInput.value);
                            chatInput.value = '';
                            app.hideChat();
                            if (foregroundEl) {
                                foregroundEl.focus();
                            }
                            e.preventDefault();
                            return false;
                        } else {
                            app.hideChat();
                            e.preventDefault();
                            return false;
                        }
                    }

                    if (key === 27) {
                        app.hideChat();
                        e.preventDefault();
                        return false;
                    }
                });

                chatInput.addEventListener('focus', function (_e: FocusEvent) {
                    const placeholder = chatInput.getAttribute('placeholder');

                    if (!Detect.isFirefoxAndroid()) {
                        chatInput.value = placeholder ?? '';
                    }

                    if (chatInput.value === placeholder) {
                        chatInput.setSelectionRange(0, 0);
                    }
                });
            }

            if (nameInput) {
                if (createCharacterForm) {
                    createCharacterForm.addEventListener('submit', function (event: Event) {
                        const name = nameInput.value;
                        event.preventDefault();
                        if (name !== '') {
                            app.tryStartingGame(name, function () {
                                nameInput.blur(); // exit keyboard on mobile
                            });
                        }
                        return false;
                    });
                }

                nameInput.addEventListener('focusin', function () {
                    if (nameTooltip) {
                        nameTooltip.classList.add('visible');
                    }
                });

                nameInput.addEventListener('focusout', function () {
                    if (nameTooltip) {
                        nameTooltip.classList.remove('visible');
                    }
                });

                nameInput.addEventListener('keypress', function (event: KeyboardEvent) {
                    const name = nameInput.value;

                    if (nameTooltip) {
                        nameTooltip.classList.remove('visible');
                    }

                    if (event.keyCode === 13) {
                        if (name !== '') {
                            app.tryStartingGame(name, function () {
                                nameInput.blur(); // exit keyboard on mobile
                            });
                            event.preventDefault();
                            return false; // prevent form submit
                        } else {
                            event.preventDefault();
                            return false; // prevent form submit
                        }
                    }
                });
            }

            if (muteButton) {
                muteButton.addEventListener('click', function () {
                    game.audioManager.toggle();
                });
            }

            document.addEventListener('keydown', function (e: KeyboardEvent) {
                const key = e.which,
                    activeElement = document.activeElement,
                    chatFocused = chatInput && activeElement === chatInput,
                    nameFocused = nameInput && activeElement === nameInput;

                if (!chatFocused && !nameFocused) {
                    if (key === 13) {
                        // Enter
                        if (game.ready && chatInput) {
                            chatInput.focus();
                            e.preventDefault();
                            return false;
                        }
                    }
                    if (key === 32) {
                        // Space
                        // game.togglePathingGrid();
                        e.preventDefault();
                        return false;
                    }
                    if (key === 70) {
                        // F
                        // game.toggleDebugInfo();
                        e.preventDefault();
                        return false;
                    }
                    if (key === 27) {
                        // ESC
                        app.hideWindows();
                        Object.keys(game.player.attackers).forEach(function (id) {
                            game.player.attackers[id].stop();
                        });
                        e.preventDefault();
                        return false;
                    }
                    if (key === 65) {
                        // a
                        // game.player.hit();
                        e.preventDefault();
                        return false;
                    }
                } else {
                    if (key === 13 && game.ready && chatInput) {
                        chatInput.focus();
                        e.preventDefault();
                        return false;
                    }
                }
            });

            if (game.renderer.tablet) {
                document.body.classList.add('tablet');
            }
        })
        .catch(function (err: unknown) {
            log.error(err, true);
        });
}

initApp();
