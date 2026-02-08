import mapData from "../maps/world_client.json";

type WorkerMap = {
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
  const grid = [];
  for (let i = 0; i < map.height; i += 1) {
    grid[i] = [];
    for (let j = 0; j < map.width; j += 1) {
      grid[i][j] = 0;
    }
  }

  for (const tileIndex of map.collisions) {
    const pos = tileIndexToGridPosition(tileIndex + 1, map.width);
    grid[pos.y][pos.x] = 1;
  }

  for (const tileIndex of map.blocking) {
    const pos = tileIndexToGridPosition(tileIndex + 1, map.width);
    if (grid[pos.y] !== undefined) {
      grid[pos.y][pos.x] = 1;
    }
  }

  map.grid = grid;
}

function generatePlateauGrid(map: WorkerMap): void {
  let tileIndex = 0;
  const plateauSet = new Set(map.plateau || []);
  const plateauGrid = [];

  for (let i = 0; i < map.height; i += 1) {
    plateauGrid[i] = [];
    for (let j = 0; j < map.width; j += 1) {
      plateauGrid[i][j] = plateauSet.has(tileIndex) ? 1 : 0;
      tileIndex += 1;
    }
  }

  map.plateauGrid = plateauGrid;
}

self.onmessage = function onmessage(): void {
  const map = JSON.parse(JSON.stringify(mapData)) as WorkerMap;
  generateCollisionGrid(map);
  generatePlateauGrid(map);
  self.postMessage(map);
};
