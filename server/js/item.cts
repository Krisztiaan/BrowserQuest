import type { EntityKind } from '../../shared/js/entity-kind-domain';

const Entity = require('./entity') as new (
    id: number | string,
    type: string,
    kind: EntityKind,
    x: number,
    y: number
) => object;

interface ItemDespawnParams {
    blinkCallback: () => void;
    despawnCallback: () => void;
    blinkingDuration: number;
    beforeBlinkDelay: number;
}

class Item extends Entity {
    isStatic: boolean;
    isFromChest: boolean;
    blinkTimeout: ReturnType<typeof setTimeout> | null;
    despawnTimeout: ReturnType<typeof setTimeout> | null;
    respawn_callback: (() => void) | null;

    constructor(id: number | string, kind: EntityKind, x: number, y: number) {
        super(id, 'item', kind, x, y);
        this.isStatic = false;
        this.isFromChest = false;
        this.blinkTimeout = null;
        this.despawnTimeout = null;
        this.respawn_callback = null;
    }

    handleDespawn(params: ItemDespawnParams): void {
        const self = this;

        this.blinkTimeout = setTimeout(function () {
            params.blinkCallback();
            self.despawnTimeout = setTimeout(params.despawnCallback, params.blinkingDuration);
        }, params.beforeBlinkDelay);
    }

    destroy(): void {
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
        setTimeout(function () {
            if (self.respawn_callback) {
                self.respawn_callback();
            }
        }, delay);
    }

    onRespawn(callback: () => void): void {
        this.respawn_callback = callback;
    }
}

module.exports = Item;
