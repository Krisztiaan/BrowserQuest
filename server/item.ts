import type { EntityKind } from '../shared/entity-kind-domain';
import type { EntityId } from '../shared/domain/ids';

import Entity from './entity';

export type ItemEvents = {
    respawn: [];
};

class Item extends Entity<ItemEvents> {
    isStatic: boolean;
    isFromChest: boolean;
    constructor(id: EntityId, kind: EntityKind, x: number, y: number) {
        super(id, 'item', kind, x, y);
        this.isStatic = false;
        this.isFromChest = false;
    }

    override destroy(): void {
        // Static item respawn is managed by the ECS pipeline to keep lifecycle deterministic.
    }
}

export default Item;
