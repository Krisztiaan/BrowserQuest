// AUTO-GENERATED from server/js/entity.cts via `bun run build:entity`.
// Do not edit server/js/entity.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Messages = require('./message');
const Utils = require('./utils');
class Entity {
    id;
    type;
    kind;
    x;
    y;
    constructor(id, type, kind, x, y) {
        this.id = Number.parseInt(String(id), 10);
        this.type = type;
        this.kind = kind;
        this.x = x;
        this.y = y;
    }
    destroy() { }
    _getBaseState() {
        return [this.id, this.kind, this.x, this.y];
    }
    getState() {
        return this._getBaseState();
    }
    spawn() {
        return new Messages.Spawn(this);
    }
    despawn() {
        return new Messages.Despawn(this.id);
    }
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }
    getPositionNextTo(entity) {
        let pos = null;
        if (entity) {
            pos = { x: entity.x, y: entity.y };
            const r = Utils.random(4);
            if (r === 0) {
                pos.y -= 1;
            }
            if (r === 1) {
                pos.y += 1;
            }
            if (r === 2) {
                pos.x -= 1;
            }
            if (r === 3) {
                pos.x += 1;
            }
        }
        return pos;
    }
}
module.exports = Entity;
