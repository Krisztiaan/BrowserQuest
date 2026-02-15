import Entity from './entity';
import Transition from './transition';
import Timer from './timer';
import log from './platform/log';
import Types from '../shared/gametypes-browser';
import { gridPos } from '../shared/domain/positions';
import { isWithinAttackRange, resolveAttackRangeTiles } from '../shared/combat/attack-range';
import type { EntityKind } from '../shared/entity-kind-domain';
import type { MergeEvents, TypedEventMap, TypedEventSource } from '../shared/typed-event-emitter';

type GridPoint = [number, number];
type Path = GridPoint[];

type CharacterLike = {
    id: string | number;
    gridX: number;
    gridY: number;
    isWaitingToAttack?: (character: CharacterLike) => boolean;
    waitToAttack?: (character: CharacterLike) => void;
};
type CombatTarget = CharacterLike & {
    removeAttacker?: (attacker: Character) => void;
};

type PathRequestResolver = (x: number, y: number) => Path;

export type CharacterEvents = {
    dirty: [character: Character];
    startPathing: [path: Path];
    stopPathing: [x: number, y: number];
    beforeStep: [];
    step: [];
    aggro: [character: CharacterLike];
    checkAggro: [];
    death: [];
    hasMoved: [character: Character];
};

export type CharacterEventSource<TEvents extends TypedEventMap = CharacterEvents> = TypedEventSource<TEvents>;

class Character<TEvents extends MergeEvents<CharacterEvents, TypedEventMap> = CharacterEvents> extends Entity<TEvents> {
    nextGridX: number;
    nextGridY: number;
    orientation: number;

    atkSpeed: number;
    moveSpeed: number;
    walkSpeed: number;
    idleSpeed: number;

    movement: Transition;
    path: Path | null;
    step: number;
    newDestination: { x: number; y: number } | null;
    destination: { gridX: number; gridY: number } | null;
    adjacentTiles: Record<string, unknown>;

    target: CombatTarget | null;
    unconfirmedTarget: CharacterLike | null;
    previousTarget: CharacterLike | null;
    attackers: Record<string, Character>;

    hitPoints: number;
    maxHitPoints: number;

    isDead: boolean;
    isDying: boolean;
    attackingMode: boolean;
    followingMode: boolean;
    interrupted: boolean;

    attackCooldown: Timer;
    hurting: ReturnType<typeof setTimeout> | null;

    private pathRequestResolver: PathRequestResolver | null;
    constructor(id: string | number, kind: EntityKind) {
        super(id, kind);

        // Position and orientation
        this.nextGridX = -1;
        this.nextGridY = -1;
        this.orientation = Types.Orientations.DOWN;

        // Speeds
        this.atkSpeed = 50;
        this.moveSpeed = 120;
        this.walkSpeed = 100;
        this.idleSpeed = 450;
        this.attackCooldown = new Timer(800);
        this.setAttackRate(800);

        // Pathing
        this.movement = new Transition();
        this.path = null;
        this.step = 0;
        this.newDestination = null;
        this.destination = null;
        this.adjacentTiles = {};

        // Combat
        this.target = null;
        this.unconfirmedTarget = null;
        this.previousTarget = null;
        this.attackers = {};

        // Health
        this.hitPoints = 0;
        this.maxHitPoints = 0;

        // Modes
        this.isDead = false;
        this.isDying = false;
        this.attackingMode = false;
        this.followingMode = false;
        this.interrupted = false;

        this.hurting = null;

        this.pathRequestResolver = null;
    }

    clean(): void {
        this.forEachAttacker((attacker) => {
            attacker.disengage();
            attacker.idle();
        });
    }

    setMaxHitPoints(hp: number): void {
        this.maxHitPoints = hp;
        this.hitPoints = hp;
    }

    setDefaultAnimation(): void {
        this.idle();
    }

    hasWeapon(): boolean {
        return false;
    }

    getWeaponName(): string | null {
        return null;
    }

    hasShadow(): boolean {
        return true;
    }

    animate(animation: string, speed?: number, count?: number, onEndCount?: (() => void) | null): void {
        const oriented = ['atk', 'walk', 'idle'];
        const orientation = this.orientation;

        // don't change animation if the character is dying
        if (!(this.currentAnimation?.name === 'death')) {
            this.flipSpriteX = false;
            this.flipSpriteY = false;

            if (oriented.includes(animation)) {
                animation += '_' + (orientation === Types.Orientations.LEFT ? 'right' : Types.getOrientationAsString(orientation));
                this.flipSpriteX = this.orientation === Types.Orientations.LEFT;
            }

            this.setAnimation(animation, speed, count, onEndCount);
        }
    }

    turnTo(orientation: number): void {
        this.orientation = orientation;
        this.idle();
    }

    setOrientation(orientation?: number): void {
        if (orientation === undefined) {
            return;
        }
        if (
            orientation === Types.Orientations.UP ||
            orientation === Types.Orientations.DOWN ||
            orientation === Types.Orientations.LEFT ||
            orientation === Types.Orientations.RIGHT
        ) {
            this.orientation = orientation;
        }
    }

    idle(orientation?: number): void {
        this.setOrientation(orientation);
        this.animate('idle', this.idleSpeed);
    }

    hit(orientation?: number): void {
        this.setOrientation(orientation);
        this.animate('atk', this.atkSpeed, 1);
    }

    walk(orientation?: number): void {
        this.setOrientation(orientation);
        this.animate('walk', this.walkSpeed);
    }

    moveTo_(x: number, y: number, _onArrive?: () => void): void {
        this.destination = { gridX: x, gridY: y };
        this.adjacentTiles = {};

        if (this.isMoving()) {
            this.continueTo(x, y);
        } else {
            const path = this.requestPathfindingTo(x, y);
            this.followPath(path);
        }
    }

    requestPathfindingTo(x: number, y: number): Path {
        if (this.pathRequestResolver) {
            return this.pathRequestResolver(x, y);
        }
        log.error(this.id + " couldn't request pathfinding to " + x + ', ' + y);
        return [];
    }

    setPathRequestResolver(callback: PathRequestResolver): void {
        this.pathRequestResolver = callback;
    }

    followPath(path: Path): void {
        // Length of 1 means the player has clicked on himself
        if (path.length > 1) {
            this.path = path;
            this.step = 0;

            // following a character
            if (this.followingMode) {
                path.pop();
            }

            this.emit('startPathing', path);
            this.nextStep();
        }
    }

    continueTo(x: number, y: number): void {
        this.newDestination = { x, y };
    }

    updateMovement(): void {
        if (!this.path) {
            return;
        }

        const p = this.path;
        const i = this.step;

        if (p[i][0] < p[i - 1][0]) {
            this.walk(Types.Orientations.LEFT);
        }
        if (p[i][0] > p[i - 1][0]) {
            this.walk(Types.Orientations.RIGHT);
        }
        if (p[i][1] < p[i - 1][1]) {
            this.walk(Types.Orientations.UP);
        }
        if (p[i][1] > p[i - 1][1]) {
            this.walk(Types.Orientations.DOWN);
        }
    }

    updatePositionOnGrid(): void {
        if (!this.path) {
            return;
        }
        this.setGridPosition(this.path[this.step][0], this.path[this.step][1]);
    }

    nextStep(): void {
        let stop = false;

        if (this.isMoving() && this.path) {
            this.emit('beforeStep');

            this.updatePositionOnGrid();
            this.checkAggro();

            // if Character.stop() has been called
            if (this.interrupted) {
                stop = true;
                this.interrupted = false;
            } else {
                if (this.hasNextStep()) {
                    this.nextGridX = this.path[this.step + 1][0];
                    this.nextGridY = this.path[this.step + 1][1];
                }

                this.emit('step');

                if (this.hasChangedItsPath() && this.newDestination) {
                    const x = this.newDestination.x;
                    const y = this.newDestination.y;
                    const path = this.requestPathfindingTo(x, y);

                    this.newDestination = null;
                    if (path.length < 2) {
                        stop = true;
                    } else {
                        this.followPath(path);
                    }
                } else if (this.hasNextStep()) {
                    this.step += 1;
                    this.updateMovement();
                } else {
                    stop = true;
                }
            }

            // Path is complete or has been interrupted
            if (stop) {
                this.path = null;
                this.idle();

                this.emit('stopPathing', this.gridX, this.gridY);
            }
        }
    }

    isMoving(): boolean {
        return this.path !== null;
    }

    hasNextStep(): boolean {
        return !!this.path && this.path.length - 1 > this.step;
    }

    hasChangedItsPath(): boolean {
        return this.newDestination !== null;
    }

    isNear(character: CharacterLike, distance: number): boolean {
        const dx = Math.abs(this.gridX - character.gridX);
        const dy = Math.abs(this.gridY - character.gridY);

        return dx <= distance && dy <= distance;
    }

    checkAggro(): void {
        this.emit('checkAggro');
    }

    aggro(character: CharacterLike): void {
        this.emit('aggro', character);
    }

    // Changes the character's orientation so that it is facing its target.
    lookAtTarget(): void {
        if (this.target) {
            this.turnTo(this.getOrientationTo(this.target));
        }
    }

    go(x: number, y: number): void {
        if (this.isAttacking()) {
            this.disengage();
        } else if (this.followingMode) {
            this.followingMode = false;
            this.target = null;
        }
        this.moveTo_(x, y);
    }

    // Makes the character follow another one.
    follow(entity: CharacterLike | null): void {
        if (entity) {
            this.followingMode = true;
            this.moveTo_(entity.gridX, entity.gridY);
        }
    }

    // Stops a moving character.
    stop(): void {
        if (this.isMoving()) {
            this.interrupted = true;
        }
    }

    // Makes the character attack another character.
    engage(character: CharacterLike): void {
        this.attackingMode = true;
        this.setTarget(character);
        if (this.canReachTarget()) {
            this.followingMode = false;
            this.stop();
            return;
        }
        this.follow(character);
    }

    disengage(): void {
        this.attackingMode = false;
        this.followingMode = false;
        this.removeTarget();
    }

    // Returns true if the character is currently attacking.
    isAttacking(): boolean {
        return this.attackingMode;
    }

    // Gets the right orientation to face a target character.
    getOrientationTo(character: CharacterLike): number {
        if (this.gridX < character.gridX) {
            return Types.Orientations.RIGHT;
        }
        if (this.gridX > character.gridX) {
            return Types.Orientations.LEFT;
        }
        if (this.gridY > character.gridY) {
            return Types.Orientations.UP;
        }
        return Types.Orientations.DOWN;
    }

    // Returns true if this character is currently attacked by a given character.
    isAttackedBy(character: CharacterLike): boolean {
        return String(character.id) in this.attackers;
    }

    // Registers a character as a current attacker of this one.
    addAttacker(character: Character): void {
        if (!this.isAttackedBy(character)) {
            this.attackers[String(character.id)] = character;        }

    }

    // Unregisters a character as a current attacker of this one.
    removeAttacker(character: CharacterLike): void {
        if (this.isAttackedBy(character)) {
            delete this.attackers[String(character.id)];        }

    }

    // Loops through all the characters currently attacking this one.
    forEachAttacker(callback: (attacker: Character) => void): void {
        Object.keys(this.attackers).forEach((id) => {
            callback(this.attackers[id]);
        });
    }

    // Sets this character's attack target.
    setTarget(character: CombatTarget): void {
        if (this.target !== character) {
            if (this.hasTarget()) {
                this.removeTarget();
            }
            this.unconfirmedTarget = null;
            this.target = character;
        } else {
            log.debug(character.id + ' is already the target of ' + this.id);
        }
    }

    // Removes the current attack target.
    removeTarget(): void {
        if (this.target) {
            if (typeof this.target.removeAttacker === 'function') {
                this.target.removeAttacker(this);
            }
            this.target = null;
        }
    }

    // Returns true if this character has a current attack target.
    hasTarget(): boolean {
        return this.target !== null;
    }

    // Marks this character as waiting to attack a target.
    waitToAttack(character: CharacterLike): void {
        this.unconfirmedTarget = character;
    }

    // Returns true if waiting to attack the target.
    isWaitingToAttack(character: CharacterLike): boolean {
        return this.unconfirmedTarget === character;
    }

    canAttack(time: number): boolean {
        if (this.canReachTarget() && this.attackCooldown.isOver(time)) {
            return true;
        }
        return false;
    }

    canReachTarget(): boolean {
        if (!this.hasTarget() || !this.target) {
            return false;
        }
        const weaponName = this.getWeaponName();
        const weaponKind = typeof weaponName === 'string' ? Types.getKindFromString(weaponName) : undefined;
        const attackRangeTiles = resolveAttackRangeTiles({ attackerKind: this.kind, weaponKind });
        return isWithinAttackRange(
            gridPos(this.gridX, this.gridY),
            gridPos(this.target.gridX, this.target.gridY),
            attackRangeTiles
        );
    }

    die(): void {
        this.removeTarget();
        this.isDead = true;
        this.emit('death');
    }

    hasMoved(): void {
        this.setDirty();
        this.emit('hasMoved', this);
    }

    hurt(): void {
        this.stopHurting();
        this.sprite = this.hurtSprite;
        this.hurting = setTimeout(() => this.stopHurting(), 75);
    }

    stopHurting(): void {
        this.sprite = this.normalSprite;
        if (this.hurting) {
            clearTimeout(this.hurting);
        }
    }

    setAttackRate(rate: number): void {
        this.attackCooldown = new Timer(rate);
    }

}

export default Character;
