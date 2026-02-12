import type { EntityId } from '../../shared/domain/ids';
import type { EntityKind } from '../../shared/entity-kind-domain';
import type { AudioSoundKey } from '../asset-key-domain';

export type ClientCommand =
    | Readonly<{ type: 'stopPlayerCombat' }>
    | Readonly<{ type: 'characterClearTarget'; entityId: EntityId }>
    | Readonly<{ type: 'clientSendHello' }>
    | Readonly<{ type: 'clientSendMove'; x: number; y: number }>
    | Readonly<{ type: 'clientSendZone' }>
    | Readonly<{ type: 'clientSendChat'; message: string }>
    | Readonly<{ type: 'clientSendAttack'; mobId: EntityId }>
    | Readonly<{ type: 'clientSendLootMove'; itemId: EntityId; x: number; y: number }>
    | Readonly<{ type: 'enqueueZoningFrom'; x: number; y: number }>
    | Readonly<{ type: 'setPlayerIsOnPlateau'; isOnPlateau: boolean }>
    | Readonly<{ type: 'setPlayerLastCheckpoint'; checkpoint: { id?: string | number } | null }>
    | Readonly<{ type: 'clientSendCheck'; checkpointId: string | number }>
    | Readonly<{ type: 'audioUpdateMusic' }>
    | Readonly<{ type: 'setEntityNextGrid'; entityId: EntityId; nextGridX: number; nextGridY: number }>
    | Readonly<{
          type: 'spatialRemoveRecord';
          entityId: EntityId;
          record: {
              gridX: number;
              gridY: number;
              nextGridX: number;
              nextGridY: number;
              isMoving: boolean;
              kind: EntityKind;
              isPlayer: boolean;
          };
      }>
    | Readonly<{
          type: 'spatialAddRecord';
          entityId: EntityId;
          record: {
              gridX: number;
              gridY: number;
              nextGridX: number;
              nextGridY: number;
              isMoving: boolean;
              kind: EntityKind;
              isPlayer: boolean;
          };
      }>
    | Readonly<{ type: 'playerGoTo'; x: number; y: number }>
    | Readonly<{ type: 'playerGoToItem'; itemId: EntityId }>
    | Readonly<{ type: 'playerAttack'; targetId: EntityId }>
    | Readonly<{ type: 'playerFollow'; targetId: EntityId }>
    | Readonly<{ type: 'playerTalkTo'; npcId: EntityId }>
    | Readonly<{ type: 'npcTalk'; npcId: EntityId }>
    | Readonly<{ type: 'playerOpenChest'; chestId: EntityId }>
    | Readonly<{ type: 'clientSendOpen'; chestId: EntityId }>
    | Readonly<{ type: 'tryLoot'; itemId: EntityId }>
    | Readonly<{ type: 'combatRelinkPreviousTarget'; attackerId: EntityId }>
    | Readonly<{
          type: 'combatRepositionAttacker';
          attackerId: EntityId;
          targetId: EntityId;
          x: number;
          y: number;
          orientation: number;
      }>
    | Readonly<{ type: 'characterLookAtTarget'; entityId: EntityId }>
    | Readonly<{ type: 'characterHit'; entityId: EntityId }>
    | Readonly<{ type: 'characterFollow'; entityId: EntityId; targetId: EntityId }>
    | Readonly<{ type: 'clientSendHit'; targetId: EntityId }>
    | Readonly<{ type: 'clientSendHurt'; mobId: EntityId }>
    | Readonly<{ type: 'audioPlaySound'; key: AudioSoundKey }>
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
    | Readonly<{ type: 'itemBlink'; entityId: EntityId }>
    | Readonly<{ type: 'spawnEntityFromKernel'; entityId: EntityId }>
    | Readonly<{ type: 'removeEntityById'; entityId: EntityId }>
    | Readonly<{ type: 'characterGoTo'; entityId: EntityId; x: number; y: number }>
    | Readonly<{ type: 'createAttackLink'; attackerId: EntityId; targetId: EntityId }>;
