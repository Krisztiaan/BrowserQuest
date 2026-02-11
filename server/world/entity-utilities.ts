import type { WorldMessage } from './contracts';

type AttackingCharacter = {
    group: string;
    id: string | number;
    attack(): WorldMessage;
};

type PushToAdjacentGroupsWithIgnored = (groupId: string, message: WorldMessage, ignoredPlayer?: string | number | null) => void;
type AttackCallback = (character: AttackingCharacter | null | undefined) => void;

type MobForDrop = {
    kind: number;
    x: number;
    y: number;
};

type PropertiesByKind = Record<string, { drops?: Record<string, number> }>;

type ResolveKindAsString = (kind: number) => string | null;
type ResolveKindFromString = (kindName: string) => number;
type RandomInt = (max: number) => number;
type CreateAndAddDrop = (kind: number, x: number, y: number) => unknown;

type SelectDroppedItemForMobParams = {
    mob: MobForDrop;
    propertiesByKind: PropertiesByKind;
    resolveKindAsString: ResolveKindAsString;
    resolveKindFromString: ResolveKindFromString;
    randomInt: RandomInt;
    createAndAddDrop: CreateAndAddDrop;
};

type DespawnableEntity = {
    id: string | number;
    group: string;
    despawn(): WorldMessage;
};

type PushToAdjacentGroups = (groupId: string, message: WorldMessage) => void;
type HasEntityFn = (entityId: string | number) => boolean;
type RemoveEntityFn = (entity: DespawnableEntity) => void;

type DespawnWorldEntityParams = {
    entity: DespawnableEntity;
    pushToAdjacentGroups: PushToAdjacentGroups;
    hasEntity: HasEntityFn;
    removeEntity: RemoveEntityFn;
};

type AttackingMob = {
    clearTarget(): void;
    forgetPlayer(playerId: string | number, timeoutMs: number): void;
};

type VanishingPlayer = {
    id: string | number;
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
    id: string | number;
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
        pushToAdjacentGroups(character.group, character.attack(), character.id);
    }
    if (onAttackCallback) {
        onAttackCallback(character);
    }
}

export function selectDroppedItemForMob({
    mob,
    propertiesByKind,
    resolveKindAsString,
    resolveKindFromString,
    randomInt,
    createAndAddDrop,
}: SelectDroppedItemForMobParams): unknown {
    const kind = resolveKindAsString(mob.kind);
    if (!kind) {
        return null;
    }

    const drops = propertiesByKind[kind]?.drops || {};
    const randomValue = randomInt(100);
    let threshold = 0;
    let item: unknown = null;

    for (const itemName in drops) {
        const percentage = drops[itemName] ?? 0;
        threshold += percentage;
        if (randomValue <= threshold) {
            item = createAndAddDrop(resolveKindFromString(itemName), mob.x, mob.y);
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
    if (id in entities) {
        return entities[id];
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
    let valid = false;
    let position = entity.getPositionNextTo(target);

    while (!valid) {
        valid = isValidPosition(position.x, position.y);
        if (!valid) {
            position = entity.getPositionNextTo(target);
        }
    }

    return position;
}

export function moveWorldEntity({ entity, x, y, handleEntityGroupMembership }: MoveWorldEntityParams): void {
    if (entity) {
        entity.setPosition(x, y);
        handleEntityGroupMembership(entity);
    }
}
