
import Entity from './entity';
import Types from './compat/gametypes';

class Chest extends Entity {
    open_callback: (() => void) | null;

    constructor(id, kind) {
        super(id, Types.Entities.CHEST);
        this.open_callback = null;
    }

    getSpriteName() {
        return "chest";
    }

    isMoving() {
        return false;
    }

    open() {
        if(this.open_callback) {
            this.open_callback();
        }
    }

    onOpen(callback) {
        this.open_callback = callback;
    }
}

export default Chest;
