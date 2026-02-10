import type { EntityKind } from '../../shared/js/entity-kind-domain';
import { Evented } from '../../shared/js/evented';
import type { NoEvents, TypedEventMap } from '../../shared/js/typed-event-emitter';

import Messages from './message';
import Utils from './utils';

interface PositionLike {
    x: number;
    y: number;
}

class Entity<TEvents extends TypedEventMap = NoEvents> extends Evented<TEvents> {
    id: number;
    type: string;
    kind: EntityKind;
    x: number;
    y: number;

    constructor(id: number | string, type: string, kind: EntityKind, x: number, y: number) {
        super();
        this.id = Number.parseInt(String(id), 10);
        this.type = type;
        this.kind = kind;
        this.x = x;
        this.y = y;
    }

    destroy(): void {}

    _getBaseState(): Array<number | string> {
        return [this.id, this.kind, this.x, this.y];
    }

    getState(): Array<number | string> {
        return this._getBaseState();
    }

    spawn(): unknown {
        return new Messages.Spawn(this);
    }

    despawn(): unknown {
        return new Messages.Despawn(this.id);
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
