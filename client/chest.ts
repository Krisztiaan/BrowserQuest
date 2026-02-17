
import Entity from './entity';
import type { EntityEvents } from './entity';
import Types from '../shared/gametypes-browser';
import type { MergeEvents } from '../shared/typed-event-emitter';

type ChestEvents = {
    open: [];
};

class Chest extends Entity<MergeEvents<EntityEvents, ChestEvents>> {

    constructor(id: string | number) {
        super(id, Types.Entities.CHEST);
    }

    getSpriteName(): string {
        return "chest";
    }

    isMoving(): boolean {
        return false;
    }

    open(): void {
        this.emit('open');
    }
}

export default Chest;
