import { expect, test } from 'bun:test';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Types = require('../../shared/js/gametypes');

test('shared gametypes keeps CJS export and global contract', () => {
    expect(Types).toBeDefined();
    expect(globalThis.Types).toBe(Types);
    expect(Types.Messages.HELLO).toBe(0);
    expect(Types.Messages.ZONE).toBe(21);
});

test('shared gametypes ESM bridge exports the same contract object', async () => {
    const esmModule = (await import('../../shared/js/gametypes-esm.mjs')) as {
        default: typeof Types;
        Types: typeof Types;
    };

    expect(esmModule.default).toBe(Types);
    expect(esmModule.Types).toBe(Types);
});
