export type WorldMessage = {
    serialize(): unknown;
};

export type WorldEntityId = string | number;
export type IgnoredPlayer = WorldEntityId | null;

export type QueuePlayer = {
    id: WorldEntityId;
} | null | undefined;

export type QueueGroup = {
    players: Array<WorldEntityId>;
};

export type AdjacentGroupMap = {
    forEachAdjacentGroup(groupId: WorldEntityId, callback: (id: string) => void): void;
};

export type OutgoingQueues = Record<string, unknown[]>;
export type TransportErrorLogger = (message: string) => void;
export type GetEntityById = (id: WorldEntityId) => QueuePlayer;

export type WorldConnection = {
    send(payload: unknown): void;
};
