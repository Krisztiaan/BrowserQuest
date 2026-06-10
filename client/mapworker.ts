import { fetchClientRuntimeMap } from './map-source';

type WorkerRequest = {
    mapId?: string;
};

type WorkerMap = {
    mapId?: string;
    width: number;
    height: number;
    collisions: number[];
    blocking: number[];
    plateau?: number[];
    grid?: number[][];
    plateauGrid?: number[][];
};

function tileIndexToGridPosition(tileNum: number, width: number): { x: number; y: number } {
    function getX(num: number, w: number): number {
        if (num === 0) {
            return 0;
        }
        return num % w === 0 ? w - 1 : (num % w) - 1;
    }

    const normalized = tileNum - 1;
    const x = getX(normalized + 1, width);
    const y = Math.floor(normalized / width);

    return { x, y };
}

function generateCollisionGrid(map: WorkerMap): void {
    const grid: number[][] = [];
    for (let i = 0; i < map.height; i += 1) {
        const row: number[] = [];
        grid[i] = row;
        for (let j = 0; j < map.width; j += 1) {
            row[j] = 0;
        }
    }

    for (const tileIndex of map.collisions) {
        const pos = tileIndexToGridPosition(tileIndex + 1, map.width);
        const row = grid[pos.y];
        if (row?.[pos.x] !== undefined) {
            row[pos.x] = 1;
        }
    }

    for (const tileIndex of map.blocking) {
        const pos = tileIndexToGridPosition(tileIndex + 1, map.width);
        const row = grid[pos.y];
        if (row?.[pos.x] !== undefined) {
            row[pos.x] = 1;
        }
    }

    map.grid = grid;
}

function generatePlateauGrid(map: WorkerMap): void {
    let tileIndex = 0;
    const plateauSet = new Set(map.plateau ?? []);
    const plateauGrid: number[][] = [];

    for (let i = 0; i < map.height; i += 1) {
        const row: number[] = [];
        plateauGrid[i] = row;
        for (let j = 0; j < map.width; j += 1) {
            row[j] = plateauSet.has(tileIndex) ? 1 : 0;
            tileIndex += 1;
        }
    }

    map.plateauGrid = plateauGrid;
}

self.onmessage = function onmessage(event: MessageEvent<WorkerRequest | number>): void {
    const requestedMapId = typeof event.data === 'object' ? event.data.mapId : undefined;

    void fetchClientRuntimeMap(requestedMapId)
        .then((map: WorkerMap) => {
            generateCollisionGrid(map);
            generatePlateauGrid(map);
            self.postMessage({
                ...map,
                ...(requestedMapId ? { mapId: requestedMapId } : {}),
            } satisfies WorkerMap);
        })
        .catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to load runtime map from Tiled source: ${message}`);
        });
};
