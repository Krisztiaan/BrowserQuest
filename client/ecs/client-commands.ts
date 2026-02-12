import type { EntityId } from '../../shared/domain/ids';

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
    | Readonly<{ type: 'emitNotification'; message: string }>;
