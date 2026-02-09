import { expect, test } from 'bun:test';
import TypesCompat from '../../client/js-esm/compat/gametypes';
import TypesShared from '../../shared/js/gametypes-browser';

test('client gametypes compat re-exports shared ESM gametypes contract', () => {
    const sharedAsCompat = TypesShared as unknown as typeof TypesCompat;
    expect(TypesCompat).toBe(sharedAsCompat);
    expect(TypesCompat.Messages).toBe(sharedAsCompat.Messages);
    expect(TypesCompat.Entities).toBe(sharedAsCompat.Entities);
});
