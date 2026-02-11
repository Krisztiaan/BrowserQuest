import type { EntityKind } from '../../shared/js/entity-kind-domain';
import type { NoEvents, TypedEventMap } from '../../shared/js/typed-event-emitter';

import Entity from './entity';
import Log from './log';
import Messages from './message';
import Utils from './utils';

const log = Log.getLogger();

interface AttackerLike {
    id: number;
    clearTarget?(): void;
}

class Character<TEvents extends TypedEventMap = NoEvents> extends Entity<TEvents> {
    orientation: number;
    attackers: Record<number, AttackerLike>;
    target: number | null;
    maxHitPoints: number;
    hitPoints: number;

    constructor(id: number | string, type: string, kind: EntityKind, x: number, y: number) {
        super(id, type, kind, x, y);

        this.orientation = Utils.randomOrientation();
        this.attackers = {};
        this.target = null;
        this.maxHitPoints = 0;
        this.hitPoints = 0;
    }

    override getState(): Array<number | string> {
        const basestate = this._getBaseState();
        const state: number[] = [];

        state.push(this.orientation);
        if (this.target) {
            state.push(this.target);
        }

        return basestate.concat(state);
    }

    resetHitPoints(maxHitPoints: number): void {
        this.maxHitPoints = maxHitPoints;
        this.hitPoints = this.maxHitPoints;
    }

    regenHealthBy(value: number): void {
        const hp = this.hitPoints;
        const max = this.maxHitPoints;

        if (hp < max) {
            if (hp + value <= max) {
                this.hitPoints += value;
            } else {
                this.hitPoints = max;
            }
        }
    }

    hasFullHealth(): boolean {
        return this.hitPoints === this.maxHitPoints;
    }

    setTarget(entity: AttackerLike): void {
        this.target = entity.id;
    }

    clearTarget(): void {
        this.target = null;
    }

    hasTarget(): boolean {
        return this.target !== null;
    }

    attack(): unknown {
        return new Messages.Attack(this.id, this.target);
    }

    health(): unknown {
        return new Messages.Health(this.hitPoints, false);
    }

    regen(): unknown {
        return new Messages.Health(this.hitPoints, true);
    }

    addAttacker(entity: AttackerLike | null | undefined): void {
        if (entity) {
            this.attackers[entity.id] = entity;
        }
    }

    removeAttacker(entity: AttackerLike | null | undefined): void {
        if (entity && entity.id in this.attackers) {
            delete this.attackers[entity.id];
            log.debug(this.id + ' REMOVED ATTACKER ' + entity.id);
        }
    }

    forEachAttacker(callback: (attacker: AttackerLike) => void): void {
        for (const attacker of Object.values(this.attackers)) {
            callback(attacker);
        }
    }
}

export default Character;
