
var Types = require('../../shared/js/gametypes');

var Messages = {};
module.exports = Messages;

class Message {}

Messages.Spawn = class Spawn extends Message {
    constructor(entity) {
        super();
        this.entity = entity;
    }

    serialize() {
        var spawn = [Types.Messages.SPAWN];
        return spawn.concat(this.entity.getState());
    }
};

Messages.Despawn = class Despawn extends Message {
    constructor(entityId) {
        super();
        this.entityId = entityId;
    }

    serialize() {
        return [Types.Messages.DESPAWN, this.entityId];
    }
};

Messages.Move = class Move extends Message {
    constructor(entity) {
        super();
        this.entity = entity;
    }

    serialize() {
        return [Types.Messages.MOVE, this.entity.id, this.entity.x, this.entity.y];
    }
};

Messages.LootMove = class LootMove extends Message {
    constructor(entity, item) {
        super();
        this.entity = entity;
        this.item = item;
    }

    serialize() {
        return [Types.Messages.LOOTMOVE, this.entity.id, this.item.id];
    }
};

Messages.Attack = class Attack extends Message {
    constructor(attackerId, targetId) {
        super();
        this.attackerId = attackerId;
        this.targetId = targetId;
    }

    serialize() {
        return [Types.Messages.ATTACK, this.attackerId, this.targetId];
    }
};

Messages.Health = class Health extends Message {
    constructor(points, isRegen) {
        super();
        this.points = points;
        this.isRegen = isRegen;
    }

    serialize() {
        var health = [Types.Messages.HEALTH, this.points];

        if(this.isRegen) {
            health.push(1);
        }
        return health;
    }
};

Messages.HitPoints = class HitPoints extends Message {
    constructor(maxHitPoints) {
        super();
        this.maxHitPoints = maxHitPoints;
    }

    serialize() {
        return [Types.Messages.HP, this.maxHitPoints];
    }
};

Messages.EquipItem = class EquipItem extends Message {
    constructor(player, itemKind) {
        super();
        this.playerId = player.id;
        this.itemKind = itemKind;
    }

    serialize() {
        return [Types.Messages.EQUIP, this.playerId, this.itemKind];
    }
};

Messages.Drop = class Drop extends Message {
    constructor(mob, item) {
        super();
        this.mob = mob;
        this.item = item;
    }

    serialize() {
        var drop = [
            Types.Messages.DROP,
            this.mob.id,
            this.item.id,
            this.item.kind,
            this.mob.hatelist.map(function(hate) {
                return hate.id;
            }),
        ];

        return drop;
    }
};

Messages.Chat = class Chat extends Message {
    constructor(player, message) {
        super();
        this.playerId = player.id;
        this.message = message;
    }

    serialize() {
        return [Types.Messages.CHAT, this.playerId, this.message];
    }
};

Messages.Teleport = class Teleport extends Message {
    constructor(entity) {
        super();
        this.entity = entity;
    }

    serialize() {
        return [Types.Messages.TELEPORT, this.entity.id, this.entity.x, this.entity.y];
    }
};

Messages.Damage = class Damage extends Message {
    constructor(entity, points) {
        super();
        this.entity = entity;
        this.points = points;
    }

    serialize() {
        return [Types.Messages.DAMAGE, this.entity.id, this.points];
    }
};

Messages.Population = class Population extends Message {
    constructor(world, total) {
        super();
        this.world = world;
        this.total = total;
    }

    serialize() {
        return [Types.Messages.POPULATION, this.world, this.total];
    }
};

Messages.Kill = class Kill extends Message {
    constructor(mob) {
        super();
        this.mob = mob;
    }

    serialize() {
        return [Types.Messages.KILL, this.mob.kind];
    }
};

Messages.List = class List extends Message {
    constructor(ids) {
        super();
        this.ids = ids;
    }

    serialize() {
        var list = this.ids;

        list.unshift(Types.Messages.LIST);
        return list;
    }
};

Messages.Destroy = class Destroy extends Message {
    constructor(entity) {
        super();
        this.entity = entity;
    }

    serialize() {
        return [Types.Messages.DESTROY, this.entity.id];
    }
};

Messages.Blink = class Blink extends Message {
    constructor(item) {
        super();
        this.item = item;
    }

    serialize() {
        return [Types.Messages.BLINK, this.item.id];
    }
};
