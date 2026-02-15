import { expect, test } from 'bun:test';
import processMap from '../../../shared/maps/processmap';
import tiledWorldMapJson from '../../../assets/maps/tiled/world.json';

test('server collisions include client blocking tiles for authority parity', () => {
    const tiledWorldMap = tiledWorldMapJson as Parameters<typeof processMap>[0];
    const clientMap = processMap(tiledWorldMap, { mode: 'client', quiet: true });
    const serverMap = processMap(tiledWorldMap, { mode: 'server', quiet: true });

    const clientBlocking = clientMap.blocking ?? [];
    expect(clientBlocking.length).toBeGreaterThan(0);

    const serverCollisions = new Set(serverMap.collisions);
    const missingBlockingTiles = clientBlocking.filter((tileIndex) => !serverCollisions.has(tileIndex));
    expect(missingBlockingTiles).toEqual([]);
});

