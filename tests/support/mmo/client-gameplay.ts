import type { EntityKind } from '../../../shared/entity-kind-domain';
import type { EntityId } from '../../../shared/domain/ids';
import type { ClientWorldKernel } from '../../../client/ecs/world-kernel';

type GridEntity = {
    setGridPosition(x: number, y: number): void;
    gridX: number;
    gridY: number;
};

export function setEntityGrid(entity: GridEntity, x: number, y: number): void {
    entity.setGridPosition(x, y);
    entity.gridX = x;
    entity.gridY = y;
}

export function upsertClientSpatialRecord({
    kernel,
    entityId,
    kind,
    x,
    y,
    isPlayer,
    isMoving = false,
    isDead = false,
    nextGridX = -1,
    nextGridY = -1,
}: {
    kernel: ClientWorldKernel;
    entityId: EntityId;
    kind: EntityKind;
    x: number;
    y: number;
    isPlayer: boolean;
    isMoving?: boolean;
    isDead?: boolean;
    nextGridX?: number;
    nextGridY?: number;
}): void {
    kernel.clientSpatialRecords.set(entityId, {
        gridX: x,
        gridY: y,
        nextGridX,
        nextGridY,
        isMoving,
        isDead,
        kind,
        isPlayer,
    });
}
