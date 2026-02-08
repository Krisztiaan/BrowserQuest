
import Player from 'player';
import Types from 'compat/gametypes';

class Warrior extends Player {
    constructor(id: string | number, name: string) {
        super(id, name, Types.Entities.WARRIOR);
    }
}

export default Warrior;
