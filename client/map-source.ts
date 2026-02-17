import processMap from '../shared/maps/processmap';

// Keep the map URL explicit so Bun dev/prod serving paths work
// without bundler-specific `?url` transforms.
const tiledWorldMapUrl = '/assets/maps/tiled/world.json';
import type { MusicKey } from './asset-key-domain';

type JsonScalar = string | number | boolean | null;
type JsonLike = JsonScalar | JsonLike[] | { [key: string]: JsonLike };
type RawMapRecord = { [key: string]: JsonLike };

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
  doors: RawMapRecord[];
  checkpoints: RawMapRecord[];
};

function cloneClientRuntimeMap(map: ClientRuntimeMap): ClientRuntimeMap {
  if (typeof structuredClone === 'function') {
    return structuredClone(map);
  }
  return JSON.parse(JSON.stringify(map)) as ClientRuntimeMap;
}

let cachedClientRuntimeMap: ClientRuntimeMap | null = null;
let pendingMapLoad: Promise<void> | null = null;

async function ensureClientRuntimeMapLoaded(): Promise<void> {
  if (cachedClientRuntimeMap !== null) {
    return;
  }

  if (pendingMapLoad === null) {
    pendingMapLoad = (async () => {
      const response = await fetch(tiledWorldMapUrl, { credentials: 'same-origin' });
      if (!response.ok) {
        throw new Error(`Failed to fetch runtime map source (${response.status}).`);
      }
      const tiledWorldMap = (await response.json()) as Parameters<typeof processMap>[0];
      cachedClientRuntimeMap = processMap(tiledWorldMap, { mode: 'client', quiet: true }) as ClientRuntimeMap;
    })();
  }

  try {
    await pendingMapLoad;
  } finally {
    pendingMapLoad = null;
  }
}

export async function fetchClientRuntimeMap(): Promise<ClientRuntimeMap> {
  await ensureClientRuntimeMapLoaded();
  return cloneClientRuntimeMap(cachedClientRuntimeMap as ClientRuntimeMap);
}
