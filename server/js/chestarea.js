// AUTO-GENERATED from server/js/chestarea.cts via `bun run build:chestarea`.
// Do not edit server/js/chestarea.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Area = require('./area');
class ChestArea extends Area {
    items;
    chestX;
    chestY;
    constructor(id, x, y, width, height, cx, cy, items, world) {
        super(id, x, y, width, height, world);
        this.items = items;
        this.chestX = cx;
        this.chestY = cy;
    }
    contains(entity) {
        if (entity) {
            return (entity.x >= this.x &&
                entity.y >= this.y &&
                entity.x < this.x + this.width &&
                entity.y < this.y + this.height);
        }
        else {
            return false;
        }
    }
}
module.exports = ChestArea;
