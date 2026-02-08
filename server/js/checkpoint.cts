const Utils = require('./utils') as {
    randomInt(min: number, max: number): number;
};

interface Position {
    x: number;
    y: number;
}

class Checkpoint {
    id: number | string;
    x: number;
    y: number;
    width: number;
    height: number;

    constructor(id: number | string, x: number, y: number, width: number, height: number) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    getRandomPosition(): Position {
        const pos: Position = { x: 0, y: 0 };

        pos.x = this.x + Utils.randomInt(0, this.width - 1);
        pos.y = this.y + Utils.randomInt(0, this.height - 1);
        return pos;
    }
}

module.exports = Checkpoint;
