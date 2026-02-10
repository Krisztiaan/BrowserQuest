import type { EntityKind, EntityKindId, EntityKindName } from '../../shared/js/entity-kind-domain';
import Area from './area';
import type { AreaWorldContract } from './area';
import Mob from './mob';
import Utils from './utils';
import Types from '../../shared/js/gametypes';

interface Position {
    x: number;
    y: number;
}

interface MobAreaMobContract {
    id: number | string;
    x: number;
    y: number;
    type: string;
    isDead: boolean;
    hasTarget(): boolean;
    move(x: number, y: number): void;
    on(eventName: 'move', callback: (mob: MobAreaMobContract) => void): void;
}

interface MobAreaWorldContract {
    onMobMoveCallback: (mob: MobAreaMobContract) => void;
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
        const mob = new Mob('1' + this.id + '' + k + '' + this.entities.length, k, pos.x, pos.y);

        mob.on('move', this.world.onMobMoveCallback.bind(this.world));

        return mob;
    }

    respawnMob(mob: MobAreaMobContract, delay: number): void {
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

    initRoaming(_mob?: MobAreaMobContract): void {
        const self = this;

        setInterval(function () {
            (self.entities as MobAreaMobContract[]).forEach(function (mob) {
                const canRoam = Utils.random(20) === 1;
                let pos: Position;

                if (canRoam) {
                    if (!mob.hasTarget() && !mob.isDead) {
                        pos = self._getRandomPositionInsideArea();
                        mob.move(pos.x, pos.y);
                    }
                }
            });
        }, 500);
    }

    createReward(): { x: number; y: number; kind: EntityKind } {
        const pos = this._getRandomPositionInsideArea();

        return { x: pos.x, y: pos.y, kind: Types.Entities.CHEST };
    }
}

export default MobArea;
