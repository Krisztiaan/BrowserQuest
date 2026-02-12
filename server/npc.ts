import type { EntityKind } from '../shared/entity-kind-domain';
import type { EntityId } from '../shared/domain/ids';

import Entity from './entity';

class Npc extends Entity {
    constructor(id: EntityId, kind: EntityKind, x: number, y: number) {
        super(id, 'npc', kind, x, y);
    }
}

export default Npc;
