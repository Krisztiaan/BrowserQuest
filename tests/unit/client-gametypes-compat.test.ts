// @ts-nocheck
import { expect, test } from 'bun:test';
import TypesCompat from '../../client/js-esm/compat/gametypes';
import TypesShared from '../../shared/js/gametypes-browser';

test('client gametypes compat re-exports shared ESM gametypes contract', () => {
    expect(TypesCompat).toBe(TypesShared);
    expect(TypesCompat.Messages).toBe(TypesShared.Messages);
    expect(TypesCompat.Entities).toBe(TypesShared.Entities);
});
