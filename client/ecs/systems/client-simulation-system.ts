import Character from '../../character';
import Mob from '../../mob';
import type AnimatedTile from '../../tile';
import type Timer from '../../timer';
import Types from '../../../shared/gametypes-browser';
import type { EntityId } from '../../../shared/domain/ids';

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
    };
    renderer: {
        FPS: number;
        mobile: boolean;
        tablet: boolean;
        renderStaticCanvases(): void;
        getTileBoundingRect(tile: AnimatedTileLike): DirtyRect;
    } | null;
    camera: {
        x: number;
        y: number;
        gridW: number;
        gridH: number;
        setPosition(x: number, y: number): void;
        isVisible(entity: SimulationPlayer): boolean;
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
    resetCamera(): void;
    forEachAnimatedTile(callback: (tile: AnimatedTileLike) => void): void;
    checkOtherDirtyRects(rect: DirtyRect, source: AnimatedTileLike, x: number, y: number): void;
}>;

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
                character.hasMoved();
            },
            function () {
                character.x = endX;
                character.y = endY;
                character.hasMoved();
                character.nextStep();
            },
            0,
            TILE,
            character.moveSpeed
        );
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

function updateCharacters(host: ClientSimulationSystemHost): void {
    host.forEachEntity(function (entity) {
        if (!entity.isLoaded) {
            return;
        }
        if (entity instanceof Character) {
            updateCharacter(host, entity);
        }
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

function ensureMobileCameraTracksPlayer(host: ClientSimulationSystemHost): void {
    const renderer = host.renderer;
    const player = host.player;
    // While awaiting WELCOME (e.g. during revive/restart), the local player is not yet authoritative.
    // Do not auto-snap the camera to a placeholder position.
    if (!renderer || !player || !host.playerId) {
        return;
    }
    if (!renderer.mobile && !renderer.tablet) {
        return;
    }
    if (host.camera.isVisible(player)) {
        return;
    }
    host.resetCamera();
}

export function runClientSimulationSystem(host: ClientSimulationSystemHost): void {
    if (!host.started) {
        return;
    }

    ensureMobileCameraTracksPlayer(host);
    updateZoning(host);
    updateCharacters(host);
    updatePlayerAggro(host);
    updateTransitions(host);
    updateAnimations(host);
    updateAnimatedTiles(host);
    updateChatBubbles(host);
    updateInfos(host);
}
