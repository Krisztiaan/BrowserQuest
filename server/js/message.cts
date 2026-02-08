const Types = require('../../shared/js/gametypes') as {
    Messages: Record<string, number>;
};

type MessageValue = number | string | number[];
type SerializedMessage = MessageValue[];

interface StatefulEntity {
    id: number;
    x: number;
    y: number;
    kind: number | string;
    getState(): Array<number | string>;
}

interface IdentifiedEntity {
    id: number;
}

interface ItemLike extends IdentifiedEntity {
    kind: number | string;
}

interface HateEntry {
    id: number;
}

interface MobLike extends IdentifiedEntity {
    kind: number | string;
    hatelist: HateEntry[];
}

type MessageCtor = new (...args: unknown[]) => Message;
const Messages: Record<string, MessageCtor> = {};
module.exports = Messages;

class Message {
    serialize(): SerializedMessage {
        return [];
    }
}

Messages.Spawn = class Spawn extends Message {
    entity: StatefulEntity;

    constructor(entity: StatefulEntity) {
        super();
        this.entity = entity;
    }

    serialize(): SerializedMessage {
        const spawn: SerializedMessage = [Types.Messages.SPAWN];
        return spawn.concat(this.entity.getState());
    }
};

Messages.Despawn = class Despawn extends Message {
    entityId: number;

    constructor(entityId: number) {
        super();
        this.entityId = entityId;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.DESPAWN, this.entityId];
    }
};

Messages.Move = class Move extends Message {
    entity: IdentifiedEntity & { x: number; y: number };

    constructor(entity: IdentifiedEntity & { x: number; y: number }) {
        super();
        this.entity = entity;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.MOVE, this.entity.id, this.entity.x, this.entity.y];
    }
};

Messages.LootMove = class LootMove extends Message {
    entity: IdentifiedEntity;
    item: IdentifiedEntity;

    constructor(entity: IdentifiedEntity, item: IdentifiedEntity) {
        super();
        this.entity = entity;
        this.item = item;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.LOOTMOVE, this.entity.id, this.item.id];
    }
};

Messages.Attack = class Attack extends Message {
    attackerId: number;
    targetId: number | null;

    constructor(attackerId: number, targetId: number | null) {
        super();
        this.attackerId = attackerId;
        this.targetId = targetId;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.ATTACK, this.attackerId, this.targetId ?? 0];
    }
};

Messages.Health = class Health extends Message {
    points: number;
    isRegen: boolean;

    constructor(points: number, isRegen: boolean) {
        super();
        this.points = points;
        this.isRegen = isRegen;
    }

    serialize(): SerializedMessage {
        const health: SerializedMessage = [Types.Messages.HEALTH, this.points];

        if (this.isRegen) {
            health.push(1);
        }
        return health;
    }
};

Messages.HitPoints = class HitPoints extends Message {
    maxHitPoints: number;

    constructor(maxHitPoints: number) {
        super();
        this.maxHitPoints = maxHitPoints;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.HP, this.maxHitPoints];
    }
};

Messages.EquipItem = class EquipItem extends Message {
    playerId: number;
    itemKind: number | string;

    constructor(player: IdentifiedEntity, itemKind: number | string) {
        super();
        this.playerId = player.id;
        this.itemKind = itemKind;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.EQUIP, this.playerId, this.itemKind];
    }
};

Messages.Drop = class Drop extends Message {
    mob: MobLike;
    item: ItemLike;

    constructor(mob: MobLike, item: ItemLike) {
        super();
        this.mob = mob;
        this.item = item;
    }

    serialize(): SerializedMessage {
        const drop: SerializedMessage = [
            Types.Messages.DROP,
            this.mob.id,
            this.item.id,
            this.item.kind,
            this.mob.hatelist.map(function (hate) {
                return hate.id;
            }),
        ];

        return drop;
    }
};

Messages.Chat = class Chat extends Message {
    playerId: number;
    message: string;

    constructor(player: IdentifiedEntity, message: string) {
        super();
        this.playerId = player.id;
        this.message = message;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.CHAT, this.playerId, this.message];
    }
};

Messages.Teleport = class Teleport extends Message {
    entity: IdentifiedEntity & { x: number; y: number };

    constructor(entity: IdentifiedEntity & { x: number; y: number }) {
        super();
        this.entity = entity;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.TELEPORT, this.entity.id, this.entity.x, this.entity.y];
    }
};

Messages.Damage = class Damage extends Message {
    entity: IdentifiedEntity;
    points: number;

    constructor(entity: IdentifiedEntity, points: number) {
        super();
        this.entity = entity;
        this.points = points;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.DAMAGE, this.entity.id, this.points];
    }
};

Messages.Population = class Population extends Message {
    world: number;
    total: number;

    constructor(world: number, total: number) {
        super();
        this.world = world;
        this.total = total;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.POPULATION, this.world, this.total];
    }
};

Messages.Kill = class Kill extends Message {
    mob: Pick<MobLike, 'kind'>;

    constructor(mob: Pick<MobLike, 'kind'>) {
        super();
        this.mob = mob;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.KILL, this.mob.kind];
    }
};

Messages.List = class List extends Message {
    ids: number[];

    constructor(ids: number[]) {
        super();
        this.ids = ids;
    }

    serialize(): number[] {
        const list = this.ids;

        list.unshift(Types.Messages.LIST);
        return list;
    }
};

Messages.Destroy = class Destroy extends Message {
    entity: IdentifiedEntity;

    constructor(entity: IdentifiedEntity) {
        super();
        this.entity = entity;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.DESTROY, this.entity.id];
    }
};

Messages.Blink = class Blink extends Message {
    item: IdentifiedEntity;

    constructor(item: IdentifiedEntity) {
        super();
        this.item = item;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.BLINK, this.item.id];
    }
};
