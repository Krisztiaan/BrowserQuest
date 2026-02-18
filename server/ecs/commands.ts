import type { EntityId } from '../../shared/domain/ids';
import type { GridPos } from '../../shared/domain/positions';
import type { EntityKind } from '../../shared/entity-kind-domain';

export type CommandSource = Readonly<{
    connectionId: string;
    playerId: EntityId;
}>;

export type HelloCommand = Readonly<{
    type: 'HELLO';
    source: CommandSource;
    name: string;
    armorKind: EntityKind;
    weaponKind: EntityKind;
    protocolRevision?: number;
    capabilitiesJson?: string;
    profile?: Readonly<{
        accountNameKey: string;
        nameKey: string;
        displayName: string;
        armorKind: EntityKind;
        weaponKind: EntityKind;
        checkpointId: number | null;
        achievements: Readonly<{
            unlockedIds: number[];
            ratCount: number;
            skeletonCount: number;
            totalKills: number;
            totalDmg: number;
            totalRevives: number;
        }>;
    }>;
}>;

export type IntentCommand = Readonly<{
    type: 'INTENT';
    source: CommandSource;
    seq: number;
    intentTypeId: string;
    payloadBytes: ReadonlyArray<number> | Uint8Array;
}>;

export type WhoCommand = Readonly<{
    type: 'WHO';
    source: CommandSource;
    entityIds: ReadonlyArray<EntityId>;
}>;

export type ZoneCommand = Readonly<{
    type: 'ZONE';
    source: CommandSource;
}>;

export type ChatCommand = Readonly<{
    type: 'CHAT';
    source: CommandSource;
    message: string;
}>;

export type MoveCommand = Readonly<{
    type: 'MOVE';
    source: CommandSource;
    to: GridPos;
}>;

export type MoveToCommand = Readonly<{
    type: 'MOVE_TO';
    source: CommandSource;
    to: GridPos;
    stopAdjacentToTarget: boolean;
}>;

export type MoveInputCommand = Readonly<{
    type: 'MOVE_INPUT';
    source: CommandSource;
    keysMask: number;
}>;

export type LootMoveCommand = Readonly<{
    type: 'LOOTMOVE';
    source: CommandSource;
    to: GridPos;
    itemId: EntityId;
}>;

export type AggroCommand = Readonly<{
    type: 'AGGRO';
    source: CommandSource;
    mobId: EntityId;
}>;

export type AttackCommand = Readonly<{
    type: 'ATTACK';
    source: CommandSource;
    targetId: EntityId;
}>;

export type LootCommand = Readonly<{
    type: 'LOOT';
    source: CommandSource;
    droppedItemId: EntityId;
}>;

export type TeleportCommand = Readonly<{
    type: 'TELEPORT';
    source: CommandSource;
    to: GridPos;
}>;

export type OpenCommand = Readonly<{
    type: 'OPEN';
    source: CommandSource;
    chestId: EntityId;
}>;

export type CheckCommand = Readonly<{
    type: 'CHECK';
    source: CommandSource;
    checkpointId: number;
}>;

export type AchievementCommand = Readonly<{
    type: 'ACHIEVEMENT';
    source: CommandSource;
    achievementId: number;
}>;

export type ChunkSubscribeCommand = Readonly<{
    type: 'CHUNK_SUBSCRIBE';
    source: CommandSource;
    chunkX: number;
    chunkY: number;
    radius: number;
}>;

export type ChunkUnsubscribeCommand = Readonly<{
    type: 'CHUNK_UNSUBSCRIBE';
    source: CommandSource;
}>;

export type TileEditCommand = Readonly<{
    type: 'TILE_EDIT';
    source: CommandSource;
    x: number;
    y: number;
    value: number | null;
}>;

export type ClaimCreateCommand = Readonly<{
    type: 'CLAIM_CREATE';
    source: CommandSource;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    editorNameKeys: ReadonlyArray<string>;
}>;

export type ClaimUpdateCommand = Readonly<{
    type: 'CLAIM_UPDATE';
    source: CommandSource;
    claimId: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    editorNameKeys?: ReadonlyArray<string>;
}>;

export type ClaimDeleteCommand = Readonly<{
    type: 'CLAIM_DELETE';
    source: CommandSource;
    claimId: number;
}>;

export type Command =
    | HelloCommand
    | IntentCommand
    | WhoCommand
    | ZoneCommand
    | ChatCommand
    | MoveCommand
    | MoveToCommand
    | MoveInputCommand
    | LootMoveCommand
    | AggroCommand
    | AttackCommand
    | LootCommand
    | TeleportCommand
    | OpenCommand
    | CheckCommand
    | AchievementCommand
    | ChunkSubscribeCommand
    | ChunkUnsubscribeCommand
    | TileEditCommand
    | ClaimCreateCommand
    | ClaimUpdateCommand
    | ClaimDeleteCommand;
