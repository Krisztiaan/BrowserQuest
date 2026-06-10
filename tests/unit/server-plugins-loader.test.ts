import { expect, test } from 'bun:test';
import {
    getPluginSpecsFromConfig,
    loadServerPlugins,
    wrapWorldServerConstructorWithPlugins,
} from '../../server/plugins/loader';
import { SERVER_PLUGIN_API_VERSION, type ServerPlugin } from '../../server/plugins/contracts';
import type { RuntimeWorldServerConstructor } from '../../server/runtime-types';

test('getPluginSpecsFromConfig returns normalized plugin specs', () => {
    expect(getPluginSpecsFromConfig({})).toEqual([]);
    expect(getPluginSpecsFromConfig({ plugins: ['./server/plugins/sample-spawner.plugin.ts'] })).toEqual([
        './server/plugins/sample-spawner.plugin.ts',
    ]);
    expect(getPluginSpecsFromConfig({ plugins: ['  ./a.ts  ', '', 123] })).toEqual(['./a.ts']);
});

test('loadServerPlugins loads default plugin modules from config specs', async () => {
    const plugins = await loadServerPlugins(['./server/plugins/sample-spawner.plugin.ts'], { baseDir: process.cwd() });
    expect(plugins.map((plugin) => plugin.id)).toEqual(['sample-spawner']);
    expect(plugins[0]?.apiVersion).toBe(SERVER_PLUGIN_API_VERSION);
});

test('wrapWorldServerConstructorWithPlugins passes plugins through constructor seam', () => {
    const captured: Array<readonly ServerPlugin[] | null> = [];

    class BaseWorldServer {
        constructor(_id: string, _capacity: number, _server: object, plugins?: readonly ServerPlugin[]) {
            captured.push(plugins ?? null);
        }
        run(_mapFilePath: string) {
            // no-op
        }
        on(_eventName: 'ready' | 'playerAdded' | 'playerRemoved', _callback: () => void) {
            // no-op
        }
        emit(_eventName: 'playerConnect', _player: { id?: string | number }) {
            // no-op
        }
        updatePopulation(_totalPlayers?: number) {
            // no-op
        }
        playerCount = 0;
    }

    const plugin: ServerPlugin = {
        id: 'test-plugin',
        apiVersion: SERVER_PLUGIN_API_VERSION,
        install() {},
    };

    const Wrapped = wrapWorldServerConstructorWithPlugins(BaseWorldServer as RuntimeWorldServerConstructor, [plugin]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const instance = new Wrapped('world1', 5, {});

    expect(captured.length).toBe(1);
    expect(captured[0]).toEqual([plugin]);
});
