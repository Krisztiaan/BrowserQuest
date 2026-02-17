import type { EntityKind, EntityKindId, EntityKindName } from '../shared/entity-kind-domain';
import type { EntityId } from '../shared/domain/ids';
import Area from './area';
import type { AreaWorldContract } from './area';
import MobEntity from './world/mob-entity';
import Types from '../shared/gametypes-browser';

interface MobAreaMobContract {
    id: EntityId;
    type: string;
    isDead: boolean;
    setPosition(x: number, y: number): void;
    updateHitPoints(): void;
    on(eventName: 'respawn', callback: () => void): void;
}

interface MobAreaWorldContract extends AreaWorldContract {
    addMob(mob: MobAreaMobContract): void;
}

class MobArea extends Area {
    nb: number;
    kind: EntityKindName;
    nextMobId: () => EntityId;
    declare world: MobAreaWorldContract;

    constructor(
        id: number | string,
        nb: number,
        kind: EntityKindName,
        x: number,
        y: number,
        width: number,
        height: number,
        world: MobAreaWorldContract,
        nextMobId: () => EntityId
    ) {
        super(id, x, y, width, height, world);
        this.world = world;
        this.nb = nb;
        this.kind = kind;
        this.nextMobId = nextMobId;
        this.setNumberOfEntities(this.nb);

        //this.initRoaming();
    }

    spawnMobs(): void {
        for (let i = 0; i < this.nb; i += 1) {
            this.addToArea(this._createMobInsideArea());
        }
    }

    _createMobInsideArea(): MobAreaMobContract {
        const k = Types.getKindFromString(this.kind) as EntityKindId;
        const pos = this._getRandomPositionInsideArea();
        const mob = new MobEntity(this.nextMobId(), k, pos.x, pos.y);

        mob.on('respawn', () => {
            const nextPos = this._getRandomPositionInsideArea();
            mob.setPosition(nextPos.x, nextPos.y);
            mob.isDead = false;
            mob.updateHitPoints();
            this.addToArea(mob);
        });

        return mob;
    }

    createReward(): { x: number; y: number; kind: EntityKind } {
        const pos = this._getRandomPositionInsideArea();

        return { x: pos.x, y: pos.y, kind: Types.Entities.CHEST };
    }
}

export default MobArea;
