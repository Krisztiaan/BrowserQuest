import { entityIdIndex, type EntityId } from '../../shared/domain/ids';
import { ArchetypeIndex } from './archetype-index';
import { ComponentRegistry, componentBit, type ComponentType } from './component-registry';
import { EntityAllocator } from './entity-allocator';

export class EcsWorld {
    readonly entities = new EntityAllocator();
    readonly components = new ComponentRegistry();

    #archetypes = new ArchetypeIndex();
    // Tracks current component mask per entity index.
    #maskByIndex: bigint[] = [];
    #idByIndex: Array<EntityId | undefined> = [];

    createEntity(): EntityId {
        const id = this.entities.create();
        const index = entityIdIndex(id);
        this.#idByIndex[index] = id;
        this.#maskByIndex[index] = 0n;
        this.#archetypes.add(id, 0n);
        return id;
    }

    // Ensures an externally-defined EntityId exists in this ECS world.
    // This is primarily for bridging legacy/wire ids into ECS without re-numbering.
    ensureEntity(id: EntityId): EntityId {
        if (this.entities.isAlive(id)) {
            return id;
        }

        this.entities.ensureAlive(id);
        const index = entityIdIndex(id);
        const currentId = this.#idByIndex[index];
        if (currentId !== undefined && currentId !== id) {
            throw new Error('EcsWorld.ensureEntity: index already mapped to a different EntityId');
        }

        this.#idByIndex[index] = id;
        this.#maskByIndex[index] = 0n;
        this.#archetypes.add(id, 0n);
        return id;
    }

    destroyEntity(id: EntityId): void {
        if (!this.entities.isAlive(id)) {
            throw new Error('EcsWorld.destroyEntity: entity is not alive');
        }

        const index = entityIdIndex(id);
        const currentId = this.#idByIndex[index];
        if (currentId !== id) {
            throw new Error('EcsWorld.destroyEntity: stale EntityId for index');
        }

        const mask = this.#maskByIndex[index] ?? 0n;
        this.#archetypes.remove(id, mask);

        // Remove all components for this entity to keep store invariants and avoid leaks.
        for (const type of this.components.all()) {
            const bit = componentBit(type);
            if ((mask & bit) !== 0n) {
                (type.store).remove(id);
            }
        }

        this.#maskByIndex[index] = 0n;
        this.#idByIndex[index] = undefined;
        this.entities.destroy(id);
    }

    addComponent<T>(id: EntityId, type: ComponentType<T>, value: T): void {
        this.#assertAlive(id);
        const index = entityIdIndex(id);
        const prevMask = this.#maskByIndex[index] ?? 0n;
        const nextMask = prevMask | componentBit(type as unknown as ComponentType<unknown>);
        if (prevMask === nextMask) {
            type.store.set(id, value);
            return;
        }

        type.store.set(id, value);
        this.#maskByIndex[index] = nextMask;
        this.#archetypes.move(id, prevMask, nextMask);
    }

    removeComponent<T>(id: EntityId, type: ComponentType<T>): void {
        this.#assertAlive(id);
        const index = entityIdIndex(id);
        const prevMask = this.#maskByIndex[index] ?? 0n;
        const bit = componentBit(type as unknown as ComponentType<unknown>);
        const nextMask = prevMask & ~bit;
        if (prevMask === nextMask) {
            return;
        }

        type.store.remove(id);
        this.#maskByIndex[index] = nextMask;
        this.#archetypes.move(id, prevMask, nextMask);
    }

    getComponent<T>(id: EntityId, type: ComponentType<T>): T | undefined {
        this.#assertAlive(id);
        return type.store.get(id);
    }

    hasComponent<T>(id: EntityId, type: ComponentType<T>): boolean {
        this.#assertAlive(id);
        return type.store.has(id);
    }

    query(required: ReadonlyArray<ComponentType<unknown>>): EntityId[] {
        let requiredMask = 0n;
        for (const type of required) {
            requiredMask |= componentBit(type);
        }
        return this.#archetypes.query(requiredMask);
    }

    #assertAlive(id: EntityId): void {
        if (!this.entities.isAlive(id)) {
            throw new Error('EcsWorld: entity is not alive');
        }
    }
}
