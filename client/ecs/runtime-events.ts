import type { EntityKind } from '../../shared/entity-kind-domain';
import type { EntityId } from '../../shared/domain/ids';

export type ClientRuntimeEvent =
    | Readonly<{ type: 'welcome'; id: EntityId; name: string; x: number; y: number; maxHp: number }>
    | Readonly<{ type: 'populationChange'; worldPlayers: number; totalPlayers: number }>
    | Readonly<{ type: 'entityList'; list: EntityId[] }>
    | Readonly<{ type: 'spawnItem'; item: unknown; x: number; y: number }>
    | Readonly<{ type: 'spawnChest'; chest: unknown; x: number; y: number }>
    | Readonly<{
          type: 'spawnCharacter';
          character: unknown;
          x: number;
          y: number;
          orientation: number | undefined;
          targetId: EntityId | undefined;
      }>
    | Readonly<{ type: 'despawnEntity'; entityId: EntityId }>
    | Readonly<{ type: 'entityDestroy'; entityId: EntityId }>
    | Readonly<{ type: 'entityMove'; entityId: EntityId; x: number; y: number }>
    | Readonly<{ type: 'playerTeleport'; entityId: EntityId; x: number; y: number }>
    | Readonly<{ type: 'entityAttack'; attackerId: EntityId; targetId: EntityId }>
    | Readonly<{ type: 'playerMoveToItem'; playerId: EntityId; itemId: EntityId }>
    | Readonly<{ type: 'playerChangeHealth'; points: number; isRegen: boolean }>
    | Readonly<{ type: 'playerChangeMaxHitPoints'; maxHp: number }>
    | Readonly<{ type: 'chatMessage'; entityId: EntityId; text: string }>
    | Readonly<{ type: 'playerEquipItem'; entityId: EntityId; itemKind: EntityKind }>
    | Readonly<{ type: 'dropItem'; item: unknown; mobId: EntityId }>
    | Readonly<{ type: 'itemBlink'; entityId: EntityId }>;

