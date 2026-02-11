import type { EntityKind } from '../shared/entity-kind-domain';

import Entity from './entity';

class Npc extends Entity {
    constructor(id: number | string, kind: EntityKind, x: number, y: number) {
        super(id, 'npc', kind, x, y);
    }
}

export default Npc;
