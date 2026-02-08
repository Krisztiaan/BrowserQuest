// AUTO-GENERATED from server/js/mob.cts via `bun run build:mob`.
// Do not edit server/js/mob.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Character = require('./character');
const Messages = require('./message');
const Properties = require('./properties');
const Utils = require('./utils');
require('../../shared/js/gametypes');
class Mob extends Character {
    spawningX;
    spawningY;
    armorLevel;
    weaponLevel;
    hatelist;
    respawnTimeout;
    returnTimeout;
    area;
    isDead;
    respawn_callback;
    move_callback;
    constructor(id, kind, x, y) {
        super(id, 'mob', kind, x, y);
        this.updateHitPoints();
        this.spawningX = x;
        this.spawningY = y;
        this.armorLevel = Properties.getArmorLevel(this.kind);
        this.weaponLevel = Properties.getWeaponLevel(this.kind);
        this.hatelist = [];
        this.respawnTimeout = null;
        this.returnTimeout = null;
        this.area = null;
        this.isDead = false;
        this.respawn_callback = null;
        this.move_callback = null;
    }
    destroy() {
        this.isDead = true;
        this.hatelist = [];
        this.clearTarget();
        this.updateHitPoints();
        this.resetPosition();
        this.handleRespawn();
    }
    receiveDamage(points, _playerId) {
        this.hitPoints -= points;
    }
    hates(playerId) {
        return this.hatelist.some(function (obj) {
            return obj.id === playerId;
        });
    }
    increaseHateFor(playerId, points) {
        if (this.hates(playerId)) {
            const entry = this.hatelist.find(function (obj) {
                return obj.id === playerId;
            });
            if (entry) {
                entry.hate += points;
            }
        }
        else {
            this.hatelist.push({ id: playerId, hate: points });
        }
        if (this.returnTimeout) {
            // Prevent the mob from returning to its spawning position
            // since it has aggroed a new player
            clearTimeout(this.returnTimeout);
            this.returnTimeout = null;
        }
    }
    getHatedPlayerId(hateRank) {
        let i;
        let playerId;
        const sorted = this.hatelist.slice().sort(function (a, b) {
            return a.hate - b.hate;
        });
        const size = this.hatelist.length;
        if (hateRank && hateRank <= size) {
            i = size - hateRank;
        }
        else {
            i = size - 1;
        }
        if (sorted && sorted[i]) {
            playerId = sorted[i].id;
        }
        return playerId;
    }
    forgetPlayer(playerId, duration) {
        this.hatelist = this.hatelist.filter(function (obj) {
            return obj.id !== playerId;
        });
        if (this.hatelist.length === 0) {
            this.returnToSpawningPosition(duration);
        }
    }
    forgetEveryone() {
        this.hatelist = [];
        this.returnToSpawningPosition(1);
    }
    drop(item) {
        if (item) {
            return new Messages.Drop(this, item);
        }
    }
    handleRespawn() {
        const delay = 30000;
        const self = this;
        if (this.area && typeof this.area.respawnMob === 'function') {
            // Respawn inside the area if part of a MobArea
            this.area.respawnMob(this, delay);
        }
        else {
            if (this.area && typeof this.area.removeFromArea === 'function') {
                this.area.removeFromArea(this);
            }
            setTimeout(function () {
                if (self.respawn_callback) {
                    self.respawn_callback();
                }
            }, delay);
        }
    }
    onRespawn(callback) {
        this.respawn_callback = callback;
    }
    resetPosition() {
        this.setPosition(this.spawningX, this.spawningY);
    }
    returnToSpawningPosition(waitDuration) {
        const self = this;
        const delay = waitDuration || 4000;
        this.clearTarget();
        this.returnTimeout = setTimeout(function () {
            self.resetPosition();
            self.move(self.x, self.y);
        }, delay);
    }
    onMove(callback) {
        this.move_callback = callback;
    }
    move(x, y) {
        this.setPosition(x, y);
        if (this.move_callback) {
            this.move_callback(this);
        }
    }
    updateHitPoints() {
        this.resetHitPoints(Properties.getHitPoints(this.kind));
    }
    distanceToSpawningPoint(x, y) {
        return Utils.distanceTo(x, y, this.spawningX, this.spawningY);
    }
}
module.exports = Mob;
