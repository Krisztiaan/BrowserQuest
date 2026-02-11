import Character from '../../character';
import Chest from '../../chest';
import Item from '../../item';
import type { EntityKind } from '../../../../shared/js/entity-kind-domain';

type DespawnEntity = {
    kind: EntityKind;
    id: string | number;
    gridX: number;
    gridY: number;
    clean(): void;
};

type DespawnAttacker = {
    canReachTarget(): boolean;
    hit(): void;
};

type DespawnHost = {
    entity: DespawnEntity | null;
    previousClickPosition: Partial<{ x: number; y: number }>;
    clearPreviousClickPosition(): void;
    logDespawn(entity: DespawnEntity): void;
    removeItem(item: Item): void;
};

export function handleEntityDespawn(host: DespawnHost): void {
    if (!host.entity) {
        return;
    }

    const entity = host.entity;
    host.logDespawn(entity);

    if (entity.gridX === host.previousClickPosition.x && entity.gridY === host.previousClickPosition.y) {
        host.clearPreviousClickPosition();
    }

    if (entity instanceof Item) {
        host.removeItem(entity);
    } else if (entity instanceof Character) {
        entity.forEachAttacker(function (attacker: DespawnAttacker) {
            if (attacker.canReachTarget()) {
                attacker.hit();
            }
        });
        entity.die();
    } else if (entity instanceof Chest) {
        entity.open();
    }

    entity.clean();
}
