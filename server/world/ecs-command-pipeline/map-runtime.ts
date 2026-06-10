import type { EntityId } from '../../../shared/domain/ids';
import type { GridPos } from '../../../shared/domain/positions';
import type { ComponentType } from '../../ecs/component-registry';
import { recordMapTransitionEvent, type MapTransitionEvent } from '../map-transition-observability';

type WorldMapLike = Readonly<{
    getCheckpoint(id: string | number): { id?: string | number } | null | undefined;
    isDoor(x: number, y: number): boolean;
    getDoorDestination(x: number, y: number): { x: number; y: number } | null;
    getGroupIdFromPosition(x: number, y: number): string;
    forEachAdjacentGroup(groupId: string | null | undefined, callback: (groupId: string) => void): void;
    grid?: number[][];
    width?: number;
    height?: number;
    isOutOfBounds?(x: number, y: number): boolean;
}>;

export function resolveDefaultMapId(world: Readonly<{ getDefaultMapId?(): string }>): string {
    return world.getDefaultMapId?.() ?? 'world_01';
}

export function resolveEntityMapId({
    MapId,
    entityId,
    world,
}: {
    MapId: ComponentType<string>;
    entityId: EntityId;
    world: Readonly<{ getDefaultMapId?(): string }>;
}): string {
    return MapId.store.get(entityId) ?? resolveDefaultMapId(world);
}

export function resolveMapForId({
    world,
    mapId,
}: {
    world: Readonly<{ map: WorldMapLike; getMapById?(mapId: string): WorldMapLike | null }>;
    mapId: string;
}): WorldMapLike | null {
    return world.getMapById?.(mapId) ?? world.map;
}

export function isValidPositionInMap({
    world,
    mapId,
    x,
    y,
}: {
    world: Readonly<{
        isValidPosition(x: number, y: number): boolean;
        isValidPositionForMap?(mapId: string, x: number, y: number): boolean;
    }>;
    mapId: string;
    x: number;
    y: number;
}): boolean {
    return world.isValidPositionForMap ? world.isValidPositionForMap(mapId, x, y) : world.isValidPosition(x, y);
}

export function emitMapTransitionEvent({
    world,
    event,
}: {
    world: Readonly<{ recordMapTransitionEvent?(event: MapTransitionEvent): void }>;
    event: MapTransitionEvent;
}): void {
    recordMapTransitionEvent(world, event);
}

export function resolveDoorTeleportDestination({
    world,
    mapId,
    x,
    y,
}: {
    world: Readonly<{
        resolveDoorTeleport?(mapId: string, x: number, y: number): Readonly<{ toMapId: string; to: GridPos }> | null;
    }>;
    mapId: string;
    x: number;
    y: number;
}): Readonly<{ toMapId: string; to: GridPos }> | null {
    return world.resolveDoorTeleport?.(mapId, x, y) ?? null;
}
