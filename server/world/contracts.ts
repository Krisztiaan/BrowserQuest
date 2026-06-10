import type { EntityId } from '../../shared/domain/ids';
import type { ServerToClientProtocolAction } from '../../shared/protocol/types';

export type WorldMessage =
    | {
          serialize(): ServerToClientProtocolAction;
      }
    | ServerToClientProtocolAction;

export type QueuePlayer =
    | {
          id: EntityId;
      }
    | null
    | undefined;

export type OutgoingQueues = Record<string, ServerToClientProtocolAction[]>;
export type TransportErrorLogger = (message: string) => void;

export type WorldConnection = {
    send(payload: ServerToClientProtocolAction | ServerToClientProtocolAction[]): void;
};
