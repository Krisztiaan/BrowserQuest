import type { EntityKind, EntityKindId, EntityKindName } from '../shared/entity-kind-domain';
import type { EntityId } from '../shared/domain/ids';
import { entityIdFromWire } from '../shared/domain/ids';
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

interface MobAreaWorldContract {
    addMob(mob: MobAreaMobContract): void;
    isValidPosition(x: number, y: number): boolean;
}

class MobArea extends Area {
    nb: number;
    kind: EntityKindName;
    respawns: unknown[];
    declare world: MobAreaWorldContract;

    constructor(
        id: number | string,
        nb: number,
        kind: EntityKindName,
        x: number,
        y: number,
        width: number,
        height: number,
        world: MobAreaWorldContract
    ) {
        super(id, x, y, width, height, world as unknown as AreaWorldContract);
        this.world = world;
        this.nb = nb;
        this.kind = kind;
        this.respawns = [];
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
        const mob = new MobEntity(
            entityIdFromWire(Number('1' + this.id + '' + k + '' + this.entities.length)),
            k,
            pos.x,
            pos.y
        );

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
