
var Utils = require('./utils');

class Checkpoint {
    constructor(id, x, y, width, height) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    
    getRandomPosition() {
        var pos = {};
        
        pos.x = this.x + Utils.randomInt(0, this.width - 1);
        pos.y = this.y + Utils.randomInt(0, this.height - 1);
        return pos;
    }
}

module.exports = Checkpoint;
