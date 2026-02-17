import Utils from './utils';
import { Evented } from '../shared/evented';

export interface AreaWorldContract {
    isValidPosition(x: number, y: number): boolean;
    addMob(entity: AreaEntity): void;
}

export interface AreaEntity {
    id: number | string;
    type?: string;
    isDead?: boolean;
    area?: object | null;
}

type AreaEvents = {
    empty: [];
};

class Area extends Evented<AreaEvents> {
    id: number | string;
    x: number;
    y: number;
    width: number;
    height: number;
    world: AreaWorldContract;
    entities: AreaEntity[];
    hasCompletelyRespawned: boolean;
    nbEntities?: number;

    constructor(id: number | string, x: number, y: number, width: number, height: number, world: AreaWorldContract) {
        super();
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.world = world;
        this.entities = [];
        this.hasCompletelyRespawned = true;
    }

    _getRandomPositionInsideArea(): { x: number; y: number } {
        const pos = { x: 0, y: 0 };
        const maxAttempts = Math.max(1, (this.width + 1) * (this.height + 1) * 4);

        for (let attempts = 0; attempts < maxAttempts; attempts += 1) {
            pos.x = this.x + Utils.random(this.width + 1);
            pos.y = this.y + Utils.random(this.height + 1);
            if (this.world.isValidPosition(pos.x, pos.y)) {
                return pos;
            }
        }

        for (let y = this.y; y <= this.y + this.height; y += 1) {
            for (let x = this.x; x <= this.x + this.width; x += 1) {
                if (this.world.isValidPosition(x, y)) {
                    return { x, y };
                }
            }
        }

        throw new Error('Could not find a valid position in area ' + this.id);
    }

    removeFromArea(entity: AreaEntity): void {
        const i = this.entities.findIndex((currentEntity) => {
            return currentEntity.id === entity.id;
        });

        if (i === -1) {
            return;
        }

        this.entities.splice(i, 1);

        if (this.isEmpty() && this.hasCompletelyRespawned) {
            this.hasCompletelyRespawned = false;
            this.emit('empty');
        }
    }

    addToArea(entity: AreaEntity | null | undefined): void {
        if (entity) {
            this.entities.push(entity);
            entity.area = this;
            if (entity.type === 'mob') {
                this.world.addMob(entity);
            }
        }

        if (this.isFull()) {
            this.hasCompletelyRespawned = true;
        }
    }

    setNumberOfEntities(nb: number): void {
        this.nbEntities = nb;
    }

    isEmpty(): boolean {
        return !this.entities.some((entity) => !entity.isDead);
    }

    isFull(): boolean {
        return !this.isEmpty() && this.nbEntities === this.entities.length;
    }
}

export default Area;
