import { expect, test } from 'bun:test';
import { AUDIO_SOUND_KEYS, CURSOR_KEYS, MUSIC_KEYS, POPUP_TYPES, SPRITE_KEYS } from '../../client/asset-key-domain';

test('asset key domain inventories are deterministic and non-empty', () => {
    expect(CURSOR_KEYS).toEqual(['hand', 'sword', 'loot', 'target', 'arrow', 'talk']);
    expect(POPUP_TYPES).toEqual(['twitter']);

    expect(AUDIO_SOUND_KEYS.includes('achievement')).toBe(true);
    expect(AUDIO_SOUND_KEYS.includes('kill2')).toBe(true);
    expect(MUSIC_KEYS.includes('village')).toBe(true);
    expect(MUSIC_KEYS.includes('boss')).toBe(true);
    expect(SPRITE_KEYS.includes('firefox')).toBe(true);
    expect(SPRITE_KEYS.includes('item-firepotion')).toBe(true);
    expect(SPRITE_KEYS.length).toBeGreaterThan(50);
});
