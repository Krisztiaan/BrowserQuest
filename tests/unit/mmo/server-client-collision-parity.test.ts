import { expect, test } from 'bun:test';
import { loadRuntimeMapPackFromSource } from '../../../server/runtime-map-pack-source';

test('server collisions include client blocking tiles for authority parity', async () => {
    const runtimeMapPack = await loadRuntimeMapPackFromSource('./assets/maps/tiled/world.json') as {
        maps?: Array<{
            id?: string;
            client?: { blocking?: number[] };
            server?: { collisions?: number[] };
        }>;
    };
    const worldMap = runtimeMapPack.maps?.find((entry) => entry.id === 'world_01');
    expect(worldMap).toBeDefined();

    const clientMap = worldMap?.client ?? {};
    const serverMap = worldMap?.server ?? {};

    const clientBlocking = clientMap.blocking ?? [];
    expect(clientBlocking.length).toBeGreaterThan(0);

    const serverCollisions = new Set(serverMap.collisions);
    const missingBlockingTiles = clientBlocking.filter((tileIndex) => !serverCollisions.has(tileIndex));
    expect(missingBlockingTiles).toEqual([]);
});
