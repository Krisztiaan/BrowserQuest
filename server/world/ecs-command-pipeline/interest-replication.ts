import type { EntityId } from '../../../shared/domain/ids';
import type { GridPos } from '../../../shared/domain/positions';
import Types from '../../../shared/gametypes-browser';
import type { Command } from '../../ecs/commands';
import type { ComponentType } from '../../ecs/component-registry';
import type { DomainEvent } from '../../ecs/events';
import type { InterestTracker } from '../../ecs/interest-tracker';
import type { OutboxMessage } from '../../ecs/outbox';
import type { WorldState } from '../../ecs/world-state';
import { buildDespawnAction } from '../../protocol/outbound-actions';
import {
    buildSpawnActionFromReplicationState,
    type registerSpawnReplicationComponents,
} from '../../replication/spawn-replication';

const MAP_GROUP_SCOPE_SEPARATOR = '::';

type WorldInterestHost = Readonly<{
    map: {
        getGroupIdFromPosition(x: number, y: number): string;
        forEachAdjacentGroup(groupId: string | null | undefined, callback: (groupId: string) => void): void;
    };
    getDefaultMapId?(): string;
    getMapById?(mapId: string): {
        getGroupIdFromPosition(x: number, y: number): string;
        forEachAdjacentGroup(groupId: string | null | undefined, callback: (groupId: string) => void): void;
    } | null;
    isPlayerActive(playerId: EntityId): boolean;
    pushToPlayerId(playerId: EntityId, action: unknown): void;
}>;

function mapScopedGroupKey(mapId: string, groupId: string): string {
    return `${mapId}${MAP_GROUP_SCOPE_SEPARATOR}${groupId}`;
}

function parseScopedFallbackGroupId(
    value: string,
    defaultMapId: string
): Readonly<{ mapId: string; groupId: string }> {
    const splitIndex = value.indexOf(MAP_GROUP_SCOPE_SEPARATOR);
    if (splitIndex <= 0) {
        return { mapId: defaultMapId, groupId: value };
    }
    return {
        mapId: value.slice(0, splitIndex),
        groupId: value.slice(splitIndex + MAP_GROUP_SCOPE_SEPARATOR.length),
    };
}

export function replicateInterestVisibility({
    world,
    state,
    Position,
    MapId,
    replication,
    interest,
    idsByGroup,
}: {
    world: WorldInterestHost;
    state: WorldState<Command, DomainEvent>;
    Position: ComponentType<GridPos>;
    MapId: ComponentType<string>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    interest: InterestTracker;
    idsByGroup: Map<string, EntityId[]>;
}): void {
    const Kind = replication.Kind;
    const defaultMapId = world.getDefaultMapId?.() ?? 'world';

    Kind.store.forEach((observerId, kind) => {
        if (!Types.isPlayer(kind)) {
            return;
        }

        if (!world.isPlayerActive(observerId)) {
            interest.clearObserver(observerId);
            return;
        }

        const pos = Position.store.get(observerId);
        if (!pos) {
            return;
        }

        const observerMapId = MapId.store.get(observerId) ?? defaultMapId;
        const map = world.getMapById?.(observerMapId) ?? world.map;

        const groupId = map.getGroupIdFromPosition(pos.x, pos.y);
        const visible: EntityId[] = [];
        map.forEachAdjacentGroup(groupId, (adjacent) => {
            const groupIds = idsByGroup.get(mapScopedGroupKey(observerMapId, adjacent));
            if (groupIds) {
                visible.push(...groupIds);
            }
        });

        const diff = interest.update(observerId, visible, { excludeSelf: true });
        for (let i = 0; i < diff.enter.length; i += 1) {
            const id = diff.enter[i];
            if (id === undefined) {
                continue;
            }
            try {
                const spawnMapId = MapId.store.get(id) ?? defaultMapId;
                world.pushToPlayerId(observerId, buildSpawnActionFromReplicationState(state.world, replication, id, spawnMapId));
            } catch {
                // Entity may have been destroyed during this tick or missing replication components.
            }
        }

        for (let i = 0; i < diff.leave.length; i += 1) {
            const id = diff.leave[i];
            if (id === undefined) {
                continue;
            }
            world.pushToPlayerId(observerId, buildDespawnAction(id));
        }
    });
}

export function broadcastNearbyOutboxMessage({
    world,
    Position,
    MapId,
    msg,
    idsByGroup,
}: {
    world: WorldInterestHost;
    Position: ComponentType<GridPos>;
    MapId: ComponentType<string>;
    msg: Extract<OutboxMessage, { kind: 'broadcast_nearby' }>;
    idsByGroup: Map<string, EntityId[]>;
}): void {
    const defaultMapId = world.getDefaultMapId?.() ?? 'world';
    const pos = Position.store.get(msg.actorId);
    const actorMapId = MapId.store.get(msg.actorId) ?? defaultMapId;
    const fallback = typeof msg.fallbackGroupId === 'string' ? parseScopedFallbackGroupId(msg.fallbackGroupId, defaultMapId) : null;
    const mapId = pos !== undefined ? actorMapId : fallback?.mapId ?? null;
    const map = mapId ? world.getMapById?.(mapId) ?? world.map : null;
    if (!map || !mapId) {
        return;
    }
    const groupId = pos !== undefined ? map.getGroupIdFromPosition(pos.x, pos.y) : fallback?.groupId ?? null;
    if (!groupId) {
        return;
    }

    map.forEachAdjacentGroup(groupId, (adjacent) => {
        const ids = idsByGroup.get(mapScopedGroupKey(mapId, adjacent));
        if (!ids) {
            return;
        }
        for (let i = 0; i < ids.length; i += 1) {
            const id = ids[i];
            if (id === undefined || (msg.ignoredPlayerId !== undefined && id === msg.ignoredPlayerId)) {
                continue;
            }
            if (!world.isPlayerActive(id)) {
                continue;
            }
            world.pushToPlayerId(id, msg.action);
        }
    });
}

export { mapScopedGroupKey };
