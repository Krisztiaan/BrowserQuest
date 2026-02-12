import type { EntityId } from '../../shared/domain/ids';
import type { EntityKind } from '../../shared/entity-kind-domain';

export type ClientCommand =
    | Readonly<{ type: 'stopPlayerCombat' }>
    | Readonly<{ type: 'playerGoTo'; x: number; y: number }>
    | Readonly<{ type: 'playerGoToItem'; itemId: EntityId }>
    | Readonly<{ type: 'playerAttack'; targetId: EntityId }>
    | Readonly<{ type: 'playerFollow'; targetId: EntityId }>
    | Readonly<{ type: 'playerTalkTo'; npcId: EntityId }>
    | Readonly<{ type: 'npcTalk'; npcId: EntityId }>
    | Readonly<{ type: 'playerOpenChest'; chestId: EntityId }>
    | Readonly<{ type: 'clientSendOpen'; chestId: EntityId }>
    | Readonly<{ type: 'tryLoot'; itemId: EntityId }>
    | Readonly<{ type: 'playerStop' }>
    | Readonly<{ type: 'playerDisengage' }>
    | Readonly<{ type: 'playerIdle' }>
    | Readonly<{ type: 'emitNotification'; message: string }>
    | Readonly<{ type: 'applyWelcome'; id: EntityId; name: string; x: number; y: number; maxHp: number }>
    | Readonly<{ type: 'invokeConnectionStartedCallback' }>
    | Readonly<{ type: 'emitNbPlayersChange'; worldPlayers: number; totalPlayers: number }>
    | Readonly<{ type: 'applyEntityList'; list: EntityId[] }>
    | Readonly<{ type: 'teleportEntity'; entityId: EntityId; x: number; y: number }>
    | Readonly<{ type: 'playerMoveToItem'; playerId: EntityId; itemId: EntityId }>
    | Readonly<{ type: 'setPlayerHealth'; points: number; isRegen: boolean }>
    | Readonly<{ type: 'setPlayerMaxHitPoints'; maxHp: number }>
    | Readonly<{ type: 'chatMessage'; entityId: EntityId; text: string }>
    | Readonly<{ type: 'equipItem'; entityId: EntityId; itemKind: EntityKind }>
    | Readonly<{ type: 'dropItem'; item: unknown; mobId: EntityId }>
    | Readonly<{ type: 'itemBlink'; entityId: EntityId }>;
