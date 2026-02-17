import { expect, test } from 'bun:test';
import { gridPos } from '../../../shared/domain/positions';
import {
    buildMovePlanSteps,
    MOVE_STEP_QUEUE_MAX,
    MOVE_STEP_REJECT_BLOCKED,
    MOVE_STEP_REJECT_NON_ADJACENT,
    MOVE_STEP_REJECT_QUEUE_FULL,
    resolveMoveBaseline,
    validateMoveStepIntent,
} from '../../../shared/world/movement-intents';

test('resolveMoveBaseline uses queue tail when pending entries exist', () => {
    const baseline = resolveMoveBaseline(gridPos(10, 10), [gridPos(11, 10), gridPos(12, 10)]);
    expect(baseline).toEqual(gridPos(12, 10));
});

test('resolveMoveBaseline falls back to current when queue is empty', () => {
    const baseline = resolveMoveBaseline(gridPos(10, 10), []);
    expect(baseline).toEqual(gridPos(10, 10));
});

test('validateMoveStepIntent enforces adjacency, walkability, and queue cap', () => {
    const baseline = gridPos(10, 10);

    expect(
        validateMoveStepIntent({
            baseline,
            to: gridPos(10, 12),
            existingQueueLength: 0,
            isValidPosition: () => true,
        })
    ).toEqual({ ok: false, reason: MOVE_STEP_REJECT_NON_ADJACENT });

    expect(
        validateMoveStepIntent({
            baseline,
            to: gridPos(11, 10),
            existingQueueLength: 0,
            isValidPosition: () => false,
        })
    ).toEqual({ ok: false, reason: MOVE_STEP_REJECT_BLOCKED });

    expect(
        validateMoveStepIntent({
            baseline,
            to: gridPos(11, 10),
            existingQueueLength: MOVE_STEP_QUEUE_MAX,
            isValidPosition: () => true,
        })
    ).toEqual({ ok: false, reason: MOVE_STEP_REJECT_QUEUE_FULL });

    expect(
        validateMoveStepIntent({
            baseline,
            to: gridPos(11, 10),
            existingQueueLength: MOVE_STEP_QUEUE_MAX - 1,
            isValidPosition: () => true,
        })
    ).toEqual({ ok: true });
});

test('buildMovePlanSteps supports stop-adjacent slicing', () => {
    const path: Array<[number, number]> = [
        [10, 10],
        [11, 10],
        [12, 10],
        [13, 10],
    ];

    expect(buildMovePlanSteps({ path, stopAdjacentToTarget: false })).toEqual([
        gridPos(11, 10),
        gridPos(12, 10),
        gridPos(13, 10),
    ]);
    expect(buildMovePlanSteps({ path, stopAdjacentToTarget: true })).toEqual([
        gridPos(11, 10),
        gridPos(12, 10),
    ]);
});
