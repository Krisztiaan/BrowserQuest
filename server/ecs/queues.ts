export class Queue<T> {
    #items: T[] = [];

    push(item: T): void {
        this.#items.push(item);
    }

    drain(): T[] {
        const items = this.#items;
        this.#items = [];
        return items;
    }

    get size(): number {
        return this.#items.length;
    }
}
