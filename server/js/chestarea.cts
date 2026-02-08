const Area = require('./area') as new (
    id: number | string,
    x: number,
    y: number,
    width: number,
    height: number,
    world: unknown
) => {
    x: number;
    y: number;
    width: number;
    height: number;
};

interface ChestAreaEntity {
    x: number;
    y: number;
}

class ChestArea extends Area {
    items: unknown[];
    chestX: number;
    chestY: number;

    constructor(
        id: number | string,
        x: number,
        y: number,
        width: number,
        height: number,
        cx: number,
        cy: number,
        items: unknown[],
        world: unknown
    ) {
        super(id, x, y, width, height, world);
        this.items = items;
        this.chestX = cx;
        this.chestY = cy;
    }

    contains(entity: ChestAreaEntity | null | undefined): boolean {
        if (entity) {
            return (
                entity.x >= this.x &&
                entity.y >= this.y &&
                entity.x < this.x + this.width &&
                entity.y < this.y + this.height
            );
        } else {
            return false;
        }
    }
}

module.exports = ChestArea;
