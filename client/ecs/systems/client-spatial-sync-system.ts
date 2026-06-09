import type { EntityKind } from '../../../shared/entity-kind-domain';
import type { EntityId } from '../../../shared/domain/ids';
import type { ClientWorldKernel } from '../world-kernel';
import Character from '../../character';
import Player from '../../player';

type GridIndexedEntity = {
    id: EntityId;
    kind: EntityKind;
    gridX: number;
    gridY: number;
    nextGridX?: number;
    nextGridY?: number;
    isDirty: boolean;
};

export type ClientSpatialSyncSystemHost = {
    kernel: ClientWorldKernel;
    map: { grid: number[][]; isOutOfBounds(x: number, y: number): boolean } | null;
    entities: Record<string, GridIndexedEntity>;
};

function normalizeNextGrid(entity: GridIndexedEntity): { nextGridX: number; nextGridY: number } {
    const nextGridX = entity.nextGridX ?? -1;
    const nextGridY = entity.nextGridY ?? -1;
    return { nextGridX, nextGridY };
}

export function runClientSpatialSyncSystem(host: ClientSpatialSyncSystemHost): void {
    if (!host.map) {
        return;
    }

    const kernel = host.kernel;
    kernel.ensureClientPathingGrid(host.map.grid);

    // Remove records for entities no longer present client-side.
    for (const id of Array.from(kernel.clientSpatialKnownIds)) {
        if (host.entities[String(id)]) {
            continue;
        }
        const record = kernel.clientSpatialRecords.get(id);
        if (record) {
            kernel.enqueueClientCommand({ type: 'spatialRemoveRecord', entityId: id, record });
        }
        kernel.clientSpatialKnownIds.delete(id);
        kernel.clientSpatialRecords.delete(id);
    }

    // Upsert records for all active entities.
    for (const entity of Object.values(host.entities)) {
        const id = entity.id;
        const isInputMoving = entity instanceof Player && (kernel.clientMoveInputKeysMask >>> 0) !== 0;
        const isMoving = entity instanceof Character ? (entity.isMoving() || isInputMoving) : false;
        const isDead = entity instanceof Character ? entity.isDead : false;

        let { nextGridX, nextGridY } = normalizeNextGrid(entity);
        if (entity instanceof Character && !isMoving) {
            if (nextGridX >= 0 || nextGridY >= 0) {
                nextGridX = -1;
                nextGridY = -1;
                kernel.enqueueClientCommand({ type: 'setEntityNextGrid', entityId: id, nextGridX, nextGridY });
            }
        }

        const record = {
            gridX: entity.gridX,
            gridY: entity.gridY,
            nextGridX,
            nextGridY,
            isMoving,
            isDead,
            kind: entity.kind,
            isPlayer: entity instanceof Player,
        } as const;

        const prev = kernel.clientSpatialRecords.get(id);
        if (!prev) {
            kernel.clientSpatialKnownIds.add(id);
            kernel.clientSpatialRecords.set(id, record);
            kernel.enqueueClientCommand({ type: 'spatialAddRecord', entityId: id, record });
            continue;
        }

        if (
            prev.gridX === record.gridX &&
            prev.gridY === record.gridY &&
            prev.nextGridX === record.nextGridX &&
            prev.nextGridY === record.nextGridY &&
            prev.isMoving === record.isMoving &&
            prev.isDead === record.isDead &&
            prev.kind === record.kind &&
            prev.isPlayer === record.isPlayer
        ) {
            continue;
        }

        kernel.enqueueClientCommand({ type: 'spatialRemoveRecord', entityId: id, record: prev });
        kernel.clientSpatialRecords.set(id, record);
        kernel.enqueueClientCommand({ type: 'spatialAddRecord', entityId: id, record });
    }
}
