import { entityIdToWire, type EntityId } from '../../shared/domain/ids';

export class ArchetypeIndex {
    #entitiesByMask = new Map<bigint, Set<EntityId>>();
    #mutationRevision = 0;
    #queryCache = new Map<bigint, Readonly<{ revision: number; ids: EntityId[] }>>();

    add(entityId: EntityId, mask: bigint): void {
        const set = this.#entitiesByMask.get(mask) ?? new Set<EntityId>();
        set.add(entityId);
        this.#entitiesByMask.set(mask, set);
        this.#mutationRevision += 1;
    }

    move(entityId: EntityId, prevMask: bigint, nextMask: bigint): void {
        if (prevMask === nextMask) {
            return;
        }
        this.remove(entityId, prevMask);
        this.add(entityId, nextMask);
    }

    remove(entityId: EntityId, mask: bigint): void {
        const set = this.#entitiesByMask.get(mask);
        if (!set) {
            return;
        }
        set.delete(entityId);
        if (set.size === 0) {
            this.#entitiesByMask.delete(mask);
        }
        this.#mutationRevision += 1;
    }

    query(requiredMask: bigint): EntityId[] {
        const cached = this.#queryCache.get(requiredMask);
        if (cached?.revision === this.#mutationRevision) {
            return cached.ids.slice();
        }

        // Stable iteration semantics: snapshot + deterministic sort.
        const ids: EntityId[] = [];
        for (const [mask, set] of this.#entitiesByMask.entries()) {
            if ((mask & requiredMask) !== requiredMask) {
                continue;
            }
            for (const id of set) {
                ids.push(id);
            }
        }
        ids.sort((a, b) => entityIdToWire(a) - entityIdToWire(b));
        this.#queryCache.set(requiredMask, { revision: this.#mutationRevision, ids });
        return ids.slice();
    }
}
