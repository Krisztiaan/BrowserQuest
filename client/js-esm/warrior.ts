
import Player from './player';
import Types from '../../shared/js/gametypes-browser';

class Warrior extends Player {
    constructor(id: string | number, name: string) {
        super(id, name, Types.Entities.WARRIOR);
    }
}

export default Warrior;
