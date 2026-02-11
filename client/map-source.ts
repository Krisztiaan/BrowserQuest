import processMap from '../shared/maps/processmap';
import tiledWorldMapJson from '../assets/maps/tiled/world.json';
import type { MusicKey } from './asset-key-domain';

type ClientRuntimeMap = {
  width: number;
  height: number;
  tilesize: number;
  data: Array<number | number[]>;
  blocking: number[];
  plateau: number[];
  musicAreas: Array<{ x: number; y: number; w: number; h: number; id: MusicKey }>;
  collisions: number[];
  high: number[];
  animated: Record<number, { l?: number; d?: number }>;
  doors: Array<Record<string, unknown>>;
  checkpoints: Array<Record<string, unknown>>;
};

const tiledWorldMap = tiledWorldMapJson as Parameters<typeof processMap>[0];

function cloneClientRuntimeMap(map: ClientRuntimeMap): ClientRuntimeMap {
  if (typeof structuredClone === 'function') {
    return structuredClone(map) as ClientRuntimeMap;
  }
  return JSON.parse(JSON.stringify(map)) as ClientRuntimeMap;
}

let cachedClientRuntimeMap: ClientRuntimeMap | null = null;

function loadClientRuntimeMap(): ClientRuntimeMap {
  if (!cachedClientRuntimeMap) {
    cachedClientRuntimeMap = processMap(tiledWorldMap, { mode: 'client', quiet: true }) as ClientRuntimeMap;
  }
  return cloneClientRuntimeMap(cachedClientRuntimeMap);
}

export async function fetchClientRuntimeMap(): Promise<ClientRuntimeMap> {
  return loadClientRuntimeMap();
}
