import type { EntityId } from '../../shared/domain/ids';
import { createResourceKey } from './resources';

export type IntentSeqState = Readonly<{
    lastAcceptedByPlayerId: Map<EntityId, number>;
}>;

export const INTENT_SEQ_STATE_RESOURCE = createResourceKey<IntentSeqState>('intent_seq_state');

export function createIntentSeqState(): IntentSeqState {
    return { lastAcceptedByPlayerId: new Map() };
}

