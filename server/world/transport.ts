import type {
    AdjacentGroupMap,
    OutgoingQueues,
    QueueGroup,
    QueuePlayer,
    TransportErrorLogger,
    WorldConnection,
} from './contracts';
import type { EntityId } from '../../shared/domain/ids';

export function pushSerializedToPlayerQueue(
    outgoingQueues: OutgoingQueues,
    player: QueuePlayer,
    serializedMessage: unknown,
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

type PushSerializedToGroupOptions = {
    groups: Record<string, QueueGroup>;
    outgoingQueues: OutgoingQueues;
    groupId: string;
    serializedMessage: unknown;
    ignoredPlayer?: EntityId | null;
    getEntityById(id: EntityId): QueuePlayer;
    logError: TransportErrorLogger;
};

export function pushSerializedToGroupQueue({
    groups,
    outgoingQueues,
    groupId,
    serializedMessage,
    ignoredPlayer = null,
    getEntityById,
    logError,
}: PushSerializedToGroupOptions): void {
        const group = groups[groupId];
    if (group) {
        group.players.forEach((playerId) => {
            if (playerId !== ignoredPlayer) {
                pushSerializedToPlayerQueue(
                    outgoingQueues,
                    getEntityById(playerId),
                    serializedMessage,
                    logError
                );
            }
        });
        return;
    }
    logError('groupId: ' + groupId + ' is not a valid group');
}

type PushSerializedToAdjacentGroupsOptions = {
    map: AdjacentGroupMap;
    groups: Record<string, QueueGroup>;
    outgoingQueues: OutgoingQueues;
    groupId: string;
    serializedMessage: unknown;
    ignoredPlayer?: EntityId | null;
    getEntityById(id: EntityId): QueuePlayer;
    logError: TransportErrorLogger;
};

export function pushSerializedToAdjacentGroupsQueue({
    map,
    groups,
    outgoingQueues,
    groupId,
    serializedMessage,
    ignoredPlayer = null,
    getEntityById,
    logError,
}: PushSerializedToAdjacentGroupsOptions): void {
    map.forEachAdjacentGroup(groupId, function (id) {
        pushSerializedToGroupQueue({
            groups,
            outgoingQueues,
            groupId: id,
            serializedMessage,
            ignoredPlayer,
            getEntityById,
            logError,
        });
    });
}

export function pushSerializedBroadcastQueue(
    outgoingQueues: OutgoingQueues,
    serializedMessage: unknown,
    ignoredPlayer: EntityId | null = null
): void {
    const ignoredKey = ignoredPlayer === null ? null : String(ignoredPlayer);
    for (const id in outgoingQueues) {
        if (ignoredKey === null || id !== ignoredKey) {
            const queue = outgoingQueues[id];
            if (queue) {
                queue.push(serializedMessage);
            }
        }
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
        while (queue.length > 0) {
            const chunk = queue.length > MAX_BATCH_ACTIONS ? queue.splice(0, MAX_BATCH_ACTIONS) : queue.splice(0);
            const payload = chunk.length === 1 ? chunk[0] : chunk;
            connection.send(payload);
        }
    }
}
