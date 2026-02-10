import { expect, test } from 'bun:test';
import Utils from '../../server/js/utils';
import Types from '../../shared/js/gametypes';

test('esm utils sanitize escapes html and strips control chars', () => {
    const sanitized = Utils.sanitize("<script>\u0000'x'</script>");
    expect(sanitized).toBe('&lt;script&gt;&#39;x&#39;&lt;/script&gt;');
});

test('esm utils utf8 helpers enforce byte limits', () => {
    expect(Utils.utf8ByteLength('abc')).toBe(3);
    expect(Utils.hasMaxUtf8Bytes('abc', 3)).toBe(true);
    expect(Utils.hasMaxUtf8Bytes('abc', 2)).toBe(false);
    expect(Utils.limitUtf8Bytes('abcdef', 3)).toBe('abc');
});

test('esm utils randomOrientation returns a known orientation', () => {
    const orientation = Utils.randomOrientation();
    expect([
        Types.Orientations.LEFT,
        Types.Orientations.RIGHT,
        Types.Orientations.UP,
        Types.Orientations.DOWN,
    ]).toContain(orientation);
});
