import type { EntityId } from '../../shared/domain/ids';
import type { ServerToClientProtocolAction } from '../../shared/protocol/types';
import type { OutgoingQueues, WorldMessage } from './contracts';

export function serializeWorldMessage(message: WorldMessage): ServerToClientProtocolAction {
    return Array.isArray(message) ? message : message.serialize();
}

export function pushSerializedToPlayerIdQueue(
    outgoingQueues: OutgoingQueues,
    playerId: EntityId,
    serializedMessage: ServerToClientProtocolAction
): void {
    const key = String(playerId);
    const queue = outgoingQueues[key];
    if (!queue) {
        return;
    }
    queue.push(serializedMessage);
}

export function pushSerializedBroadcastQueue(
    outgoingQueues: OutgoingQueues,
    serializedMessage: ServerToClientProtocolAction,
    ignoredPlayerId: EntityId | null
): void {
    const ignoredKey = ignoredPlayerId === null ? null : String(ignoredPlayerId);

    for (const id in outgoingQueues) {
        if (ignoredKey !== null && id === ignoredKey) {
            continue;
        }
        const queue = outgoingQueues[id];
        if (queue) {
            queue.push(serializedMessage);
        }
    }
}
