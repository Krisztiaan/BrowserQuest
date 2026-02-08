// AUTO-GENERATED from server/js/chest.cts via `bun run build:chest`.
// Do not edit server/js/chest.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Utils = require('./utils');
const Item = require('./item');
const Types = require('../../shared/js/gametypes');
class Chest extends Item {
    items;
    constructor(id, x, y) {
        super(id, Types.Entities.CHEST, x, y);
        this.items = [];
    }
    setItems(items) {
        this.items = items;
    }
    getRandomItem() {
        const nbItems = this.items.length;
        let item = null;
        if (nbItems > 0) {
            item = this.items[Utils.random(nbItems)];
        }
        return item;
    }
}
module.exports = Chest;
