import { expect, test } from 'bun:test';
import WorldServer from '../../../server/world-server';

test('WorldServer applies ServerConfig.chunk_size before players join', () => {
    const server = {
        getConnection(_id: string) {
            return undefined;
        },
    } as { getConnection: (id: string) => undefined };

    const world = new WorldServer('world1', 2000, server as never);
    expect(world.ecsPipeline.chunkOverlays.chunkSize).toBe(32);

    world.setServerConfig({
        port: 8000,
        debug_level: 'info',
        nb_players_per_world: 2000,
        nb_worlds: 1,
        map_filepath: './assets/maps/tiled/world.json',
        metrics_enabled: false,
        chunk_size: 64,
    });

    expect(world.ecsPipeline.chunkOverlays.chunkSize).toBe(64);
});
