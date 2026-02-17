import type { EntityKind } from '../../shared/entity-kind-domain';
import type { EntityId } from '../../shared/domain/ids';
import { entityIdToWire } from '../../shared/domain/ids';

import Entity from '../entity';
import { buildDropAction } from '../protocol/outbound-actions';
import { requireMobPrefab } from '../../shared/content/prefabs';

type HateEntry = {
    id: EntityId;
    hate: number;
};

type DropItemLike = {
    id: EntityId;
    kind: EntityKind;
};

export type MobEntityEvents = {
    respawn: [];
    move: [mob: MobEntity];
};

export class MobEntity extends Entity<MobEntityEvents> {
    spawningX: number;
    spawningY: number;
    armorLevel: number;
    weaponLevel: number;
    hatelist: HateEntry[];
    area: object | null;
    isDead: boolean;
    target: EntityId | null;
    maxHitPoints: number;
    hitPoints: number;

    constructor(id: EntityId, kind: EntityKind, x: number, y: number) {
        super(id, 'mob', kind, x, y);

        this.spawningX = x;
        this.spawningY = y;
        const prefab = requireMobPrefab(this.kind);
        this.armorLevel = prefab.combat.armorLevel;
        this.weaponLevel = prefab.combat.weaponLevel;
        this.maxHitPoints = prefab.combat.maxHitPoints;
        this.hitPoints = this.maxHitPoints;

        this.hatelist = [];
        this.area = null;
        this.isDead = false;
        this.target = null;
    }

    override destroy(): void {
        this.isDead = true;
        this.hatelist = [];
        this.target = null;
    }

    clearTarget(): void {
        this.target = null;
    }

    forgetPlayer(playerId: number, _duration?: number): void {
        this.hatelist = this.hatelist.filter((obj) => obj.id !== playerId);
    }

    updateHitPoints(): void {
        const prefab = requireMobPrefab(this.kind);
        this.maxHitPoints = prefab.combat.maxHitPoints;
        this.hitPoints = prefab.combat.maxHitPoints;
    }

    drop(item: DropItemLike | null | undefined): ReturnType<typeof buildDropAction> | undefined {
        if (!item) {
            return;
        }
        const haters: number[] = [];
        for (const hateEntry of this.hatelist) {
            haters.push(entityIdToWire(hateEntry.id));
        }
        return buildDropAction(this.id, item.id, item.kind, haters);
    }

    move(x: number, y: number): void {
        this.setPosition(x, y);
        this.emit('move', this);
    }
}

export default MobEntity;
