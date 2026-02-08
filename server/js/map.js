// AUTO-GENERATED from server/js/map.cts via `bun run build:map`.
// Do not edit server/js/map.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const Log = require('./log');
const Utils = require('./utils');
const Checkpoint = require('./checkpoint');
const log = Log.getLogger();
class Map {
    isLoaded;
    width;
    height;
    collisions;
    mobAreas;
    chestAreas;
    staticChests;
    staticEntities;
    zoneWidth;
    zoneHeight;
    groupWidth;
    groupHeight;
    grid;
    connectedGroups;
    checkpoints;
    startingAreas;
    ready_func;
    constructor(filepath) {
        const self = this;
        this.isLoaded = false;
        this.width = 0;
        this.height = 0;
        this.collisions = [];
        this.mobAreas = [];
        this.chestAreas = [];
        this.staticChests = [];
        this.staticEntities = [];
        this.zoneWidth = 0;
        this.zoneHeight = 0;
        this.groupWidth = 0;
        this.groupHeight = 0;
        this.grid = [];
        this.connectedGroups = {};
        this.checkpoints = {};
        this.startingAreas = [];
        this.ready_func = null;
        fs.access(filepath, fs.constants.F_OK, function (err) {
            if (err) {
                log.error(filepath + " doesn't exist.");
                return;
            }
            fs.readFile(filepath, function (readErr, file) {
                if (readErr) {
                    log.error('Could not read map file: ' + filepath);
                    return;
                }
                try {
                    const json = JSON.parse(file.toString());
                    self.initMap(json);
                }
                catch (parseErr) {
                    const parseMessage = parseErr instanceof Error ? parseErr.message : String(parseErr);
                    log.error('Invalid map JSON: ' + filepath + ' (' + parseMessage + ')');
                }
            });
        });
    }
    initMap(map) {
        this.width = map.width;
        this.height = map.height;
        this.collisions = map.collisions;
        this.mobAreas = map.roamingAreas;
        this.chestAreas = map.chestAreas;
        this.staticChests = map.staticChests;
        this.staticEntities = map.staticEntities;
        this.isLoaded = true;
        // zone groups
        this.zoneWidth = 28;
        this.zoneHeight = 12;
        this.groupWidth = Math.floor(this.width / this.zoneWidth);
        this.groupHeight = Math.floor(this.height / this.zoneHeight);
        this.initConnectedGroups(map.doors);
        this.initCheckpoints(map.checkpoints);
        if (this.ready_func) {
            this.ready_func();
        }
    }
    ready(f) {
        this.ready_func = f;
    }
    tileIndexToGridPosition(tileNum) {
        let x = 0;
        let y = 0;
        const getX = function (num, w) {
            if (num === 0) {
                return 0;
            }
            return num % w === 0 ? w - 1 : (num % w) - 1;
        };
        tileNum -= 1;
        x = getX(tileNum + 1, this.width);
        y = Math.floor(tileNum / this.width);
        return { x: x, y: y };
    }
    GridPositionToTileIndex(x, y) {
        return y * this.width + x + 1;
    }
    generateCollisionGrid() {
        this.grid = [];
        if (this.isLoaded) {
            let tileIndex = 0;
            for (let i = 0; i < this.height; i++) {
                this.grid[i] = [];
                for (let j = 0; j < this.width; j++) {
                    if (this.collisions.includes(tileIndex)) {
                        this.grid[i][j] = 1;
                    }
                    else {
                        this.grid[i][j] = 0;
                    }
                    tileIndex += 1;
                }
            }
            //log.info("Collision grid generated.");
        }
    }
    isOutOfBounds(x, y) {
        return x <= 0 || x >= this.width || y <= 0 || y >= this.height;
    }
    isColliding(x, y) {
        if (this.isOutOfBounds(x, y)) {
            return false;
        }
        return this.grid[y][x] === 1;
    }
    GroupIdToGroupPosition(id) {
        const posArray = id.split('-');
        return pos(Number.parseInt(posArray[0], 10), Number.parseInt(posArray[1], 10));
    }
    forEachGroup(callback) {
        const width = this.groupWidth;
        const height = this.groupHeight;
        for (let x = 0; x < width; x += 1) {
            for (let y = 0; y < height; y += 1) {
                callback(x + '-' + y);
            }
        }
    }
    getGroupIdFromPosition(x, y) {
        const w = this.zoneWidth;
        const h = this.zoneHeight;
        const gx = Math.floor((x - 1) / w);
        const gy = Math.floor((y - 1) / h);
        return gx + '-' + gy;
    }
    getAdjacentGroupPositions(id) {
        const self = this;
        const position = this.GroupIdToGroupPosition(id);
        const x = position.x;
        const y = position.y;
        // surrounding groups
        const list = [
            pos(x - 1, y - 1),
            pos(x, y - 1),
            pos(x + 1, y - 1),
            pos(x - 1, y),
            pos(x, y),
            pos(x + 1, y),
            pos(x - 1, y + 1),
            pos(x, y + 1),
            pos(x + 1, y + 1),
        ];
        // groups connected via doors
        (this.connectedGroups[id] || []).forEach(function (position) {
            // don't add a connected group if it's already part of the surrounding ones.
            if (!list.some(function (groupPos) {
                return equalPositions(groupPos, position);
            })) {
                list.push(position);
            }
        });
        return list.filter(function (groupPosition) {
            return (groupPosition.x >= 0 &&
                groupPosition.y >= 0 &&
                groupPosition.x < self.groupWidth &&
                groupPosition.y < self.groupHeight);
        });
    }
    forEachAdjacentGroup(groupId, callback) {
        if (groupId) {
            this.getAdjacentGroupPositions(groupId).forEach(function (groupPosition) {
                callback(groupPosition.x + '-' + groupPosition.y);
            });
        }
    }
    initConnectedGroups(doors) {
        const self = this;
        this.connectedGroups = {};
        (doors || []).forEach(function (door) {
            const groupId = self.getGroupIdFromPosition(door.x, door.y);
            const connectedGroupId = self.getGroupIdFromPosition(door.tx, door.ty);
            const connectedPosition = self.GroupIdToGroupPosition(connectedGroupId);
            if (groupId in self.connectedGroups) {
                self.connectedGroups[groupId].push(connectedPosition);
            }
            else {
                self.connectedGroups[groupId] = [connectedPosition];
            }
        });
    }
    initCheckpoints(cpList) {
        const self = this;
        this.checkpoints = {};
        this.startingAreas = [];
        (cpList || []).forEach(function (cp) {
            const checkpoint = new Checkpoint(cp.id, cp.x, cp.y, cp.w, cp.h);
            self.checkpoints[checkpoint.id] = checkpoint;
            if (cp.s === 1) {
                self.startingAreas.push(checkpoint);
            }
        });
    }
    getCheckpoint(id) {
        return this.checkpoints[id];
    }
    getRandomStartingPosition() {
        const nbAreas = this.startingAreas.length;
        const i = Utils.randomInt(0, nbAreas - 1);
        const area = this.startingAreas[i];
        return area.getRandomPosition();
    }
}
function pos(x, y) {
    return { x: x, y: y };
}
function equalPositions(pos1, pos2) {
    return pos1.x === pos2.x && pos1.y === pos2.y;
}
module.exports = Map;
