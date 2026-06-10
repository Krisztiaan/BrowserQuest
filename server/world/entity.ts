import type { EntityId } from '../../shared/domain/ids';
import type { EntityKind } from '../../shared/entity-kind-domain';

type MobForDrop = {
    kind: EntityKind;
    x: number;
    y: number;
};

type DropTableEntry = Readonly<{
    kind: EntityKind;
    chance: number;
}>;

type SelectDroppedItemForMobParams<TItem> = {
    mob: MobForDrop;
    drops: readonly DropTableEntry[];
    randomInt: (max: number) => number;
    createAndAddDrop: (kind: EntityKind, x: number, y: number) => TItem;
};

export function selectDroppedItemForMob<TItem>({
    mob,
    drops,
    randomInt,
    createAndAddDrop,
}: SelectDroppedItemForMobParams<TItem>): TItem | null {
    const randomValue = randomInt(100);
    let threshold = 0;
    let item: TItem | null = null;

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

type LogError = (message: string) => void;
type LooseValue = string | number | boolean | null | undefined | object;
type PositionTarget = string | number | boolean | null | undefined | object;

export function getWorldEntityById<TEntity>({
    entities,
    id,
    logError,
}: {
    entities: Record<string, TEntity>;
    id: EntityId;
    logError: LogError;
}): TEntity | undefined {
    const key = String(id);
    if (key in entities) {
        return entities[key];
    }

    logError('Unknown entity : ' + id);
    return undefined;
}

type WorldMapCollisionCheck =
    | {
          isOutOfBounds(x: number, y: number): boolean;
          isColliding(x: number, y: number): boolean;
      }
    | null
    | undefined;

export function isWorldPositionValid(map: WorldMapCollisionCheck, x: LooseValue, y: LooseValue): boolean {
    return Boolean(
        map &&
        typeof x === 'number' &&
        typeof y === 'number' &&
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        !map.isOutOfBounds(x, y) &&
        !map.isColliding(x, y)
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
        getPositionNextTo(target: PositionTarget): GridPosition;
    },
    target: PositionTarget,
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
