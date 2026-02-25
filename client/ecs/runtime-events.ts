import type { EntityKind } from '../../shared/entity-kind-domain';
import type { EntityId } from '../../shared/domain/ids';
import type { RuntimeEntity } from '../client-boundary-types';

export type ClientRuntimeEvent =
    | Readonly<{ type: 'welcome'; id: EntityId; name: string; x: number; y: number; maxHp: number }>
    | Readonly<{ type: 'populationChange'; worldPlayers: number; totalPlayers: number }>
    | Readonly<{ type: 'entityList'; list: EntityId[] }>
    | Readonly<{ type: 'playerTeleport'; entityId: EntityId; x: number; y: number; mapId?: string }>
    | Readonly<{ type: 'mapTransitionBegin'; seq: number; fromMapId: string; toMapId: string; x: number; y: number }>
    | Readonly<{ type: 'mapTransitionCommit'; seq: number; fromMapId: string; toMapId: string; x: number; y: number }>
    | Readonly<{ type: 'playerMoveToItem'; playerId: EntityId; itemId: EntityId }>
    | Readonly<{ type: 'playerChangeHealth'; points: number; isRegen: boolean }>
    | Readonly<{ type: 'playerChangeMaxHitPoints'; maxHp: number }>
    | Readonly<{ type: 'chatMessage'; entityId: EntityId; text: string }>
    | Readonly<{ type: 'playerEquipItem'; entityId: EntityId; itemKind: EntityKind }>
    | Readonly<{ type: 'dropItem'; item: RuntimeEntity; mobId: EntityId }>
    | Readonly<{ type: 'itemBlink'; entityId: EntityId }>
    | Readonly<{ type: 'playerDamageMob'; mobId: EntityId; points: number }>
    | Readonly<{ type: 'playerKillMob'; kind: EntityKind }>
    | Readonly<{
          type: 'achievementProgress';
          unlockedIds: number[];
          ratCount: number;
          skeletonCount: number;
          totalKills: number;
          totalDmg: number;
          totalRevives: number;
      }>;
