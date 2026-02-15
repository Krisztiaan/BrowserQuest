const UINT32_MAX = 0xffff_ffff;
const CONNECTION_ID_BASE = 500_000_000;

export class ConnectionIdGenerator {
    #next: number;

    constructor(startAt: number = CONNECTION_ID_BASE) {
        if (!Number.isInteger(startAt) || startAt < 1 || startAt > UINT32_MAX) {
            throw new Error(`Invalid connection id start value: ${String(startAt)}`);
        }
        this.#next = startAt;
    }

    nextId(): string {
        if (this.#next > UINT32_MAX) {
            throw new Error('ConnectionIdGenerator exhausted uint32 id space');
        }

        const id = this.#next;
        this.#next += 1;
        return String(id);
    }
}

