import { entityIdToWire, type EntityId } from '../../shared/domain/ids';
import { gridPosKey, type GridPos } from '../../shared/domain/positions';

export class SpatialIndex {
    #cells = new Map<string, Set<EntityId>>();

    clear(): void {
        this.#cells.clear();
    }

    insert(id: EntityId, pos: GridPos): void {
        const key = gridPosKey(pos);
        const set = this.#cells.get(key) ?? new Set<EntityId>();
        set.add(id);
        this.#cells.set(key, set);
    }

    remove(id: EntityId, pos: GridPos): void {
        const key = gridPosKey(pos);
        const set = this.#cells.get(key);
        if (!set) {
            return;
        }
        set.delete(id);
        if (set.size === 0) {
            this.#cells.delete(key);
        }
    }

    queryRadius(center: GridPos, radius: number): EntityId[] {
        if (!Number.isInteger(radius) || radius < 0) {
            throw new Error('SpatialIndex.queryRadius: radius must be a non-negative integer');
        }

        const result = new Set<EntityId>();
        const minX = center.x - radius;
        const maxX = center.x + radius;
        const minY = center.y - radius;
        const maxY = center.y + radius;

        for (let x = minX; x <= maxX; x += 1) {
            for (let y = minY; y <= maxY; y += 1) {
                const key = `${x},${y}`;
                const cell = this.#cells.get(key);
                if (!cell) {
                    continue;
                }
                for (const id of cell) {
                    result.add(id);
                }
            }
        }

        const ids = Array.from(result);
        ids.sort((a, b) => entityIdToWire(a) - entityIdToWire(b));
        return ids;
    }
}
