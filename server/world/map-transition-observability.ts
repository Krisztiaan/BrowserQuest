import type { EntityId } from '../../shared/domain/ids';

export const MAP_TRANSITION_REJECT_REASONS = [
    'invalid_destination',
    'destination_occupied',
    'player_missing',
    'invalid_transition_payload',
] as const;

export type MapTransitionRejectReason = (typeof MAP_TRANSITION_REJECT_REASONS)[number];

type BaseMapTransitionEvent = Readonly<{
    playerId: EntityId;
    fromMapId: string;
    toMapId: string;
    toX: number;
    toY: number;
}>;

export type MapTransitionBeginEvent = BaseMapTransitionEvent & Readonly<{ kind: 'begin' }>;
export type MapTransitionCommitEvent = BaseMapTransitionEvent & Readonly<{ kind: 'commit' }>;
export type MapTransitionRejectEvent = BaseMapTransitionEvent &
    Readonly<{
        kind: 'reject';
        reason: MapTransitionRejectReason;
        destinationOccupantId?: EntityId;
    }>;

export type MapTransitionEvent = MapTransitionBeginEvent | MapTransitionCommitEvent | MapTransitionRejectEvent;

export type MapTransitionEventSink = Readonly<{
    recordMapTransitionEvent?: (event: MapTransitionEvent) => void;
}>;

export function recordMapTransitionEvent(
    target: MapTransitionEventSink | null | undefined,
    event: MapTransitionEvent
): void {
    target?.recordMapTransitionEvent?.(event);
}
