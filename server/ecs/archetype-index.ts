import type { EntityId } from '../../shared/domain/ids';

export class ArchetypeIndex {
    #entitiesByMask = new Map<bigint, Set<EntityId>>();

    add(entityId: EntityId, mask: bigint): void {
        const set = this.#entitiesByMask.get(mask) ?? new Set<EntityId>();
        set.add(entityId);
        this.#entitiesByMask.set(mask, set);
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
    }

    query(requiredMask: bigint): EntityId[] {
        // Stable iteration semantics: snapshot + deterministic sort.
        const result: EntityId[] = [];
        for (const [mask, set] of this.#entitiesByMask.entries()) {
            if ((mask & requiredMask) === requiredMask) {
                for (const id of set) {
                    result.push(id);
                }
            }
        }
        result.sort((a, b) => (a as unknown as number) - (b as unknown as number));
        return result;
    }
}

