export type ResourceKey<T> = Readonly<{
    name: string;
    id: symbol;
    // Type-only phantom to preserve T through structural typing/inference.
    __type?: (value: T) => void;
}>;

export function createResourceKey<T>(name: string): ResourceKey<T> {
    return Object.freeze({ name, id: Symbol(name) }) as ResourceKey<T>;
}

export class WorldResources {
    #values = new Map<symbol, unknown>();

    set<T>(key: ResourceKey<T>, value: T): void {
        this.#values.set(key.id, value);
    }

    get<T>(key: ResourceKey<T>): T | undefined {
        return this.#values.get(key.id) as T | undefined;
    }

    require<T>(key: ResourceKey<T>): T {
        const value = this.get(key);
        if (value === undefined) {
            throw new Error(`WorldResources.require: missing resource: ${key.name}`);
        }
        return value as T;
    }

    has<T>(key: ResourceKey<T>): boolean {
        return this.#values.has(key.id);
    }

    delete<T>(key: ResourceKey<T>): void {
        this.#values.delete(key.id);
    }

    clear(): void {
        this.#values.clear();
    }
}
