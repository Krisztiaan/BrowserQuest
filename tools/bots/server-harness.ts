import net from 'node:net';

const repoRoot = new URL('../..', import.meta.url).pathname;

type RunningServer = Readonly<{
    port: number;
    proc: ReturnType<typeof Bun.spawn>;
    configPath: string;
}>;

async function getFreePort(): Promise<number> {
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

async function waitForHttpOk(url: string, timeoutMs = 8000): Promise<void> {
    const start = Date.now();
    let last: unknown = null;
    for (;;) {
        try {
            const res = await fetch(url);
            if (res.ok) return;
            last = `HTTP ${res.status}`;
        } catch (err) {
            last = err;
        }
        if (Date.now() - start > timeoutMs) {
            throw new Error(`Timed out waiting for ${url}. Last error: ${String(last)}`);
        }
        await Bun.sleep(50);
    }
}

export async function spawnLocalServer({
    configPath,
    fixedSpawn,
}: {
    configPath?: string | null;
    fixedSpawn?: { enabled: boolean; areaIndex: number; center: boolean } | null;
} = {}): Promise<RunningServer> {
    const port = await getFreePort();
    const resolvedConfigPath = configPath?.trim()
        ? configPath.trim().startsWith('/')
            ? configPath.trim()
            : `${repoRoot}/${configPath.trim()}`
        : `${repoRoot}/server/.tmp-config.bots-${port}.json`;

    if (!configPath?.trim()) {
        await Bun.write(
            resolvedConfigPath,
            JSON.stringify({
                port,
                debug_level: 'error',
                nb_players_per_world: 200,
                nb_worlds: 1,
                map_filepath: './assets/maps/tiled/world.json',
                metrics_enabled: false,
                player_db_path: ':memory:',
                chunk_overlay_db_path: ':memory:',
                claims_db_path: ':memory:',
            })
        );
    }

    const proc = Bun.spawn({
        cmd: ['bun', 'server/entry.ts', resolvedConfigPath],
        cwd: repoRoot,
        stdout: 'ignore',
        stderr: 'pipe',
        env:
            fixedSpawn?.enabled === false
                ? process.env
                : {
                      ...process.env,
                      BQ_FIXED_START_AREA_INDEX: String(fixedSpawn?.areaIndex ?? 0),
                      ...(fixedSpawn?.center === false ? {} : { BQ_FIXED_START_CENTER: '1' }),
                  },
    });

    await waitForHttpOk(`http://127.0.0.1:${port}/status`, 8000);

    return Object.freeze({ port, proc, configPath: resolvedConfigPath });
}

export async function cleanupLocalServer(server: RunningServer | null): Promise<void> {
    if (!server) {
        return;
    }
    try {
        server.proc.kill('SIGTERM');
    } catch (_) {
        // ignore
    }
    try {
        await server.proc.exited;
    } catch (_) {
        // ignore
    }
    try {
        if (server.configPath.includes('.tmp-config.bots-')) {
            await Bun.file(server.configPath).delete();
        }
    } catch (_) {
        // ignore
    }
}
