import { expect, test } from 'bun:test';
import Types from '../../shared/gametypes-browser';

test('shared gametypes module sets global contract', () => {
    expect(Types).toBeDefined();
    expect(globalThis.Types).toBe(Types);
    expect(Types.Messages.HELLO).toBe(0);
    expect(Types.Messages.ZONE).toBe(21);
});

test('shared browser gametypes module matches canonical contract values', async () => {
    const browserModule = (await import('../../shared/gametypes-browser'));
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
