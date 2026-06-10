import { expect, test } from 'bun:test';
import { gridPos } from '../../../shared/domain/positions';
import { TILE_SUBPX, tileToWorldPosCenter, worldPos } from '../../../shared/world/worldpos';
import type { Command } from '../../../server/ecs/commands';
import { SoaGridPosStore, SoaWorldPosStore } from '../../../server/ecs/component-store';
import type { DomainEvent } from '../../../server/ecs/events';
import { createDeriveGridPositionFromWorldPosSystem } from '../../../server/ecs/position-systems';
import { WorldState } from '../../../server/ecs/world-state';
import {
    registerSpawnReplicationComponents,
    syncSpawnReplicationFromLegacyEntity,
} from '../../../server/replication/spawn-replication';
import Types from '../../../shared/gametypes-browser';

test('derive grid Position from PositionSub floors at tile boundaries', () => {
    const state = new WorldState<Command, DomainEvent>();
    const Position = state.world.components.register('Position', new SoaGridPosStore());
    const PositionSub = state.world.components.register('PositionSub', new SoaWorldPosStore());

    const entity = state.world.createEntity();
    const derive = createDeriveGridPositionFromWorldPosSystem({ PositionSub, Position });

    state.world.addComponent(entity, PositionSub, worldPos(0, 0));
    derive(state);
    expect(state.world.getComponent(entity, Position)).toEqual(gridPos(0, 0));

    state.world.addComponent(entity, PositionSub, worldPos(TILE_SUBPX - 1, TILE_SUBPX - 1));
    derive(state);
    expect(state.world.getComponent(entity, Position)).toEqual(gridPos(0, 0));

    state.world.addComponent(entity, PositionSub, worldPos(TILE_SUBPX, TILE_SUBPX));
    derive(state);
    expect(state.world.getComponent(entity, Position)).toEqual(gridPos(1, 1));
});

test('spawn replication initializes PositionSub at the center of the legacy tile', () => {
    const state = new WorldState<Command, DomainEvent>();
    const replication = registerSpawnReplicationComponents(state.world);
    const entity = state.world.createEntity();

    syncSpawnReplicationFromLegacyEntity(state.world, replication, {
        id: entity,
        kind: Types.Entities.WARRIOR,
        x: 12,
        y: 34,
    });

    expect(state.world.getComponent(entity, replication.Position)).toEqual(gridPos(12, 34));
    expect(state.world.getComponent(entity, replication.PositionSub)).toEqual(tileToWorldPosCenter(12, 34));
});
