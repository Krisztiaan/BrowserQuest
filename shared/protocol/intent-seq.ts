export const INTENT_SEQ_INITIAL_LAST_ACCEPTED = -1;
export const INTENT_SEQ_DEFAULT_MAX_GAP = 2048;

export type IntentSeqDecision =
    | Readonly<{ kind: 'accept' }>
    | Readonly<{ kind: 'duplicate' }>
    | Readonly<{ kind: 'stale'; lastAccepted: number }>
    | Readonly<{ kind: 'gap'; lastAccepted: number; maxGap: number }>;

export function isValidIntentSeq(seq: number): boolean {
    return Number.isFinite(seq) && Number.isSafeInteger(seq) && seq >= 0;
}

export function nextIntentSeq(current: number): number {
    return current + 1;
}

export function classifyIntentSeq({
    seq,
    lastAccepted,
    maxGap = INTENT_SEQ_DEFAULT_MAX_GAP,
}: {
    seq: number;
    lastAccepted: number;
    maxGap?: number;
}): IntentSeqDecision {
    if (seq < lastAccepted) {
        return { kind: 'stale', lastAccepted };
    }
    if (seq === lastAccepted) {
        return { kind: 'duplicate' };
    }
    if (seq > lastAccepted + maxGap) {
        return { kind: 'gap', lastAccepted, maxGap };
    }
    return { kind: 'accept' };
}

export function formatIntentSeqRejectReason(seq: number, decision: IntentSeqDecision): string | null {
    if (decision.kind === 'stale') {
        return `Stale seq: ${seq} < ${decision.lastAccepted}`;
    }
    if (decision.kind === 'gap') {
        return `Seq gap too large: ${seq} > ${decision.lastAccepted} + ${decision.maxGap}`;
    }
    return null;
}
