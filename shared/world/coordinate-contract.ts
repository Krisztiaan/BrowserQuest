export function isOutOfBoundsGridPosition(x: number, y: number, width: number, height: number): boolean {
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
        return true;
    }
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
        return true;
    }
    return x < 0 || x >= width || y < 0 || y >= height;
}

export function getZoneGroupIdFromGrid(x: number, y: number, zoneWidth: number, zoneHeight: number): string {
    if (!Number.isInteger(zoneWidth) || !Number.isInteger(zoneHeight) || zoneWidth <= 0 || zoneHeight <= 0) {
        return '0-0';
    }
    const gx = Math.floor(x / zoneWidth);
    const gy = Math.floor(y / zoneHeight);
    return `${gx}-${gy}`;
}
