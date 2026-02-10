
import Item from './item';
import type { LootPlayer } from './item';
import Types from './compat/gametypes';

type ItemCtor = new (id: string | number) => Item;

class Sword2 extends Item {
    constructor(id: string | number) {
        super(id, Types.Entities.SWORD2, "weapon");
        this.lootMessage = "You pick up a steel sword";
    }
}

class Axe extends Item {
    constructor(id: string | number) {
        super(id, Types.Entities.AXE, "weapon");
        this.lootMessage = "You pick up an axe";
    }
}

class RedSword extends Item {
    constructor(id: string | number) {
        super(id, Types.Entities.REDSWORD, "weapon");
        this.lootMessage = "You pick up a blazing sword";
    }
}

class BlueSword extends Item {
    constructor(id: string | number) {
        super(id, Types.Entities.BLUESWORD, "weapon");
        this.lootMessage = "You pick up a magic sword";
    }
}

class GoldenSword extends Item {
    constructor(id: string | number) {
        super(id, Types.Entities.GOLDENSWORD, "weapon");
        this.lootMessage = "You pick up the ultimate sword";
    }
}

class MorningStar extends Item {
    constructor(id: string | number) {
        super(id, Types.Entities.MORNINGSTAR, "weapon");
        this.lootMessage = "You pick up a morning star";
    }
}

class LeatherArmor extends Item {
    constructor(id: string | number) {
        super(id, Types.Entities.LEATHERARMOR, "armor");
        this.lootMessage = "You equip a leather armor";
    }
}

class MailArmor extends Item {
    constructor(id: string | number) {
        super(id, Types.Entities.MAILARMOR, "armor");
        this.lootMessage = "You equip a mail armor";
    }
}

class PlateArmor extends Item {
    constructor(id: string | number) {
        super(id, Types.Entities.PLATEARMOR, "armor");
        this.lootMessage = "You equip a plate armor";
    }
}

class RedArmor extends Item {
    constructor(id: string | number) {
        super(id, Types.Entities.REDARMOR, "armor");
        this.lootMessage = "You equip a ruby armor";
    }
}

class GoldenArmor extends Item {
    constructor(id: string | number) {
        super(id, Types.Entities.GOLDENARMOR, "armor");
        this.lootMessage = "You equip a golden armor";
    }
}

class Flask extends Item {
    constructor(id: string | number) {
        super(id, Types.Entities.FLASK, "object");
        this.lootMessage = "You drink a health potion";
    }
}

class Cake extends Item {
    constructor(id: string | number) {
        super(id, Types.Entities.CAKE, "object");
        this.lootMessage = "You eat a cake";
    }
}

class Burger extends Item {
    constructor(id: string | number) {
        super(id, Types.Entities.BURGER, "object");
        this.lootMessage = "You can haz rat burger";
    }
}

class FirePotion extends Item {
    constructor(id: string | number) {
        super(id, Types.Entities.FIREPOTION, "object");
        this.lootMessage = "You feel the power of Firefox!";
    }

    onLoot(player: LootPlayer): void {
        player.startInvincibility();
    }
}

const Items: Record<string, ItemCtor> = {
    Sword2,
    Axe,
    RedSword,
    BlueSword,
    GoldenSword,
    MorningStar,
    LeatherArmor,
    MailArmor,
    PlateArmor,
    RedArmor,
    GoldenArmor,
    Flask,
    Cake,
    Burger,
    FirePotion,
};

export default Items;
