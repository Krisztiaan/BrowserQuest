import { expect, test } from 'bun:test';
import { computeCameraRegions } from '../../../client/camera-regions';

function dataFrom(rows: string[]): Array<number | number[]> {
    // '#' painted, '.' void
    const out: Array<number | number[]> = [];
    for (const row of rows) {
        for (const ch of row) {
            out.push(ch === '#' ? 7 : 0);
        }
    }
    return out;
}

test('computeCameraRegions separates disconnected painted areas with tight bounds', () => {
    const rows = ['###....', '###....', '.....##', '.....##', '.....##'];
    const regions = computeCameraRegions(dataFrom(rows), 7, 5);
    const a = regions.boundsAt(0, 0);
    const b = regions.boundsAt(5, 3);
    expect(a).toEqual({ minX: 0, minY: 0, maxX: 2, maxY: 1 });
    expect(b).toEqual({ minX: 5, minY: 2, maxX: 6, maxY: 4 });
    expect(regions.boundsAt(4, 0)).toBeNull(); // void
});

test('computeCameraRegions treats array cells (stacked tiles) as painted', () => {
    const data: Array<number | number[]> = [0, [3, 4], 0, 0];
    const regions = computeCameraRegions(data, 2, 2);
    expect(regions.boundsAt(1, 0)).toEqual({ minX: 1, minY: 0, maxX: 1, maxY: 0 });
});
