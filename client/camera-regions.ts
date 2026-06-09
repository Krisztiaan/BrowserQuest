export type CameraRegionBounds = Readonly<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}>;

export type CameraRegions = Readonly<{
    boundsAt(gridX: number, gridY: number): CameraRegionBounds | null;
}>;

/**
 * Connected components of painted render cells (4-connectivity) with their
 * bounding boxes. The playable world is a set of painted regions floating in
 * void; the camera clamps to the region containing the player so it never
 * pans over the void, and centers on regions smaller than the viewport
 * (enclosed interior rooms).
 */
export function computeCameraRegions(
    data: ArrayLike<number | number[] | undefined>,
    width: number,
    height: number
): CameraRegions {
    const cellCount = width * height;
    const regionIdByTile = new Int32Array(cellCount).fill(-1);
    const bounds: Array<{ minX: number; minY: number; maxX: number; maxY: number }> = [];

    const isPainted = (index: number): boolean => {
        const cell = data[index];
        if (Array.isArray(cell)) {
            return cell.length > 0;
        }
        return typeof cell === 'number' && cell !== 0;
    };

    const stack: number[] = [];
    for (let start = 0; start < cellCount; start += 1) {
        if (regionIdByTile[start] !== -1 || !isPainted(start)) {
            continue;
        }
        const regionId = bounds.length;
        const box = { minX: width, minY: height, maxX: -1, maxY: -1 };
        bounds.push(box);
        regionIdByTile[start] = regionId;
        stack.push(start);
        while (stack.length > 0) {
            const index = stack.pop() as number;
            const x = index % width;
            const y = (index - x) / width;
            if (x < box.minX) box.minX = x;
            if (x > box.maxX) box.maxX = x;
            if (y < box.minY) box.minY = y;
            if (y > box.maxY) box.maxY = y;
            if (x > 0) visit(index - 1);
            if (x < width - 1) visit(index + 1);
            if (y > 0) visit(index - width);
            if (y < height - 1) visit(index + width);
        }

        function visit(neighbor: number): void {
            if (regionIdByTile[neighbor] === -1 && isPainted(neighbor)) {
                regionIdByTile[neighbor] = regionId;
                stack.push(neighbor);
            }
        }
    }

    const frozen: CameraRegionBounds[] = bounds.map((box) => Object.freeze({ ...box }));
    return Object.freeze({
        boundsAt(gridX: number, gridY: number): CameraRegionBounds | null {
            if (gridX < 0 || gridY < 0 || gridX >= width || gridY >= height) {
                return null;
            }
            const regionId = regionIdByTile[gridY * width + gridX] ?? -1;
            return regionId >= 0 ? (frozen[regionId] ?? null) : null;
        },
    });
}
