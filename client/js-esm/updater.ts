import Character from './character';
import type AnimatedTile from './tile';
import Timer from './timer';
import Types from '../../shared/js/gametypes-browser';

type DirtyRect = Record<string, number>;
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
type UpdaterEntity = Character | NonCharacterEntity;
type AnimatedTileLike = AnimatedTile & {
    isDirty?: boolean;
    dirtyRect?: DirtyRect;
};
type UpdaterCharacter = Character;
type UpdaterGame = {
    currentTime: number;
    player: { isMoving(): boolean; isAttacking(): boolean; checkAggro(): void } | null;
    renderer: {
        FPS: number;
        mobile: boolean;
        tablet: boolean;
        renderStaticCanvases(): void;
        getTileBoundingRect(tile: AnimatedTileLike): DirtyRect;
    };
    camera: {
        x: number;
        y: number;
        gridW: number;
        gridH: number;
        setPosition(x: number, y: number): void;
    };
    currentZoning: StepTransition | null;
    zoningOrientation: number;
    sparksAnimation: { update(time: number): void } | null;
    targetAnimation: { update(time: number): void } | null;
    bubbleManager: { update(time: number): void };
    infoManager: { update(time: number): void };
    forEachEntity(callback: (entity: UpdaterEntity) => void): void;
    onCharacterUpdate(character: Character): void;
    initAnimatedTiles(): void;
    endZoning(): void;
    forEachAnimatedTile(callback: (tile: AnimatedTileLike) => void): void;
    checkOtherDirtyRects(rect: DirtyRect, source: AnimatedTileLike, x: number, y: number): void;
};

class Updater {
    game: UpdaterGame;
    playerAggroTimer: Timer;
    isFading: boolean;

    constructor(game: UpdaterGame) {
        this.game = game;
        this.playerAggroTimer = new Timer(1000);
        this.isFading = false;
    }

    update(): void {
        this.updateZoning();
        this.updateCharacters();
        this.updatePlayerAggro();
        this.updateTransitions();
        this.updateAnimations();
        this.updateAnimatedTiles();
        this.updateChatBubbles();
        this.updateInfos();
    }

    updateCharacters(): void {
        const self = this;

        this.game.forEachEntity(function (entity) {
            if (entity.isLoaded) {
                if (entity instanceof Character) {
                    self.updateCharacter(entity);
                    self.game.onCharacterUpdate(entity);
                }
                self.updateEntityFading(entity);
            }
        });
    }

    updatePlayerAggro(): void {
        const t = this.game.currentTime,
            player = this.game.player;

        // Check player aggro every 1s when not moving nor attacking
        if (player && !player.isMoving() && !player.isAttacking() && this.playerAggroTimer.isOver(t)) {
            player.checkAggro();
        }
    }

    updateEntityFading(entity: UpdaterEntity): void {
        if (entity && entity.isFading) {
            const duration = 1000,
                t = this.game.currentTime,
                dt = t - entity.startFadingTime;

            if (dt > duration) {
                this.isFading = false;
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

    updateTransitions(): void {
        const self = this,
            z = this.game.currentZoning;
        let m = null;

        this.game.forEachEntity(function (entity) {
            m = entity.movement;
            if (m) {
                if (m.inProgress) {
                    m.step(self.game.currentTime);
                }
            }
        });

        if (z) {
            if (z.inProgress) {
                z.step(this.game.currentTime);
            }
        }
    }

    updateZoning(): void {
        let g = this.game,
            c = g.camera,
            z = g.currentZoning,
            s = 3,
            ts = 16,
            speed = 500;

        if (z && z.inProgress === false) {
            let orientation = this.game.zoningOrientation,
                startValue = 0,
                endValue = 0,
                offset = 0,
                updateFunc = null,
                endFunc = null;

            if (orientation === Types.Orientations.LEFT || orientation === Types.Orientations.RIGHT) {
                offset = (c.gridW - 2) * ts;
                startValue = orientation === Types.Orientations.LEFT ? c.x - ts : c.x + ts;
                endValue = orientation === Types.Orientations.LEFT ? c.x - offset : c.x + offset;
                updateFunc = function (x) {
                    c.setPosition(x, c.y);
                    g.initAnimatedTiles();
                    g.renderer.renderStaticCanvases();
                };
                endFunc = function () {
                    c.setPosition(z.endValue, c.y);
                    g.endZoning();
                };
            } else if (orientation === Types.Orientations.UP || orientation === Types.Orientations.DOWN) {
                offset = (c.gridH - 2) * ts;
                startValue = orientation === Types.Orientations.UP ? c.y - ts : c.y + ts;
                endValue = orientation === Types.Orientations.UP ? c.y - offset : c.y + offset;
                updateFunc = function (y) {
                    c.setPosition(c.x, y);
                    g.initAnimatedTiles();
                    g.renderer.renderStaticCanvases();
                };
                endFunc = function () {
                    c.setPosition(c.x, z.endValue);
                    g.endZoning();
                };
            }

            z.start(this.game.currentTime, updateFunc, endFunc, startValue, endValue, speed);
        }
    }

    updateCharacter(c: UpdaterCharacter): void {
        const self = this;

        // Estimate of the movement distance for one update
        const tick = Math.round(16 / Math.round(c.moveSpeed / (1000 / this.game.renderer.FPS)));

        if (c.isMoving() && c.movement.inProgress === false) {
            if (c.orientation === Types.Orientations.LEFT) {
                c.movement.start(
                    this.game.currentTime,
                    function (x) {
                        c.x = x;
                        c.hasMoved();
                    },
                    function () {
                        c.x = c.movement.endValue;
                        c.hasMoved();
                        c.nextStep();
                    },
                    c.x - tick,
                    c.x - 16,
                    c.moveSpeed
                );
            } else if (c.orientation === Types.Orientations.RIGHT) {
                c.movement.start(
                    this.game.currentTime,
                    function (x) {
                        c.x = x;
                        c.hasMoved();
                    },
                    function () {
                        c.x = c.movement.endValue;
                        c.hasMoved();
                        c.nextStep();
                    },
                    c.x + tick,
                    c.x + 16,
                    c.moveSpeed
                );
            } else if (c.orientation === Types.Orientations.UP) {
                c.movement.start(
                    this.game.currentTime,
                    function (y) {
                        c.y = y;
                        c.hasMoved();
                    },
                    function () {
                        c.y = c.movement.endValue;
                        c.hasMoved();
                        c.nextStep();
                    },
                    c.y - tick,
                    c.y - 16,
                    c.moveSpeed
                );
            } else if (c.orientation === Types.Orientations.DOWN) {
                c.movement.start(
                    this.game.currentTime,
                    function (y) {
                        c.y = y;
                        c.hasMoved();
                    },
                    function () {
                        c.y = c.movement.endValue;
                        c.hasMoved();
                        c.nextStep();
                    },
                    c.y + tick,
                    c.y + 16,
                    c.moveSpeed
                );
            }
        }
    }

    updateAnimations(): void {
        const t = this.game.currentTime;

        this.game.forEachEntity(function (entity) {
            const anim = entity.currentAnimation;

            if (anim) {
                if ('update' in anim && typeof anim.update === 'function' && anim.update(t)) {
                    entity.setDirty();
                }
            }
        });

        const sparks = this.game.sparksAnimation;
        if (sparks) {
            sparks.update(t);
        }

        const target = this.game.targetAnimation;
        if (target) {
            target.update(t);
        }
    }

    updateAnimatedTiles(): void {
        const self = this,
            t = this.game.currentTime;

        this.game.forEachAnimatedTile(function (tile) {
            if (tile.animate(t)) {
                tile.isDirty = true;
                tile.dirtyRect = self.game.renderer.getTileBoundingRect(tile);

                if (self.game.renderer.mobile || self.game.renderer.tablet) {
                    self.game.checkOtherDirtyRects(tile.dirtyRect, tile, tile.x, tile.y);
                }
            }
        });
    }

    updateChatBubbles(): void {
        const t = this.game.currentTime;

        this.game.bubbleManager.update(t);
    }

    updateInfos(): void {
        const t = this.game.currentTime;

        this.game.infoManager.update(t);
    }
}

export default Updater;
