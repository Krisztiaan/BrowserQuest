
import Character from 'character';

class Mob extends Character {
    aggroRange: number;
    isAggressive: boolean;

    constructor(id: string | number, kind: number) {
        super(id, kind);
    
        this.aggroRange = 1;
        this.isAggressive = true;
    }
}

export default Mob;
