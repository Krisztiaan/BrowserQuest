import type { EntityKind } from '../shared/entity-kind-domain';
import type { NoEvents, TypedEventMap } from '../shared/typed-event-emitter';
import type { EntityId } from '../shared/domain/ids';

import Entity from './entity';
import Log from './log';
import Utils from './utils';
import { buildAttackAction, buildHealthAction } from './protocol/outbound-actions';

const log = Log.getLogger();

interface AttackerLike {
    id: EntityId;
    clearTarget?(): void;
}

class Character<TEvents extends TypedEventMap = NoEvents> extends Entity<TEvents> {
    orientation: number;
    attackers: Record<string, AttackerLike>;
    target: EntityId | null;
    maxHitPoints: number;
    hitPoints: number;

    constructor(id: EntityId, type: string, kind: EntityKind, x: number, y: number) {
        super(id, type, kind, x, y);

        this.orientation = Utils.randomOrientation();
        this.attackers = {};
        this.target = null;
        this.maxHitPoints = 0;
        this.hitPoints = 0;
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
        if (!this.target) {
            return null;
        }
        return buildAttackAction(this.id, this.target);
    }

    health(): unknown {
        return buildHealthAction(this.hitPoints, false);
    }

    regen(): unknown {
        return buildHealthAction(this.hitPoints, true);
    }

    addAttacker(entity: AttackerLike | null | undefined): void {
        if (entity) {
            this.attackers[String(entity.id)] = entity;
        }
    }

    removeAttacker(entity: AttackerLike | null | undefined): void {
        const key = String(entity?.id ?? '');
        if (key && key in this.attackers) {
            delete this.attackers[key];
            log.debug(this.id + ' REMOVED ATTACKER ' + (entity ? entity.id : 'unknown'));
        }
    }

    forEachAttacker(callback: (attacker: AttackerLike) => void): void {
        for (const attacker of Object.values(this.attackers)) {
            callback(attacker);
        }
    }
}

export default Character;
