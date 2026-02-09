import { expect, test } from 'bun:test';
import UtilsEsm from '../../server/js/utils-esm';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Types = require('../../shared/js/gametypes');

test('esm utils sanitize escapes html and strips control chars', () => {
    const sanitized = UtilsEsm.sanitize("<script>\u0000'x'</script>");
    expect(sanitized).toBe('&lt;script&gt;&#39;x&#39;&lt;/script&gt;');
});

test('esm utils utf8 helpers enforce byte limits', () => {
    expect(UtilsEsm.utf8ByteLength('abc')).toBe(3);
    expect(UtilsEsm.hasMaxUtf8Bytes('abc', 3)).toBe(true);
    expect(UtilsEsm.hasMaxUtf8Bytes('abc', 2)).toBe(false);
    expect(UtilsEsm.limitUtf8Bytes('abcdef', 3)).toBe('abc');
});

test('esm utils randomOrientation returns a known orientation', () => {
    const orientation = UtilsEsm.randomOrientation();
    expect([
        Types.Orientations.LEFT,
        Types.Orientations.RIGHT,
        Types.Orientations.UP,
        Types.Orientations.DOWN,
    ]).toContain(orientation);
});
