interface Position {
    x: number;
    y: number;
}

interface MobAreaMobContract {
    x: number;
    y: number;
    isDead: boolean;
    hasTarget(): boolean;
    move(x: number, y: number): void;
    onMove(callback: (mob: MobAreaMobContract) => void): void;
}

interface MobAreaWorldContract {
    onMobMoveCallback: (mob: MobAreaMobContract) => void;
    addMob(mob: MobAreaMobContract): void;
    isValidPosition(x: number, y: number): boolean;
}

const Area = require('./area') as new (
    id: number | string,
    x: number,
    y: number,
    width: number,
    height: number,
    world: MobAreaWorldContract
) => {
    id: number | string;
    entities: MobAreaMobContract[];
    world: MobAreaWorldContract;
    setNumberOfEntities(nb: number): void;
    addToArea(entity: MobAreaMobContract): void;
    removeFromArea(entity: MobAreaMobContract): void;
    _getRandomPositionInsideArea(): Position;
};

const Mob = require('./mob') as new (
    id: number | string,
    kind: number | string,
    x: number,
    y: number
) => MobAreaMobContract;

const Utils = require('./utils') as {
    random(range: number): number;
};

const Types = require('../../shared/js/gametypes') as {
    getKindFromString(kind: string): number;
    Entities: {
        CHEST: number | string;
    };
};

class MobArea extends Area {
    nb: number;
    kind: string;
    respawns: unknown[];

    constructor(
        id: number | string,
        nb: number,
        kind: string,
        x: number,
        y: number,
        width: number,
        height: number,
        world: MobAreaWorldContract
    ) {
        super(id, x, y, width, height, world);
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
        const k = Types.getKindFromString(this.kind);
        const pos = this._getRandomPositionInsideArea();
        const mob = new Mob('1' + this.id + '' + k + '' + this.entities.length, k, pos.x, pos.y);

        mob.onMove(this.world.onMobMoveCallback.bind(this.world));

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
            self.entities.forEach(function (mob) {
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

    createReward(): { x: number; y: number; kind: number | string } {
        const pos = this._getRandomPositionInsideArea();

        return { x: pos.x, y: pos.y, kind: Types.Entities.CHEST };
    }
}

module.exports = MobArea;
