import type { GridPos } from '../../shared/domain/positions';
import type { ResourceKey } from './resources';
import type { SpatialIndex } from './spatial-index';
import type { ComponentType } from './component-registry';
import type { System } from './scheduler';

export function createSpatialIndexRebuildSystem<TCommand = never, TEvent = never>({
    Position,
    spatialIndexKey,
}: {
    Position: ComponentType<GridPos>;
    spatialIndexKey: ResourceKey<SpatialIndex>;
}): System<TCommand, TEvent> {
    return (state) => {
        const index = state.resources.require(spatialIndexKey);
        index.clear();
        Position.store.forEach((id, pos) => {
            index.insert(id, pos);
        });
    };
}

