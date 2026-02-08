import log from 'compat/log';
import Types from 'compat/gametypes';

type AnimationLike = {
    name: string;
    reset: () => void;
    setSpeed: (speed?: number) => void;
    setCount: (count: number, onEndCount: () => void) => void;
};

type SpriteLike = {
    name: string;
    silhouetteSprite: SpriteLike;
    getHurtSprite: () => SpriteLike;
    createAnimations: () => Record<string, AnimationLike>;
};

type GridEntityLike = {
    gridX: number;
    gridY: number;
};

class Entity {
    id: string | number;
    kind: number;

    sprite: SpriteLike | null;
    normalSprite: SpriteLike | null;
    hurtSprite: SpriteLike | null;
    flipSpriteX: boolean;
    flipSpriteY: boolean;
    animations: Record<string, AnimationLike>;
    currentAnimation: AnimationLike | null;
    shadowOffsetY: number;

    x: number;
    y: number;
    gridX: number;
    gridY: number;

    isLoaded: boolean;
    isHighlighted: boolean;
    visible: boolean;
    isFading: boolean;
    startFadingTime: number;
    blinking: ReturnType<typeof setInterval> | null;
    isDirty: boolean;

    ready_func: (() => void) | null;
    dirty_callback: ((entity: Entity) => void) | null;
    name: string;

    constructor(id: string | number, kind: number) {
        this.id = id;
        this.kind = kind;

        // Renderer
        this.sprite = null;
        this.normalSprite = null;
        this.hurtSprite = null;
        this.flipSpriteX = false;
        this.flipSpriteY = false;
        this.animations = {};
        this.currentAnimation = null;
        this.shadowOffsetY = 0;

        // Position
        this.x = 0;
        this.y = 0;
        this.gridX = 0;
        this.gridY = 0;
        this.setGridPosition(0, 0);

        // Modes
        this.isLoaded = false;
        this.isHighlighted = false;
        this.visible = true;
        this.isFading = false;
        this.startFadingTime = 0;
        this.blinking = null;
        this.isDirty = false;

        this.ready_func = null;
        this.dirty_callback = null;
        this.name = '';

        this.setDirty();
    }

    setName(name: string): void {
        this.name = name;
    }

    setPosition(x: number, y: number): void {
        this.x = x;
        this.y = y;
    }

    setGridPosition(x: number, y: number): void {
        this.gridX = x;
        this.gridY = y;

        this.setPosition(x * 16, y * 16);
    }

    setSprite(sprite: SpriteLike | null): void {
        if (!sprite) {
            log.error(this.id + ' : sprite is null', true);
            throw new Error('Sprite error');
        }

        if (this.sprite && this.sprite.name === sprite.name) {
            return;
        }

        this.sprite = sprite;
        this.normalSprite = this.sprite;

        if (Types.isMob(this.kind) || Types.isPlayer(this.kind)) {
            this.hurtSprite = sprite.getHurtSprite();
        }

        this.animations = sprite.createAnimations();

        this.isLoaded = true;
        if (this.ready_func) {
            this.ready_func();
        }
    }

    getSprite(): SpriteLike | null {
        return this.sprite;
    }

    getSpriteName(): string {
        return Types.getKindAsString(this.kind);
    }

    getAnimationByName(name: string): AnimationLike | null {
        let animation: AnimationLike | null = null;

        if (name in this.animations) {
            animation = this.animations[name];
        } else {
            log.error('No animation called ' + name);
        }
        return animation;
    }

    setAnimation(name: string, speed?: number, count?: number, onEndCount?: (() => void) | null): void {
        const entityWithIdle = this as unknown as { idle?: () => void };

        if (this.isLoaded) {
            if (this.currentAnimation && this.currentAnimation.name === name) {
                return;
            }

            const animation = this.getAnimationByName(name);

            if (animation) {
                this.currentAnimation = animation;
                if (name.substr(0, 3) === 'atk') {
                    this.currentAnimation.reset();
                }
                this.currentAnimation.setSpeed(speed);
                this.currentAnimation.setCount(count ? count : 0, onEndCount || function () {
                    if (entityWithIdle.idle) {
                        entityWithIdle.idle();
                    }
                });
            }
        } else {
            this.log_error('Not ready for animation');
        }
    }

    hasShadow(): boolean {
        return false;
    }

    ready(f: () => void): void {
        this.ready_func = f;
    }

    clean(): void {
        this.stopBlinking();
    }

    log_info(message: string): void {
        log.info('[' + this.id + '] ' + message);
    }

    log_error(message: string): void {
        log.error('[' + this.id + '] ' + message);
    }

    setHighlight(value: boolean): void {
        if (value === true && this.sprite) {
            this.sprite = this.sprite.silhouetteSprite;
            this.isHighlighted = true;
        } else {
            this.sprite = this.normalSprite;
            this.isHighlighted = false;
        }
    }

    setVisible(value: boolean): void {
        this.visible = value;
    }

    isVisible(): boolean {
        return this.visible;
    }

    toggleVisibility(): void {
        if (this.visible) {
            this.setVisible(false);
        } else {
            this.setVisible(true);
        }
    }

    getDistanceToEntity(entity: GridEntityLike): number {
        const distX = Math.abs(entity.gridX - this.gridX);
        const distY = Math.abs(entity.gridY - this.gridY);

        return distX > distY ? distX : distY;
    }

    isCloseTo(entity: GridEntityLike | null): boolean {
        let close = false;
        if (entity) {
            const dx = Math.abs(entity.gridX - this.gridX);
            const dy = Math.abs(entity.gridY - this.gridY);

            if (dx < 30 && dy < 14) {
                close = true;
            }
        }
        return close;
    }

    isAdjacent(entity: GridEntityLike | null): boolean {
        let adjacent = false;

        if (entity) {
            adjacent = this.getDistanceToEntity(entity) <= 1;
        }
        return adjacent;
    }

    isAdjacentNonDiagonal(entity: GridEntityLike): boolean {
        let result = false;

        if (this.isAdjacent(entity) && !(this.gridX !== entity.gridX && this.gridY !== entity.gridY)) {
            result = true;
        }

        return result;
    }

    isDiagonallyAdjacent(entity: GridEntityLike): boolean {
        return this.isAdjacent(entity) && !this.isAdjacentNonDiagonal(entity);
    }

    forEachAdjacentNonDiagonalPosition(callback: (x: number, y: number, orientation: number) => void): void {
        callback(this.gridX - 1, this.gridY, Types.Orientations.LEFT);
        callback(this.gridX, this.gridY - 1, Types.Orientations.UP);
        callback(this.gridX + 1, this.gridY, Types.Orientations.RIGHT);
        callback(this.gridX, this.gridY + 1, Types.Orientations.DOWN);
    }

    fadeIn(currentTime: number): void {
        this.isFading = true;
        this.startFadingTime = currentTime;
    }

    blink(speed: number, _callback?: () => void): void {
        this.blinking = setInterval(() => {
            this.toggleVisibility();
        }, speed);
    }

    stopBlinking(): void {
        if (this.blinking) {
            clearInterval(this.blinking);
        }
        this.setVisible(true);
    }

    setDirty(): void {
        this.isDirty = true;
        if (this.dirty_callback) {
            this.dirty_callback(this);
        }
    }

    onDirty(dirty_callback: (entity: Entity) => void): void {
        this.dirty_callback = dirty_callback;
    }
}

export default Entity;
