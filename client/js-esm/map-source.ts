import processMap from '../../tools/maps/processmap';

export const tiledWorldMapUrl = new URL('../../tools/maps/tiled/world.json', import.meta.url).href;

type ClientRuntimeMap = {
  width: number;
  height: number;
  tilesize: number;
  data: Array<number | number[]>;
  blocking: number[];
  plateau: number[];
  musicAreas: Array<{ x: number; y: number; w: number; h: number; id: unknown }>;
  collisions: number[];
  high: number[];
  animated: Record<number, { l?: number; d?: number }>;
  doors: Array<Record<string, unknown>>;
  checkpoints: Array<Record<string, unknown>>;
};

export async function fetchClientRuntimeMap(): Promise<ClientRuntimeMap> {
  const response = await fetch(tiledWorldMapUrl);
  if (!response.ok) {
    throw new Error(`Map request failed with status ${response.status}`);
  }
  const tiledMapJson = (await response.json()) as Parameters<typeof processMap>[0];
  return processMap(tiledMapJson, { mode: 'client', quiet: true }) as ClientRuntimeMap;
}
