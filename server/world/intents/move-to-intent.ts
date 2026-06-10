import type { EntityId } from '../../../shared/domain/ids';
import { gridPos, type GridPos } from '../../../shared/domain/positions';
import Types from '../../../shared/gametypes-browser';
import type { EntityKind } from '../../../shared/entity-kind-domain';
import Pathfinder from '../../../shared/world/pathfinding/pathfinder';
import { findBestPathToCandidates, resolveMoveToTargetCandidates } from '../../../shared/world/move-to-planning';
import type { ComponentType } from '../../ecs/component-registry';
import type { Command } from '../../ecs/commands';
import type { DomainEvent } from '../../ecs/events';
import type { registerMovementComponents } from '../../ecs/movement-components';
import type { WorldState } from '../../ecs/world-state';
import type { registerSpawnReplicationComponents } from '../../replication/spawn-replication';
import type { PlayerLike } from '../player-like';
import type { IntentWorldHost } from '../ecs-command-pipeline/core-module-registry';
import { resolveServerMovementNetcodeConfig } from '../../movement-netcode-config';

const MOVE_TO_MAX_QUEUE_ENTRIES = 64;
const MOVE_TO_MAX_VISITED = 50_000;

function shouldBlockForPathfinding(kind: EntityKind): boolean {
    const config = resolveServerMovementNetcodeConfig();
    if (Types.isPlayer(kind)) {
        return !config.rollout.playerPathingIgnoresPlayers;
    }
    return Types.isMob(kind) || Types.isNpc(kind) || Types.isChest(kind);
}

function applyOccupancyOverlayToGrid({
    grid,
    Position,
    MapId,
    Kind,
    activeMapId,
    defaultMapId,
    excludeId,
}: {
    grid: number[][];
    Position: ComponentType<GridPos>;
    MapId: ComponentType<string>;
    Kind: ComponentType<EntityKind>;
    activeMapId: string;
    defaultMapId: string;
    excludeId: EntityId;
}): () => void {
    const original = new Map<string, number>();
    const mark = (x: number, y: number): void => {
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
            return;
        }
        const row = grid[y];
        if (row?.[x] === undefined) {
            return;
        }
        const k = `${x},${y}`;
        if (!original.has(k)) {
            original.set(k, row[x] ?? 0);
        }
        row[x] = 1;
    };

    Position.store.forEach((id, pos) => {
        if (id === excludeId) {
            return;
        }
        const mapId = MapId.store.get(id) ?? defaultMapId;
        if (mapId !== activeMapId) {
            return;
        }
        const kind = Kind.store.get(id);
        if (kind === undefined || !shouldBlockForPathfinding(kind)) {
            return;
        }
        mark(pos.x, pos.y);
    });

    return () => {
        for (const [k, value] of original.entries()) {
            const [xs, ys] = k.split(',');
            const x = Number(xs);
            const y = Number(ys);
            if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
                continue;
            }
            const row = grid[y];
            if (row?.[x] === undefined) {
                continue;
            }
            row[x] = value;
        }
        original.clear();
    };
}

function forceTileWalkable(grid: number[][], x: number, y: number): () => void {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
        return () => {};
    }
    const row = grid[y];
    if (row?.[x] === undefined) {
        return () => {};
    }
    const previous = row[x] ?? 0;
    row[x] = 0;
    return () => {
        const restoreRow = grid[y];
        if (restoreRow?.[x] === undefined) {
            return;
        }
        restoreRow[x] = previous;
    };
}

export function applyMoveToIntentCommand({
    state,
    Position,
    MapId,
    Kind,
    player,
    movement,
    world,
    cmd,
}: {
    state: WorldState<Command, DomainEvent>;
    Position: ComponentType<GridPos>;
    MapId: ComponentType<string>;
    Kind: ReturnType<typeof registerSpawnReplicationComponents>['Kind'];
    player: PlayerLike;
    movement: ReturnType<typeof registerMovementComponents>;
    world: IntentWorldHost;
    cmd: Extract<Command, { type: 'MOVE_TO' }>;
}): { ok: false; reason: string } | void {
    const { MoveQueue } = movement;

    const currentPos = Position.store.get(player.id);
    if (!currentPos) {
        return;
    }

    // New target supersedes old queued steps.
    state.world.removeComponent(player.id, MoveQueue);

    const to = cmd.to;
    const defaultMapId = world.getDefaultMapId?.() ?? 'world_01';
    const currentMapId = MapId.store.get(player.id) ?? defaultMapId;
    const activeMap = world.getMapById?.(currentMapId) ?? world.map;
    const mapWidth = activeMap.width;
    const mapHeight = activeMap.height;
    if (
        typeof mapWidth !== 'number' ||
        typeof mapHeight !== 'number' ||
        !Number.isInteger(mapWidth) ||
        !Number.isInteger(mapHeight) ||
        mapWidth <= 0 ||
        mapHeight <= 0
    ) {
        return { ok: false, reason: 'move.to unavailable (missing map bounds).' };
    }
    const width = mapWidth;
    const height = mapHeight;
    const isOutOfBounds = (x: number, y: number): boolean => {
        if (typeof activeMap.isOutOfBounds === 'function') {
            return activeMap.isOutOfBounds(x, y);
        }
        return x < 0 || y < 0 || x >= width || y >= height;
    };
    if (isOutOfBounds(to.x, to.y)) {
        return { ok: false, reason: 'Invalid move.to (out of bounds).' };
    }
    if (
        typeof activeMap.isSameNavigationIsland === 'function' &&
        !activeMap.isSameNavigationIsland(currentPos.x, currentPos.y, to.x, to.y)
    ) {
        return { ok: false, reason: 'Invalid move.to (no path).' };
    }

    const grid = activeMap.grid;
    if (!Array.isArray(grid) || grid.length === 0) {
        return { ok: false, reason: 'move.to unavailable (missing collision grid).' };
    }

    const restoreOccupancy = applyOccupancyOverlayToGrid({
        grid,
        Position,
        MapId,
        Kind,
        activeMapId: currentMapId,
        defaultMapId,
        excludeId: player.id,
    });
    const restoreStartTile = forceTileWalkable(grid, currentPos.x, currentPos.y);

    try {
        const pathfinder = new Pathfinder(width, height);
        const candidates = resolveMoveToTargetCandidates({
            isOutOfBounds,
            to,
            stopAdjacentToTarget: cmd.stopAdjacentToTarget,
        });

        const bestPath = findBestPathToCandidates({
            candidates: candidates.filter((candidate) =>
                world.isValidPositionForMap
                    ? world.isValidPositionForMap(currentMapId, candidate.x, candidate.y)
                    : world.isValidPosition(candidate.x, candidate.y)
            ),
            findPathTo: (x, y) =>
                pathfinder.findPath(grid, { gridX: currentPos.x, gridY: currentPos.y }, x, y, false, {
                    maxVisited: MOVE_TO_MAX_VISITED,
                    variant: 'DiagonalFree',
                }),
        });

        if (!bestPath) {
            return { ok: false, reason: 'Invalid move.to (no path).' };
        }

        const rawSteps = bestPath.slice(1, 1 + MOVE_TO_MAX_QUEUE_ENTRIES);
        const steps: GridPos[] = rawSteps.map((entry) => gridPos(entry[0], entry[1]));
        if (steps.length === 0) {
            return;
        }

        state.world.addComponent(player.id, MoveQueue, { entries: steps });
    } finally {
        restoreOccupancy();
        restoreStartTile();
    }
}
