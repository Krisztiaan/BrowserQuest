import { gridPos, type GridPos } from '../domain/positions';

type PathPoint = readonly [number, number];

export const MOVE_STEP_QUEUE_MAX = 16;
export const MOVE_STEP_REJECT_NON_ADJACENT = 'Invalid move.step (non-adjacent).';
export const MOVE_STEP_REJECT_BLOCKED = 'Invalid move.step (position blocked).';
export const MOVE_STEP_REJECT_QUEUE_FULL = 'move.step queue full.';

export function isCardinalStep(from: GridPos, to: GridPos): boolean {
    return Math.abs(from.x - to.x) + Math.abs(from.y - to.y) === 1;
}

export function isAdjacentStep(from: GridPos, to: GridPos): boolean {
    const dx = Math.abs(from.x - to.x);
    const dy = Math.abs(from.y - to.y);
    return dx <= 1 && dy <= 1 && (dx + dy) > 0;
}

export function isDiagonalStep(from: GridPos, to: GridPos): boolean {
    return Math.abs(from.x - to.x) === 1 && Math.abs(from.y - to.y) === 1;
}

export function resolveMoveBaseline(current: GridPos, queued: ReadonlyArray<GridPos>): GridPos {
    const tail = queued.length > 0 ? queued[queued.length - 1] : null;
    return tail ? gridPos(tail.x, tail.y) : current;
}

export function validateMoveStepIntent({
    baseline,
    to,
    existingQueueLength,
    isValidPosition,
    maxQueue = MOVE_STEP_QUEUE_MAX,
}: {
    baseline: GridPos;
    to: GridPos;
    existingQueueLength: number;
    isValidPosition: (x: number, y: number) => boolean;
    maxQueue?: number;
}): { ok: true } | { ok: false; reason: string } {
    if (!isAdjacentStep(baseline, to)) {
        return { ok: false, reason: MOVE_STEP_REJECT_NON_ADJACENT };
    }
    if (!isValidPosition(to.x, to.y)) {
        return { ok: false, reason: MOVE_STEP_REJECT_BLOCKED };
    }
    if (isDiagonalStep(baseline, to)) {
        // "No corner clipping": require both orthogonal neighbor tiles to be walkable.
        if (!isValidPosition(to.x, baseline.y) || !isValidPosition(baseline.x, to.y)) {
            return { ok: false, reason: MOVE_STEP_REJECT_BLOCKED };
        }
    }
    if (existingQueueLength >= maxQueue) {
        return { ok: false, reason: MOVE_STEP_REJECT_QUEUE_FULL };
    }
    return { ok: true };
}

export function buildMovePlanSteps({
    path,
    stopAdjacentToTarget,
}: {
    path: ReadonlyArray<PathPoint>;
    stopAdjacentToTarget: boolean;
}): GridPos[] {
    if (path.length <= 1) {
        return [];
    }

    const rawSteps = stopAdjacentToTarget ? path.slice(1, -1) : path.slice(1);
    const steps: GridPos[] = [];
    for (let i = 0; i < rawSteps.length; i += 1) {
        const point = rawSteps[i];
        if (!point) {
            continue;
        }
        steps.push(gridPos(point[0], point[1]));
    }
    return steps;
}
