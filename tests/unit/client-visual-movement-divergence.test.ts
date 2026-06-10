import { expect, test } from 'bun:test';
import {
    classifyInterpolationDivergence,
    classifyPredictionDivergence,
    classifyRemoteReplicationDivergence,
    isSnapVisualDivergenceClass,
    resolveVisualMoveModeForDivergenceClass,
} from '../../client/ecs/visual-movement-divergence';
import { MOVEMENT_TUNING_PROFILES } from '../../shared/netcode/movement-tuning';

const tuning = MOVEMENT_TUNING_PROFILES.combat_proximity.client;

test('remote replication divergence keeps ordinary updates separate from discontinuities', () => {
    expect(classifyRemoteReplicationDivergence({ x: 100, y: 100 }, { x: 200, y: 100 })).toBe('ordinary');
    expect(classifyRemoteReplicationDivergence({ x: 100, y: 100 }, { x: 10_000, y: 100 })).toBe('remote_discontinuity');
});

test('prediction divergence distinguishes hard reconcile from suppressed resync', () => {
    expect(classifyPredictionDivergence({ suppressed: false, predictionError: tuning.hardReconcileErrSubpx + 1 })).toBe(
        'prediction_hard_reconcile'
    );
    expect(classifyPredictionDivergence({ suppressed: true, predictionError: 0 })).toBe('suppressed_resync');
    expect(classifyPredictionDivergence({ suppressed: false, predictionError: 0 })).toBe('ordinary');
});

test('interpolation divergence only escalates large visual gaps to teleport handling', () => {
    expect(
        classifyInterpolationDivergence({
            isLocalPlayer: false,
            maxAxisDistancePx: tuning.remotePresentationSnapDistancePx - 1,
        })
    ).toBe('ordinary');
    expect(
        classifyInterpolationDivergence({
            isLocalPlayer: true,
            maxAxisDistancePx: tuning.localPresentationSnapDistancePx + 1,
        })
    ).toBe('teleport');
    expect(isSnapVisualDivergenceClass('ordinary')).toBe(false);
    expect(isSnapVisualDivergenceClass('teleport')).toBe(true);
    expect(resolveVisualMoveModeForDivergenceClass('remote_discontinuity')).toBe('snap');
});
