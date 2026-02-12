import Types from '../../shared/gametypes-browser';
import { entityIdToWire } from '../../shared/domain/ids';
import type { EntityId } from '../../shared/domain/ids';
import type { GridPos } from '../../shared/domain/positions';
import type { ServerToClientProtocolAction } from '../../shared/protocol/types';
import type { ComponentType } from './component-registry';
import type { Command } from './commands';
import type { DomainEvent } from './events';
import type { OutboxMessage } from './outbox';
import type { System } from './scheduler';

export function createApplyMoveCommandsSystem({
    Position,
    onMoveApplied,
}: {
    Position: ComponentType<GridPos>;
    onMoveApplied?: (playerId: EntityId, to: GridPos) => void;
}): System<Command, DomainEvent> {
    return (state) => {
        const commands = state.commands.drain();
        for (let i = 0; i < commands.length; i += 1) {
            const cmd = commands[i];
            if (!cmd) {
                continue;
            }
            if (cmd.type !== 'MOVE') {
                continue;
            }

            // For now, MOVE is purely authoritative position set; validation/physics come later.
            state.world.addComponent(cmd.source.playerId, Position, cmd.to);
            onMoveApplied?.(cmd.source.playerId, cmd.to);
            state.events.push({
                type: 'ENTITY_MOVED',
                entityId: cmd.source.playerId,
                to: cmd.to,
            });
        }
    };
}

export function mapDomainEventToProtocolAction(event: DomainEvent): OutboxMessage[] {
    if (event.type === 'ENTITY_MOVED') {
        const action: ServerToClientProtocolAction = [
            Types.Messages.MOVE,
            entityIdToWire(event.entityId),
            event.to.x,
            event.to.y,
        ];
        return [{ kind: 'broadcast_nearby', actorId: event.entityId, action, ignoredPlayerId: event.entityId }];
    }

    if (event.type === 'ENTITY_ATTACKED') {
        const action: ServerToClientProtocolAction = [
            Types.Messages.ATTACK,
            entityIdToWire(event.attackerId),
            entityIdToWire(event.targetId),
        ];
        return [
            {
                kind: 'broadcast_nearby',
                actorId: event.attackerId,
                action,
                ignoredPlayerId: event.attackerId,
            },
        ];
    }

    if (event.type === 'ENTITY_DAMAGED') {
        const action: ServerToClientProtocolAction = [
            Types.Messages.DAMAGE,
            entityIdToWire(event.entityId),
            event.damage,
        ];
        return [{ kind: 'to_player', playerId: event.attackerId, action }];
    }

    if (event.type === 'PLAYER_HEALTH_CHANGED') {
        const action: ServerToClientProtocolAction =
            event.isRegen === true
                ? [Types.Messages.HEALTH, event.hitPoints, 1]
                : [Types.Messages.HEALTH, event.hitPoints];
        return [{ kind: 'to_player', playerId: event.playerId, action }];
    }

    if (event.type === 'MOB_KILLED') {
        const action: ServerToClientProtocolAction = [Types.Messages.KILL, event.mobKind];
        return [{ kind: 'to_player', playerId: event.killerId, action }];
    }

    return [];
}
