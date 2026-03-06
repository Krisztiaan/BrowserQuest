import Character from '../../character';
import Mob from '../../mob';
import type AnimatedTile from '../../tile';
import type Timer from '../../timer';
import Types from '../../../shared/gametypes-browser';
import type { EntityId } from '../../../shared/domain/ids';
import { SUBPIXELS, TILE_PX } from '../../../shared/world/worldpos';

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
    };
    map: { grid: number[][] } | null;
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

function isInterpolatedEntity(entity: SimulationEntity): entity is SimulationEntity & InterpolatedEntity {
    const candidate = entity as unknown as Partial<InterpolatedEntity>;
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
    if (!('id' in entity) || typeof entity.id !== 'number') {
        return;
    }
    if (!isInterpolatedEntity(entity)) {
        return;
    }
    host.kernel.setClientRenderedWorldPosition?.(
        entity.id as EntityId,
        (entity.x + TILE_PX / 2) * SUBPIXELS,
        (entity.y + TILE_PX / 2) * SUBPIXELS
    );
}

export function resolveCameraAxis({
    mapPixels,
    viewportPixels,
    desired,
}: {
    mapPixels: number;
    viewportPixels: number;
    desired: number;
}): Readonly<{ min: number; max: number; clamped: number }> {
    if (mapPixels <= viewportPixels) {
        const centered = -(viewportPixels - mapPixels) / 2;
        return Object.freeze({ min: centered, max: centered, clamped: centered });
    }

    const min = 0;
    const max = mapPixels - viewportPixels;
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
        character.targetX = character.x;
        character.targetY = character.y;

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
                character.x = startX + dx * d;
                character.y = startY + dy * d;
                character.targetX = character.x;
                character.targetY = character.y;
                character.hasMoved();
            },
            function () {
                character.x = endX;
                character.y = endY;
                character.targetX = character.x;
                character.targetY = character.y;
                character.hasMoved();
                character.nextStep();
            },
            0,
            TILE,
            character.moveSpeed
        );
    }
}

function updateEntityInterpolation(entity: SimulationEntity, dtMs: number): void {
    if (!isInterpolatedEntity(entity)) {
        return;
    }
    if (entity instanceof Character && entity.isMoving()) {
        return;
    }

    const dx = entity.targetX - entity.x;
    const dy = entity.targetY - entity.y;
    const manhattan = Math.abs(dx) + Math.abs(dy);
    if (manhattan < 0.01) {
        return;
    }

    const prevX = entity.x;
    const prevY = entity.y;

    // Large drift: snap immediately (eg teleport/correction).
    if (manhattan > 96) {
        entity.x = entity.targetX;
        entity.y = entity.targetY;
    } else {
        const a = lerpAlpha(dtMs, 80);
        entity.x = entity.x + dx * a;
        entity.y = entity.y + dy * a;
    }

    if (entity instanceof Character) {
        const movedX = entity.x - prevX;
        const movedY = entity.y - prevY;
        const moved = Math.abs(movedX) + Math.abs(movedY);
        if (!entity.isAttacking()) {
            if (moved > 0.05) {
                // 4-dir sprite facing: choose dominant axis.
                if (Math.abs(movedX) >= Math.abs(movedY)) {
                    entity.walk(movedX < 0 ? Types.Orientations.LEFT : Types.Orientations.RIGHT);
                } else {
                    entity.walk(movedY < 0 ? Types.Orientations.UP : Types.Orientations.DOWN);
                }
            } else {
                entity.idle();
            }
        }
        entity.hasMoved();
    } else {
        entity.setDirty();
    }
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

    if (orientation === Types.Orientations.LEFT || orientation === Types.Orientations.RIGHT) {
        offset = (c.gridW - 2) * ts;
        startValue = orientation === Types.Orientations.LEFT ? c.x - ts : c.x + ts;
        endValue = orientation === Types.Orientations.LEFT ? c.x - offset : c.x + offset;
        updateFunc = function (x: number) {
            c.setPosition(x, c.y);
            host.initAnimatedTiles();
            renderer.renderStaticCanvases();
        };
        endFunc = function () {
            c.setPosition(z.endValue, c.y);
            host.endZoning();
        };
    } else if (orientation === Types.Orientations.UP || orientation === Types.Orientations.DOWN) {
        offset = (c.gridH - 2) * ts;
        startValue = orientation === Types.Orientations.UP ? c.y - ts : c.y + ts;
        endValue = orientation === Types.Orientations.UP ? c.y - offset : c.y + offset;
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
        updateEntityInterpolation(entity, dtMs);
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
    const mapH = grid.length;
    const mapW = grid[0]?.length ?? 0;
    if (mapW <= 0 || mapH <= 0) {
        return;
    }

    const TILE = 16;
    const mapWorldWidth = mapW * TILE;
    const mapWorldHeight = mapH * TILE;
    const viewportWorldWidth = renderer.getWidth() / renderer.scale;
    const viewportWorldHeight = renderer.getHeight() / renderer.scale;
    const desiredX = Math.round(player.x - (viewportWorldWidth / 2));
    const desiredY = Math.round(player.y - (viewportWorldHeight / 2));
    const xAxis = resolveCameraAxis({
        mapPixels: mapWorldWidth,
        viewportPixels: viewportWorldWidth,
        desired: desiredX,
    });
    const yAxis = resolveCameraAxis({
        mapPixels: mapWorldHeight,
        viewportPixels: viewportWorldHeight,
        desired: desiredY,
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

    updateCameraFollow(host, dtMs);
    updateZoning(host);
    updateCharacters(host, dtMs);
    updatePlayerAggro(host);
    updateTransitions(host);
    updateAnimations(host);
    updateAnimatedTiles(host);
    updateChatBubbles(host);
    updateInfos(host);
}
