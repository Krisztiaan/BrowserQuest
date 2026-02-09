import type { EntityKindId } from '../../shared/js/entity-kind-domain';

const Utils = require('./utils') as {
    random(range: number): number;
};

const Item = require('./item') as new (id: number | string, kind: EntityKindId, x: number, y: number) => object;

const Types = require('../../shared/js/gametypes') as {
    Entities: {
        CHEST: EntityKindId;
    };
};

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

module.exports = Chest;
