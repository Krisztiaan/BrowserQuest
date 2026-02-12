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

export type HitCommand = Readonly<{
    type: 'HIT';
    source: CommandSource;
    attackedMobId: EntityId;
}>;

export type HurtCommand = Readonly<{
    type: 'HURT';
    source: CommandSource;
    hurtingMobId: EntityId;
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

export type Command =
    | HelloCommand
    | WhoCommand
    | ZoneCommand
    | ChatCommand
    | MoveCommand
    | LootMoveCommand
    | AggroCommand
    | AttackCommand
    | HitCommand
    | HurtCommand
    | LootCommand
    | TeleportCommand
    | OpenCommand
    | CheckCommand;
