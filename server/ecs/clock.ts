export class FixedClock {
    #nowMs: number;

    constructor(startMs = 0) {
        if (!Number.isFinite(startMs)) {
            throw new Error('FixedClock: startMs must be finite');
        }
        this.#nowMs = startMs;
    }

    nowMs(): number {
        return this.#nowMs;
    }

    advanceMs(deltaMs: number): void {
        if (!Number.isFinite(deltaMs)) {
            throw new Error('FixedClock.advanceMs: deltaMs must be finite');
        }
        this.#nowMs += deltaMs;
    }
}
