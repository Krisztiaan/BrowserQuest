import { expect, test } from 'bun:test';
import { classifyTileForOverlay, OVERLAY_COLORS } from '../../../client/debug-overlay';

function mapLike(overrides: Partial<Record<'colliding' | 'door' | 'plateau' | 'checkpoint', boolean>>) {
    return {
        isColliding: () => overrides.colliding ?? false,
        isDoor: () => overrides.door ?? false,
        isPlateau: () => overrides.plateau ?? false,
        isCheckpoint: () => overrides.checkpoint ?? false,
    };
}

test('classifyTileForOverlay precedence: door beats blocked beats plateau beats walkable', () => {
    expect(classifyTileForOverlay(mapLike({ door: true, colliding: true }), 0, 0)).toBe('door');
    expect(classifyTileForOverlay(mapLike({ checkpoint: true, colliding: true }), 0, 0)).toBe('checkpoint');
    expect(classifyTileForOverlay(mapLike({ colliding: true, plateau: true }), 0, 0)).toBe('blocked');
    expect(classifyTileForOverlay(mapLike({ plateau: true }), 0, 0)).toBe('plateau');
    expect(classifyTileForOverlay(mapLike({}), 0, 0)).toBe('walkable');
});

test('every overlay class has a color', () => {
    for (const cls of ['blocked', 'door', 'checkpoint', 'plateau', 'walkable'] as const) {
        expect(OVERLAY_COLORS[cls]).toContain('rgba');
    }
});
