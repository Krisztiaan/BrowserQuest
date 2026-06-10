import { expect, test } from 'bun:test';
import { ConnectionIdGenerator } from '../../../server/ws/connection-id';

test('connection id generator emits unique monotonic ids', () => {
    const generator = new ConnectionIdGenerator();
    const seen = new Set<string>();

    for (let i = 0; i < 10_000; i += 1) {
        const id = generator.nextId();
        expect(seen.has(id)).toBe(false);
        seen.add(id);
    }

    expect(seen.size).toBe(10_000);
    expect(Number.parseInt([...seen][0] ?? '0', 10)).toBeGreaterThanOrEqual(500_000_000);
});

test('connection id generator throws when uint32 id space is exhausted', () => {
    const generator = new ConnectionIdGenerator(0xffff_ffff);
    expect(generator.nextId()).toBe('4294967295');
    expect(() => generator.nextId()).toThrow('ConnectionIdGenerator exhausted uint32 id space');
});
