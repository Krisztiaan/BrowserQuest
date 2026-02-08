// AUTO-GENERATED from server/js/area.cts via `bun run build:area`.
// Do not edit server/js/area.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Utils = require('./utils');
class Area {
    id;
    x;
    y;
    width;
    height;
    world;
    entities;
    hasCompletelyRespawned;
    nbEntities;
    empty_callback;
    constructor(id, x, y, width, height, world) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.world = world;
        this.entities = [];
        this.hasCompletelyRespawned = true;
    }
    _getRandomPositionInsideArea() {
        const pos = { x: 0, y: 0 };
        let valid = false;
        while (!valid) {
            pos.x = this.x + Utils.random(this.width + 1);
            pos.y = this.y + Utils.random(this.height + 1);
            valid = this.world.isValidPosition(pos.x, pos.y);
        }
        return pos;
    }
    removeFromArea(entity) {
        const i = this.entities.findIndex((currentEntity) => {
            return currentEntity.id === entity.id;
        });
        this.entities.splice(i, 1);
        if (this.isEmpty() && this.hasCompletelyRespawned && this.empty_callback) {
            this.hasCompletelyRespawned = false;
            this.empty_callback();
        }
    }
    addToArea(entity) {
        if (entity) {
            this.entities.push(entity);
            entity.area = this;
            if (entity.type === 'mob') {
                this.world.addMob(entity);
            }
        }
        if (this.isFull()) {
            this.hasCompletelyRespawned = true;
        }
    }
    setNumberOfEntities(nb) {
        this.nbEntities = nb;
    }
    isEmpty() {
        return !this.entities.some((entity) => !entity.isDead);
    }
    isFull() {
        return !this.isEmpty() && this.nbEntities === this.entities.length;
    }
    onEmpty(callback) {
        this.empty_callback = callback;
    }
}
module.exports = Area;
