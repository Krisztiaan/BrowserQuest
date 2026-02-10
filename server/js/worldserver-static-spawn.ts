type GridPosition = {
    x: number;
    y: number;
};

type StaticEntityMap = Record<string, string> | undefined;

type SpawnMob = {
    id: string | number;
    isDead: boolean;
    area?: unknown;
    on(eventName: 'respawn', callback: () => void): void;
    on(eventName: 'move', callback: (mob: SpawnMob) => void): void;
};

type ChestAreaLike = {
    addToArea(entity: unknown): void;
};

type SpawnStaticEntitiesForWorldParams = {
    staticEntities: StaticEntityMap;
    resolveKindFromString(kindName: string): EntityKind;
    tileIndexToGridPosition(tileIndex: number): GridPosition;
    isNpcKind(kind: EntityKind): boolean;
    isMobKind(kind: EntityKind): boolean;
    isItemKind(kind: EntityKind): boolean;
    addNpc(kind: EntityKind, x: number, y: number): void;
    createMob(id: string, kind: EntityKind, x: number, y: number): SpawnMob;
    addMob(mob: SpawnMob): void;
    isChestArea(area: unknown): area is ChestAreaLike;
    addMobToContainingChestArea(mob: SpawnMob): void;
    onMobMove(mob: SpawnMob): void;
    createItem(kind: EntityKind, x: number, y: number): unknown;
    addStaticItem(item: unknown): void;
};

export function spawnStaticEntitiesForWorld({
    staticEntities,
    resolveKindFromString,
    tileIndexToGridPosition,
    isNpcKind,
    isMobKind,
    isItemKind,
    addNpc,
    createMob,
    addMob,
    isChestArea,
    addMobToContainingChestArea,
    onMobMove,
    createItem,
    addStaticItem,
}: SpawnStaticEntitiesForWorldParams): void {
    let count = 0;

    Object.keys(staticEntities || {}).forEach((tileId) => {
        const kindName = (staticEntities as Record<string, string>)[tileId];
        const kind = resolveKindFromString(kindName);
        const position = tileIndexToGridPosition(Number.parseInt(tileId, 10));
        const x = position.x + 1;
        const y = position.y;

        if (isNpcKind(kind)) {
            addNpc(kind, x, y);
        }

        if (isMobKind(kind)) {
            const mob = createMob('7' + kind + count++, kind, x, y);
            mob.on('respawn', () => {
                mob.isDead = false;
                addMob(mob);
                if (mob.area && isChestArea(mob.area)) {
                    mob.area.addToArea(mob);
                }
            });
            mob.on('move', onMobMove);
            addMob(mob);
            addMobToContainingChestArea(mob);
        }

        if (isItemKind(kind)) {
            addStaticItem(createItem(kind, x, y));
        }
    });
}
import type { EntityKind } from '../../shared/js/entity-kind-domain';
