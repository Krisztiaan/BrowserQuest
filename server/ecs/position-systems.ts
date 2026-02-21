import { worldPosToTile, type WorldPos } from '../../shared/world/worldpos';
import type { GridPos } from '../../shared/domain/positions';
import type { ComponentType } from './component-registry';
import type { Command } from './commands';
import type { DomainEvent } from './events';
import type { System } from './scheduler';

export function createDeriveGridPositionFromWorldPosSystem({
    PositionSub,
    Position,
}: {
    PositionSub: ComponentType<WorldPos>;
    Position: ComponentType<GridPos>;
}): System<Command, DomainEvent> {
    return (state) => {
        // Keep legacy/grid Position in sync for tile-structured gameplay logic.
        PositionSub.store.forEach((id, pos) => {
            state.world.addComponent(id, Position, worldPosToTile(pos));
        });
    };
}

