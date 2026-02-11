import type { EntityKind } from '../shared/entity-kind-domain';

import Entity from './entity';

interface ItemDespawnParams {
    blinkCallback: () => void;
    despawnCallback: () => void;
    blinkingDuration: number;
    beforeBlinkDelay: number;
}

export type ItemEvents = {
    respawn: [];
};

class Item extends Entity<ItemEvents> {
    isStatic: boolean;
    isFromChest: boolean;
    blinkTimeout: ReturnType<typeof setTimeout> | null;
    despawnTimeout: ReturnType<typeof setTimeout> | null;
    constructor(id: number | string, kind: EntityKind, x: number, y: number) {
        super(id, 'item', kind, x, y);
        this.isStatic = false;
        this.isFromChest = false;
        this.blinkTimeout = null;
        this.despawnTimeout = null;
    }

    handleDespawn(params: ItemDespawnParams): void {
        const self = this;

        this.blinkTimeout = setTimeout(function (): void {
            params.blinkCallback();
            self.despawnTimeout = setTimeout(params.despawnCallback, params.blinkingDuration);
        }, params.beforeBlinkDelay);
    }

    override destroy(): void {
        if (this.blinkTimeout) {
            clearTimeout(this.blinkTimeout);
        }
        if (this.despawnTimeout) {
            clearTimeout(this.despawnTimeout);
        }

        if (this.isStatic) {
            this.scheduleRespawn(30000);
        }
    }

    scheduleRespawn(delay: number): void {
        const self = this;
        setTimeout(function (): void {
            self.emit('respawn');
        }, delay);
    }
}

export default Item;
