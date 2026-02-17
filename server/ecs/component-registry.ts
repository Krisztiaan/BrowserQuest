import type { ComponentStore } from './component-store';
import type { EntityId } from '../../shared/domain/ids';

export type ComponentType<T> = Readonly<{
    id: number;
    name: string;
    store: ComponentStore<T>;
}>;

export type ComponentBitType = Readonly<{ id: number }>;
export type ComponentRegistryEntry = Readonly<{
    id: number;
    name: string;
    remove(id: EntityId): void;
}>;

export function componentBit(type: ComponentBitType): bigint {
    return 1n << BigInt(type.id);
}

export class ComponentRegistry {
    #nextId = 0;
    #types: ComponentRegistryEntry[] = [];
    #typesByName = new Map<string, ComponentRegistryEntry>();

    register<T>(name: string, store: ComponentStore<T>): ComponentType<T> {
        if (this.#typesByName.has(name)) {
            throw new Error(`ComponentRegistry.register: duplicate component name: ${name}`);
        }
        const type: ComponentType<T> = Object.freeze({
            id: this.#nextId++,
            name,
            store,
        });
        const entry: ComponentRegistryEntry = Object.freeze({
            id: type.id,
            name,
            remove(id: EntityId): void {
                store.remove(id);
            },
        });
        this.#types.push(entry);
        this.#typesByName.set(name, entry);
        return type;
    }

    all(): ReadonlyArray<ComponentRegistryEntry> {
        return this.#types;
    }
}
