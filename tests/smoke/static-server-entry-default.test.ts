import net from 'node:net';
import { afterEach, expect, test } from 'bun:test';

const repoRoot = new URL('../..', import.meta.url).pathname;

async function getFreePort() {
    return await new Promise<number>((resolve, reject) => {
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
    // eslint-disable-next-line no-constant-condition
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

test('static dev server serves modern entry at root by default', async () => {
    const port = await getFreePort();

    proc = Bun.spawn({
        cmd: ['bun', 'tools/static-server.ts'],
        cwd: repoRoot,
        env: { ...process.env, PORT: String(port) },
        stdout: 'ignore',
        stderr: 'pipe',
    });

    await waitForHttpOk(`http://127.0.0.1:${port}/`);

    const rootHtml = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    const legacyHtml = await (await fetch(`http://127.0.0.1:${port}/index.html`)).text();

    expect(rootHtml).toContain('js-esm/preflight.js');
    expect(rootHtml).not.toContain('js/detect.js');
    expect(legacyHtml).toContain('js/detect.js');
    expect(legacyHtml).not.toContain('js-esm/preflight.js');
});

test('static dev server can opt into legacy root entry', async () => {
    const port = await getFreePort();

    proc = Bun.spawn({
        cmd: ['bun', 'tools/static-server.ts'],
        cwd: repoRoot,
        env: {
            ...process.env,
            PORT: String(port),
            BQ_CLIENT_DEFAULT_ENTRY: 'index.html',
        },
        stdout: 'ignore',
        stderr: 'pipe',
    });

    await waitForHttpOk(`http://127.0.0.1:${port}/`);

    const rootHtml = await (await fetch(`http://127.0.0.1:${port}/`)).text();

    expect(rootHtml).toContain('js/detect.js');
    expect(rootHtml).not.toContain('js-esm/preflight.js');
});
