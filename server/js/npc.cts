import type { EntityKind } from '../../shared/js/entity-kind-domain';

const Entity = require('./entity') as new (
    id: number | string,
    type: string,
    kind: EntityKind,
    x: number,
    y: number
) => object;

class Npc extends Entity {
    constructor(id: number | string, kind: EntityKind, x: number, y: number) {
        super(id, 'npc', kind, x, y);
    }
}

module.exports = Npc;
