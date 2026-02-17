import Area from './area';
import type { AreaWorldContract } from './area';

type JsonScalar = string | number | boolean | null;
type JsonLike = JsonScalar | JsonLike[] | { [key: string]: JsonLike };

interface ChestAreaEntity {
    x: number;
    y: number;
}

class ChestArea extends Area {
    items: JsonLike[];
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
        items: JsonLike[],
        world: AreaWorldContract
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

export default ChestArea;
