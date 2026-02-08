// AUTO-GENERATED from server/js/item.cts via `bun run build:item`.
// Do not edit server/js/item.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Entity = require('./entity');
class Item extends Entity {
    isStatic;
    isFromChest;
    blinkTimeout;
    despawnTimeout;
    respawn_callback;
    constructor(id, kind, x, y) {
        super(id, 'item', kind, x, y);
        this.isStatic = false;
        this.isFromChest = false;
        this.blinkTimeout = null;
        this.despawnTimeout = null;
        this.respawn_callback = null;
    }
    handleDespawn(params) {
        const self = this;
        this.blinkTimeout = setTimeout(function () {
            params.blinkCallback();
            self.despawnTimeout = setTimeout(params.despawnCallback, params.blinkingDuration);
        }, params.beforeBlinkDelay);
    }
    destroy() {
        if (this.blinkTimeout) {
            clearTimeout(this.blinkTimeout);
        }
        if (this.despawnTimeout) {
            clearTimeout(this.despawnTimeout);
        }
        if (this.isStatic) {
            this.scheduleRespawn(30000);
        }
    }
    scheduleRespawn(delay) {
        const self = this;
        setTimeout(function () {
            if (self.respawn_callback) {
                self.respawn_callback();
            }
        }, delay);
    }
    onRespawn(callback) {
        this.respawn_callback = callback;
    }
}
module.exports = Item;
