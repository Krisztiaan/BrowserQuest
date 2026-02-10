import {
    pushSerializedBroadcastQueue,
    pushSerializedToAdjacentGroupsQueue,
    pushSerializedToGroupQueue,
    pushSerializedToPlayerQueue,
} from './worldserver-transport';
import { pushMessageToPreviouslyLeftGroups } from './worldserver-group-flow';
import type { WorldMessage } from './worldserver-contracts';
import type {
    AdjacentGroupMap,
    GetEntityById,
    IgnoredPlayer,
    OutgoingQueues,
    QueueGroup,
    QueuePlayer,
    TransportErrorLogger,
    WorldEntityId,
} from './worldserver-contracts';

type WorldGroups = Record<string, QueueGroup>;

type PushSerializedToGroup = (
    groupId: string,
    serializedMessage: unknown,
    ignoredPlayer: IgnoredPlayer
) => void;

type PushSerializedToAdjacentGroups = (
    groupId: string,
    serializedMessage: unknown,
    ignoredPlayer: IgnoredPlayer
) => void;

type PushSerializedToPlayer<TPlayer> = (player: TPlayer, serializedMessage: unknown) => void;
type PushToGroup = (groupId: string, message: WorldMessage) => void;

type PreviousGroupsPlayer = {
    recentlyLeftGroups?: string[];
};

type PushSerializedToWorldGroupQueueParams = {
    groups: WorldGroups;
    outgoingQueues: OutgoingQueues;
    groupId: WorldEntityId;
    serializedMessage: unknown;
    ignoredPlayer?: IgnoredPlayer;
    getEntityById: GetEntityById;
    logError: TransportErrorLogger;
};

type PushSerializedToWorldAdjacentGroupsQueueParams = {
    map: AdjacentGroupMap;
    groups: WorldGroups;
    outgoingQueues: OutgoingQueues;
    groupId: WorldEntityId;
    serializedMessage: unknown;
    ignoredPlayer?: IgnoredPlayer;
    getEntityById: GetEntityById;
    logError: TransportErrorLogger;
};

type PushWorldMessageToGroupParams = {
    groupId: string;
    message: WorldMessage;
    ignoredPlayer: IgnoredPlayer;
    pushSerializedToGroup: PushSerializedToGroup;
};

type PushWorldMessageToAdjacentGroupsParams = {
    groupId: string;
    message: WorldMessage;
    ignoredPlayer: IgnoredPlayer;
    pushSerializedToAdjacentGroups: PushSerializedToAdjacentGroups;
};

type PushWorldBroadcastMessageParams = {
    message: WorldMessage;
    ignoredPlayer: IgnoredPlayer;
    outgoingQueues: OutgoingQueues;
};

export function pushWorldMessageToPlayer<TPlayer>({
    player,
    message,
    pushSerializedToPlayer,
}: {
    player: TPlayer;
    message: WorldMessage;
    pushSerializedToPlayer: PushSerializedToPlayer<TPlayer>;
}): void {
    pushSerializedToPlayer(player, message.serialize());
}

export function pushSerializedToWorldPlayerQueue(
    outgoingQueues: OutgoingQueues,
    player: QueuePlayer,
    serializedMessage: unknown,
    logError: TransportErrorLogger
): void {
    pushSerializedToPlayerQueue(outgoingQueues, player, serializedMessage, logError);
}

export function pushSerializedToWorldGroupQueue({
    groups,
    outgoingQueues,
    groupId,
    serializedMessage,
    ignoredPlayer = null,
    getEntityById,
    logError,
}: PushSerializedToWorldGroupQueueParams): void {
    pushSerializedToGroupQueue({
        groups,
        outgoingQueues,
        groupId,
        serializedMessage,
        ignoredPlayer,
        getEntityById,
        logError,
    });
}

export function pushSerializedToWorldAdjacentGroupsQueue({
    map,
    groups,
    outgoingQueues,
    groupId,
    serializedMessage,
    ignoredPlayer = null,
    getEntityById,
    logError,
}: PushSerializedToWorldAdjacentGroupsQueueParams): void {
    pushSerializedToAdjacentGroupsQueue({
        map,
        groups,
        outgoingQueues,
        groupId,
        serializedMessage,
        ignoredPlayer,
        getEntityById,
        logError,
    });
}

export function pushWorldMessageToGroup({
    groupId,
    message,
    ignoredPlayer,
    pushSerializedToGroup,
}: PushWorldMessageToGroupParams): void {
    pushSerializedToGroup(groupId, message.serialize(), ignoredPlayer);
}

export function pushWorldMessageToAdjacentGroups({
    groupId,
    message,
    ignoredPlayer,
    pushSerializedToAdjacentGroups,
}: PushWorldMessageToAdjacentGroupsParams): void {
    pushSerializedToAdjacentGroups(groupId, message.serialize(), ignoredPlayer);
}

export function pushWorldMessageToPreviousGroups(
    player: PreviousGroupsPlayer | null | undefined,
    message: WorldMessage,
    pushToGroup: PushToGroup
): void {
    pushMessageToPreviouslyLeftGroups(player, (groupId) => {
        pushToGroup(groupId, message);
    });
}

export function pushWorldBroadcastMessage({
    message,
    ignoredPlayer,
    outgoingQueues,
}: PushWorldBroadcastMessageParams): void {
    pushSerializedBroadcastQueue(outgoingQueues, message.serialize(), ignoredPlayer);
}
