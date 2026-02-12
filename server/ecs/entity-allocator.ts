import {
    ENTITY_ID_MAX_GENERATION,
    ENTITY_ID_MAX_INDEX,
    entityIdGeneration,
    entityIdIndex,
    makeEntityId,
    type EntityId,
} from '../../shared/domain/ids';

export class EntityAllocator {
    // Index 0 is reserved (ENTITY_ID_NONE).
    #generations: number[] = [0];
    #alive: boolean[] = [false];
    #free: number[] = [];
    #nextIndex = 1;
    #aliveCount = 0;

    create(): EntityId {
        let index: number;
        if (this.#free.length > 0) {
            const reused = this.#free.pop();
            if (reused === undefined) {
                throw new Error('EntityAllocator: free list invariant violated');
            }
            index = reused;
        } else {
            while (this.#nextIndex <= ENTITY_ID_MAX_INDEX && this.#alive[this.#nextIndex]) {
                this.#nextIndex += 1;
            }
            index = this.#nextIndex;
            if (index > ENTITY_ID_MAX_INDEX) {
                throw new Error('EntityAllocator: exhausted EntityId index space');
            }
            this.#nextIndex += 1;
            if (this.#generations[index] === undefined) {
                this.#generations[index] = 0;
            }
        }

        this.#alive[index] = true;
        this.#aliveCount += 1;
        return makeEntityId(index, this.#generations[index] ?? 0);
    }

    // Makes a specific EntityId alive in this allocator (primarily for bridging legacy/wire ids into ECS).
    // Intended for sparse "adopt external id" usage; normal ECS code should prefer create()/destroy().
    ensureAlive(id: EntityId): void {
        const index = entityIdIndex(id);
        if (index === 0) {
            throw new Error('EntityAllocator.ensureAlive: cannot ensure ENTITY_ID_NONE');
        }
        if (index > ENTITY_ID_MAX_INDEX) {
            throw new Error('EntityAllocator.ensureAlive: invalid entity index');
        }

        const generation = entityIdGeneration(id);
        if (generation < 0 || generation > ENTITY_ID_MAX_GENERATION) {
            throw new Error('EntityAllocator.ensureAlive: invalid entity generation');
        }

        if (this.#alive[index]) {
            // Idempotent if the exact id is already alive.
            const expectedGeneration = this.#generations[index] ?? 0;
            if (expectedGeneration !== generation) {
                throw new Error('EntityAllocator.ensureAlive: stale EntityId generation');
            }
            return;
        }

        const expectedGeneration = this.#generations[index] ?? 0;
        if (expectedGeneration !== generation) {
            // Bridged ids may be re-used by legacy systems with the same numeric wire id. In that case we
            // allow "adopting" the requested generation as long as the entity is not currently alive.
            this.#generations[index] = generation;
        } else if (this.#generations[index] === undefined) {
            this.#generations[index] = expectedGeneration;
        }

        // Remove from free list if present (avoid create() reusing a now-claimed index).
        for (let i = 0; i < this.#free.length; i += 1) {
            if (this.#free[i] === index) {
                this.#free[i] = this.#free[this.#free.length - 1] as number;
                this.#free.pop();
                break;
            }
        }

        this.#alive[index] = true;
        this.#aliveCount += 1;
    }

    destroy(id: EntityId): void {
        const index = entityIdIndex(id);
        if (index === 0) {
            throw new Error('EntityAllocator.destroy: cannot destroy ENTITY_ID_NONE');
        }
        if (!this.#alive[index]) {
            throw new Error('EntityAllocator.destroy: entity is not alive');
        }

        const expectedGeneration = this.#generations[index] ?? 0;
        const idGeneration = entityIdGeneration(id);
        if (idGeneration !== expectedGeneration) {
            throw new Error('EntityAllocator.destroy: stale EntityId generation');
        }

        this.#alive[index] = false;
        this.#aliveCount -= 1;

        const nextGeneration = expectedGeneration === ENTITY_ID_MAX_GENERATION ? 0 : expectedGeneration + 1;
        this.#generations[index] = nextGeneration;
        this.#free.push(index);
    }

    isAlive(id: EntityId): boolean {
        const index = entityIdIndex(id);
        if (index === 0 || index > ENTITY_ID_MAX_INDEX) {
            return false;
        }
        if (!this.#alive[index]) {
            return false;
        }
        return (this.#generations[index] ?? 0) === entityIdGeneration(id);
    }

    get aliveCount(): number {
        return this.#aliveCount;
    }

    reset(): void {
        this.#generations = [0];
        this.#alive = [false];
        this.#free = [];
        this.#nextIndex = 1;
        this.#aliveCount = 0;
    }
}
