export class XorShift32 {
    #state: number;

    constructor(seed: number) {
        if (!Number.isInteger(seed)) {
            throw new Error('XorShift32: seed must be an integer');
        }
        // xorshift32 has a bad all-zero state; perturb it deterministically.
        const s = seed >>> 0 || 0x6d2b79f5;
        this.#state = s;
    }

    nextU32(): number {
        // xorshift32
        let x = this.#state;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.#state = x >>> 0;
        return this.#state;
    }

    nextInt(maxExclusive: number): number {
        if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
            throw new Error('XorShift32.nextInt: maxExclusive must be a positive integer');
        }
        return this.nextU32() % maxExclusive;
    }
}
