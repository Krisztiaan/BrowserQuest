class Tile {}

class AnimatedTile extends Tile {
    startId: number;
    id: number;
    length: number;
    speed: number;
    index: number;
    x: number;
    y: number;
    lastTime: number;

    constructor(id: number, length: number, speed: number, index: number) {
        super();
        this.startId = id;
        this.id = id;
        this.length = length;
        this.speed = speed;
        this.index = index;
        this.x = 0;
        this.y = 0;
        this.lastTime = 0;
    }

    tick(): void {
        if ((this.id - this.startId) < this.length - 1) {
            this.id += 1;
        } else {
            this.id = this.startId;
        }
    }

    animate(time: number): boolean {
        if ((time - this.lastTime) > this.speed) {
            this.tick();
            this.lastTime = time;
            return true;
        }
        return false;
    }
}

export default AnimatedTile;
