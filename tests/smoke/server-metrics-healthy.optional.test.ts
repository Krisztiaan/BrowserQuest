import { afterEach, expect, test } from 'bun:test';
import WebSocket from '../support/ws-client';
import { killBunProcess } from '../support/process-cleanup';
import {
    getFreePort,
    startStructuredLogCapture,
    waitForCondition,
    waitForHttpOk,
    waitForStringMessage,
    type StructuredEventRecord,
} from '../support/server-harness';

const repoRoot = new URL('../..', import.meta.url).pathname;
const runHealthySmoke = process.env.BQ_TEST_METRICS_HEALTH === '1';
const maybeTest = runHealthySmoke ? test : test.skip;

let proc: ReturnType<typeof Bun.spawn> | null = null;
let configPath: string | null = null;

afterEach(async () => {
    await killBunProcess(proc);
    proc = null;

    if (configPath) {
        try {
            await Bun.file(configPath).delete();
        } catch (_) {
            // ignore
        } finally {
            configPath = null;
        }
    }
});

maybeTest('optional: healthy metrics path starts with memcache backend and no fallback event', async () => {
    const hasMemcacheDependency = (() => {
        try {
            require.resolve('memcache');
            return true;
        } catch (_) {
            return false;
        }
    })();

    expect(hasMemcacheDependency).toBe(true);

    const port = await getFreePort();
    const memcachedHostEnv = process.env.BQ_TEST_METRICS_HOST;
    const memcachedHost = memcachedHostEnv && memcachedHostEnv.trim() !== '' ? memcachedHostEnv : '127.0.0.1';
    const memcachedPortEnv = process.env.BQ_TEST_METRICS_PORT;
    const memcachedPort = Number.parseInt(
        memcachedPortEnv && memcachedPortEnv.trim() !== '' ? memcachedPortEnv : '11211',
        10
    );

    configPath = `${repoRoot}/server/.tmp-config.metrics-healthy-${port}.json`;
    await Bun.write(
        configPath,
        JSON.stringify({
            port,
            debug_level: 'info',
            nb_players_per_world: 5,
            nb_worlds: 1,
            map_filepath: './assets/maps/runtime/map-pack.json',
            metrics_enabled: true,
            memcached_host: memcachedHost,
            memcached_port: memcachedPort,
            server_name: 'local',
            game_servers: [{ name: 'local' }],
        })
    );

    const events: StructuredEventRecord[] = [];

    proc = Bun.spawn({
        cmd: ['bun', 'server/entry.ts', configPath],
        cwd: repoRoot,
        stdout: 'pipe',
        stderr: 'pipe',
    });

    startStructuredLogCapture(proc.stdout, events);
    startStructuredLogCapture(proc.stderr, events);

    await waitForHttpOk(`http://127.0.0.1:${port}/status`, 8000);

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const message = await waitForStringMessage(ws, 4000);
    expect(message).toBe('go');
    ws.close();

    await waitForCondition(
        () =>
            events.some((eventRecord) => eventRecord.event === 'server.metrics.ready') ||
            events.some((eventRecord) => eventRecord.event === 'server.metrics.unavailable'),
        4000,
        'metrics adapter startup signal'
    );

    const fallbackEvent = events.find((eventRecord) => eventRecord.event === 'server.metrics.unavailable');
    expect(fallbackEvent).toBeUndefined();
    const readyEvent = events.find((eventRecord) => eventRecord.event === 'server.metrics.ready');
    expect(readyEvent).toBeDefined();
});
