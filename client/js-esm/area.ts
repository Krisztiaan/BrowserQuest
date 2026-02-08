class Area {
    x: number;
    y: number;
    width: number;
    height: number;
    id: string | number | null;
    musicName: string | null;

    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.id = null;
        this.musicName = null;
    }

    contains(entity) {
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
