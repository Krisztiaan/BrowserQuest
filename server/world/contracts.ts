import type { EntityId } from '../../shared/domain/ids';
import type { ServerToClientProtocolAction } from '../../shared/protocol/types';

export type WorldMessage = {
    serialize(): unknown;
} | ServerToClientProtocolAction;

export type WorldEntityId = EntityId;
export type IgnoredPlayer = WorldEntityId | null;

export type QueuePlayer = {
    id: WorldEntityId;
} | null | undefined;

export type QueueGroup = {
    players: Array<WorldEntityId>;
};

export type AdjacentGroupMap = {
    forEachAdjacentGroup(groupId: string, callback: (id: string) => void): void;
};

export type OutgoingQueues = Record<string, unknown[]>;
export type TransportErrorLogger = (message: string) => void;
export type GetEntityById = (id: WorldEntityId) => QueuePlayer;

export type WorldConnection = {
    send(payload: unknown): void;
};
