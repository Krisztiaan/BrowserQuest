import type { OutgoingQueues, QueuePlayer, TransportErrorLogger, WorldConnection } from './contracts';
import type { ServerToClientProtocolAction } from '../../shared/protocol/types';

export function pushSerializedToPlayerQueue(
    outgoingQueues: OutgoingQueues,
    player: QueuePlayer,
    serializedMessage: ServerToClientProtocolAction,
    logError: TransportErrorLogger
): void {
    const key = String(player?.id ?? '');
    if (player && key in outgoingQueues) {
        const queue = outgoingQueues[key];
        if (queue) {
            queue.push(serializedMessage);
        }
    } else {
        logError('pushToPlayer: player was undefined');
    }
}

export function flushOutgoingQueues(
    outgoingQueues: OutgoingQueues,
    getConnection: (id: string) => WorldConnection | undefined
): void {
    const MAX_BATCH_ACTIONS = 50;

    for (const id in outgoingQueues) {
        const queue = outgoingQueues[id];
        if (!queue || queue.length === 0) {
            continue;
        }
        const connection = getConnection(id);
        if (!connection) {
            continue;
        }

        // Avoid single huge JSON.stringify() calls that can stall the event loop (especially when a player
        // receives many SPAWN actions at once). Chunk into smaller batches to keep handshake/ticks responsive.
        if (queue.length <= MAX_BATCH_ACTIONS) {
            if (queue.length === 1) {
                const payload = queue[0];
                if (payload !== undefined) {
                    connection.send(payload);
                }
            } else {
                connection.send(queue.slice());
            }
            queue.length = 0;
            continue;
        }

        const queueLength = queue.length;
        for (let batchStart = 0; batchStart < queueLength; batchStart += MAX_BATCH_ACTIONS) {
            const batchEnd = Math.min(batchStart + MAX_BATCH_ACTIONS, queueLength);
            const batch: ServerToClientProtocolAction[] = [];
            for (let i = batchStart; i < batchEnd; i += 1) {
                const payload = queue[i];
                if (payload === undefined) {
                    continue;
                }
                batch.push(payload);
            }
            if (batch.length === 0) {
                continue;
            }
            if (batch.length === 1) {
                const single = batch[0];
                if (single !== undefined) {
                    connection.send(single);
                }
                continue;
            }
            connection.send(batch);
        }
        queue.length = 0;
    }
}
