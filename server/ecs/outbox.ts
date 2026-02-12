import type { EntityId } from '../../shared/domain/ids';
import type { ServerToClientProtocolAction } from '../../shared/protocol/types';
import { createResourceKey } from './resources';
import type { Queue } from './queues';

export type OutboxMessage =
    | Readonly<{
          kind: 'broadcast_nearby';
          actorId: EntityId;
          action: ServerToClientProtocolAction;
          ignoredPlayerId?: EntityId | null;
          fallbackGroupId?: string;
      }>
    | Readonly<{
          kind: 'to_player';
          playerId: EntityId;
          action: ServerToClientProtocolAction;
      }>;

export const OUTBOX_RESOURCE = createResourceKey<Queue<OutboxMessage>>('outbox');
