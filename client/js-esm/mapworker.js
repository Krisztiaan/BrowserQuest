import mapData from "../maps/world_client.json";

function tileIndexToGridPosition(tileNum, width) {
  function getX(num, w) {
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

function generateCollisionGrid(map) {
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

function generatePlateauGrid(map) {
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

self.onmessage = function onmessage() {
  const map = JSON.parse(JSON.stringify(mapData));
  generateCollisionGrid(map);
  generatePlateauGrid(map);
  self.postMessage(map);
};
