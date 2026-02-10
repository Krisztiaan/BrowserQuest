import { expect, test } from 'bun:test';
import Types from '../../shared/js/gametypes-esm';

test('shared gametypes module sets global contract', () => {
    expect(Types).toBeDefined();
    expect(globalThis.Types).toBe(Types);
    expect(Types.Messages.HELLO).toBe(0);
    expect(Types.Messages.ZONE).toBe(21);
});

test('shared gametypes ESM bridge exports canonical contract values', async () => {
    const esmModule = (await import('../../shared/js/gametypes-esm')) as {
        default: typeof Types;
        Types: typeof Types;
    };
    const ESMTypes = esmModule.default;

    expect(esmModule.Types).toBe(ESMTypes);
    expect(ESMTypes.Messages).toEqual(Types.Messages);
    expect(ESMTypes.Entities).toEqual(Types.Entities);
    expect(ESMTypes.Orientations).toEqual(Types.Orientations);
    expect(ESMTypes.getKindFromString('rat')).toBe(Types.getKindFromString('rat'));
    expect(ESMTypes.getKindAsString(Types.Entities.RAT)).toBe('rat');
});

test('shared browser gametypes module matches canonical contract values', async () => {
    const browserModule = (await import('../../shared/js/gametypes-browser')) as {
        default: typeof Types;
        Types: typeof Types;
    };
    const BrowserTypes = browserModule.default;

    expect(BrowserTypes).toBeDefined();
    expect(BrowserTypes).toBe(Types);
    expect(BrowserTypes.Messages).toEqual(Types.Messages);
    expect(BrowserTypes.Entities).toEqual(Types.Entities);
    expect(BrowserTypes.Orientations).toEqual(Types.Orientations);
    expect(BrowserTypes.getKindFromString('rat')).toBe(Types.getKindFromString('rat'));
    expect(BrowserTypes.getKindAsString(Types.Entities.RAT)).toBe('rat');
    expect(BrowserTypes.getMessageTypeAsString(Types.Messages.WELCOME)).toBe('WELCOME');
});
