import type { ComponentStore } from './component-store';

export type ComponentType<T> = Readonly<{
    id: number;
    name: string;
    store: ComponentStore<T>;
}>;

export function componentBit(type: ComponentType<unknown>): bigint {
    return 1n << BigInt(type.id);
}

export class ComponentRegistry {
    #nextId = 0;
    #types: ComponentType<unknown>[] = [];
    #typesByName = new Map<string, ComponentType<unknown>>();

    register<T>(name: string, store: ComponentStore<T>): ComponentType<T> {
        if (this.#typesByName.has(name)) {
            throw new Error(`ComponentRegistry.register: duplicate component name: ${name}`);
        }
        const type: ComponentType<T> = Object.freeze({
            id: this.#nextId++,
            name,
            store,
        });
        this.#types.push(type as unknown as ComponentType<unknown>);
        this.#typesByName.set(name, type as unknown as ComponentType<unknown>);
        return type;
    }

    all(): ReadonlyArray<ComponentType<unknown>> {
        return this.#types;
    }
}

