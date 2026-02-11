class Area {
    x: number;
    y: number;
    width: number;
    height: number;
    id: string | number | null;
    musicName: string | null;

    constructor(x: number, y: number, width: number, height: number) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.id = null;
        this.musicName = null;
    }

    contains(entity: { gridX: number; gridY: number } | null): boolean {
        if (!entity) {
            return false;
        }

        return entity.gridX >= this.x
            && entity.gridY >= this.y
            && entity.gridX < this.x + this.width
            && entity.gridY < this.y + this.height;
    }
}

export default Area;
