// AUTO-GENERATED from server/js/npc.cts via `bun run build:npc`.
// Do not edit server/js/npc.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Entity = require('./entity');
class Npc extends Entity {
    constructor(id, kind, x, y) {
        super(id, 'npc', kind, x, y);
    }
}
module.exports = Npc;
