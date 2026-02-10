type GroupState = {
    entities: Record<string, unknown>;
    players: Array<string | number>;
};

type GroupsById = Record<string, GroupState>;

type GroupAssignableEntity = {
    id: string | number;
    group: string | null;
};

type ForEachAdjacentGroup = (groupId: string, callback: (id: string) => void) => void;
type IsPlayerEntity = (entity: GroupAssignableEntity) => boolean;

type AddEntityToWorldGroupParams = {
    entity: GroupAssignableEntity | null | undefined;
    groupId: string | null | undefined;
    groups: GroupsById;
    forEachAdjacentGroup: ForEachAdjacentGroup;
    isPlayerEntity: IsPlayerEntity;
};

type IncomingEntity = {
    id: string | number;
};

type IncomingGroupState = {
    entities: Record<string, unknown>;
    incoming: unknown[];
};

type IncomingGroupsById = Record<string, IncomingGroupState | undefined>;

type AddEntityAsIncomingToGroupsParams = {
    entity: IncomingEntity | null | undefined;
    groupId: string | null | undefined;
    groups: IncomingGroupsById;
    forEachAdjacentGroup: ForEachAdjacentGroup;
    isChestEntity: boolean;
    isItemEntity: boolean;
    isDroppedItemEntity: boolean;
};

type GroupedEntity = {
    id: string | number;
    group: string | null;
};

type RemoveEntityFromWorldGroupsParams = {
    entity: GroupedEntity | null | undefined;
    groups: GroupsById;
    forEachAdjacentGroup: ForEachAdjacentGroup;
    isPlayerEntity: IsPlayerEntity;
};

type GroupMembershipEntity = {
    x: number;
    y: number;
    group: string | null;
    recentlyLeftGroups?: string[];
};

type ResolveGroupIdFromPosition = (x: number, y: number) => string;
type AddAsIncomingToGroup = (entity: GroupMembershipEntity, groupId: string) => void;
type RemoveFromGroups = (entity: GroupMembershipEntity) => string[];
type AddToGroup = (entity: GroupMembershipEntity, groupId: string) => string[];
type LogDebug = (message: string) => void;

type HandleWorldEntityGroupMembershipParams = {
    entity: GroupMembershipEntity | null | undefined;
    resolveGroupIdFromPosition: ResolveGroupIdFromPosition;
    addAsIncomingToGroup: AddAsIncomingToGroup;
    removeFromGroups: RemoveFromGroups;
    addToGroup: AddToGroup;
    logDebug: LogDebug;
};

type LogWorldGroupPlayersParams = {
    groupId: string;
    groups: GroupsById;
    logDebug: LogDebug;
};

export function addEntityToWorldGroup({
    entity,
    groupId,
    groups,
    forEachAdjacentGroup,
    isPlayerEntity,
}: AddEntityToWorldGroupParams): string[] {
    const newGroups: string[] = [];

    if (entity && groupId && groupId in groups) {
        forEachAdjacentGroup(groupId, (adjacentGroupId) => {
            groups[adjacentGroupId].entities[entity.id] = entity;
            newGroups.push(adjacentGroupId);
        });
        entity.group = groupId;

        if (isPlayerEntity(entity)) {
            groups[groupId].players.push(entity.id);
        }
    }

    return newGroups;
}

export function addEntityAsIncomingToGroups({
    entity,
    groupId,
    groups,
    forEachAdjacentGroup,
    isChestEntity,
    isItemEntity,
    isDroppedItemEntity,
}: AddEntityAsIncomingToGroupsParams): void {
    if (entity && groupId) {
        forEachAdjacentGroup(groupId, (adjacentGroupId) => {
            const group = groups[adjacentGroupId];

            if (group) {
                if (
                    !(entity.id in group.entities)
                    && (!isItemEntity || isChestEntity || (isItemEntity && !isDroppedItemEntity))
                ) {
                    group.incoming.push(entity);
                }
            }
        });
    }
}

export function removeEntityFromWorldGroups({
    entity,
    groups,
    forEachAdjacentGroup,
    isPlayerEntity,
}: RemoveEntityFromWorldGroupsParams): string[] {
    const oldGroups: string[] = [];

    if (entity && entity.group) {
        const group = groups[entity.group];
        if (isPlayerEntity(entity)) {
            for (let index = group.players.length - 1; index >= 0; index -= 1) {
                if (group.players[index] === entity.id) {
                    group.players.splice(index, 1);
                }
            }
        }

        forEachAdjacentGroup(entity.group, (groupId) => {
            if (entity.id in groups[groupId].entities) {
                delete groups[groupId].entities[entity.id];
                oldGroups.push(groupId);
            }
        });
        entity.group = null;
    }

    return oldGroups;
}

export function handleWorldEntityGroupMembership({
    entity,
    resolveGroupIdFromPosition,
    addAsIncomingToGroup,
    removeFromGroups,
    addToGroup,
    logDebug,
}: HandleWorldEntityGroupMembershipParams): boolean {
    let hasChangedGroups = false;
    if (entity) {
        const groupId = resolveGroupIdFromPosition(entity.x, entity.y);
        if (!entity.group || (entity.group && entity.group !== groupId)) {
            hasChangedGroups = true;
            addAsIncomingToGroup(entity, groupId);
            const oldGroups = removeFromGroups(entity);
            const newGroups = addToGroup(entity, groupId);

            if (oldGroups.length > 0) {
                const remaining: string[] = [];
                for (let index = 0; index < oldGroups.length; index += 1) {
                    const oldGroupId = oldGroups[index];
                    if (!newGroups.includes(oldGroupId)) {
                        remaining.push(oldGroupId);
                    }
                }
                entity.recentlyLeftGroups = remaining;
                logDebug('group diff: ' + entity.recentlyLeftGroups);
            }
        }
    }
    return hasChangedGroups;
}

export function logWorldGroupPlayers({ groupId, groups, logDebug }: LogWorldGroupPlayersParams): void {
    logDebug('Players inside group ' + groupId + ':');
    groups[groupId].players.forEach((playerId) => {
        logDebug('- player ' + playerId);
    });
}
