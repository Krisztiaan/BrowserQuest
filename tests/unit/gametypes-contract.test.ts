import { expect, test } from 'bun:test';
import Types from '../../shared/js/gametypes';

test('shared gametypes module sets global contract', () => {
    expect(Types).toBeDefined();
    expect(globalThis.Types).toBe(Types);
    expect(Types.Messages.HELLO).toBe(0);
    expect(Types.Messages.ZONE).toBe(21);
});

test('shared gametypes canonical entrypoint exports contract values', async () => {
    const canonicalModule = (await import('../../shared/js/gametypes')) as {
        default: typeof Types;
        Types: typeof Types;
    };
    const canonicalTypes = canonicalModule.default;

    expect(canonicalModule.Types).toBe(canonicalTypes);
    expect(canonicalTypes.Messages).toEqual(Types.Messages);
    expect(canonicalTypes.Entities).toEqual(Types.Entities);
    expect(canonicalTypes.Orientations).toEqual(Types.Orientations);
    expect(canonicalTypes.getKindFromString('rat')).toBe(Types.getKindFromString('rat'));
    expect(canonicalTypes.getKindAsString(Types.Entities.RAT)).toBe('rat');
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
