// AUTO-GENERATED from server/js/mobarea.cts via `bun run build:mobarea`.
// Do not edit server/js/mobarea.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Area = require('./area');
const Mob = require('./mob');
const Utils = require('./utils');
const Types = require('../../shared/js/gametypes');
class MobArea extends Area {
    nb;
    kind;
    respawns;
    constructor(id, nb, kind, x, y, width, height, world) {
        super(id, x, y, width, height, world);
        this.nb = nb;
        this.kind = kind;
        this.respawns = [];
        this.setNumberOfEntities(this.nb);
        //this.initRoaming();
    }
    spawnMobs() {
        for (let i = 0; i < this.nb; i += 1) {
            this.addToArea(this._createMobInsideArea());
        }
    }
    _createMobInsideArea() {
        const k = Types.getKindFromString(this.kind);
        const pos = this._getRandomPositionInsideArea();
        const mob = new Mob('1' + this.id + '' + k + '' + this.entities.length, k, pos.x, pos.y);
        mob.onMove(this.world.onMobMoveCallback.bind(this.world));
        return mob;
    }
    respawnMob(mob, delay) {
        const self = this;
        this.removeFromArea(mob);
        setTimeout(function () {
            const pos = self._getRandomPositionInsideArea();
            mob.x = pos.x;
            mob.y = pos.y;
            mob.isDead = false;
            self.addToArea(mob);
            self.world.addMob(mob);
        }, delay);
    }
    initRoaming(_mob) {
        const self = this;
        setInterval(function () {
            self.entities.forEach(function (mob) {
                const canRoam = Utils.random(20) === 1;
                let pos;
                if (canRoam) {
                    if (!mob.hasTarget() && !mob.isDead) {
                        pos = self._getRandomPositionInsideArea();
                        mob.move(pos.x, pos.y);
                    }
                }
            });
        }, 500);
    }
    createReward() {
        const pos = this._getRandomPositionInsideArea();
        return { x: pos.x, y: pos.y, kind: Types.Entities.CHEST };
    }
}
module.exports = MobArea;
