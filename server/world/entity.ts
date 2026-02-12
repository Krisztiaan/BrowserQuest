import type { WorldMessage } from './contracts';
import type { EntityId } from '../../shared/domain/ids';

type AttackingCharacter = {
    group: string;
    id: EntityId;
    attack(): WorldMessage;
};

type PushToAdjacentGroupsWithIgnored = (groupId: string, message: WorldMessage, ignoredPlayer?: EntityId | null) => void;
type AttackCallback = (character: AttackingCharacter | null | undefined) => void;

type MobForDrop = {
    kind: number;
    x: number;
    y: number;
};

type RandomInt = (max: number) => number;
type CreateAndAddDrop = (kind: number, x: number, y: number) => unknown;

type DropTableEntry = Readonly<{
    kind: number;
    chance: number;
}>;

type SelectDroppedItemForMobParams = {
    mob: MobForDrop;
    drops: readonly DropTableEntry[];
    randomInt: RandomInt;
    createAndAddDrop: CreateAndAddDrop;
};

type DespawnableEntity = {
    id: EntityId;
    group: string;
    despawn(): WorldMessage;
};

type PushToAdjacentGroups = (groupId: string, message: WorldMessage) => void;
type HasEntityFn = (entityId: EntityId) => boolean;
type RemoveEntityFn = (entity: DespawnableEntity) => void;

type DespawnWorldEntityParams = {
    entity: DespawnableEntity;
    pushToAdjacentGroups: PushToAdjacentGroups;
    hasEntity: HasEntityFn;
    removeEntity: RemoveEntityFn;
};

type AttackingMob = {
    clearTarget(): void;
    forgetPlayer(playerId: EntityId, timeoutMs: number): void;
};

type VanishingPlayer = {
    id: EntityId;
    forEachAttacker(callback: (mob: AttackingMob) => void): void;
    removeAttacker(mob: AttackingMob): void;
};

type ChooseMobTarget = (mob: AttackingMob, hateRank: number) => void;
type HandleEntityGroupMembership = (player: VanishingPlayer) => void;

type HandleWorldPlayerVanishParams = {
    player: VanishingPlayer;
    chooseMobTarget: ChooseMobTarget;
    handleEntityGroupMembership: HandleEntityGroupMembership;
};

type WorldEntities = Record<string, unknown>;
type LogError = (message: string) => void;

type GetWorldEntityByIdParams = {
    entities: WorldEntities;
    id: EntityId;
    logError: LogError;
};

type WorldMapCollisionCheck = {
    isOutOfBounds(x: number, y: number): boolean;
    isColliding(x: number, y: number): boolean;
} | null | undefined;

type GridPosition = {
    x: number;
    y: number;
};

type PositionEntity = {
    x: number;
    y: number;
    getPositionNextTo(target: unknown): GridPosition;
};

type PositionValidator = (x: number, y: number) => boolean;

type PositionableEntity = {
    setPosition(x: number, y: number): void;
};

type MoveWorldEntityParams = {
    entity: PositionableEntity | null | undefined;
    x: number;
    y: number;
    handleEntityGroupMembership: (entity: PositionableEntity) => void;
};

export function broadcastWorldAttacker(
    character: AttackingCharacter | null | undefined,
    pushToAdjacentGroups: PushToAdjacentGroupsWithIgnored,
    onAttackCallback?: AttackCallback
): void {
    if (character) {
        const attackMessage = character.attack();
        if (attackMessage) {
            pushToAdjacentGroups(character.group, attackMessage, character.id);
        }
    }
    if (onAttackCallback) {
        onAttackCallback(character);
    }
}

export function selectDroppedItemForMob({
    mob,
    drops,
    randomInt,
    createAndAddDrop,
}: SelectDroppedItemForMobParams): unknown {
    const randomValue = randomInt(100);
    let threshold = 0;
    let item: unknown = null;

    for (let i = 0; i < drops.length; i += 1) {
        const entry = drops[i];
        if (!entry) {
            continue;
        }
        threshold += entry.chance;
        if (randomValue <= threshold) {
            item = createAndAddDrop(entry.kind, mob.x, mob.y);
            break;
        }
    }

    return item;
}

export function despawnWorldEntity({
    entity,
    pushToAdjacentGroups,
    hasEntity,
    removeEntity,
}: DespawnWorldEntityParams): void {
    pushToAdjacentGroups(entity.group, entity.despawn());

    if (hasEntity(entity.id)) {
        removeEntity(entity);
    }
}

export function handleWorldPlayerVanish({
    player,
    chooseMobTarget,
    handleEntityGroupMembership,
}: HandleWorldPlayerVanishParams): void {
    const previousAttackers: AttackingMob[] = [];

    player.forEachAttacker((mob) => {
        previousAttackers.push(mob);
        chooseMobTarget(mob, 2);
    });

    previousAttackers.forEach((mob) => {
        player.removeAttacker(mob);
        mob.clearTarget();
        mob.forgetPlayer(player.id, 1000);
    });

    handleEntityGroupMembership(player);
}

export function getWorldEntityById({ entities, id, logError }: GetWorldEntityByIdParams): unknown {
    const key = String(id);
    if (key in entities) {
        return entities[key];
    }

    logError('Unknown entity : ' + id);
    return undefined;
}

export function isWorldPositionValid(map: WorldMapCollisionCheck, x: unknown, y: unknown): boolean {
    return Boolean(
        map
        && typeof x === 'number'
        && typeof y === 'number'
        && Number.isFinite(x)
        && Number.isFinite(y)
        && !map.isOutOfBounds(x, y)
        && !map.isColliding(x, y)
    );
}

export function findWorldPositionNextTo(entity: PositionEntity, target: unknown, isValidPosition: PositionValidator): GridPosition {
    const maxAttempts = 32;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const position = entity.getPositionNextTo(target);
        if (isValidPosition(position.x, position.y)) {
            return position;
        }
    }

    return { x: entity.x, y: entity.y };
}

export function moveWorldEntity({ entity, x, y, handleEntityGroupMembership }: MoveWorldEntityParams): void {
    if (entity) {
        entity.setPosition(x, y);
        handleEntityGroupMembership(entity);
    }
}
