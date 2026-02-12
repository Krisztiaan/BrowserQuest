import type { EntityKind } from '../shared/entity-kind-domain';
import { Evented } from '../shared/evented';
import type { NoEvents, TypedEventMap } from '../shared/typed-event-emitter';
import type { EntityId } from '../shared/domain/ids';

import Utils from './utils';
import { buildDespawnAction } from './protocol/outbound-actions';

interface PositionLike {
    x: number;
    y: number;
}

class Entity<TEvents extends TypedEventMap = NoEvents> extends Evented<TEvents> {
    id: EntityId;
    type: string;
    kind: EntityKind;
    x: number;
    y: number;

    constructor(id: EntityId, type: string, kind: EntityKind, x: number, y: number) {
        super();
        this.id = id;
        this.type = type;
        this.kind = kind;
        this.x = x;
        this.y = y;
    }

    destroy(): void {}

    despawn(): unknown {
        return buildDespawnAction(this.id);
    }

    setPosition(x: number, y: number): void {
        this.x = x;
        this.y = y;
    }

    getPositionNextTo(entity: PositionLike | null | undefined): PositionLike | null {
        let pos: PositionLike | null = null;
        if (entity) {
            pos = { x: entity.x, y: entity.y };
            const r = Utils.random(4);

            if (r === 0) {
                pos.y -= 1;
            }
            if (r === 1) {
                pos.y += 1;
            }
            if (r === 2) {
                pos.x -= 1;
            }
            if (r === 3) {
                pos.x += 1;
            }
        }
        return pos;
    }
}

export default Entity;
