import { beforeEach, afterEach, expect, test } from 'bun:test';
import { check as checkEsm, FormatChecker as FormatCheckerEsm } from '../../server/js/format-esm';
import { ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1, MSG_CHAT, MSG_HELLO, MSG_MOVE, MSG_WHO } from '../support/protocol';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const FormatCjs = require('../../server/js/format');
const originalConsoleError = console.error;

beforeEach(() => {
    console.error = () => {
        // silence unknown-type noise in parity checks
    };
});

afterEach(() => {
    console.error = originalConsoleError;
});

test('esm format checker matches cjs checker for representative actions', () => {
    const samples: unknown[][] = [
        [MSG_HELLO, 'player', ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1],
        [MSG_MOVE, 12, 9],
        [MSG_CHAT, 'hello'],
        [MSG_WHO, 1001, 1002],
        [MSG_WHO, 'bad'],
        [MSG_MOVE, 12.5, 9],
    ];

    samples.forEach((sample) => {
        expect(checkEsm(sample)).toBe(FormatCjs.check(sample));
    });
});

test('esm format checker class instance validates payloads', () => {
    const checker = new FormatCheckerEsm();

    expect(checker.check([MSG_HELLO, 'player', ENTITY_CLOTH_ARMOR, ENTITY_SWORD_1])).toBe(true);
    expect(checker.check([MSG_MOVE, 3, 4])).toBe(true);
    expect(checker.check([MSG_MOVE, 3.25, 4])).toBe(false);
});
