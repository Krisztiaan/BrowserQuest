// AUTO-GENERATED from server/js/character.cts via `bun run build:character`.
// Do not edit server/js/character.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Entity = require('./entity');
const Messages = require('./message');
const Log = require('./log');
const Utils = require('./utils');
require('./properties');
require('../../shared/js/gametypes');
const log = Log.getLogger();
class Character extends Entity {
    orientation;
    attackers;
    target;
    maxHitPoints;
    hitPoints;
    constructor(id, type, kind, x, y) {
        super(id, type, kind, x, y);
        this.orientation = Utils.randomOrientation();
        this.attackers = {};
        this.target = null;
        this.maxHitPoints = 0;
        this.hitPoints = 0;
    }
    getState() {
        const basestate = this._getBaseState();
        const state = [];
        state.push(this.orientation);
        if (this.target) {
            state.push(this.target);
        }
        return basestate.concat(state);
    }
    resetHitPoints(maxHitPoints) {
        this.maxHitPoints = maxHitPoints;
        this.hitPoints = this.maxHitPoints;
    }
    regenHealthBy(value) {
        const hp = this.hitPoints;
        const max = this.maxHitPoints;
        if (hp < max) {
            if (hp + value <= max) {
                this.hitPoints += value;
            }
            else {
                this.hitPoints = max;
            }
        }
    }
    hasFullHealth() {
        return this.hitPoints === this.maxHitPoints;
    }
    setTarget(entity) {
        this.target = entity.id;
    }
    clearTarget() {
        this.target = null;
    }
    hasTarget() {
        return this.target !== null;
    }
    attack() {
        return new Messages.Attack(this.id, this.target);
    }
    health() {
        return new Messages.Health(this.hitPoints, false);
    }
    regen() {
        return new Messages.Health(this.hitPoints, true);
    }
    addAttacker(entity) {
        if (entity) {
            this.attackers[entity.id] = entity;
        }
    }
    removeAttacker(entity) {
        if (entity && entity.id in this.attackers) {
            delete this.attackers[entity.id];
            log.debug(this.id + ' REMOVED ATTACKER ' + entity.id);
        }
    }
    forEachAttacker(callback) {
        for (const id in this.attackers) {
            callback(this.attackers[id]);
        }
    }
}
module.exports = Character;
