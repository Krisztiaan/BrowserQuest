import Item from '../../item';
import Mob from '../../mob';
import Npc from '../../npc';
import Chest from '../../chest';
import Character, { type CharacterEvents } from '../../character';
import type Player from '../../player';
import type Sprite from '../../sprite';
import { entityIdFromWire, isEntityId, type EntityId } from '../../../shared/domain/ids';
import type { EntityKind } from '../../../shared/entity-kind-domain';
import { gridPos, type GridPos } from '../../../shared/domain/positions';
import { buildMovePlanSteps } from '../../../shared/world/movement-intents';
import { findBestPathToCandidates, resolveMoveToTargetCandidates } from '../../../shared/world/move-to-planning';
import log from '../../platform/log';
import Types from '../../../shared/gametypes-browser';
import { getMobPrefab } from '../../../shared/content/prefabs';
import type { MergeEvents, TypedEventMap } from '../../../shared/typed-event-emitter';
import type { RuntimeEntity } from '../../client-boundary-types';
import type { ClientCommand } from '../client-commands';
import type { ClientWorldKernel } from '../world-kernel';
import { adaptKernelEntityForRendering } from '../kernel-entity-adapter';
import { bridgeCharacterWorldUpdate } from '../visual-movement-bridge';
import { isSnapVisualDivergenceClass } from '../visual-movement-divergence';
import Exceptions from '../../exceptions';
import { debugMoves } from '../../debug-flags';
import type { AudioSoundKey } from '../../asset-key-domain';
import { SUBPIXELS, TILE_PX, tileToWorldPosCenter } from '../../../shared/world/worldpos';

type GridIndexedEntity = {
    id: EntityId;
    kind: EntityKind;
    x: number;
    y: number;
    gridX: number;
    gridY: number;
    worldX?: number;
    worldY?: number;
    nextGridX?: number;
    nextGridY?: number;
    setSprite(sprite: Sprite | null): void;
    setWeaponName?(name: string): void;
    setSpriteName?(name: string): void;
    getSpriteName(): string;
    getWeaponName?(): string | null;
    setGridPosition(x: number, y: number): void;
    setWorldPositionSub?(worldX: number, worldY: number, options?: { snapRender?: boolean }): void;
    setDirty(): void;
    setMaxHitPoints?(hp: number): void;
    setOrientation?(orientation: number): void;
    idle?(): void;
    blink?(speed: number): void;
    dirtyRect?: DirtyRect | null;
};
type DirtyRect = {
    x: number;
    y: number;
    w: number;
    h: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
};

type SpatialRecord = Readonly<{
    gridX: number;
    gridY: number;
    nextGridX: number;
    nextGridY: number;
    isMoving: boolean;
    isDead?: boolean;
    kind: EntityKind;
    isPlayer: boolean;
}>;
type CharacterEventEnvelope = MergeEvents<CharacterEvents, TypedEventMap>;

export type ClientCommandApplySystemHost = {
    kernel: ClientWorldKernel;
    started: boolean;
    client: {
        sendHello(player: Player): void;
        sendLoot(item: { id: EntityId }): void;
        sendMove(x: number, y: number): void;
        sendMoveTo(x: number, y: number, stopAdjacentToTarget: boolean): void;
        sendMoveInput(keysMask: number): void;
        sendMovePos(x: number, y: number, facing: number, moving: boolean): void;
        sendChunkSubscribe(chunkX: number, chunkY: number, radius: number): void;
        sendChunkUnsubscribe(): void;
        sendZone(): void;
        sendChat(text: string): void;
        sendAchievement(id: number): void;
        sendAggro(mob: { id: EntityId }): void;
        sendAttack(mob: { id: EntityId }): void;
        sendLootMove(item: { id: EntityId }, x: number, y: number): void;
        sendCheck(id: string | number): void;
        sendOpen(chest: { id: EntityId }): void;
        sendWho(ids: EntityId[]): void;
    } | null;
    playerId: EntityId | null;
    player: Player;
    emit(eventName: 'notification', message: string): void;
    emit(eventName: 'nbPlayersChange', worldPlayers: number, totalPlayers: number): void;
    emit(eventName: 'playerHurt'): void;
    emit(eventName: 'playerDeath'): void;
    emit(eventName: 'playerEquipmentChange'): void;

    stopPlayerCombat(): void;
    makePlayerGoTo(x: number, y: number): void;
    makePlayerGoToItem(item: Item | null): void;
    getEntityById(id: EntityId): GridIndexedEntity | undefined;
    makeCharacterTeleportTo<TEvents extends CharacterEventEnvelope>(
        entity: Character<TEvents>,
        x: number,
        y: number
    ): void;
    makeCharacterGoTo<TEvents extends CharacterEventEnvelope>(entity: Character<TEvents>, x: number, y: number): void;
    createAttackLink<TAttackerEvents extends CharacterEventEnvelope, TTargetEvents extends CharacterEventEnvelope>(
        attacker: Character<TAttackerEvents>,
        target: Character<TTargetEvents>
    ): void;
    removeItem(item: Item | null): void;
    removeEntity(entity: GridIndexedEntity): void;
    enqueueZoningFrom(x: number, y: number): void;

    makePlayerAttack(mob: Mob): void;
    makePlayerTalkTo(npc: Npc): void;
    makePlayerOpenChest(chest: Chest): void;
    makeNpcTalk(npc: Npc): void;

    // Runtime/welcome side effects
    renderer: {
        getEntityBoundingRect(entity: GridIndexedEntity): DirtyRect;
        getPlayerImage(cb: (img: string) => void): void;
    } | null;
    storage: {
        hasAlreadyPlayed(): boolean;
        initPlayer(name: string): void;
        savePlayer(playerImage: string, spriteName: string, weaponName: string): void;
        setPlayerName(name: string): void;
        applyAchievementProgressSnapshot(snapshot: {
            unlockedIds: number[];
            ratCount: number;
            skeletonCount: number;
            totalKills: number;
            totalDmg: number;
            totalRevives: number;
        }): void;
        incrementTotalKills(): void;
        incrementRatCount(): void;
        incrementSkeletonCount(): void;
        addDamage(damage: number): void;
        data: {
            achievements: {
                unlocked: number[];
            };
        };
    };
    app: { initUnlockedAchievements(unlocked: number[]): void };
    updateBars(): void;
    resetCamera(): void;
    addEntity(entity: GridIndexedEntity): void;
    showNotification(message: string): void;
    tryUnlockingAchievement(key: string): void;
    audioManager: { playSound(key: AudioSoundKey): void; updateMusic?(): void } | null;
    createBubble(entityId: EntityId, text: string): void;
    infoManager: {
        addDamageInfo(value: number | string, x: number, y: number, type: 'received' | 'inflicted' | 'healed'): void;
    };
    sprites: Record<string, Sprite>;
    entities: Record<string, GridIndexedEntity>;
    map: {
        grid: number[][];
        isOutOfBounds(x: number, y: number): boolean;
        isColliding?(x: number, y: number): boolean;
    } | null;
    obsoleteEntities: GridIndexedEntity[] | null;
    removeObsoleteEntities(): void;
    connectionStartedCallback: (() => void) | null;
    setPlayerId(id: EntityId): void;
    setPlayerName(name: string): void;
    setPlayerGridPosition(x: number, y: number): void;
    setPlayerMaxHitPoints(hp: number): void;
    setPlayerHealth(points: number): void;
    addItemFromUnknown(item: RuntimeEntity, x: number, y: number): void;
    loadMapById?(mapId: string): Promise<void>;
};

function isGridIndexedEntity(value: unknown): value is GridIndexedEntity {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value as Partial<GridIndexedEntity>;
    return (
        isEntityId(candidate.id) &&
        typeof candidate.getSpriteName === 'function' &&
        typeof candidate.setGridPosition === 'function' &&
        typeof candidate.setSprite === 'function'
    );
}

function safeOrientation(orientation: number | undefined): number {
    return orientation === Types.Orientations.UP ||
        orientation === Types.Orientations.DOWN ||
        orientation === Types.Orientations.LEFT ||
        orientation === Types.Orientations.RIGHT
        ? orientation
        : Types.Orientations.DOWN;
}

function startAuthoritativeAdjacentStep<TEvents extends CharacterEventEnvelope>(
    entity: Character<TEvents>,
    x: number,
    y: number
): boolean {
    const distance = Math.abs(entity.gridX - x) + Math.abs(entity.gridY - y);
    if (distance !== 1) {
        return false;
    }

    entity.followPath([
        [entity.gridX, entity.gridY],
        [x, y],
    ]);

    return entity.isMoving();
}

function appendAuthoritativeAdjacentStep<TEvents extends CharacterEventEnvelope>(
    entity: Character<TEvents>,
    x: number,
    y: number
): boolean {
    const path = entity.path;
    if (!path || path.length === 0) {
        return false;
    }

    const tail = path[path.length - 1];
    if (!tail) {
        return false;
    }

    const distance = Math.abs(tail[0] - x) + Math.abs(tail[1] - y);
    if (distance !== 1) {
        return false;
    }

    path.push([x, y]);
    return true;
}

function hardStopCharacterMovement<TEvents extends CharacterEventEnvelope>(entity: Character<TEvents>): void {
    entity.stop();
    entity.path = null;
    entity.newDestination = null;
    entity.destination = null;
    entity.nextGridX = -1;
    entity.nextGridY = -1;
    entity.movement.stop();
    entity.idle();
}

function resolveAuthoritativeLocalPlayerPos(host: ClientCommandApplySystemHost): GridPos {
    // For click-to-move prediction, treat the rendered player's current tile as the baseline.
    // Server authority is reconciled via kernel replication sync + teleport correction.
    return gridPos(host.player.gridX, host.player.gridY);
}

function renderTopLeftPxToWorldSub(x: number, y: number): { worldX: number; worldY: number } {
    return {
        worldX: (x + TILE_PX / 2) * SUBPIXELS,
        worldY: (y + TILE_PX / 2) * SUBPIXELS,
    };
}

function resolvePlanOrigin(host: ClientCommandApplySystemHost): GridPos {
    const pos = resolveAuthoritativeLocalPlayerPos(host);
    return gridPos(pos.x, pos.y);
}

function trimConsumedPlanSteps(steps: ReadonlyArray<GridPos>, origin: GridPos): GridPos[] {
    for (let i = steps.length - 1; i >= 0; i -= 1) {
        const step = steps[i];
        if (step?.x === origin.x && step.y === origin.y) {
            return steps.slice(i + 1);
        }
    }
    return steps.slice();
}

function countPlanPrefixOverlap(existingSteps: ReadonlyArray<GridPos>, nextSteps: ReadonlyArray<GridPos>): number {
    const maxOverlap = Math.min(existingSteps.length, nextSteps.length);
    let overlap = 0;
    for (let i = 0; i < maxOverlap; i += 1) {
        const existing = existingSteps[i];
        const next = nextSteps[i];
        if (!existing || !next || existing.x !== next.x || existing.y !== next.y) {
            break;
        }
        overlap = i + 1;
    }
    return overlap;
}

function countPlanSuffixPrefixOverlap(
    existingSteps: ReadonlyArray<GridPos>,
    nextSteps: ReadonlyArray<GridPos>
): number {
    const maxOverlap = Math.min(existingSteps.length, nextSteps.length);
    for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
        let matches = true;
        for (let i = 0; i < overlap; i += 1) {
            const existing = existingSteps[existingSteps.length - overlap + i];
            const next = nextSteps[i];
            if (!existing || !next || existing.x !== next.x || existing.y !== next.y) {
                matches = false;
                break;
            }
        }
        if (matches) {
            return overlap;
        }
    }
    return 0;
}

function mergeOverlappingPlanSteps(
    existingSteps: ReadonlyArray<GridPos>,
    nextSteps: ReadonlyArray<GridPos>
): {
    steps: GridPos[];
    overlapCount: number;
    overlapMode: 'none' | 'prefix' | 'suffix_prefix';
} {
    const prefixOverlapCount = countPlanPrefixOverlap(existingSteps, nextSteps);
    if (prefixOverlapCount > 0) {
        return {
            steps: nextSteps.slice(),
            overlapCount: prefixOverlapCount,
            overlapMode: 'prefix',
        };
    }

    const suffixPrefixOverlapCount = countPlanSuffixPrefixOverlap(existingSteps, nextSteps);
    if (suffixPrefixOverlapCount > 0) {
        return {
            steps: [...existingSteps, ...nextSteps.slice(suffixPrefixOverlapCount)],
            overlapCount: suffixPrefixOverlapCount,
            overlapMode: 'suffix_prefix',
        };
    }

    return {
        steps: nextSteps.slice(),
        overlapCount: 0,
        overlapMode: 'none',
    };
}

function areGridStepListsEqual(a: ReadonlyArray<GridPos>, b: ReadonlyArray<GridPos>): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i += 1) {
        const left = a[i];
        const right = b[i];
        if (!left || !right || left.x !== right.x || left.y !== right.y) {
            return false;
        }
    }
    return true;
}

function requestPathFromPlanOrigin({
    host,
    origin,
    toX,
    toY,
}: {
    host: ClientCommandApplySystemHost;
    origin: { x: number; y: number };
    toX: number;
    toY: number;
}): Array<[number, number]> {
    if (origin.x === host.player.gridX && origin.y === host.player.gridY) {
        return host.player.requestPathfindingTo(toX, toY);
    }

    const prevGridX = host.player.gridX;
    const prevGridY = host.player.gridY;
    host.player.gridX = origin.x;
    host.player.gridY = origin.y;
    try {
        return host.player.requestPathfindingTo(toX, toY);
    } finally {
        host.player.gridX = prevGridX;
        host.player.gridY = prevGridY;
    }
}

function planServerAuthoritativeMoveTo({
    host,
    toX,
    toY,
    stopAdjacentToTarget,
}: {
    host: ClientCommandApplySystemHost;
    toX: number;
    toY: number;
    stopAdjacentToTarget: boolean;
}): void {
    if (!host.started || !host.client || !host.playerId || !host.map) {
        return;
    }
    if (host.map.isOutOfBounds(toX, toY)) {
        return;
    }

    const map = host.map;
    const isColliding =
        typeof map.isColliding === 'function'
            ? (x: number, y: number) => map.isColliding?.(x, y) === true
            : (x: number, y: number) => (map.grid[y]?.[x] ?? 0) !== 0;
    const origin = resolvePlanOrigin(host);
    const existingPlan = host.kernel.clientMovePlan;

    const requestedTo = gridPos(toX, toY);
    const candidates = resolveMoveToTargetCandidates({
        isOutOfBounds: (x, y) => map.isOutOfBounds(x, y),
        to: requestedTo,
        stopAdjacentToTarget,
    }).filter((pos) => !isColliding(pos.x, pos.y));

    const bestPath = findBestPathToCandidates({
        candidates,
        findPathTo: (x, y) =>
            requestPathFromPlanOrigin({
                host,
                origin,
                toX: x,
                toY: y,
            }),
    });
    if (!bestPath) {
        debugMoves('plan:none', { toX, toY, stopAdjacentToTarget, origin, reason: 'no_path' });
        return;
    }

    // When stopping adjacent, path to the adjacent candidate directly for prediction parity with the server.
    const steps = buildMovePlanSteps({ path: bestPath, stopAdjacentToTarget: false });
    if (steps.length === 0) {
        debugMoves('plan:none', { toX, toY, stopAdjacentToTarget, origin, reason: 'no_steps' });
        return;
    }
    const target = steps.at(-1);
    if (!target) {
        return;
    }

    const remainingExistingSteps = existingPlan ? trimConsumedPlanSteps(existingPlan.steps, origin) : [];
    const { steps: mergedSteps, overlapCount, overlapMode } = mergeOverlappingPlanSteps(remainingExistingSteps, steps);
    const sameRequestedTarget =
        existingPlan !== null &&
        existingPlan.requestedTo.x === requestedTo.x &&
        existingPlan.requestedTo.y === requestedTo.y &&
        existingPlan.stopAdjacentToTarget === stopAdjacentToTarget;
    if (sameRequestedTarget && areGridStepListsEqual(remainingExistingSteps, steps)) {
        debugMoves('plan:reuse_same', {
            toX,
            toY,
            stopAdjacentToTarget,
            origin,
            pendingSeqAcks: host.kernel.clientPendingMoveSeqAcks.length,
            steps: steps.length,
        });
        return;
    }

    host.kernel.clientMovementSuppressed = false;
    if (overlapCount === 0) {
        host.kernel.clearClientPendingMoveAcks();
        host.kernel.clearClientPendingMoveSeqAcks();
    }

    debugMoves('plan:set', {
        toX,
        toY,
        stopAdjacentToTarget,
        origin,
        overlapCount,
        overlapMode,
        pendingSeqAcks: host.kernel.clientPendingMoveSeqAcks.length,
        steps: mergedSteps.length,
        target,
    });
    host.kernel.setClientMovePlan({
        requestedTo,
        target,
        steps: mergedSteps,
        stopAdjacentToTarget,
    });

    if (host.kernel.clientMovementNetcodeMode === 'predictive') {
        if (host.player.isMoving() && overlapCount > 0) {
            host.player.continueTo(toX, toY);
        } else {
            // Start local prediction immediately using the already-computed path (avoid a second pathfinding pass).
            const predictedPath: Array<[number, number]> = [
                [origin.x, origin.y],
                ...mergedSteps.map((step) => [step.x, step.y] as [number, number]),
            ];
            host.player.followPath(predictedPath);
        }
    } else {
        // Lockstep mode intentionally waits for server movement updates before moving the local avatar.
        hardStopCharacterMovement(host.player);
    }
}

function resolveKillNotificationMobName(kind: EntityKind): string | null {
    const mobName = Types.getKindAsString(kind);
    if (!mobName) {
        return null;
    }
    if (mobName === 'skeleton2') {
        return 'greater skeleton';
    }
    if (mobName === 'eye') {
        return 'evil eye';
    }
    if (mobName === 'deathknight') {
        return 'death knight';
    }
    return mobName;
}

function setPathingCell(host: ClientCommandApplySystemHost, x: number, y: number, value: number): void {
    if (!host.map) {
        return;
    }
    if (host.map.isOutOfBounds(x, y)) {
        return;
    }
    host.kernel.ensureClientPathingGrid(host.map.grid);
    const grid = host.kernel.clientPathingGrid;
    if (!grid) {
        return;
    }
    const row = grid[y];
    if (row?.[x] === undefined) {
        return;
    }
    row[x] = value;
}

const DEFAULT_CHUNK_SUBSCRIBE_RADIUS = 3;
const DEFAULT_CHUNK_SIZE_HINT = 32;

function resolveChunkCenterFromTile(
    host: ClientCommandApplySystemHost,
    x: number,
    y: number
): { chunkX: number; chunkY: number } {
    const hintedChunkSize = host.kernel.clientChunkOverlayCache.chunkSize ?? DEFAULT_CHUNK_SIZE_HINT;
    const chunkSize =
        Number.isSafeInteger(hintedChunkSize) && hintedChunkSize > 0 ? hintedChunkSize : DEFAULT_CHUNK_SIZE_HINT;
    return {
        chunkX: Math.floor(x / chunkSize),
        chunkY: Math.floor(y / chunkSize),
    };
}

function overlayValueToPathingValue(value: number): number {
    return value === 0 ? 0 : 1;
}

function basePathingValue(host: ClientCommandApplySystemHost, x: number, y: number): number {
    if (!host.map) {
        return 0;
    }
    if (host.map.isOutOfBounds(x, y)) {
        return 0;
    }
    if (typeof host.map.isColliding === 'function') {
        return host.map.isColliding(x, y) ? 1 : 0;
    }

    const overlayValue = host.kernel.clientChunkOverlayCache.getGlobal(x, y);
    if (overlayValue !== null) {
        return overlayValueToPathingValue(overlayValue);
    }

    return host.map.grid[y]?.[x] ?? 0;
}

function removeDynamicPathing(host: ClientCommandApplySystemHost, x: number, y: number): void {
    setPathingCell(host, x, y, basePathingValue(host, x, y));
}

function addDynamicPathing(host: ClientCommandApplySystemHost, x: number, y: number): void {
    setPathingCell(host, x, y, 1);
}

function applySpatialRemoveRecord(host: ClientCommandApplySystemHost, entityId: EntityId, record: SpatialRecord): void {
    host.kernel.applySpatialRemoveRecord(entityId, record);

    if (Types.isChest(record.kind)) {
        removeDynamicPathing(host, record.gridX, record.gridY);
        return;
    }

    if (Types.isItem(record.kind)) {
        return;
    }

    if (record.isPlayer) {
        return;
    }

    if (record.isMoving && record.nextGridX >= 0 && record.nextGridY >= 0) {
        removeDynamicPathing(host, record.nextGridX, record.nextGridY);
    } else {
        removeDynamicPathing(host, record.gridX, record.gridY);
    }
}

function applySpatialAddRecord(host: ClientCommandApplySystemHost, entityId: EntityId, record: SpatialRecord): void {
    const map = host.map;
    if (!map) {
        return;
    }
    if (!map.isOutOfBounds(record.gridX, record.gridY)) {
        host.kernel.applySpatialAddRecord(entityId, record);
    }

    if (Types.isChest(record.kind)) {
        addDynamicPathing(host, record.gridX, record.gridY);
        return;
    }

    if (Types.isItem(record.kind)) {
        return;
    }

    if (record.isPlayer) {
        return;
    }

    if (record.isDead) {
        return;
    }

    if (record.isMoving && record.nextGridX >= 0 && record.nextGridY >= 0) {
        addDynamicPathing(host, record.nextGridX, record.nextGridY);
    } else {
        addDynamicPathing(host, record.gridX, record.gridY);
    }
}

function applyWelcome(
    host: ClientCommandApplySystemHost,
    id: EntityId,
    name: string,
    x: number,
    y: number,
    maxHp: number
): void {
    log.info('Received player ID from server : ' + id);

    host.setPlayerId(id);
    host.setPlayerName(name);
    host.setPlayerGridPosition(x, y);
    host.setPlayerMaxHitPoints(maxHp);
    host.kernel.upsertSimpleEntity(id, host.player.kind, x, y);

    host.kernel.clientLastSentMovePos = gridPos(x, y);
    host.kernel.clearClientPendingMoveAcks();
    host.kernel.clearClientPendingMoveSeqAcks();
    host.kernel.clientMovementSuppressed = false;
    host.kernel.clientLocalPlayerDead = false;
    const chunkCenter = resolveChunkCenterFromTile(host, x, y);
    host.kernel.enqueueClientCommand({
        type: 'clientSendChunkSubscribe',
        chunkX: chunkCenter.chunkX,
        chunkY: chunkCenter.chunkY,
        radius: DEFAULT_CHUNK_SUBSCRIBE_RADIUS,
    });

    host.updateBars();
    host.resetCamera();
    if (isGridIndexedEntity(host.player)) {
        host.addEntity(host.player);
    }
    const renderer = host.renderer;
    if (renderer && isGridIndexedEntity(host.player)) {
        host.player.dirtyRect = renderer.getEntityBoundingRect(host.player);
    }

    setTimeout(function (): void {
        host.tryUnlockingAchievement('STILL_ALIVE');
    }, 1500);

    if (!host.storage.hasAlreadyPlayed()) {
        host.storage.initPlayer(host.player.name);
        if (renderer) {
            renderer.getPlayerImage(function (playerImage: string) {
                const weaponName = host.player.getWeaponName() ?? 'sword1';
                host.storage.savePlayer(playerImage, host.player.getSpriteName(), weaponName);
            });
        }
        host.showNotification('Welcome to BrowserQuest!');
        return;
    }

    host.showNotification('Welcome back to BrowserQuest!');
    host.storage.setPlayerName(name);
}

function finalizeClientMapTransition(
    host: ClientCommandApplySystemHost,
    getKnownEntity: (id: EntityId) => GridIndexedEntity | undefined
): void {
    if (!host.kernel.canFinalizeClientMapTransition()) {
        return;
    }
    const transition = host.kernel.clientMapTransition;
    if (!transition) {
        return;
    }

    const playerId = host.playerId;
    if (playerId !== null) {
        const playerEntity = getKnownEntity(playerId);
        const targetPos = transition.localTeleport ?? { x: transition.x, y: transition.y, mapId: transition.toMapId };
        if (typeof targetPos.mapId === 'string') {
            host.kernel.setEntityMapId(playerId, targetPos.mapId);
            host.kernel.setActiveMapId(targetPos.mapId);
        }
        if (playerEntity instanceof Character) {
            playerEntity.path = null;
            playerEntity.step = 0;
            playerEntity.newDestination = null;
            playerEntity.destination = null;
            playerEntity.interrupted = false;
            playerEntity.nextGridX = -1;
            playerEntity.nextGridY = -1;
            playerEntity.movement.stop();
            playerEntity.idle();
            host.makeCharacterTeleportTo(playerEntity, targetPos.x, targetPos.y);
        }
        host.kernel.clientReplicationLastPos.set(playerId, gridPos(targetPos.x, targetPos.y));
        host.kernel.clientLastSentMovePos = gridPos(targetPos.x, targetPos.y);
    }

    host.resetCamera();
    host.audioManager?.updateMusic?.();
    host.kernel.clientMovementSuppressed = false;
    host.kernel.clearClientMapTransition();
}

export function runClientCommandApplySystem(host: ClientCommandApplySystemHost): void {
    const getKnownEntity = (id: EntityId): GridIndexedEntity | undefined => host.entities[String(id)];
    const MAX_PASSES = 10;
    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
        const commands: ClientCommand[] = host.kernel.drainClientCommands();
        if (commands.length === 0) {
            return;
        }

        for (const command of commands) {
            switch (command.type) {
                case 'stopPlayerCombat': {
                    host.stopPlayerCombat();
                    break;
                }
                case 'characterClearTarget': {
                    const entity = getKnownEntity(command.entityId);
                    if (entity instanceof Character) {
                        entity.stop();
                        entity.path = null;
                        entity.nextGridX = -1;
                        entity.nextGridY = -1;
                        entity.disengage();
                        entity.previousTarget = null;
                        entity.unconfirmedTarget = null;
                        entity.idle();
                    }
                    break;
                }
                case 'clientSendHello': {
                    if (!host.started || !host.client) {
                        break;
                    }
                    host.client.sendHello(host.player);
                    break;
                }
                case 'clientSendMove': {
                    if (!host.started || !host.client) {
                        break;
                    }
                    host.client.sendMove(command.x, command.y);
                    host.kernel.clientLastSentMovePos = gridPos(command.x, command.y);
                    break;
                }
                case 'clientSendMoveTo': {
                    if (!host.started || !host.client) {
                        break;
                    }
                    host.client.sendMoveTo(command.x, command.y, command.stopAdjacentToTarget);
                    host.kernel.clientLastSentMovePos = gridPos(command.x, command.y);
                    break;
                }
                case 'clientSendMoveInput': {
                    if (!host.started || !host.client) {
                        break;
                    }
                    host.client.sendMoveInput(command.keysMask);
                    break;
                }
                case 'clientSendMovePos': {
                    if (!host.started || !host.client) {
                        break;
                    }
                    host.client.sendMovePos(command.x, command.y, command.facing, command.moving);
                    break;
                }
                case 'clientSendChunkSubscribe': {
                    if (!host.started || !host.client) {
                        break;
                    }
                    host.client.sendChunkSubscribe(command.chunkX, command.chunkY, command.radius);
                    break;
                }
                case 'clientSendChunkUnsubscribe': {
                    if (!host.started || !host.client) {
                        break;
                    }
                    host.client.sendChunkUnsubscribe();
                    break;
                }
                case 'clientSendZone': {
                    if (!host.started || !host.client) {
                        break;
                    }
                    host.client.sendZone();
                    break;
                }
                case 'clientSendChat': {
                    if (!host.started || !host.client) {
                        break;
                    }
                    host.client.sendChat(command.message);
                    break;
                }
                case 'clientSendAchievement': {
                    if (!host.started || !host.client) {
                        break;
                    }
                    host.client.sendAchievement(command.achievementId);
                    break;
                }
                case 'clientSendAggro': {
                    if (!host.started || !host.client) {
                        break;
                    }
                    const mob = getKnownEntity(command.mobId);
                    if (mob instanceof Mob) {
                        host.client.sendAggro(mob);
                    }
                    break;
                }
                case 'clientSendAttack': {
                    if (!host.started || !host.client) {
                        break;
                    }
                    const mob = getKnownEntity(command.mobId);
                    if (mob instanceof Mob) {
                        host.client.sendAttack(mob);
                    }
                    break;
                }
                case 'clientSendLootMove': {
                    if (!host.started || !host.client) {
                        break;
                    }
                    const item = getKnownEntity(command.itemId);
                    if (item instanceof Item) {
                        host.client.sendLootMove(item, command.x, command.y);
                    }
                    break;
                }
                case 'enqueueZoningFrom': {
                    host.enqueueZoningFrom(command.x, command.y);
                    break;
                }
                case 'setPlayerIsOnPlateau': {
                    host.player.isOnPlateau = command.isOnPlateau;
                    break;
                }
                case 'setPlayerLastCheckpoint': {
                    if (command.checkpoint?.id === undefined) {
                        host.player.lastCheckpoint = null;
                        break;
                    }
                    host.player.lastCheckpoint = { id: command.checkpoint.id };
                    break;
                }
                case 'clientSendCheck': {
                    if (!host.started || !host.client) {
                        break;
                    }
                    host.client.sendCheck(command.checkpointId);
                    break;
                }
                case 'audioUpdateMusic': {
                    host.audioManager?.updateMusic?.();
                    break;
                }
                case 'audioPlaySound': {
                    host.audioManager?.playSound(command.key);
                    break;
                }
                case 'setEntityNextGrid': {
                    const entity = host.entities[String(command.entityId)];
                    if (!entity) {
                        break;
                    }
                    entity.nextGridX = command.nextGridX;
                    entity.nextGridY = command.nextGridY;
                    break;
                }
                case 'spatialRemoveRecord': {
                    applySpatialRemoveRecord(host, command.entityId, command.record);
                    break;
                }
                case 'spatialAddRecord': {
                    applySpatialAddRecord(host, command.entityId, command.record);
                    break;
                }
                case 'combatRelinkPreviousTarget': {
                    const attacker = getKnownEntity(command.attackerId);
                    if (!(attacker instanceof Mob) || attacker.isMoving() || !attacker.previousTarget) {
                        break;
                    }
                    const previousTargetId = attacker.previousTarget.id;
                    if (typeof previousTargetId !== 'number') {
                        attacker.previousTarget = null;
                        break;
                    }
                    let targetId: EntityId;
                    try {
                        targetId = entityIdFromWire(previousTargetId);
                    } catch {
                        attacker.previousTarget = null;
                        break;
                    }
                    const target = getKnownEntity(targetId);
                    if (!(target instanceof Character)) {
                        attacker.previousTarget = null;
                        break;
                    }
                    attacker.previousTarget = null;
                    host.createAttackLink(attacker, target);
                    break;
                }
                case 'combatRepositionAttacker': {
                    const attacker = getKnownEntity(command.attackerId);
                    const target = getKnownEntity(command.targetId);
                    if (!(attacker instanceof Character) || !(target instanceof Character)) {
                        break;
                    }

                    attacker.previousTarget = target;
                    attacker.disengage();
                    attacker.idle();
                    host.makeCharacterGoTo(attacker, command.x, command.y);

                    target.adjacentTiles[String(command.orientation)] = true;
                    break;
                }
                case 'characterLookAtTarget': {
                    const entity = getKnownEntity(command.entityId);
                    if (entity instanceof Character && entity.hasTarget()) {
                        entity.lookAtTarget();
                    }
                    break;
                }
                case 'characterHit': {
                    const entity = getKnownEntity(command.entityId);
                    if (entity instanceof Character) {
                        entity.hit();
                    }
                    break;
                }
                case 'characterFollow': {
                    const entity = getKnownEntity(command.entityId);
                    const target = getKnownEntity(command.targetId);
                    if (entity instanceof Character && target instanceof Character) {
                        // Movement is server-authoritative; only treat "follow" as a planning request for the local player.
                        if (host.playerId !== null && command.entityId === host.playerId) {
                            host.player.setTarget(target);
                            planServerAuthoritativeMoveTo({
                                host,
                                toX: target.gridX,
                                toY: target.gridY,
                                stopAdjacentToTarget: true,
                            });
                        }
                    }
                    break;
                }
                case 'applyDamageToMob': {
                    const entity = getKnownEntity(command.mobId);
                    if (!(entity instanceof Character) || !Types.isMob(entity.kind)) {
                        break;
                    }

                    if (entity.maxHitPoints <= 0) {
                        const prefab = getMobPrefab(entity.kind);
                        if (prefab) {
                            entity.setMaxHitPoints(prefab.combat.maxHitPoints);
                        }
                    }

                    entity.hitPoints = Math.max(0, entity.hitPoints - command.points);
                    entity.hurt();
                    const x = entity.x;
                    const y = entity.y;
                    host.infoManager.addDamageInfo(command.points, x, y, 'inflicted');
                    break;
                }
                case 'playerGoTo': {
                    host.player.disengage();
                    planServerAuthoritativeMoveTo({
                        host,
                        toX: command.x,
                        toY: command.y,
                        stopAdjacentToTarget: false,
                    });
                    break;
                }
                case 'playerGoToItem': {
                    const entity = getKnownEntity(command.itemId);
                    if (entity instanceof Item) {
                        host.player.disengage();
                        planServerAuthoritativeMoveTo({
                            host,
                            toX: entity.gridX,
                            toY: entity.gridY,
                            stopAdjacentToTarget: false,
                        });
                    }
                    break;
                }
                case 'playerAttack': {
                    const entity = getKnownEntity(command.targetId);
                    if (entity instanceof Mob) {
                        // Once in range, stop sending any queued steps; movement is server-authoritative.
                        host.kernel.clearClientMovePlan();
                        host.kernel.clearClientPendingMoveAcks();
                        host.kernel.clearClientPendingMoveSeqAcks();

                        log.info({
                            scope: 'client_command_apply',
                            level: 'info',
                            event: 'player_attack_send',
                            targetId: command.targetId,
                            targetGrid: { x: entity.gridX, y: entity.gridY },
                            playerGrid: { x: host.player.gridX, y: host.player.gridY },
                        });
                        if (host.started && host.client) {
                            host.client.sendAttack(entity);
                        }
                    } else {
                        log.warn({
                            scope: 'client_command_apply',
                            level: 'warn',
                            event: 'player_attack_missing_target',
                            targetId: command.targetId,
                        });
                    }
                    break;
                }
                case 'playerFollow': {
                    const entity = getKnownEntity(command.targetId);
                    if (entity) {
                        log.info({
                            scope: 'client_command_apply',
                            level: 'info',
                            event: 'player_follow_plan',
                            targetId: command.targetId,
                            targetGrid: { x: entity.gridX, y: entity.gridY },
                            playerGrid: { x: host.player.gridX, y: host.player.gridY },
                        });
                        if (entity instanceof Character && host.player.target !== entity) {
                            host.player.setTarget(entity);
                        }
                        planServerAuthoritativeMoveTo({
                            host,
                            toX: entity.gridX,
                            toY: entity.gridY,
                            stopAdjacentToTarget: true,
                        });
                    } else {
                        log.warn({
                            scope: 'client_command_apply',
                            level: 'warn',
                            event: 'player_follow_missing_target',
                            targetId: command.targetId,
                        });
                    }
                    break;
                }
                case 'playerTalkTo': {
                    const entity = getKnownEntity(command.npcId);
                    if (entity instanceof Npc) {
                        if (host.player.target !== entity) {
                            host.player.setTarget(entity);
                        }
                        planServerAuthoritativeMoveTo({
                            host,
                            toX: entity.gridX,
                            toY: entity.gridY,
                            stopAdjacentToTarget: true,
                        });
                    }
                    break;
                }
                case 'npcTalk': {
                    const entity = getKnownEntity(command.npcId);
                    if (entity instanceof Npc) {
                        host.makeNpcTalk(entity);
                    }
                    break;
                }
                case 'playerOpenChest': {
                    const entity = getKnownEntity(command.chestId);
                    if (entity instanceof Chest) {
                        if (host.player.target !== entity) {
                            host.player.setTarget(entity);
                        }
                        planServerAuthoritativeMoveTo({
                            host,
                            toX: entity.gridX,
                            toY: entity.gridY,
                            stopAdjacentToTarget: true,
                        });
                    }
                    break;
                }
                case 'clientSendOpen': {
                    const entity = getKnownEntity(command.chestId);
                    if (host.started && host.client && entity instanceof Chest) {
                        host.client.sendOpen(entity);
                    }
                    break;
                }
                case 'tryLoot': {
                    if (!host.started || !host.client || !host.playerId) {
                        break;
                    }
                    const intent = host.kernel.clientInteractionIntent;
                    if (intent?.kind !== 'loot' || intent.targetId !== command.itemId) {
                        break;
                    }

                    const entity = getKnownEntity(command.itemId);
                    if (!(entity instanceof Item)) {
                        host.kernel.clearClientLootAttempt();
                        host.kernel.clearClientInteractionIntent();
                        break;
                    }

                    try {
                        host.player.loot({
                            id: entity.id,
                            kind: entity.kind,
                            type: entity.type,
                            onLoot: () => {},
                        });
                    } catch (err) {
                        if (err instanceof Exceptions.LootException) {
                            host.emit('notification', err.message);
                            host.kernel.clearClientLootAttempt();
                            if (
                                host.kernel.clientInteractionIntent?.kind === 'loot' &&
                                host.kernel.clientInteractionIntent.targetId === entity.id
                            ) {
                                host.kernel.clearClientInteractionIntent();
                            }
                            break;
                        }
                        throw err;
                    }

                    host.client.sendLoot(entity);
                    host.kernel.clearClientLootAttempt();
                    if (
                        host.kernel.clientInteractionIntent?.kind === 'loot' &&
                        host.kernel.clientInteractionIntent.targetId === entity.id
                    ) {
                        host.kernel.clearClientInteractionIntent();
                    }
                    break;
                }
                case 'playerStop': {
                    host.player.stop();
                    host.kernel.clearClientMovePlan();
                    host.kernel.clearClientPendingMoveAcks();
                    host.kernel.clearClientPendingMoveSeqAcks();
                    break;
                }
                case 'playerDisengage': {
                    host.player.disengage();
                    break;
                }
                case 'playerIdle': {
                    host.player.idle();
                    break;
                }
                case 'emitNotification': {
                    host.emit('notification', command.message);
                    break;
                }
                case 'applyWelcome': {
                    applyWelcome(host, command.id, command.name, command.x, command.y, command.maxHp);
                    break;
                }
                case 'invokeConnectionStartedCallback': {
                    host.connectionStartedCallback?.();
                    host.connectionStartedCallback = null;
                    break;
                }
                case 'beginMapTransition': {
                    const previous = host.kernel.clientMapTransition;
                    if (
                        previous &&
                        (command.seq < previous.seq ||
                            (command.seq === previous.seq && command.toMapId === previous.toMapId))
                    ) {
                        break;
                    }

                    host.kernel.startClientMapTransition({
                        seq: command.seq,
                        fromMapId: command.fromMapId,
                        toMapId: command.toMapId,
                        x: command.x,
                        y: command.y,
                    });
                    host.kernel.setActiveMapId(command.toMapId);
                    host.kernel.clientMovementSuppressed = true;
                    host.kernel.clearClientMovePlan();
                    host.kernel.clearClientPendingMoveAcks();
                    host.kernel.clearClientPendingMoveSeqAcks();
                    host.kernel.clearClientMoveInput();
                    host.kernel.clearClientPendingDoorTraversal();
                    host.kernel.clearClientDoorTraversalContact();

                    if (typeof host.loadMapById !== 'function') {
                        host.kernel.enqueueClientCommand({
                            type: 'mapTransitionMapActivated',
                            seq: command.seq,
                            toMapId: command.toMapId,
                        });
                        break;
                    }

                    void host
                        .loadMapById(command.toMapId)
                        .then(() => {
                            host.kernel.enqueueClientCommand({
                                type: 'mapTransitionMapActivated',
                                seq: command.seq,
                                toMapId: command.toMapId,
                            });
                        })
                        .catch((error) => {
                            const reason = error instanceof Error ? error.message : String(error);
                            host.kernel.enqueueClientCommand({
                                type: 'mapTransitionMapFailed',
                                seq: command.seq,
                                toMapId: command.toMapId,
                                reason,
                            });
                        });
                    break;
                }
                case 'commitMapTransition': {
                    host.kernel.markClientMapTransitionCommitted(command.seq, command.toMapId);
                    finalizeClientMapTransition(host, getKnownEntity);
                    break;
                }
                case 'mapTransitionMapActivated': {
                    host.kernel.markClientMapTransitionMapActivated(command.seq, command.toMapId);
                    finalizeClientMapTransition(host, getKnownEntity);
                    break;
                }
                case 'mapTransitionMapFailed': {
                    const transition = host.kernel.clientMapTransition;
                    if (transition?.seq === command.seq && transition.toMapId === command.toMapId) {
                        host.kernel.clearClientMapTransition();
                        host.kernel.clientMovementSuppressed = false;
                        host.showNotification('Failed to load destination area. Please retry.');
                        log.error(`Map transition failed for ${command.toMapId}: ${command.reason}`);
                    }
                    break;
                }
                case 'emitNbPlayersChange': {
                    host.emit('nbPlayersChange', command.worldPlayers, command.totalPlayers);
                    break;
                }
                case 'applyEntityList': {
                    if (!host.client || !host.playerId) {
                        break;
                    }
                    const entityIds = Object.values(host.entities).map(function (entity) {
                        return entity.id;
                    });
                    const knownIds = entityIds.filter(function (id: EntityId) {
                        return command.list.includes(id);
                    });
                    const newIds = command.list.filter(function (id: EntityId) {
                        return !knownIds.includes(id);
                    });

                    host.obsoleteEntities = Object.values(host.entities).filter(function (entity) {
                        return !knownIds.includes(entity.id) && entity.id !== host.playerId;
                    });
                    host.removeObsoleteEntities();

                    if (newIds.length > 0) {
                        host.client.sendWho(newIds);
                    }
                    break;
                }
                case 'setEntityWorldPosition': {
                    const entity = getKnownEntity(command.entityId);
                    if (!entity) {
                        break;
                    }
                    if (!entity.setWorldPositionSub && !(entity instanceof Character)) {
                        throw new Error(`Entity ${String(command.entityId)} missing setWorldPositionSub`);
                    }
                    if (entity instanceof Character) {
                        const isLocalPlayer = host.playerId !== null && command.entityId === host.playerId;
                        if (entity.isMoving() && !isLocalPlayer) {
                            hardStopCharacterMovement(entity);
                        }
                    }
                    const renderedBefore = renderTopLeftPxToWorldSub(entity.x, entity.y);
                    host.kernel.setClientRenderedWorldPosition(
                        command.entityId,
                        renderedBefore.worldX,
                        renderedBefore.worldY
                    );
                    host.kernel.setClientPresentationTargetWorldPosition(
                        command.entityId,
                        command.worldX,
                        command.worldY
                    );
                    if (entity instanceof Character) {
                        bridgeCharacterWorldUpdate(entity, {
                            worldX: command.worldX,
                            worldY: command.worldY,
                            divergenceClass: command.visualDivergenceClass,
                        });
                        if (isSnapVisualDivergenceClass(command.visualDivergenceClass)) {
                            host.kernel.setClientRenderedWorldPosition(
                                command.entityId,
                                command.worldX,
                                command.worldY
                            );
                        }
                    } else {
                        entity.setWorldPositionSub?.(
                            command.worldX,
                            command.worldY,
                            isSnapVisualDivergenceClass(command.visualDivergenceClass)
                                ? { snapRender: true }
                                : undefined
                        );
                        if (isSnapVisualDivergenceClass(command.visualDivergenceClass)) {
                            host.kernel.setClientRenderedWorldPosition(
                                command.entityId,
                                command.worldX,
                                command.worldY
                            );
                        }
                    }
                    entity.setDirty();
                    break;
                }
                case 'teleportEntity': {
                    const entity = getKnownEntity(command.entityId);
                    const localPlayerTransition =
                        command.entityId === host.playerId ? host.kernel.clientMapTransition : null;
                    if (localPlayerTransition) {
                        host.kernel.setClientMapTransitionLocalTeleport(command.x, command.y, command.mapId);
                    }
                    const shouldDeferLocalTeleport = localPlayerTransition !== null;

                    if (entity && !shouldDeferLocalTeleport) {
                        if (entity instanceof Character) {
                            // Server teleports/corrections must cancel local pathing; otherwise the client continues an
                            // obsolete predicted path and fights the authoritative position.
                            entity.path = null;
                            entity.step = 0;
                            entity.newDestination = null;
                            entity.destination = null;
                            entity.interrupted = false;
                            entity.nextGridX = -1;
                            entity.nextGridY = -1;
                            entity.movement.stop();
                            entity.idle();
                            // Use legacy immediate teleport effect when available.
                            host.makeCharacterTeleportTo(entity, command.x, command.y);
                        }
                    }
                    host.kernel.clientReplicationLastPos.set(command.entityId, gridPos(command.x, command.y));
                    if (typeof command.mapId === 'string') {
                        host.kernel.setEntityMapId(command.entityId, command.mapId);
                        if (command.entityId === host.playerId) {
                            host.kernel.setActiveMapId(command.mapId);
                        }
                    }
                    if (command.entityId === host.playerId) {
                        host.kernel.clearClientMovePlan();
                        host.kernel.clientLastSentMovePos = gridPos(command.x, command.y);
                        host.kernel.clearClientPendingMoveAcks();
                        host.kernel.clearClientPendingMoveSeqAcks();
                        host.kernel.clearClientDoorTraversalContact();
                        if (!localPlayerTransition) {
                            host.kernel.clientMovementSuppressed = false;
                        }
                    }

                    const teleportedWorldPos = tileToWorldPosCenter(command.x, command.y);
                    host.kernel.setClientPresentationTargetWorldPosition(
                        command.entityId,
                        teleportedWorldPos.x,
                        teleportedWorldPos.y
                    );
                    host.kernel.setClientRenderedWorldPosition(
                        command.entityId,
                        teleportedWorldPos.x,
                        teleportedWorldPos.y
                    );
                    break;
                }
                case 'playerMoveToItem': {
                    if (command.playerId !== host.playerId) {
                        break;
                    }
                    const entity = host.getEntityById(command.itemId);
                    host.makePlayerGoToItem(entity instanceof Item ? entity : null);
                    break;
                }
                case 'setPlayerHealth': {
                    const previousPoints = host.player.hitPoints;
                    host.setPlayerHealth(command.points);
                    host.kernel.clientLocalPlayerDead = command.points <= 0;
                    host.updateBars();

                    if (!command.isRegen) {
                        const damage = Math.max(0, previousPoints - command.points);
                        const healed = Math.max(0, command.points - previousPoints);
                        if (damage > 0) {
                            host.infoManager.addDamageInfo(damage, host.player.x, host.player.y - 15, 'received');
                            host.audioManager?.playSound('hurt');
                            host.storage.addDamage(damage);
                            host.tryUnlockingAchievement('MEATSHIELD');
                        } else if (healed > 0) {
                            host.infoManager.addDamageInfo('+' + healed, host.player.x, host.player.y - 15, 'healed');
                        }
                        host.emit('playerHurt');
                    }

                    if (command.points <= 0) {
                        if (!host.player.isDead) {
                            host.stopPlayerCombat();
                            host.player.die();
                            host.audioManager?.playSound('death');
                            host.emit('playerDeath');
                        }
                        break;
                    }
                    break;
                }
                case 'setPlayerMaxHitPoints': {
                    host.setPlayerMaxHitPoints(command.maxHp);
                    host.updateBars();
                    break;
                }
                case 'applyAchievementProgress': {
                    host.storage.applyAchievementProgressSnapshot({
                        unlockedIds: command.unlockedIds,
                        ratCount: command.ratCount,
                        skeletonCount: command.skeletonCount,
                        totalKills: command.totalKills,
                        totalDmg: command.totalDmg,
                        totalRevives: command.totalRevives,
                    });
                    host.app.initUnlockedAchievements(host.storage.data.achievements.unlocked);
                    break;
                }
                case 'applyKillToAchievements': {
                    const mobName = resolveKillNotificationMobName(command.mobKind);
                    if (command.mobKind === Types.Entities.BOSS) {
                        host.showNotification('You killed the skeleton king');
                    } else if (mobName) {
                        const firstLetter = (mobName[0] ?? '').toLowerCase();
                        const article = ['a', 'e', 'i', 'o', 'u'].includes(firstLetter) ? 'an' : 'a';
                        host.showNotification(`You killed ${article} ${mobName}`);
                    }

                    host.storage.incrementTotalKills();
                    host.tryUnlockingAchievement('HUNTER');

                    if (command.mobKind === Types.Entities.RAT) {
                        host.storage.incrementRatCount();
                        host.tryUnlockingAchievement('ANGRY_RATS');
                    }

                    if (command.mobKind === Types.Entities.SKELETON || command.mobKind === Types.Entities.SKELETON2) {
                        host.storage.incrementSkeletonCount();
                        host.tryUnlockingAchievement('SKULL_COLLECTOR');
                    }

                    if (command.mobKind === Types.Entities.BOSS) {
                        host.tryUnlockingAchievement('HERO');
                    }
                    break;
                }
                case 'chatMessage': {
                    host.createBubble(command.entityId, command.text);
                    host.audioManager?.playSound('chat');
                    break;
                }
                case 'equipItem': {
                    const entity = getKnownEntity(command.entityId);
                    if (!entity) {
                        break;
                    }
                    if (Types.isArmor(command.itemKind)) {
                        const kindName = Types.getKindAsString(command.itemKind);
                        if (kindName) {
                            entity.setSprite(host.sprites[kindName] ?? null);
                            entity.setSpriteName?.(kindName);
                        }
                    } else if (Types.isWeapon(command.itemKind)) {
                        const kindName = Types.getKindAsString(command.itemKind);
                        if (kindName) {
                            entity.setWeaponName?.(kindName);
                        }
                    }
                    if (command.entityId === host.playerId) {
                        host.emit('playerEquipmentChange');
                    }
                    break;
                }
                case 'dropItem': {
                    const mob = getKnownEntity(command.mobId);
                    if (!mob) {
                        break;
                    }
                    host.addItemFromUnknown(command.item, mob.gridX, mob.gridY);
                    break;
                }
                case 'itemBlink': {
                    const entity = getKnownEntity(command.entityId);
                    entity?.blink?.(150);
                    break;
                }
                case 'spawnEntityFromKernel': {
                    const id = command.entityId;
                    if (getKnownEntity(id)) {
                        break;
                    }

                    const view = host.kernel.getEntityView(id);
                    const adapted = adaptKernelEntityForRendering(host.kernel, id);

                    if (adapted.type === 'item') {
                        host.addItemFromUnknown(adapted.entity, view.position.x, view.position.y);
                        break;
                    }

                    if (adapted.type === 'chest') {
                        const entity = adapted.entity;
                        if (isGridIndexedEntity(entity)) {
                            entity.setSprite(host.sprites[entity.getSpriteName()] ?? null);
                            entity.setGridPosition(view.position.x, view.position.y);
                            host.addEntity(entity);
                        }
                        break;
                    }

                    const character = adapted.entity;
                    character.setSprite(host.sprites[character.getSpriteName()] ?? null);
                    character.setGridPosition(view.position.x, view.position.y);
                    if (typeof character.setOrientation === 'function') {
                        character.setOrientation(safeOrientation(adapted.orientation));
                    }
                    character.idle();
                    if (isGridIndexedEntity(character)) {
                        host.addEntity(character);
                    }

                    if (adapted.targetId !== undefined) {
                        const target = getKnownEntity(adapted.targetId);
                        if (target instanceof Character) {
                            host.createAttackLink(character, target);
                        }
                    }
                    break;
                }
                case 'removeEntityById': {
                    const entity = getKnownEntity(command.entityId);
                    if (!entity) {
                        break;
                    }
                    if (entity instanceof Item) {
                        host.removeItem(entity);
                    } else {
                        host.removeEntity(entity);
                    }
                    break;
                }
                case 'characterGoTo': {
                    const entity = getKnownEntity(command.entityId);
                    if (!host.map || host.map.isOutOfBounds(command.x, command.y)) {
                        break;
                    }
                    if (entity instanceof Character) {
                        if (entity.isMoving()) {
                            const path = entity.path;
                            const tail = path && path.length > 0 ? path[path.length - 1] : undefined;
                            if (tail?.[0] === command.x && tail[1] === command.y) {
                                break;
                            }
                            if (appendAuthoritativeAdjacentStep(entity, command.x, command.y)) {
                                break;
                            }

                            hardStopCharacterMovement(entity);
                            if (host.playerId === command.entityId) {
                                debugMoves('apply:teleport_fallback', {
                                    entityId: command.entityId,
                                    to: { x: command.x, y: command.y },
                                    reason: 'append_failed',
                                });
                            }
                            host.makeCharacterTeleportTo(entity, command.x, command.y);
                            break;
                        }

                        if (entity.gridX === command.x && entity.gridY === command.y) {
                            break;
                        }

                        if (startAuthoritativeAdjacentStep(entity, command.x, command.y)) {
                            break;
                        }

                        // Non-local replication gaps (e.g. zoning/interest reacquire) should snap to authoritative position.
                        hardStopCharacterMovement(entity);
                        if (host.playerId === command.entityId) {
                            debugMoves('apply:teleport_fallback', {
                                entityId: command.entityId,
                                to: { x: command.x, y: command.y },
                                reason: 'start_failed_or_non_adjacent',
                            });
                        }
                        host.makeCharacterTeleportTo(entity, command.x, command.y);
                    }
                    break;
                }
                case 'createAttackLink': {
                    const attacker = getKnownEntity(command.attackerId);
                    const target = getKnownEntity(command.targetId);
                    if (!(attacker instanceof Character) || !(target instanceof Character)) {
                        break;
                    }
                    host.createAttackLink(attacker, target);
                    break;
                }
            }
        }
    }

    log.error('Client command apply exceeded max passes; possible command feedback loop');
}
