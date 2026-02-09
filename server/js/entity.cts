import type { EntityKind } from '../../shared/js/entity-kind-domain';

const Messages = require('./message') as {
    Spawn: new (entity: Entity) => unknown;
    Despawn: new (id: number) => unknown;
};

const Utils = require('./utils') as {
    random(range: number): number;
};

interface PositionLike {
    x: number;
    y: number;
}

class Entity {
    id: number;
    type: string;
    kind: EntityKind;
    x: number;
    y: number;

    constructor(id: number | string, type: string, kind: EntityKind, x: number, y: number) {
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

module.exports = Entity;
