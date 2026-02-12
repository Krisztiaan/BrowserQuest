import Types from '../../../shared/gametypes-browser';
import type { EntityKind } from '../../../shared/entity-kind-domain';
import type { EntityId } from '../../../shared/domain/ids';
import type { ClientWorldKernel } from '../world-kernel';
import Character from '../../character';
import Chest from '../../chest';
import Item from '../../item';
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

type EntityGridCell = Record<string, GridIndexedEntity>;
type EntityGrid = EntityGridCell[][];

export type ClientSpatialSyncSystemHost = {
    kernel: ClientWorldKernel;
    map: { grid: number[][]; isOutOfBounds(x: number, y: number): boolean } | null;
    entities: Record<string, GridIndexedEntity>;
    entityGrid: EntityGrid | null;
    itemGrid: EntityGrid | null;
    renderingGrid: EntityGrid | null;
    pathingGrid: number[][] | null;
};

function removeFromCell(cell: EntityGridCell | undefined, entityId: EntityId): void {
    if (!cell) {
        return;
    }
    if (cell[entityId]) {
        delete cell[entityId];
    }
}

function setPathingCell(
    host: ClientSpatialSyncSystemHost,
    x: number,
    y: number,
    value: number
): void {
    if (!host.map || !host.pathingGrid) {
        return;
    }
    if (host.map.isOutOfBounds(x, y)) {
        return;
    }
    host.pathingGrid[y][x] = value;
}

function basePathingValue(host: ClientSpatialSyncSystemHost, x: number, y: number): number {
    if (!host.map) {
        return 0;
    }
    if (host.map.isOutOfBounds(x, y)) {
        return 0;
    }
    return host.map.grid[y]?.[x] ?? 0;
}

function removeDynamicPathing(host: ClientSpatialSyncSystemHost, x: number, y: number): void {
    setPathingCell(host, x, y, basePathingValue(host, x, y));
}

function addDynamicPathing(host: ClientSpatialSyncSystemHost, x: number, y: number): void {
    setPathingCell(host, x, y, 1);
}

function removeRecord(host: ClientSpatialSyncSystemHost, record: { gridX: number; gridY: number; nextGridX: number; nextGridY: number; isMoving: boolean; kind: EntityKind; id: EntityId }): void {
    const { id } = record;
    const entityGrid = host.entityGrid;
    const itemGrid = host.itemGrid;
    const renderingGrid = host.renderingGrid;

    if (entityGrid) {
        removeFromCell(entityGrid[record.gridY]?.[record.gridX], id);
        if (record.isMoving && record.nextGridX >= 0 && record.nextGridY >= 0) {
            removeFromCell(entityGrid[record.nextGridY]?.[record.nextGridX], id);
        }
    }

    if (renderingGrid) {
        removeFromCell(renderingGrid[record.gridY]?.[record.gridX], id);
    }

    if (itemGrid && Types.isItem(record.kind)) {
        removeFromCell(itemGrid[record.gridY]?.[record.gridX], id);
    }

    if (Types.isChest(record.kind)) {
        removeDynamicPathing(host, record.gridX, record.gridY);
        return;
    }

    if (Types.isItem(record.kind)) {
        return;
    }

    // Characters: block on next while moving, or current while stationary, except players.
    const entity = host.entities[String(id)];
    if (entity instanceof Player) {
        return;
    }

    if (record.isMoving && record.nextGridX >= 0 && record.nextGridY >= 0) {
        removeDynamicPathing(host, record.nextGridX, record.nextGridY);
    } else {
        removeDynamicPathing(host, record.gridX, record.gridY);
    }
}

function addRecord(host: ClientSpatialSyncSystemHost, entity: GridIndexedEntity, record: { gridX: number; gridY: number; nextGridX: number; nextGridY: number; isMoving: boolean; kind: EntityKind }): void {
    const entityGrid = host.entityGrid;
    const itemGrid = host.itemGrid;
    const renderingGrid = host.renderingGrid;

    if (entityGrid && !host.map?.isOutOfBounds(record.gridX, record.gridY)) {
        if (entity instanceof Character || entity instanceof Chest) {
            entityGrid[record.gridY][record.gridX][entity.id] = entity;
            if (record.isMoving && record.nextGridX >= 0 && record.nextGridY >= 0) {
                if (!host.map?.isOutOfBounds(record.nextGridX, record.nextGridY)) {
                    entityGrid[record.nextGridY][record.nextGridX][entity.id] = entity;
                }
            }
        }
    }

    if (itemGrid && entity instanceof Item && !host.map?.isOutOfBounds(record.gridX, record.gridY)) {
        itemGrid[record.gridY][record.gridX][entity.id] = entity;
    }

    if (renderingGrid && !host.map?.isOutOfBounds(record.gridX, record.gridY)) {
        renderingGrid[record.gridY][record.gridX][entity.id] = entity;
    }

    if (entity instanceof Chest) {
        addDynamicPathing(host, record.gridX, record.gridY);
        return;
    }

    if (entity instanceof Item) {
        return;
    }

    if (entity instanceof Player) {
        return;
    }

    if (record.isMoving && record.nextGridX >= 0 && record.nextGridY >= 0) {
        addDynamicPathing(host, record.nextGridX, record.nextGridY);
    } else {
        addDynamicPathing(host, record.gridX, record.gridY);
    }
}

function normalizeNextGrid(entity: GridIndexedEntity): { nextGridX: number; nextGridY: number } {
    const nextGridX = entity.nextGridX ?? -1;
    const nextGridY = entity.nextGridY ?? -1;
    return { nextGridX, nextGridY };
}

export function runClientSpatialSyncSystem(host: ClientSpatialSyncSystemHost): void {
    if (!host.map || !host.entityGrid || !host.renderingGrid || !host.pathingGrid) {
        return;
    }

    const kernel = host.kernel;

    // Remove records for entities no longer present client-side.
    for (const id of Array.from(kernel.clientSpatialKnownIds)) {
        if (host.entities[String(id)]) {
            continue;
        }
        const record = kernel.clientSpatialRecords.get(id);
        if (record) {
            removeRecord(host, { ...record, id });
        }
        kernel.clientSpatialKnownIds.delete(id);
        kernel.clientSpatialRecords.delete(id);
    }

    // Upsert records for all active entities.
    for (const entity of Object.values(host.entities)) {
        const id = entity.id;

        if (entity instanceof Character && !entity.isMoving()) {
            if ((entity.nextGridX ?? -1) >= 0 || (entity.nextGridY ?? -1) >= 0) {
                entity.nextGridX = -1;
                entity.nextGridY = -1;
            }
        }

        const { nextGridX, nextGridY } = normalizeNextGrid(entity);
        const isMoving = entity instanceof Character ? entity.isMoving() : false;
        const record = {
            gridX: entity.gridX,
            gridY: entity.gridY,
            nextGridX,
            nextGridY,
            isMoving,
            kind: entity.kind,
        } as const;

        const prev = kernel.clientSpatialRecords.get(id);
        if (!prev) {
            kernel.clientSpatialKnownIds.add(id);
            kernel.clientSpatialRecords.set(id, record);
            addRecord(host, entity, record);
            continue;
        }

        if (
            prev.gridX === record.gridX &&
            prev.gridY === record.gridY &&
            prev.nextGridX === record.nextGridX &&
            prev.nextGridY === record.nextGridY &&
            prev.isMoving === record.isMoving &&
            prev.kind === record.kind
        ) {
            continue;
        }

        removeRecord(host, { ...prev, id });
        kernel.clientSpatialRecords.set(id, record);
        addRecord(host, entity, record);
    }
}

