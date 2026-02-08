// AUTO-GENERATED from server/js/checkpoint.cts via `bun run build:checkpoint`.
// Do not edit server/js/checkpoint.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Utils = require('./utils');
class Checkpoint {
    id;
    x;
    y;
    width;
    height;
    constructor(id, x, y, width, height) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    getRandomPosition() {
        const pos = { x: 0, y: 0 };
        pos.x = this.x + Utils.randomInt(0, this.width - 1);
        pos.y = this.y + Utils.randomInt(0, this.height - 1);
        return pos;
    }
}
module.exports = Checkpoint;
