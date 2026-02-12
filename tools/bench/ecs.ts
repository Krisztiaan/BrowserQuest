import { gridPos } from '../../shared/domain/positions';
import { FixedClock } from '../../server/ecs/clock';
import { SoaGridPosStore } from '../../server/ecs/component-store';
import { CLOCK_RESOURCE, RNG_RESOURCE } from '../../server/ecs/core-resources';
import { XorShift32 } from '../../server/ecs/rng';
import { createSpatialIndexRebuildSystem } from '../../server/ecs/spatial-systems';
import { SpatialIndex } from '../../server/ecs/spatial-index';
import { SPATIAL_INDEX_RESOURCE } from '../../server/ecs/spatial-resources';
import { WorldState } from '../../server/ecs/world-state';

function nowMs(): number {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }
    return Date.now();
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
    const n = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

const entityCount = parsePositiveInt(process.argv[2], 25_000);
const iterations = parsePositiveInt(process.argv[3], 30);
const queryRadius = parsePositiveInt(process.argv[4], 6);

const state = new WorldState();
state.resources.set(RNG_RESOURCE, new XorShift32(123));
state.resources.set(CLOCK_RESOURCE, new FixedClock(0));
state.resources.set(SPATIAL_INDEX_RESOURCE, new SpatialIndex());

const Position = state.world.components.register('Position', new SoaGridPosStore());
const index = state.resources.require(SPATIAL_INDEX_RESOURCE);
const rebuild = createSpatialIndexRebuildSystem({ Position, spatialIndexKey: SPATIAL_INDEX_RESOURCE });
const rng = state.resources.require(RNG_RESOURCE);

for (let i = 0; i < entityCount; i += 1) {
    const id = state.world.createEntity();
    const x = rng.nextInt(512);
    const y = rng.nextInt(512);
    state.world.addComponent(id, Position, gridPos(x, y));
}

const start = nowMs();
let queryCount = 0;
for (let i = 0; i < iterations; i += 1) {
    rebuild(state, { tick: i + 1 });

    // Simple query workload against a stable center point.
    const found = index.queryRadius(gridPos(256, 256), queryRadius);
    queryCount += found.length;
}
const elapsed = nowMs() - start;

console.log(
    JSON.stringify(
        {
            bench: 'ecs_spatial_index_rebuild+query',
            entityCount,
            iterations,
            queryRadius,
            elapsedMs: Number(elapsed.toFixed(2)),
            avgMsPerIteration: Number((elapsed / iterations).toFixed(4)),
            totalResultsCount: queryCount,
        },
        null,
        2
    )
);
