import type { EntityKind } from '../shared/entity-kind-domain';
import type { EntityId } from '../shared/domain/ids';

import Character from './character';
import Utils from './utils';
import { buildDropAction } from './protocol/outbound-actions';
import { requireMobPrefab } from '../shared/content/prefabs';

interface HateEntry {
    id: EntityId;
    hate: number;
}

interface DropItemLike {
    id: EntityId;
    kind: EntityKind;
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
    area: unknown;
    isDead: boolean;
    constructor(id: EntityId, kind: EntityKind, x: number, y: number) {
        super(id, 'mob', kind, x, y);

        this.updateHitPoints();
        this.spawningX = x;
        this.spawningY = y;
        const prefab = requireMobPrefab(this.kind);
        this.armorLevel = prefab.combat.armorLevel;
        this.weaponLevel = prefab.combat.weaponLevel;
        this.hatelist = [];
        this.area = null;
        this.isDead = false;
    }

    override destroy(): void {
        this.isDead = true;
        this.hatelist = [];
        this.clearTarget();
    }

    receiveDamage(points: number, _playerId: EntityId): void {
        this.hitPoints -= points;
    }

    hates(playerId: EntityId): boolean {
        return this.hatelist.some(function (obj) {
            return obj.id === playerId;
        });
    }

    increaseHateFor(playerId: EntityId, points: number): void {
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
    }

    getHatedPlayerId(hateRank?: number): EntityId | undefined {
        let i: number;
        let playerId: EntityId | undefined;
        const sorted = this.hatelist.slice().sort(function (a, b) {
            return a.hate - b.hate;
        });
        const size = this.hatelist.length;

        if (hateRank && hateRank <= size) {
            i = size - hateRank;
        } else {
            i = size - 1;
        }
        const entry = sorted[i];
        if (entry) {
            playerId = entry.id;
        }

        return playerId;
    }

    forgetPlayer(playerId: number, _duration?: number): void {
        this.hatelist = this.hatelist.filter(function (obj) {
            return obj.id !== playerId;
        });
    }

    forgetEveryone(): void {
        this.hatelist = [];
        this.clearTarget();
    }

    drop(item: DropItemLike | null | undefined): unknown {
        if (item) {
            const haters: number[] = [];
            for (const hateEntry of this.hatelist) {
                haters.push(hateEntry.id as unknown as number);
            }
            return buildDropAction(this.id, item.id, item.kind, haters);
        }
    }

    move(x: number, y: number): void {
        this.setPosition(x, y);
        this.emit('move', this);
    }

    updateHitPoints(): void {
        const prefab = requireMobPrefab(this.kind);
        this.resetHitPoints(prefab.combat.maxHitPoints);
    }

    distanceToSpawningPoint(x: number, y: number): number {
        return Utils.distanceTo(x, y, this.spawningX, this.spawningY);
    }
}

export default Mob;
