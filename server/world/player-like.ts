import type { EntityKind } from '../../shared/entity-kind-domain';
import type { EntityId } from '../../shared/domain/ids';

type PlayerCheckpoint = {
    id?: string | number;
    getRandomPosition?(): { x: number; y: number };
};

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
    firepotionTimeout?: ReturnType<typeof setTimeout> | null;
    lastCheckpoint: PlayerCheckpoint | null;
    setPositionResolver(resolver: () => { x: number; y: number }): void;
    on(eventName: 'move', callback: (x: number, y: number) => void): void;
    on(eventName: 'lootMove', callback: (x: number, y: number) => void): void;
    on(eventName: 'exit', callback: () => void): void;
    updatePosition(): void;
    setPosition(x: number, y: number): void;
    setTarget(entity: { id: EntityId }): void;
    clearTarget(): void;
    emit(eventName: 'exit'): void;
    emit(eventName: 'zone'): void;
    emit(eventName: 'move', x: number, y: number): void;
    emit(eventName: 'lootMove', x: number, y: number): void;
};
