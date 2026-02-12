import type { EntityId } from '../../shared/domain/ids';
import type { GridPos } from '../../shared/domain/positions';
import type { EntityKind } from '../../shared/entity-kind-domain';

export type EntityMovedEvent = Readonly<{
    type: 'ENTITY_MOVED';
    entityId: EntityId;
    to: GridPos;
}>;

export type EntityAttackedEvent = Readonly<{
    type: 'ENTITY_ATTACKED';
    attackerId: EntityId;
    targetId: EntityId;
}>;

export type EntityDamagedEvent = Readonly<{
    type: 'ENTITY_DAMAGED';
    entityId: EntityId;
    damage: number;
    attackerId: EntityId;
}>;

export type PlayerHealthChangedEvent = Readonly<{
    type: 'PLAYER_HEALTH_CHANGED';
    playerId: EntityId;
    hitPoints: number;
    isRegen: boolean;
}>;

export type MobKilledEvent = Readonly<{
    type: 'MOB_KILLED';
    mobId: EntityId;
    mobKind: EntityKind;
    killerId: EntityId;
}>;

export type DomainEvent =
    | EntityMovedEvent
    | EntityAttackedEvent
    | EntityDamagedEvent
    | PlayerHealthChangedEvent
    | MobKilledEvent;
