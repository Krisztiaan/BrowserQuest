import { entityIdIndex, type EntityId } from '../../shared/domain/ids';
import { gridPos, type GridPos } from '../../shared/domain/positions';

export interface ComponentStore<T> {
    has(id: EntityId): boolean;
    get(id: EntityId): T | undefined;
    set(id: EntityId, value: T): void;
    remove(id: EntityId): void;
    clear(): void;
    forEach(callback: (id: EntityId, value: T) => void): void;
    get size(): number;
}

export class SparseSetStore<T> implements ComponentStore<T> {
    #denseIds: EntityId[] = [];
    #denseValues: T[] = [];
    // Maps entity index -> dense position + 1. Zero means absent.
    #sparse: number[] = [];

    get size(): number {
        return this.#denseIds.length;
    }

    has(id: EntityId): boolean {
        const index = entityIdIndex(id);
        const densePosPlusOne = this.#sparse[index] ?? 0;
        if (densePosPlusOne === 0) {
            return false;
        }
        const densePos = densePosPlusOne - 1;
        return this.#denseIds[densePos] === id;
    }

    get(id: EntityId): T | undefined {
        const index = entityIdIndex(id);
        const densePosPlusOne = this.#sparse[index] ?? 0;
        if (densePosPlusOne === 0) {
            return undefined;
        }
        const densePos = densePosPlusOne - 1;
        if (this.#denseIds[densePos] !== id) {
            return undefined;
        }
        return this.#denseValues[densePos];
    }

    set(id: EntityId, value: T): void {
        const index = entityIdIndex(id);
        const densePosPlusOne = this.#sparse[index] ?? 0;
        if (densePosPlusOne !== 0) {
            const densePos = densePosPlusOne - 1;
            const existingId = this.#denseIds[densePos];
            if (existingId !== id) {
                // Same index with a different generation indicates a stale component that should have been removed
                // as part of the entity destroy path.
                throw new Error('SparseSetStore.set: stale component for reused entity index');
            }
            this.#denseValues[densePos] = value;
            return;
        }

        const nextPos = this.#denseIds.length;
        this.#denseIds.push(id);
        this.#denseValues.push(value);
        this.#sparse[index] = nextPos + 1;
    }

    remove(id: EntityId): void {
        const index = entityIdIndex(id);
        const densePosPlusOne = this.#sparse[index] ?? 0;
        if (densePosPlusOne === 0) {
            return;
        }
        const densePos = densePosPlusOne - 1;
        if (this.#denseIds[densePos] !== id) {
            return;
        }

        const lastPos = this.#denseIds.length - 1;
        if (densePos !== lastPos) {
            const lastId = this.#denseIds[lastPos];
            const lastValue = this.#denseValues[lastPos];
            if (lastId === undefined || lastValue === undefined) {
                throw new Error('SparseSetStore.remove: dense array invariant violated');
            }
            this.#denseIds[densePos] = lastId;
            this.#denseValues[densePos] = lastValue;
            this.#sparse[entityIdIndex(lastId)] = densePos + 1;
        }

        this.#denseIds.pop();
        this.#denseValues.pop();
        this.#sparse[index] = 0;
    }

    clear(): void {
        this.#denseIds = [];
        this.#denseValues = [];
        this.#sparse = [];
    }

    forEach(callback: (id: EntityId, value: T) => void): void {
        for (let i = 0; i < this.#denseIds.length; i += 1) {
            const id = this.#denseIds[i];
            const value = this.#denseValues[i];
            if (id !== undefined && value !== undefined) {
                callback(id, value);
            }
        }
    }
}

export class SoaGridPosStore implements ComponentStore<GridPos> {
    #denseIds: EntityId[] = [];
    #denseX: number[] = [];
    #denseY: number[] = [];
    #sparse: number[] = [];

    get size(): number {
        return this.#denseIds.length;
    }

    has(id: EntityId): boolean {
        const index = entityIdIndex(id);
        const densePosPlusOne = this.#sparse[index] ?? 0;
        if (densePosPlusOne === 0) {
            return false;
        }
        const densePos = densePosPlusOne - 1;
        return this.#denseIds[densePos] === id;
    }

    get(id: EntityId): GridPos | undefined {
        const index = entityIdIndex(id);
        const densePosPlusOne = this.#sparse[index] ?? 0;
        if (densePosPlusOne === 0) {
            return undefined;
        }
        const densePos = densePosPlusOne - 1;
        if (this.#denseIds[densePos] !== id) {
            return undefined;
        }
        const x = this.#denseX[densePos];
        const y = this.#denseY[densePos];
        if (x === undefined || y === undefined) {
            return undefined;
        }
        return gridPos(x, y);
    }

    set(id: EntityId, value: GridPos): void {
        const index = entityIdIndex(id);
        const densePosPlusOne = this.#sparse[index] ?? 0;
        if (densePosPlusOne !== 0) {
            const densePos = densePosPlusOne - 1;
            const existingId = this.#denseIds[densePos];
            if (existingId !== id) {
                throw new Error('SoaGridPosStore.set: stale component for reused entity index');
            }
            this.#denseX[densePos] = value.x;
            this.#denseY[densePos] = value.y;
            return;
        }

        const nextPos = this.#denseIds.length;
        this.#denseIds.push(id);
        this.#denseX.push(value.x);
        this.#denseY.push(value.y);
        this.#sparse[index] = nextPos + 1;
    }

    remove(id: EntityId): void {
        const index = entityIdIndex(id);
        const densePosPlusOne = this.#sparse[index] ?? 0;
        if (densePosPlusOne === 0) {
            return;
        }
        const densePos = densePosPlusOne - 1;
        if (this.#denseIds[densePos] !== id) {
            return;
        }

        const lastPos = this.#denseIds.length - 1;
        if (densePos !== lastPos) {
            const lastId = this.#denseIds[lastPos];
            if (lastId === undefined) {
                throw new Error('SoaGridPosStore.remove: dense array invariant violated');
            }
            this.#denseIds[densePos] = lastId;
            this.#denseX[densePos] = this.#denseX[lastPos] as number;
            this.#denseY[densePos] = this.#denseY[lastPos] as number;
            this.#sparse[entityIdIndex(lastId)] = densePos + 1;
        }

        this.#denseIds.pop();
        this.#denseX.pop();
        this.#denseY.pop();
        this.#sparse[index] = 0;
    }

    clear(): void {
        this.#denseIds = [];
        this.#denseX = [];
        this.#denseY = [];
        this.#sparse = [];
    }

    forEach(callback: (id: EntityId, value: GridPos) => void): void {
        for (let i = 0; i < this.#denseIds.length; i += 1) {
            const id = this.#denseIds[i];
            const x = this.#denseX[i];
            const y = this.#denseY[i];
            if (id !== undefined && x !== undefined && y !== undefined) {
                callback(id, gridPos(x, y));
            }
        }
    }
}
