const Character = require('./character') as new (
    id: number | string,
    type: string,
    kind: number | string,
    x: number,
    y: number
) => {
    id: number;
    kind: number | string;
    x: number;
    y: number;
    hitPoints: number;
    clearTarget(): void;
    resetHitPoints(maxHitPoints: number): void;
    setPosition(x: number, y: number): void;
    hasTarget(): boolean;
};

const Messages = require('./message') as {
    Drop: new (mob: Mob, item: DropItemLike) => unknown;
};

const Properties = require('./properties') as {
    getArmorLevel(kind: number | string): number;
    getWeaponLevel(kind: number | string): number;
    getHitPoints(kind: number | string): number;
};

const Utils = require('./utils') as {
    distanceTo(x: number, y: number, x2: number, y2: number): number;
};

require('../../shared/js/gametypes');

interface HateEntry {
    id: number;
    hate: number;
}

interface DropItemLike {
    id: number;
    kind: number | string;
}

interface MobAreaRespawnContract {
    respawnMob?(mob: Mob, delay: number): void;
    removeFromArea?(mob: Mob): void;
}

class Mob extends Character {
    spawningX: number;
    spawningY: number;
    armorLevel: number;
    weaponLevel: number;
    hatelist: HateEntry[];
    respawnTimeout: ReturnType<typeof setTimeout> | null;
    returnTimeout: ReturnType<typeof setTimeout> | null;
    area: MobAreaRespawnContract | null;
    isDead: boolean;
    respawn_callback: (() => void) | null;
    move_callback: ((mob: Mob) => void) | null;

    constructor(id: number | string, kind: number | string, x: number, y: number) {
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

    destroy(): void {
        this.isDead = true;
        this.hatelist = [];
        this.clearTarget();
        this.updateHitPoints();
        this.resetPosition();

        this.handleRespawn();
    }

    receiveDamage(points: number, _playerId: number): void {
        this.hitPoints -= points;
    }

    hates(playerId: number): boolean {
        return this.hatelist.some(function (obj) {
            return obj.id === playerId;
        });
    }

    increaseHateFor(playerId: number, points: number): void {
        if (this.hates(playerId)) {
            const entry = this.hatelist.find(function (obj) {
                return obj.id === playerId;
            });
            if (entry) {
                entry.hate += points;
            }
        } else {
            this.hatelist.push({ id: playerId, hate: points });
        }

        if (this.returnTimeout) {
            // Prevent the mob from returning to its spawning position
            // since it has aggroed a new player
            clearTimeout(this.returnTimeout);
            this.returnTimeout = null;
        }
    }

    getHatedPlayerId(hateRank?: number): number | undefined {
        let i: number;
        let playerId: number | undefined;
        const sorted = this.hatelist.slice().sort(function (a, b) {
            return a.hate - b.hate;
        });
        const size = this.hatelist.length;

        if (hateRank && hateRank <= size) {
            i = size - hateRank;
        } else {
            i = size - 1;
        }
        if (sorted && sorted[i]) {
            playerId = sorted[i].id;
        }

        return playerId;
    }

    forgetPlayer(playerId: number, duration?: number): void {
        this.hatelist = this.hatelist.filter(function (obj) {
            return obj.id !== playerId;
        });

        if (this.hatelist.length === 0) {
            this.returnToSpawningPosition(duration);
        }
    }

    forgetEveryone(): void {
        this.hatelist = [];
        this.returnToSpawningPosition(1);
    }

    drop(item: DropItemLike | null | undefined): unknown {
        if (item) {
            return new Messages.Drop(this, item);
        }
    }

    handleRespawn(): void {
        const delay = 30000;
        const self = this;

        if (this.area && typeof this.area.respawnMob === 'function') {
            // Respawn inside the area if part of a MobArea
            this.area.respawnMob(this, delay);
        } else {
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

    onRespawn(callback: () => void): void {
        this.respawn_callback = callback;
    }

    resetPosition(): void {
        this.setPosition(this.spawningX, this.spawningY);
    }

    returnToSpawningPosition(waitDuration?: number): void {
        const self = this;
        const delay = waitDuration || 4000;

        this.clearTarget();

        this.returnTimeout = setTimeout(function () {
            self.resetPosition();
            self.move(self.x, self.y);
        }, delay);
    }

    onMove(callback: (mob: Mob) => void): void {
        this.move_callback = callback;
    }

    move(x: number, y: number): void {
        this.setPosition(x, y);
        if (this.move_callback) {
            this.move_callback(this);
        }
    }

    updateHitPoints(): void {
        this.resetHitPoints(Properties.getHitPoints(this.kind));
    }

    distanceToSpawningPoint(x: number, y: number): number {
        return Utils.distanceTo(x, y, this.spawningX, this.spawningY);
    }
}

module.exports = Mob;
