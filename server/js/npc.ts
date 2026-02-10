import type { EntityKind } from '../../shared/js/entity-kind-domain';

import * as EntityModule from './entity.cts';

const Entity = ((EntityModule as unknown as { default?: unknown }).default
    ? (EntityModule as unknown as { default: unknown }).default
    : EntityModule) as new (
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

export default Npc;
