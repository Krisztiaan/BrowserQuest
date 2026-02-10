import type { EntityKind } from '../../shared/js/entity-kind-domain';

import Character from './character';
import Messages from './message';
import Properties from './properties';
import Utils from './utils';

interface HateEntry {
    id: number;
    hate: number;
}

interface DropItemLike {
    id: number;
    kind: EntityKind;
}

interface MobAreaRespawnContract {
    respawnMob?(mob: Mob, delay: number): void;
    removeFromArea?(mob: Mob): void;
}

export type MobEvents = {
    respawn: [];
    move: [mob: Mob];
};

class Mob extends Character<MobEvents> {
    spawningX: number;
    spawningY: number;
    armorLevel: number;
    weaponLevel: number;
    hatelist: HateEntry[];
    respawnTimeout: ReturnType<typeof setTimeout> | null;
    returnTimeout: ReturnType<typeof setTimeout> | null;
    area: MobAreaRespawnContract | null;
    isDead: boolean;
    constructor(id: number | string, kind: EntityKind, x: number, y: number) {
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
                self.emit('respawn');
            }, delay);
        }
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

    move(x: number, y: number): void {
        this.setPosition(x, y);
        this.emit('move', this);
    }

    updateHitPoints(): void {
        this.resetHitPoints(Properties.getHitPoints(this.kind));
    }

    distanceToSpawningPoint(x: number, y: number): number {
        return Utils.distanceTo(x, y, this.spawningX, this.spawningY);
    }
}

export default Mob;
