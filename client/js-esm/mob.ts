
import Character from './character';
import type { EntityKind } from './compat/gametypes';

class Mob extends Character {
    aggroRange: number;
    isAggressive: boolean;

    constructor(id: string | number, kind: EntityKind) {
        super(id, kind);
    
        this.aggroRange = 1;
        this.isAggressive = true;
    }
}

export default Mob;
