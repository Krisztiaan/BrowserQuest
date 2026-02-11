import type { EntityKind } from '../../shared/js/entity-kind-domain';
import Types from '../../shared/js/gametypes-browser';

type MessageValue = number | string | number[];
export type SerializedMessage = MessageValue[];

interface StatefulEntity {
    id: number;
    x: number;
    y: number;
    kind: EntityKind;
    getState(): Array<number | string>;
}

interface IdentifiedEntity {
    id: number;
}

interface ItemLike extends IdentifiedEntity {
    kind: EntityKind;
}

interface HateEntry {
    id: number;
}

interface MobLike extends IdentifiedEntity {
    kind: EntityKind;
    hatelist: HateEntry[];
}

class Message {
    serialize(): SerializedMessage {
        return [];
    }
}

class Spawn extends Message {
    entity: StatefulEntity;

    constructor(entity: StatefulEntity) {
        super();
        this.entity = entity;
    }

    serialize(): SerializedMessage {
        const state = this.entity.getState();
        const serialized: SerializedMessage = new Array(state.length + 1);
        serialized[0] = Types.Messages.SPAWN;
        for (let i = 0; i < state.length; i += 1) {
            serialized[i + 1] = state[i];
        }
        return serialized;
    }
}

class Despawn extends Message {
    entityId: number;

    constructor(entityId: number) {
        super();
        this.entityId = entityId;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.DESPAWN, this.entityId];
    }
}

class Move extends Message {
    entity: IdentifiedEntity & { x: number; y: number };

    constructor(entity: IdentifiedEntity & { x: number; y: number }) {
        super();
        this.entity = entity;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.MOVE, this.entity.id, this.entity.x, this.entity.y];
    }
}

class LootMove extends Message {
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
}

class Attack extends Message {
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
}

class Health extends Message {
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
}

class HitPoints extends Message {
    maxHitPoints: number;

    constructor(maxHitPoints: number) {
        super();
        this.maxHitPoints = maxHitPoints;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.HP, this.maxHitPoints];
    }
}

class EquipItem extends Message {
    playerId: number;
    itemKind: EntityKind;

    constructor(player: IdentifiedEntity, itemKind: EntityKind) {
        super();
        this.playerId = player.id;
        this.itemKind = itemKind;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.EQUIP, this.playerId, this.itemKind];
    }
}

class Drop extends Message {
    mob: MobLike;
    item: ItemLike;

    constructor(mob: MobLike, item: ItemLike) {
        super();
        this.mob = mob;
        this.item = item;
    }

    serialize(): SerializedMessage {
        const haters: number[] = new Array(this.mob.hatelist.length);
        for (let i = 0; i < this.mob.hatelist.length; i += 1) {
            haters[i] = this.mob.hatelist[i].id;
        }
        return [
            Types.Messages.DROP,
            this.mob.id,
            this.item.id,
            this.item.kind,
            haters,
        ];
    }
}

class Chat extends Message {
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
}

class Teleport extends Message {
    entity: IdentifiedEntity & { x: number; y: number };

    constructor(entity: IdentifiedEntity & { x: number; y: number }) {
        super();
        this.entity = entity;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.TELEPORT, this.entity.id, this.entity.x, this.entity.y];
    }
}

class Damage extends Message {
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
}

class Population extends Message {
    world: number;
    total: number;

    constructor(world: number, total?: number) {
        super();
        this.world = world;
        this.total = typeof total === 'number' ? total : world;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.POPULATION, this.world, this.total];
    }
}

class Kill extends Message {
    mob: Pick<MobLike, 'kind'>;

    constructor(mob: Pick<MobLike, 'kind'>) {
        super();
        this.mob = mob;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.KILL, this.mob.kind];
    }
}

class List extends Message {
    ids: number[];

    constructor(ids: number[]) {
        super();
        this.ids = ids;
    }

    serialize(): number[] {
        const serialized = new Array(this.ids.length + 1);
        serialized[0] = Types.Messages.LIST;
        for (let i = 0; i < this.ids.length; i += 1) {
            serialized[i + 1] = this.ids[i];
        }
        return serialized;
    }
}

class Destroy extends Message {
    entity: IdentifiedEntity;

    constructor(entity: IdentifiedEntity) {
        super();
        this.entity = entity;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.DESTROY, this.entity.id];
    }
}

class Blink extends Message {
    item: IdentifiedEntity;

    constructor(item: IdentifiedEntity) {
        super();
        this.item = item;
    }

    serialize(): SerializedMessage {
        return [Types.Messages.BLINK, this.item.id];
    }
}

const Messages = {
    Spawn,
    Despawn,
    Move,
    LootMove,
    Attack,
    Health,
    HitPoints,
    EquipItem,
    Drop,
    Chat,
    Teleport,
    Damage,
    Population,
    Kill,
    List,
    Destroy,
    Blink,
};

export type MessageConstructors = typeof Messages;

export { Message };
export default Messages;
