import net from 'node:net';
import { afterEach, expect, test } from 'bun:test';

const repoRoot = new URL('../..', import.meta.url).pathname;

async function getFreePort() {
    return new Promise<number>((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                server.close(() => reject(new Error('Unable to allocate port')));
                return;
            }
            const port = address.port;
            server.close((err) => (err ? reject(err) : resolve(port)));
        });
    });
}

async function waitForHttpOk(url: string, timeoutMs = 5000) {
    const start = Date.now();
     
    while (true) {
        try {
            const res = await fetch(url);
            if (res.ok) return;
        } catch (_) {
            // ignore until timeout
        }

        if (Date.now() - start > timeoutMs) {
            throw new Error(`Timed out waiting for ${url}`);
        }
        await Bun.sleep(50);
    }
}

async function waitForProcessExit(proc: ReturnType<typeof Bun.spawn>, timeoutMs = 4000) {
    return new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for server exit')), timeoutMs);
        proc.exited
            .then((code) => {
                clearTimeout(timeout);
                resolve(code);
            })
            .catch((error) => {
                clearTimeout(timeout);
                reject(error);
            });
    });
}

let proc: ReturnType<typeof Bun.spawn> | null = null;

afterEach(() => {
    try {
        proc?.kill();
    } catch (_) {
        // ignore
    } finally {
        proc = null;
    }
});

async function runSignalShutdownScenario(signal: 'SIGTERM' | 'SIGINT') {
    const port = await getFreePort();
    const configPath = `${repoRoot}/server/.tmp-config.shutdown-${signal}-${port}.json`;

    await Bun.write(
        configPath,
        JSON.stringify({
            port,
            debug_level: 'error',
            nb_players_per_world: 5,
            nb_worlds: 1,
            map_filepath: './assets/maps/tiled/world.json',
            metrics_enabled: false,
        })
    );

    try {
        proc = Bun.spawn({
            cmd: ['bun', 'server/entry.ts', configPath],
            cwd: repoRoot,
            stdout: 'ignore',
            stderr: 'pipe',
        });

        await waitForHttpOk(`http://127.0.0.1:${port}/status`, 8000);

        proc.kill(signal);
        const exitCode = await waitForProcessExit(proc, 5000);
        expect(exitCode).toBe(0);
        proc = null;
    } finally {
        try {
            await Bun.file(configPath).delete();
        } catch (_) {
            // ignore
        }
    }
}

test('server performs controlled shutdown on SIGTERM and SIGINT', async () => {
    await runSignalShutdownScenario('SIGTERM');
    await runSignalShutdownScenario('SIGINT');
});
