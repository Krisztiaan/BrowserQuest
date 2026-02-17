import { expect, test } from 'bun:test';
import {
    classifyIntentSeq,
    formatIntentSeqRejectReason,
    INTENT_SEQ_DEFAULT_MAX_GAP,
    INTENT_SEQ_INITIAL_LAST_ACCEPTED,
    isValidIntentSeq,
    nextIntentSeq,
} from '../../../shared/protocol/intent-seq';

test('intent seq validation accepts non-negative safe integers', () => {
    expect(isValidIntentSeq(0)).toBe(true);
    expect(isValidIntentSeq(1)).toBe(true);
    expect(isValidIntentSeq(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isValidIntentSeq(-1)).toBe(false);
    expect(isValidIntentSeq(1.5)).toBe(false);
});

test('nextIntentSeq increments monotonically', () => {
    expect(nextIntentSeq(1)).toBe(2);
    expect(nextIntentSeq(99)).toBe(100);
});

test('classifyIntentSeq yields expected decisions', () => {
    expect(
        classifyIntentSeq({
            seq: 0,
            lastAccepted: INTENT_SEQ_INITIAL_LAST_ACCEPTED,
            maxGap: INTENT_SEQ_DEFAULT_MAX_GAP,
        })
    ).toEqual({ kind: 'accept' });

    expect(classifyIntentSeq({ seq: 8, lastAccepted: 8 })).toEqual({ kind: 'duplicate' });
    expect(classifyIntentSeq({ seq: 7, lastAccepted: 8 })).toEqual({ kind: 'stale', lastAccepted: 8 });
    expect(classifyIntentSeq({ seq: 12, lastAccepted: 8, maxGap: 2 })).toEqual({ kind: 'gap', lastAccepted: 8, maxGap: 2 });
});

test('formatIntentSeqRejectReason formats stale/gap reasons', () => {
    expect(formatIntentSeqRejectReason(7, { kind: 'stale', lastAccepted: 8 })).toBe('Stale seq: 7 < 8');
    expect(formatIntentSeqRejectReason(12, { kind: 'gap', lastAccepted: 8, maxGap: 2 })).toBe('Seq gap too large: 12 > 8 + 2');
    expect(formatIntentSeqRejectReason(8, { kind: 'duplicate' })).toBeNull();
    expect(formatIntentSeqRejectReason(9, { kind: 'accept' })).toBeNull();
});
