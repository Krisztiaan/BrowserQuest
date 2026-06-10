import Character from '../../character';
import Mob from '../../mob';
import type AnimatedTile from '../../tile';
import type Timer from '../../timer';
import type { EntityId } from '../../../shared/domain/ids';
import { SUBPIXELS, TILE_PX } from '../../../shared/world/worldpos';
import log from '../../platform/log';
import { resolveClientMovementNetcodeConfig } from '../../movement-netcode-config';
import {
    bridgeCharacterInterpolatedLocomotion,
    bridgeCharacterRenderPosition,
    bridgeCharacterRenderTarget,
    bridgeEntityRenderPosition,
} from '../visual-movement-bridge';
import { classifyInterpolationDivergence, isSnapVisualDivergenceClass } from '../visual-movement-divergence';

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
type StepTransition = {
    inProgress: boolean;
    endValue: number;
    step(currentTime: number): void;
    start(
        currentTime: number,
        update: (value: number) => void,
        done: () => void,
        startValue: number,
        endValue: number,
        speed: number
    ): void;
};
type NonCharacterEntity = {
    isLoaded?: boolean;
    isFading?: boolean;
    startFadingTime?: number;
    fadingAlpha?: number;
    movement?: StepTransition | null;
    currentAnimation?: { update(time: number): boolean } | null;
    setDirty(): void;
};
type SimulationEntity = Character | NonCharacterEntity;
type SimulationPlayer = Pick<
    Character,
    'id' | 'x' | 'y' | 'gridX' | 'gridY' | 'isMoving' | 'isAttacking' | 'isNear' | 'isAttackedBy'
>;
type AnimatedTileLike = AnimatedTile & {
    isDirty?: boolean;
    dirtyRect?: DirtyRect;
};

export type ClientSimulationSystemHost = Readonly<{
    started: boolean;
    currentTime: number;
    playerAggroTimer: Pick<Timer, 'isOver'>;
    player: SimulationPlayer | null;
    playerId: EntityId | null;
    kernel: {
        enqueueClientCommand(command: { type: 'clientSendAggro'; mobId: EntityId }): void;
        setClientRenderedWorldPosition?(entityId: EntityId, worldX: number, worldY: number): void;
        setClientPresentationTargetWorldPosition?(entityId: EntityId, worldX: number, worldY: number): void;
        clientMoveInputKeysMask?: number;
        clientMovePlan?: { target: { x: number; y: number } } | null;
    };
    map: {
        grid: number[][];
        width?: number;
        height?: number;
        getCameraRegionBounds?(
            gridX: number,
            gridY: number
        ): Readonly<{ minX: number; minY: number; maxX: number; maxY: number }> | null;
    } | null;
    renderer: {
        FPS: number;
        mobile: boolean;
        tablet: boolean;
        scale: number;
        getWidth(): number;
        getHeight(): number;
        renderStaticCanvases(): void;
        getTileBoundingRect(tile: AnimatedTileLike): DirtyRect;
    } | null;
    camera: {
        x: number;
        y: number;
        gridW: number;
        gridH: number;
        setPosition(x: number, y: number): void;
    };
    currentZoning: StepTransition | null;
    zoningOrientation: number | null;
    sparksAnimation: { update(time: number): void } | null;
    targetAnimation: { update(time: number): void } | null;
    bubbleManager: { update(time: number): void } | null;
    infoManager: { update(time: number): void };
    forEachEntity(callback: (entity: SimulationEntity) => void): void;
    initAnimatedTiles(): void;
    endZoning(): void;
    forEachAnimatedTile(callback: (tile: AnimatedTileLike) => void): void;
    checkOtherDirtyRects(rect: DirtyRect, source: AnimatedTileLike, x: number, y: number): void;
}>;

type InterpolatedEntity = {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    setDirty(): void;
};

function isInterpolatedEntity<T>(entity: T): entity is T & InterpolatedEntity {
    const candidate = entity as Partial<InterpolatedEntity>;
    return (
        typeof candidate.x === 'number' &&
        typeof candidate.y === 'number' &&
        typeof candidate.targetX === 'number' &&
        typeof candidate.targetY === 'number' &&
        typeof candidate.setDirty === 'function'
    );
}

function lerpAlpha(dtMs: number, tauMs: number): number {
    // Stable smoothing regardless of FPS; clamp dt to reduce huge jumps on background tab wakeups.
    const dt = Math.max(0, Math.min(250, dtMs));
    return 1 - Math.exp(-dt / tauMs);
}

function syncRenderedWorldPosition(host: ClientSimulationSystemHost, entity: SimulationEntity): void {
    // Note: an early `'id' in entity` guard would type-narrow the union to
    // Character only (NonCharacterEntity does not declare id), collapsing the
    // non-Character branch to never; read id via a local instead.
    if (entity instanceof Character) {
        if (typeof entity.id !== 'number') {
            return;
        }
        host.kernel.setClientRenderedWorldPosition?.(
            entity.id as EntityId,
            entity.visualState.renderWorldX,
            entity.visualState.renderWorldY
        );
        return;
    }
    if (!isInterpolatedEntity(entity)) {
        return;
    }
    const id = (entity as { id?: unknown }).id;
    if (typeof id !== 'number') {
        return;
    }
    host.kernel.setClientRenderedWorldPosition?.(
        id as EntityId,
        (entity.x + TILE_PX / 2) * SUBPIXELS,
        (entity.y + TILE_PX / 2) * SUBPIXELS
    );
}

function hasLocalPresentationIntent(host: ClientSimulationSystemHost, entity: Character): boolean {
    if (host.playerId === null || entity.id !== host.playerId) {
        return false;
    }
    return (host.kernel.clientMoveInputKeysMask ?? 0) !== 0 || host.kernel.clientMovePlan !== null;
}

export function resolveCameraAxis({
    mapPixels,
    viewportPixels,
    desired,
    rangeMinPixels,
    rangeMaxPixels,
}: {
    mapPixels: number;
    viewportPixels: number;
    desired: number;
    /** Optional clamp range (e.g. the painted region containing the player); defaults to the full map. */
    rangeMinPixels?: number;
    rangeMaxPixels?: number;
}): Readonly<{ min: number; max: number; clamped: number }> {
    const rangeMin = rangeMinPixels ?? 0;
    const rangeMax = rangeMaxPixels ?? mapPixels;
    const extent = rangeMax - rangeMin;
    if (extent <= viewportPixels) {
        const centered = rangeMin - (viewportPixels - extent) / 2;
        return Object.freeze({ min: centered, max: centered, clamped: centered });
    }

    const min = rangeMin;
    const max = rangeMax - viewportPixels;
    const clamped = Math.max(min, Math.min(desired, max));
    return Object.freeze({ min, max, clamped });
}

function updateEntityFading(host: ClientSimulationSystemHost, entity: SimulationEntity): void {
    if ('isFading' in entity && entity.isFading) {
        const duration = 1000;
        const t = host.currentTime;
        const start = typeof entity.startFadingTime === 'number' ? entity.startFadingTime : 0;
        const dt = t - start;

        if (dt > duration) {
            if ('fadingAlpha' in entity) {
                entity.fadingAlpha = 1;
            }
        } else {
            if ('fadingAlpha' in entity) {
                entity.fadingAlpha = dt / duration;
            }
        }
    }
}

function updateCharacter(host: ClientSimulationSystemHost, character: Character): void {
    const renderer = host.renderer;
    if (!renderer) {
        return;
    }

    if (character.isMoving() && character.movement.inProgress === false) {
        // While path-stepping, keep render target aligned with the step interpolation so we don't
        // "snap back" to an old authoritative target when the path completes.
        bridgeCharacterRenderTarget(character, {
            x: character.visualState.renderX,
            y: character.visualState.renderY,
            mode: 'path_step',
        });

        const TILE = 16;
        const dx = character.nextGridX - character.gridX;
        const dy = character.nextGridY - character.gridY;
        if (dx === 0 && dy === 0) {
            character.nextStep();
            return;
        }
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || dx < -1 || dy < -1) {
            // Defensive: if path state is corrupted, do not attempt interpolation.
            character.nextStep();
            return;
        }

        const startX = character.x;
        const startY = character.y;
        const endX = startX + dx * TILE;
        const endY = startY + dy * TILE;

        // Transition drives a scalar progress value; we map it into x+y deltas.
        character.movement.start(
            host.currentTime,
            function (d) {
                const nextX = startX + dx * d;
                const nextY = startY + dy * d;
                bridgeCharacterRenderPosition(character, {
                    x: nextX,
                    y: nextY,
                    velocityX: dx,
                    velocityY: dy,
                    mode: 'path_step',
                });
                bridgeCharacterRenderTarget(character, { x: nextX, y: nextY, mode: 'path_step' });
                if (host.playerId !== null && character.id === host.playerId) {
                    host.kernel.setClientPresentationTargetWorldPosition?.(
                        character.id as EntityId,
                        character.visualState.renderWorldX,
                        character.visualState.renderWorldY
                    );
                }
                character.hasMoved();
            },
            function () {
                bridgeCharacterRenderPosition(character, {
                    x: endX,
                    y: endY,
                    velocityX: dx,
                    velocityY: dy,
                    mode: 'path_step',
                });
                bridgeCharacterRenderTarget(character, { x: endX, y: endY, mode: 'path_step' });
                if (host.playerId !== null && character.id === host.playerId) {
                    host.kernel.setClientPresentationTargetWorldPosition?.(
                        character.id as EntityId,
                        character.visualState.renderWorldX,
                        character.visualState.renderWorldY
                    );
                }
                character.hasMoved();
                character.nextStep();
            },
            0,
            TILE,
            character.moveSpeed
        );
    }
}

function updateEntityInterpolation(host: ClientSimulationSystemHost, entity: SimulationEntity, dtMs: number): void {
    if (!isInterpolatedEntity(entity)) {
        return;
    }
    if (entity instanceof Character && entity.isMoving()) {
        return;
    }

    const renderX = entity instanceof Character ? entity.visualState.renderX : entity.x;
    const renderY = entity instanceof Character ? entity.visualState.renderY : entity.y;
    const targetX = entity instanceof Character ? entity.visualState.targetRenderX : entity.targetX;
    const targetY = entity instanceof Character ? entity.visualState.targetRenderY : entity.targetY;
    const dx = targetX - renderX;
    const dy = targetY - renderY;
    const maxAxisDistance = Math.max(Math.abs(dx), Math.abs(dy));
    if (maxAxisDistance < 0.01) {
        return;
    }

    const prevX = renderX;
    const prevY = renderY;
    const isLocalPlayer = entity instanceof Character && host.playerId !== null && entity.id === host.playerId;
    const config = resolveClientMovementNetcodeConfig();
    const tuning = config.tuning;

    const divergenceClass = classifyInterpolationDivergence({
        isLocalPlayer,
        maxAxisDistancePx: maxAxisDistance,
    });
    if (entity instanceof Character) {
        entity.setVisualDivergenceClass(divergenceClass);
    }

    if (isSnapVisualDivergenceClass(divergenceClass)) {
        if (entity instanceof Character) {
            log.warn({
                scope: 'movement_presentation',
                level: 'warn',
                event: 'movement.visual_recovery_snap',
                entityId: entity.id,
                profile: config.profileId,
                isLocalPlayer,
                divergenceClass,
                maxAxisDistancePx: maxAxisDistance,
                renderX,
                renderY,
                targetX,
                targetY,
            });
        }
        if (entity instanceof Character) {
            bridgeCharacterRenderPosition(entity, {
                x: targetX,
                y: targetY,
                velocityX: 0,
                velocityY: 0,
                mode: 'snap',
            });
        } else {
            bridgeEntityRenderPosition(entity, { x: targetX, y: targetY });
        }
    } else {
        let blend = lerpAlpha(dtMs, tuning.remotePresentationTauMs);
        if (isLocalPlayer && config.rollout.localPresentationMotor) {
            const activeIntent = hasLocalPresentationIntent(host, entity);
            const baseTauMs = activeIntent ? tuning.localPresentationTauActiveMs : tuning.localPresentationTauIdleMs;
            const boostedTauMs = maxAxisDistance >= 8 ? Math.max(10, Math.round(baseTauMs * 0.7)) : baseTauMs;
            blend = lerpAlpha(dtMs, boostedTauMs);
            if (activeIntent && maxAxisDistance > 0.1) {
                const minBlend = Math.min(
                    1,
                    (tuning.localPresentationMinStepPx * Math.max(dtMs, 1)) / 16 / maxAxisDistance
                );
                blend = Math.max(blend, minBlend);
            }
        }

        const nextRenderX = renderX + dx * blend;
        const nextRenderY = renderY + dy * blend;
        if (entity instanceof Character) {
            bridgeCharacterRenderPosition(entity, {
                velocityX: nextRenderX - renderX,
                velocityY: nextRenderY - renderY,
                x: nextRenderX,
                y: nextRenderY,
                mode: 'interpolate',
            });
        } else {
            bridgeEntityRenderPosition(entity, { x: nextRenderX, y: nextRenderY });
        }
    }

    if (entity instanceof Character) {
        const movedX = entity.visualState.renderX - prevX;
        const movedY = entity.visualState.renderY - prevY;
        if (!entity.isAttacking()) {
            bridgeCharacterInterpolatedLocomotion(entity, { movedX, movedY, movingThresholdPx: 0.05 });
        }
        entity.hasMoved();
    }
    // Non-character entities are marked dirty inside bridgeEntityRenderPosition.
}

function updateZoning(host: ClientSimulationSystemHost): void {
    const z = host.currentZoning;
    if (!z) {
        return;
    }
    if (z.inProgress !== false) {
        return;
    }

    const renderer = host.renderer;
    if (!renderer) {
        return;
    }

    const orientation = host.zoningOrientation;
    if (!orientation) {
        return;
    }

    const c = host.camera;
    const ts = 16;
    const speed = 500;

    let startValue = 0;
    let endValue = 0;
    let offset = 0;
    let updateFunc: ((value: number) => void) | null = null;
    let endFunc: (() => void) | null = null;
    const ORIENTATION_UP = 1;
    const ORIENTATION_DOWN = 2;
    const ORIENTATION_LEFT = 3;
    const ORIENTATION_RIGHT = 4;

    if (orientation === ORIENTATION_LEFT || orientation === ORIENTATION_RIGHT) {
        offset = (c.gridW - 2) * ts;
        startValue = orientation === ORIENTATION_LEFT ? c.x - ts : c.x + ts;
        endValue = orientation === ORIENTATION_LEFT ? c.x - offset : c.x + offset;
        updateFunc = function (x: number) {
            c.setPosition(x, c.y);
            host.initAnimatedTiles();
            renderer.renderStaticCanvases();
        };
        endFunc = function () {
            c.setPosition(z.endValue, c.y);
            host.endZoning();
        };
    } else if (orientation === ORIENTATION_UP || orientation === ORIENTATION_DOWN) {
        offset = (c.gridH - 2) * ts;
        startValue = orientation === ORIENTATION_UP ? c.y - ts : c.y + ts;
        endValue = orientation === ORIENTATION_UP ? c.y - offset : c.y + offset;
        updateFunc = function (y: number) {
            c.setPosition(c.x, y);
            host.initAnimatedTiles();
            renderer.renderStaticCanvases();
        };
        endFunc = function () {
            c.setPosition(c.x, z.endValue);
            host.endZoning();
        };
    }

    if (!updateFunc || !endFunc) {
        return;
    }

    z.start(host.currentTime, updateFunc, endFunc, startValue, endValue, speed);
}

function updateCharacters(host: ClientSimulationSystemHost, dtMs: number): void {
    host.forEachEntity(function (entity) {
        if (!entity.isLoaded) {
            return;
        }
        if (entity instanceof Character) {
            updateCharacter(host, entity);
        }
        updateEntityInterpolation(host, entity, dtMs);
        syncRenderedWorldPosition(host, entity);
        updateEntityFading(host, entity);
    });
}

function updatePlayerAggro(host: ClientSimulationSystemHost): void {
    const t = host.currentTime;
    const player = host.player;

    // Legacy parity: periodically probe nearby aggressive mobs and emit AGGRO intent.
    if (!player || player.isMoving() || player.isAttacking() || !host.playerAggroTimer.isOver(t)) {
        return;
    }

    host.forEachEntity((entity) => {
        if (!(entity instanceof Mob)) {
            return;
        }
        if (!entity.isAggressive || entity.isAttacking()) {
            return;
        }
        if (!player.isNear(entity, entity.aggroRange)) {
            return;
        }
        if (player.isAttackedBy(entity) || entity.isWaitingToAttack(player)) {
            return;
        }

        entity.waitToAttack(player);
        host.kernel.enqueueClientCommand({ type: 'clientSendAggro', mobId: entity.id as EntityId });
    });
}

function updateTransitions(host: ClientSimulationSystemHost): void {
    host.forEachEntity(function (entity) {
        const movement = entity.movement;
        if (movement?.inProgress) {
            movement.step(host.currentTime);
        }
    });

    const zoning = host.currentZoning;
    if (zoning?.inProgress) {
        zoning.step(host.currentTime);
    }
}

function updateAnimations(host: ClientSimulationSystemHost): void {
    const t = host.currentTime;

    host.forEachEntity(function (entity) {
        const anim = entity.currentAnimation;
        if (anim) {
            if ('update' in anim && typeof anim.update === 'function' && anim.update(t)) {
                entity.setDirty();
            }
        }
    });

    host.sparksAnimation?.update(t);
    host.targetAnimation?.update(t);
}

function updateAnimatedTiles(host: ClientSimulationSystemHost): void {
    const renderer = host.renderer;
    if (!renderer) {
        return;
    }

    const t = host.currentTime;
    host.forEachAnimatedTile(function (tile) {
        if (tile.animate(t)) {
            tile.isDirty = true;
            tile.dirtyRect = renderer.getTileBoundingRect(tile);

            if (renderer.mobile || renderer.tablet) {
                host.checkOtherDirtyRects(tile.dirtyRect, tile, tile.x, tile.y);
            }
        }
    });
}

function updateChatBubbles(host: ClientSimulationSystemHost): void {
    host.bubbleManager?.update(host.currentTime);
}

function updateInfos(host: ClientSimulationSystemHost): void {
    host.infoManager.update(host.currentTime);
}

function updateCameraFollow(host: ClientSimulationSystemHost, dtMs: number): void {
    const renderer = host.renderer;
    const player = host.player;
    if (!renderer || !player || !host.playerId) {
        return;
    }
    if (!host.map) {
        return;
    }
    if (host.currentZoning) {
        return;
    }

    const grid: number[][] = host.map.grid;
    const mapH =
        Number.isInteger(host.map.height) && (host.map.height ?? 0) > 0 ? Number(host.map.height) : grid.length;
    const mapW =
        Number.isInteger(host.map.width) && (host.map.width ?? 0) > 0 ? Number(host.map.width) : (grid[0]?.length ?? 0);
    if (mapW <= 0 || mapH <= 0) {
        return;
    }

    const TILE = 16;
    const mapWorldWidth = mapW * TILE;
    const mapWorldHeight = mapH * TILE;
    const viewportWorldWidth = renderer.getWidth() / renderer.scale;
    const viewportWorldHeight = renderer.getHeight() / renderer.scale;
    const desiredX = Math.round(player.x - viewportWorldWidth / 2);
    const desiredY = Math.round(player.y - viewportWorldHeight / 2);
    // Clamp the camera to the painted region containing the player so it never
    // pans over the void between regions; small enclosed regions (interior
    // rooms) center in the viewport instead.
    const region = host.map.getCameraRegionBounds?.(player.gridX, player.gridY) ?? null;
    const xAxis = resolveCameraAxis({
        mapPixels: mapWorldWidth,
        viewportPixels: viewportWorldWidth,
        desired: desiredX,
        ...(region ? { rangeMinPixels: region.minX * TILE, rangeMaxPixels: (region.maxX + 1) * TILE } : {}),
    });
    const yAxis = resolveCameraAxis({
        mapPixels: mapWorldHeight,
        viewportPixels: viewportWorldHeight,
        desired: desiredY,
        ...(region ? { rangeMinPixels: region.minY * TILE, rangeMaxPixels: (region.maxY + 1) * TILE } : {}),
    });

    const a = lerpAlpha(dtMs, 120);
    const nextX = host.camera.x + (xAxis.clamped - host.camera.x) * a;
    const nextY = host.camera.y + (yAxis.clamped - host.camera.y) * a;
    host.camera.setPosition(
        Math.max(xAxis.min, Math.min(nextX, xAxis.max)),
        Math.max(yAxis.min, Math.min(nextY, yAxis.max))
    );
}

let lastSimulationTimeMs = 0;

export function runClientSimulationSystem(host: ClientSimulationSystemHost): void {
    if (!host.started) {
        return;
    }

    const dtMs = lastSimulationTimeMs > 0 ? host.currentTime - lastSimulationTimeMs : 16;
    lastSimulationTimeMs = host.currentTime;

    updateCharacters(host, dtMs);
    updateCameraFollow(host, dtMs);
    updateZoning(host);
    updatePlayerAggro(host);
    updateTransitions(host);
    updateAnimations(host);
    updateAnimatedTiles(host);
    updateChatBubbles(host);
    updateInfos(host);
}
