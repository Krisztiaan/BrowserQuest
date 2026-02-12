import type { EntityId } from '../../shared/domain/ids';
import type { ServerToClientProtocolAction } from '../../shared/protocol/types';

export type WorldMessage = {
    serialize(): unknown;
} | ServerToClientProtocolAction;

export type QueuePlayer = {
    id: EntityId;
} | null | undefined;

export type OutgoingQueues = Record<string, unknown[]>;
export type TransportErrorLogger = (message: string) => void;

export type WorldConnection = {
    send(payload: unknown): void;
};
