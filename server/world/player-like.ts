import type { EntityKind } from '../../shared/entity-kind-domain';
import type { EntityId } from '../../shared/domain/ids';

export type PlayerLike = {
    id: EntityId;
    x: number;
    y: number;
    kind: EntityKind;
    name: string;
    accountNameKey?: string;
    orientation: number;
    armor: EntityKind;
    weapon: EntityKind;
    armorLevel: number;
    weaponLevel: number;
    maxHitPoints: number;
    hitPoints: number;
    hasEnteredGame: boolean;
    isDead: boolean;
    lastCheckpoint: unknown;
    updatePosition(): void;
    setPosition(x: number, y: number): void;
    setTarget(entity: { id: EntityId }): void;
    clearTarget(): void;
    emit(eventName: 'zone'): void;
    emit(eventName: 'move', x: number, y: number): void;
    emit(eventName: 'lootMove', x: number, y: number): void;
};
