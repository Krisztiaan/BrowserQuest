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

type WorldInterestHost = Readonly<{
    map: {
        getGroupIdFromPosition(x: number, y: number): string;
        forEachAdjacentGroup(groupId: string, callback: (groupId: string) => void): void;
    };
    isPlayerActive(playerId: EntityId): boolean;
    pushToPlayerId(playerId: EntityId, action: unknown): void;
}>;

export function replicateInterestVisibility({
    world,
    state,
    Position,
    replication,
    interest,
    idsByGroup,
}: {
    world: WorldInterestHost;
    state: WorldState<Command, DomainEvent>;
    Position: ComponentType<GridPos>;
    replication: ReturnType<typeof registerSpawnReplicationComponents>;
    interest: InterestTracker;
    idsByGroup: Map<string, EntityId[]>;
}): void {
    const Kind = replication.Kind;

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

        const groupId = world.map.getGroupIdFromPosition(pos.x, pos.y);
        const visible: EntityId[] = [];
        world.map.forEachAdjacentGroup(groupId, (adjacent) => {
            const groupIds = idsByGroup.get(adjacent);
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
                world.pushToPlayerId(observerId, buildSpawnActionFromReplicationState(state.world, replication, id));
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
    msg,
    idsByGroup,
}: {
    world: WorldInterestHost;
    Position: ComponentType<GridPos>;
    msg: Extract<OutboxMessage, { kind: 'broadcast_nearby' }>;
    idsByGroup: Map<string, EntityId[]>;
}): void {
    const pos = Position.store.get(msg.actorId);
    const groupId =
        pos !== undefined
            ? world.map.getGroupIdFromPosition(pos.x, pos.y)
            : typeof msg.fallbackGroupId === 'string'
              ? msg.fallbackGroupId
              : null;
    if (!groupId) {
        return;
    }

    world.map.forEachAdjacentGroup(groupId, (adjacent) => {
        const ids = idsByGroup.get(adjacent);
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
