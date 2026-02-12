import type { EntityId } from '../../shared/domain/ids';

type MobForDrop = {
    kind: number;
    x: number;
    y: number;
};

type DropTableEntry = Readonly<{
    kind: number;
    chance: number;
}>;

type SelectDroppedItemForMobParams = {
    mob: MobForDrop;
    drops: readonly DropTableEntry[];
    randomInt: (max: number) => number;
    createAndAddDrop: (kind: number, x: number, y: number) => unknown;
};

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

type WorldEntities = Record<string, unknown>;
type LogError = (message: string) => void;

export function getWorldEntityById({
    entities,
    id,
    logError,
}: {
    entities: WorldEntities;
    id: EntityId;
    logError: LogError;
}): unknown {
    const key = String(id);
    if (key in entities) {
        return entities[key];
    }

    logError('Unknown entity : ' + id);
    return undefined;
}

type WorldMapCollisionCheck = {
    isOutOfBounds(x: number, y: number): boolean;
    isColliding(x: number, y: number): boolean;
} | null | undefined;

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

type GridPosition = {
    x: number;
    y: number;
};

export function findWorldPositionNextTo(
    entity: {
        x: number;
        y: number;
        getPositionNextTo(target: unknown): GridPosition;
    },
    target: unknown,
    isValidPosition: (x: number, y: number) => boolean
): GridPosition {
    const maxAttempts = 32;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const position = entity.getPositionNextTo(target);
        if (isValidPosition(position.x, position.y)) {
            return position;
        }
    }
    return { x: entity.x, y: entity.y };
}

export function moveWorldEntity({
    entity,
    x,
    y,
}: {
    entity: { setPosition(x: number, y: number): void } | null | undefined;
    x: number;
    y: number;
}): void {
    if (entity) {
        entity.setPosition(x, y);
    }
}
