import type {
    AdjacentGroupMap,
    OutgoingQueues,
    QueueGroup,
    QueuePlayer,
    TransportErrorLogger,
    WorldConnection,
} from './contracts';

export function pushSerializedToPlayerQueue(
    outgoingQueues: OutgoingQueues,
    player: QueuePlayer,
    serializedMessage: unknown,
    logError: TransportErrorLogger
): void {
    if (player && player.id in outgoingQueues) {
        const queue = outgoingQueues[player.id];
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
    groupId: string | number;
    serializedMessage: unknown;
    ignoredPlayer?: string | number | null;
    getEntityById(id: string | number): QueuePlayer;
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
            if (playerId != ignoredPlayer) {
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
    groupId: string | number;
    serializedMessage: unknown;
    ignoredPlayer?: string | number | null;
    getEntityById(id: string | number): QueuePlayer;
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
    ignoredPlayer: string | number | null = null
): void {
    for (const id in outgoingQueues) {
        if (id != ignoredPlayer) {
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
    for (const id in outgoingQueues) {
        const queue = outgoingQueues[id];
        if (!queue || queue.length === 0) {
            continue;
        }
        const connection = getConnection(id);
        if (!connection) {
            continue;
        }
        connection.send(queue);
        queue.length = 0;
    }
}
