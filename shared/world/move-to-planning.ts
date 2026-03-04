import { gridPos, type GridPos } from '../domain/positions';

type PathPoint = readonly [number, number];
type GridPath = ReadonlyArray<PathPoint>;

export function resolveMoveToTargetCandidates({
    isOutOfBounds,
    to,
    stopAdjacentToTarget,
}: {
    isOutOfBounds: (x: number, y: number) => boolean;
    to: GridPos;
    stopAdjacentToTarget: boolean;
}): GridPos[] {
    if (!stopAdjacentToTarget) {
        return [to];
    }

    const candidates = [
        gridPos(to.x + 1, to.y),
        gridPos(to.x - 1, to.y),
        gridPos(to.x, to.y + 1),
        gridPos(to.x, to.y - 1),
        // Allow diagonal-adjacent stop tiles so interactions can complete even when all 4 cardinals are blocked.
        gridPos(to.x + 1, to.y + 1),
        gridPos(to.x + 1, to.y - 1),
        gridPos(to.x - 1, to.y + 1),
        gridPos(to.x - 1, to.y - 1),
    ];
    return candidates.filter((pos) => !isOutOfBounds(pos.x, pos.y));
}

export function findBestPathToCandidates({
    candidates,
    findPathTo,
}: {
    candidates: ReadonlyArray<GridPos>;
    findPathTo: (x: number, y: number) => GridPath;
}): GridPath | null {
    let best: GridPath | null = null;

    for (const candidate of candidates) {
        const path = findPathTo(candidate.x, candidate.y);
        if (path.length <= 1) {
            continue;
        }
        if (!best || path.length < best.length) {
            best = path;
        }
    }

    return best;
}
