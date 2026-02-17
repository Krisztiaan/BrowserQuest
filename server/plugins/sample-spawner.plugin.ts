import Types from '../../shared/gametypes-browser';
import { SERVER_PLUGIN_API_VERSION, type ServerPlugin } from './contracts';
import type { EntityKind } from '../../shared/entity-kind-domain';

type PluginWorldLike = {
    ups: number;
    map: {
        ready(callback: () => void): void;
        getRandomStartingPosition(): { x: number; y: number };
    };
    isValidPosition(x: number, y: number): boolean;
    createItem(kind: EntityKind, x: number, y: number): object;
    addItem(item: object): void;
};

const SAMPLE_SPAWN_INTERVAL_SECONDS = 10;
const SAMPLE_MAX_SPAWNS = 3;

const plugin: ServerPlugin = {
    id: 'sample-spawner',
    apiVersion: SERVER_PLUGIN_API_VERSION,
    version: '0.0.1',
    install({ world, ecs }) {
        const host = world as PluginWorldLike;
        let mapReady = false;
        let spawned = 0;

        host.map.ready(() => {
            mapReady = true;
        });

        ecs.registerSystem('sim', 'sample_spawner', (_state, ctx) => {
            if (!mapReady) {
                return;
            }

            if (typeof ctx.tick !== 'number' || ctx.tick <= 0) {
                return;
            }

            const intervalTicks = Math.max(1, host.ups * SAMPLE_SPAWN_INTERVAL_SECONDS);
            if (ctx.tick % intervalTicks !== 0) {
                return;
            }
            if (spawned >= SAMPLE_MAX_SPAWNS) {
                return;
            }

            const pos = host.map.getRandomStartingPosition();
            if (!host.isValidPosition(pos.x, pos.y)) {
                return;
            }

            const item = host.createItem(Types.Entities.FIREPOTION, pos.x, pos.y);
            host.addItem(item);
            spawned += 1;
        });
    },
};

export default plugin;
