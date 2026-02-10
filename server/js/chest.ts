import type { EntityKindId } from '../../shared/js/entity-kind-domain';

import Utils from './utils';
import Item from './item';
import Types from '../../shared/js/gametypes-esm';

class Chest extends Item {
    items: unknown[];

    constructor(id: number | string, x: number, y: number) {
        super(id, Types.Entities.CHEST, x, y);
        this.items = [];
    }

    setItems(items: unknown[]): void {
        this.items = items;
    }

    getRandomItem(): unknown | null {
        const nbItems = this.items.length;
        let item: unknown | null = null;

        if (nbItems > 0) {
            item = this.items[Utils.random(nbItems)];
        }
        return item;
    }
}

export default Chest;
