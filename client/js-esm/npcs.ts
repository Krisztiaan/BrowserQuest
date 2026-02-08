
import Npc from 'npc';
import Types from 'compat/gametypes';

type NpcCtor = new (id: string | number) => Npc;

class Guard extends Npc {
    constructor(id: string | number) {
        super(id, Types.Entities.GUARD);
    }
}

class King extends Npc {
    constructor(id: string | number) {
        super(id, Types.Entities.KING);
    }
}

class Agent extends Npc {
    constructor(id: string | number) {
        super(id, Types.Entities.AGENT);
    }
}

class Rick extends Npc {
    constructor(id: string | number) {
        super(id, Types.Entities.RICK);
    }
}

class VillageGirl extends Npc {
    constructor(id: string | number) {
        super(id, Types.Entities.VILLAGEGIRL);
    }
}

class Villager extends Npc {
    constructor(id: string | number) {
        super(id, Types.Entities.VILLAGER);
    }
}

class Coder extends Npc {
    constructor(id: string | number) {
        super(id, Types.Entities.CODER);
    }
}

class Scientist extends Npc {
    constructor(id: string | number) {
        super(id, Types.Entities.SCIENTIST);
    }
}

class Nyan extends Npc {
    constructor(id: string | number) {
        super(id, Types.Entities.NYAN);
        this.idleSpeed = 50;
    }
}

class Sorcerer extends Npc {
    constructor(id: string | number) {
        super(id, Types.Entities.SORCERER);
        this.idleSpeed = 150;
    }
}

class Priest extends Npc {
    constructor(id: string | number) {
        super(id, Types.Entities.PRIEST);
    }
}

class BeachNpc extends Npc {
    constructor(id: string | number) {
        super(id, Types.Entities.BEACHNPC);
    }
}

class ForestNpc extends Npc {
    constructor(id: string | number) {
        super(id, Types.Entities.FORESTNPC);
    }
}

class DesertNpc extends Npc {
    constructor(id: string | number) {
        super(id, Types.Entities.DESERTNPC);
    }
}

class LavaNpc extends Npc {
    constructor(id: string | number) {
        super(id, Types.Entities.LAVANPC);
    }
}

class Octocat extends Npc {
    constructor(id: string | number) {
        super(id, Types.Entities.OCTOCAT);
    }
}

const NPCs: Record<string, NpcCtor> = {
    Guard,
    King,
    Agent,
    Rick,
    VillageGirl,
    Villager,
    Coder,
    Scientist,
    Nyan,
    Sorcerer,
    Priest,
    BeachNpc,
    ForestNpc,
    DesertNpc,
    LavaNpc,
    Octocat,
};

export default NPCs;
