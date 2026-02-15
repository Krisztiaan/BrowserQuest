import Types from '../../shared/gametypes-browser';
import type { EntityId } from '../../shared/domain/ids';
import type { EntityKind } from '../../shared/entity-kind-domain';

export type ClientDynamicOccupancySpatialRecord = Readonly<{
    gridX: number;
    gridY: number;
    nextGridX: number;
    nextGridY: number;
    isMoving: boolean;
    isDead?: boolean;
    kind: EntityKind;
}>;

function key(x: number, y: number): string {
    return `${x},${y}`;
}

function shouldBlock(kind: EntityKind): boolean {
    return Types.isPlayer(kind) || Types.isMob(kind) || Types.isNpc(kind) || Types.isChest(kind);
}

type ApplyOverlayArgs = Readonly<{
    grid: number[][];
    records: Iterable<[EntityId, ClientDynamicOccupancySpatialRecord]>;
    isOutOfBounds?: (x: number, y: number) => boolean;
    excludeIds?: ReadonlySet<EntityId>;
}>;

/**
 * Applies a temporary "dynamic occupancy" overlay to a pathing grid by marking occupied tiles as blocked.
 * Returns a restore function that MUST be called to return the shared grid to its prior state.
 */
export function applyDynamicOccupancyOverlayToGrid({
    grid,
    records,
    isOutOfBounds,
    excludeIds,
}: ApplyOverlayArgs): () => void {
    const original = new Map<string, number>();

    const mark = (x: number, y: number): void => {
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
            return;
        }
        if (isOutOfBounds?.(x, y)) {
            return;
        }
        const row = grid[y];
        if (!row || row[x] === undefined) {
            return;
        }
        const k = key(x, y);
        if (!original.has(k)) {
            original.set(k, row[x] ?? 0);
        }
        row[x] = 1;
    };

    for (const [id, record] of records) {
        if (excludeIds?.has(id)) {
            continue;
        }
        if (record.isDead === true) {
            continue;
        }
        if (!shouldBlock(record.kind)) {
            continue;
        }

        mark(record.gridX, record.gridY);

        if (record.isMoving) {
            const nx = record.nextGridX;
            const ny = record.nextGridY;
            if (Number.isInteger(nx) && Number.isInteger(ny) && (nx !== record.gridX || ny !== record.gridY)) {
                mark(nx, ny);
            }
        }
    }

    return () => {
        for (const [k, value] of original.entries()) {
            const [xs, ys] = k.split(',');
            const x = Number(xs);
            const y = Number(ys);
            if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
                continue;
            }
            const row = grid[y];
            if (!row || row[x] === undefined) {
                continue;
            }
            row[x] = value;
        }
        original.clear();
    };
}

