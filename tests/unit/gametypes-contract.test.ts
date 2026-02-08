import { expect, test } from 'bun:test';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Types = require('../../shared/js/gametypes');

test('shared gametypes keeps CJS export and global contract', () => {
    expect(Types).toBeDefined();
    expect(globalThis.Types).toBe(Types);
    expect(Types.Messages.HELLO).toBe(0);
    expect(Types.Messages.ZONE).toBe(21);
});

test('shared gametypes ESM bridge exports equivalent contract values', async () => {
    const esmModule = (await import('../../shared/js/gametypes-esm.mjs')) as {
        default: typeof Types;
        Types: typeof Types;
    };
    const ESMTypes = esmModule.default;

    expect(esmModule.Types).toBe(ESMTypes);
    expect(ESMTypes).not.toBe(Types);
    expect(ESMTypes.Messages).toEqual(Types.Messages);
    expect(ESMTypes.Entities).toEqual(Types.Entities);
    expect(ESMTypes.Orientations).toEqual(Types.Orientations);
    expect(ESMTypes.getKindFromString('rat')).toBe(Types.getKindFromString('rat'));
    expect(ESMTypes.getKindAsString(Types.Entities.RAT)).toBe('rat');
});

test('shared browser gametypes module matches CJS contract values', async () => {
    const browserModule = (await import('../../shared/js/gametypes-browser.mjs')) as {
        default: typeof Types;
        Types: typeof Types;
    };
    const BrowserTypes = browserModule.default;

    expect(BrowserTypes).toBeDefined();
    expect(BrowserTypes).not.toBe(Types);
    expect(BrowserTypes.Messages).toEqual(Types.Messages);
    expect(BrowserTypes.Entities).toEqual(Types.Entities);
    expect(BrowserTypes.Orientations).toEqual(Types.Orientations);
    expect(BrowserTypes.getKindFromString('rat')).toBe(Types.getKindFromString('rat'));
    expect(BrowserTypes.getKindAsString(Types.Entities.RAT)).toBe('rat');
    expect(BrowserTypes.getMessageTypeAsString(Types.Messages.WELCOME)).toBe('WELCOME');
});
