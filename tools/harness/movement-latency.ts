import Types from '../../shared/gametypes-browser';
import { encodeClientToServerProtocolActionBinary } from '../../shared/protocol/registry';
import {
    encodeMoveInputIntentPayload,
    encodeMoveToIntentPayload,
    INTENT_MOVE_INPUT,
    INTENT_MOVE_TO,
    MOVE_INPUT_KEY_A,
    MOVE_INPUT_KEY_D,
    MOVE_INPUT_KEY_S,
    MOVE_INPUT_KEY_W,
} from '../../shared/protocol/intents';
import { dispatchBinaryActionBatchPayload } from '../../shared/protocol/binary-action-codec';
import net from 'node:net';

type LinkConfig = Readonly<{
    c2sBaseMs: number;
    c2sJitterMs: number;
    s2cBaseMs: number;
    s2cJitterMs: number;
    seed: number;
}>;

type ScenarioConfig = Readonly<{
    trials: number;
    mode: 'wasd' | 'click';
}>;

type LoginResult = Readonly<{
    ws: WebSocket;
    localWireId: number;
    startX: number;
    startY: number;
}>;

type TrialResult = Readonly<{
    okSignal: boolean;
    okMove: boolean;
    signalLatencyMs: number | null;
    moveLatencyMs: number | null;
    firstSignalSuppressed: boolean | null;
    correctionCount: number;
    rejectCount: number;
}>;

function parseArgNumber(flag: string, fallback: number): number {
    const idx = Bun.argv.indexOf(flag);
    if (idx < 0) return fallback;
    const raw = Bun.argv[idx + 1];
    const parsed = raw ? Number(raw) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseArgString<T extends string>(flag: string, allowed: readonly T[], fallback: T): T {
    const idx = Bun.argv.indexOf(flag);
    if (idx < 0) return fallback;
    const raw = Bun.argv[idx + 1];
    if (!raw) return fallback;
    return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

function xorshift32(seed: number): () => number {
    let x = seed >>> 0;
    return () => {
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        return (x >>> 0) / 0xffffffff;
    };
}

function clampNonNegative(ms: number): number {
    return ms < 0 ? 0 : ms;
}

function resolveDelayMs(base: number, jitter: number, rand: () => number): number {
    const delta = (rand() * 2 - 1) * jitter;
    return clampNonNegative(base + delta);
}

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
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(port);
            });
        });
    });
}

async function waitForHttpOk(url: string, timeoutMs = 5000): Promise<void> {
    const startedAt = Date.now();
    let lastError: string | null = null;
    for (;;) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return;
            }
            lastError = `HTTP ${response.status}`;
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
        }
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error(`Timed out waiting for ${url}${lastError ? ` (${lastError})` : ''}`);
        }
        await Bun.sleep(50);
    }
}

async function killProcess(proc: ReturnType<typeof Bun.spawn> | null | undefined, timeoutMs = 3000): Promise<void> {
    if (!proc) {
        return;
    }
    try {
        proc.kill('SIGTERM');
    } catch {
        // ignore
    }
    const startedAt = Date.now();
    for (;;) {
        const exited = await Promise.race([
            proc.exited.then(() => true).catch(() => true),
            Bun.sleep(50).then(() => false),
        ]);
        if (exited) {
            return;
        }
        if (Date.now() - startedAt > timeoutMs) {
            break;
        }
    }
    try {
        proc.kill('SIGKILL');
    } catch {
        // ignore
    }
    await proc.exited.catch(() => {});
}

class JitterWebSocket {
    readonly socket: WebSocket;
    readonly #cfg: LinkConfig;
    readonly #rand: () => number;
    readonly stats = {
        c2sSends: 0,
        c2sBytes: 0,
        s2cFrames: 0,
        s2cBytes: 0,
    };

    onMessage: ((data: unknown) => void) | null = null;
    onError: ((err: unknown) => void) | null = null;
    onClose: ((ev: CloseEvent) => void) | null = null;

    constructor(url: string, cfg: LinkConfig) {
        this.socket = new WebSocket(url);
        this.#cfg = cfg;
        this.#rand = xorshift32(cfg.seed);

        this.socket.addEventListener('message', (event: MessageEvent) => {
            const data: unknown = event.data;
            const delay = resolveDelayMs(cfg.s2cBaseMs, cfg.s2cJitterMs, this.#rand);
            this.stats.s2cFrames += 1;
            if (typeof data === 'string') {
                this.stats.s2cBytes += data.length;
            } else if (data instanceof ArrayBuffer) {
                this.stats.s2cBytes += data.byteLength;
            } else if (data instanceof Uint8Array) {
                this.stats.s2cBytes += data.byteLength;
            }
            setTimeout(() => this.onMessage?.(data), delay);
        });
        this.socket.addEventListener('error', (event) => this.onError?.(event));
        this.socket.addEventListener('close', (event: CloseEvent) => this.onClose?.(event));
    }

    send(data: string | ArrayBuffer | Uint8Array): void {
        const delay = resolveDelayMs(this.#cfg.c2sBaseMs, this.#cfg.c2sJitterMs, this.#rand);
        this.stats.c2sSends += 1;
        if (typeof data === 'string') {
            this.stats.c2sBytes += data.length;
        } else if (data instanceof Uint8Array) {
            this.stats.c2sBytes += data.byteLength;
        } else if (data instanceof ArrayBuffer) {
            this.stats.c2sBytes += data.byteLength;
        }

        setTimeout(() => this.socket.send(data), delay);
    }

    close(): void {
        this.socket.close();
    }
}

async function waitForGo(ws: JitterWebSocket, timeoutMs = 8000): Promise<void> {
    const startedAt = Date.now();
    return new Promise<void>((resolve, reject) => {
        const timer = setInterval(() => {
            if (Date.now() - startedAt > timeoutMs) {
                clearInterval(timer);
                reject(new Error('Timed out waiting for go handshake'));
            }
        }, 25);

        const previous = ws.onMessage;
        ws.onMessage = (data) => {
            previous?.(data);
            if (typeof data === 'string' && data === 'go') {
                clearInterval(timer);
                resolve();
            }
        };
    });
}

type PendingTrial = {
    seq: number;
    sentAt: number;
    gotFirstSignal: boolean;
    signalLatencyMs: number | null;
    firstSignalSuppressed: boolean | null;
    gotFirstMove: boolean;
    moveLatencyMs: number | null;
    correctionCount: number;
    rejectCount: number;
};

function quantile(values: number[], q: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
    return sorted[idx] ?? 0;
}

async function loginAndAttachPump(ws: JitterWebSocket): Promise<LoginResult> {
    const inbox: unknown[] = [];
    ws.onMessage = (data) => inbox.push(data);

    await waitForGo(ws);

    ws.send(encodeClientToServerProtocolActionBinary([Types.Messages.HELLO, 'latency-bot', 2, 60]));

    const startedAt = Date.now();
    for (;;) {
        if (Date.now() - startedAt > 30_000) {
            throw new Error('Timed out waiting for WELCOME');
        }
        const next = inbox.shift();
        if (!next) {
            await Bun.sleep(5);
            continue;
        }
        if (!(next instanceof ArrayBuffer || next instanceof Uint8Array)) {
            continue;
        }

        const actions: unknown[][] = [];
        dispatchBinaryActionBatchPayload(next, {
            onEntityStateBatchEntry: () => {},
            onServerAction: (action) => {
                actions.push(action);
            },
        });

        const welcome = actions.find((action) => action[0] === Types.Messages.WELCOME);
        if (!welcome) {
            continue;
        }
        const id = welcome[1];
        const x = welcome[3];
        const y = welcome[4];
        if (typeof id !== 'number' || typeof x !== 'number' || typeof y !== 'number') {
            continue;
        }
        return { ws: ws.socket, localWireId: id, startX: x, startY: y };
    }
}

async function runTrials(
    ws: JitterWebSocket,
    login: LoginResult,
    cfg: ScenarioConfig
): Promise<{
    results: TrialResult[];
    linkStats: typeof ws.stats;
}> {
    const results: TrialResult[] = [];
    let nextSeq = 1;

    let localX = login.startX;
    let localY = login.startY;

    const pending: PendingTrial | null = null;
    let active: PendingTrial | null = pending;

    ws.onMessage = (data) => {
        if (!(data instanceof ArrayBuffer || data instanceof Uint8Array)) {
            return;
        }
        dispatchBinaryActionBatchPayload(data, {
            onEntityStateBatchEntry: () => {},
            onServerAction: (action) => {
                const opcode = action[0];
                if (opcode === Types.Messages.MOVE) {
                    const id = action[1];
                    const x = action[2];
                    const y = action[3];
                    if (typeof id !== 'number' || typeof x !== 'number' || typeof y !== 'number') {
                        return;
                    }
                    if (id !== login.localWireId) {
                        return;
                    }
                    localX = x;
                    localY = y;
                    if (active && !active.gotFirstMove) {
                        active.gotFirstMove = true;
                        active.moveLatencyMs = performance.now() - active.sentAt;
                    }
                    return;
                }
                if (opcode === Types.Messages.MOVE_SYNC) {
                    const ackSeq = action[1];
                    const x = action[2];
                    const y = action[3];
                    const flags = action[5];
                    if (
                        typeof ackSeq !== 'number' ||
                        typeof x !== 'number' ||
                        typeof y !== 'number' ||
                        typeof flags !== 'number'
                    ) {
                        return;
                    }
                    if (active && !active.gotFirstSignal && ackSeq >= active.seq) {
                        active.gotFirstSignal = true;
                        active.signalLatencyMs = performance.now() - active.sentAt;
                        active.firstSignalSuppressed = (flags & 1) !== 0;
                    }
                    const moved = x !== localX || y !== localY;
                    localX = x;
                    localY = y;
                    if (moved && active && !active.gotFirstMove) {
                        active.gotFirstMove = true;
                        active.moveLatencyMs = performance.now() - active.sentAt;
                    }
                    return;
                }
                if (opcode === Types.Messages.CORRECTION) {
                    const seq = action[1];
                    if (active && typeof seq === 'number' && seq >= active.seq) {
                        active.correctionCount += 1;
                    }
                    return;
                }
                if (opcode === Types.Messages.REJECT) {
                    const seq = action[1];
                    if (active && typeof seq === 'number' && seq >= active.seq) {
                        active.rejectCount += 1;
                    }
                }
            },
        });
    };

    const directions = [MOVE_INPUT_KEY_D, MOVE_INPUT_KEY_W, MOVE_INPUT_KEY_A, MOVE_INPUT_KEY_S] as const;
    let chosenDirection = MOVE_INPUT_KEY_D;
    let chosenClickTarget: { x: number; y: number } | null = null;

    // Probe a valid movement direction/target once to keep trial results meaningful (avoid wall-blocked trials).
    if (cfg.mode === 'wasd') {
        for (const keysMask of directions) {
            const seq = nextSeq++;
            active = {
                seq,
                sentAt: performance.now(),
                gotFirstSignal: false,
                signalLatencyMs: null,
                firstSignalSuppressed: null,
                gotFirstMove: false,
                moveLatencyMs: null,
                correctionCount: 0,
                rejectCount: 0,
            };
            const payload = encodeMoveInputIntentPayload({ keysMask });
            if (payload === null) {
                continue;
            }
            ws.send(encodeClientToServerProtocolActionBinary([Types.Messages.INTENT, seq, INTENT_MOVE_INPUT, payload]));
            const waitStart = Date.now();
            while (!active.gotFirstMove && Date.now() - waitStart < 1500) {
                await Bun.sleep(10);
            }
            const stopSeq = nextSeq++;
            const stopPayload = encodeMoveInputIntentPayload({ keysMask: 0 });
            if (stopPayload !== null) {
                ws.send(
                    encodeClientToServerProtocolActionBinary([
                        Types.Messages.INTENT,
                        stopSeq,
                        INTENT_MOVE_INPUT,
                        stopPayload,
                    ])
                );
            }
            if (active.gotFirstMove) {
                chosenDirection = keysMask;
                break;
            }
        }
        await Bun.sleep(100);
    } else {
        const candidates = [
            { x: localX + 6, y: localY },
            { x: localX - 6, y: localY },
            { x: localX, y: localY + 6 },
            { x: localX, y: localY - 6 },
        ];
        for (const candidate of candidates) {
            const seq = nextSeq++;
            active = {
                seq,
                sentAt: performance.now(),
                gotFirstSignal: false,
                signalLatencyMs: null,
                firstSignalSuppressed: null,
                gotFirstMove: false,
                moveLatencyMs: null,
                correctionCount: 0,
                rejectCount: 0,
            };
            const payload = encodeMoveToIntentPayload({ x: candidate.x, y: candidate.y, stopAdjacentToTarget: false });
            if (payload === null) {
                continue;
            }
            ws.send(encodeClientToServerProtocolActionBinary([Types.Messages.INTENT, seq, INTENT_MOVE_TO, payload]));
            const waitStart = Date.now();
            while (!active.gotFirstMove && Date.now() - waitStart < 2000) {
                await Bun.sleep(10);
            }
            if (active.gotFirstMove) {
                chosenClickTarget = candidate;
                break;
            }
        }
        await Bun.sleep(100);
    }

    for (let i = 0; i < cfg.trials; i += 1) {
        const seq = nextSeq++;
        active = {
            seq,
            sentAt: performance.now(),
            gotFirstSignal: false,
            signalLatencyMs: null,
            firstSignalSuppressed: null,
            gotFirstMove: false,
            moveLatencyMs: null,
            correctionCount: 0,
            rejectCount: 0,
        };

        if (cfg.mode === 'wasd') {
            const payload = encodeMoveInputIntentPayload({ keysMask: chosenDirection });
            if (payload === null) {
                results.push({
                    okSignal: false,
                    okMove: false,
                    signalLatencyMs: null,
                    moveLatencyMs: null,
                    firstSignalSuppressed: null,
                    correctionCount: 0,
                    rejectCount: 0,
                });
                continue;
            }
            ws.send(encodeClientToServerProtocolActionBinary([Types.Messages.INTENT, seq, INTENT_MOVE_INPUT, payload]));
        } else {
            const candidate = chosenClickTarget ?? { x: localX + 6, y: localY };
            const payload = encodeMoveToIntentPayload({ x: candidate.x, y: candidate.y, stopAdjacentToTarget: false });
            if (payload === null) {
                results.push({
                    okSignal: false,
                    okMove: false,
                    signalLatencyMs: null,
                    moveLatencyMs: null,
                    firstSignalSuppressed: null,
                    correctionCount: 0,
                    rejectCount: 0,
                });
                continue;
            }
            ws.send(encodeClientToServerProtocolActionBinary([Types.Messages.INTENT, seq, INTENT_MOVE_TO, payload]));
        }

        const signalStart = Date.now();
        while (!active.gotFirstSignal && Date.now() - signalStart < 2000) {
            await Bun.sleep(10);
        }
        const moveStart = Date.now();
        while (!active.gotFirstMove && Date.now() - moveStart < 3000) {
            await Bun.sleep(10);
        }

        if (cfg.mode === 'wasd') {
            // Stop: do not leave the server thinking we're holding a key.
            const stopSeq = nextSeq++;
            const stopPayload = encodeMoveInputIntentPayload({ keysMask: 0 });
            if (stopPayload !== null) {
                ws.send(
                    encodeClientToServerProtocolActionBinary([
                        Types.Messages.INTENT,
                        stopSeq,
                        INTENT_MOVE_INPUT,
                        stopPayload,
                    ])
                );
            }
        }

        results.push({
            okSignal: active.gotFirstSignal,
            okMove: active.gotFirstMove,
            signalLatencyMs: active.signalLatencyMs,
            moveLatencyMs: active.moveLatencyMs,
            firstSignalSuppressed: active.firstSignalSuppressed,
            correctionCount: active.correctionCount,
            rejectCount: active.rejectCount,
        });

        await Bun.sleep(50);
    }

    return { results, linkStats: ws.stats };
}

function summarize(
    label: string,
    results: TrialResult[],
    stats: LinkConfig,
    link: { c2sSends: number; c2sBytes: number; s2cFrames: number; s2cBytes: number }
) {
    const okSignal = results.filter((r) => r.okSignal && typeof r.signalLatencyMs === 'number') as Array<
        TrialResult & { signalLatencyMs: number }
    >;
    const okMove = results.filter((r) => r.okMove && typeof r.moveLatencyMs === 'number') as Array<
        TrialResult & { moveLatencyMs: number }
    >;
    const signalLat = okSignal.map((r) => r.signalLatencyMs);
    const moveLat = okMove.map((r) => r.moveLatencyMs);
    const rejects = results.reduce((sum, r) => sum + r.rejectCount, 0);
    const corrections = results.reduce((sum, r) => sum + r.correctionCount, 0);
    const signalAvg = signalLat.length ? signalLat.reduce((a, b) => a + b, 0) / signalLat.length : 0;
    const moveAvg = moveLat.length ? moveLat.reduce((a, b) => a + b, 0) / moveLat.length : 0;
    const suppressed = results.filter((r) => r.firstSignalSuppressed === true).length;
    const unsuppressed = results.filter((r) => r.firstSignalSuppressed === false).length;

    const report = {
        label,
        link: {
            c2s: { baseMs: stats.c2sBaseMs, jitterMs: stats.c2sJitterMs },
            s2c: { baseMs: stats.s2cBaseMs, jitterMs: stats.s2cJitterMs },
            seed: stats.seed,
        },
        trials: results.length,
        ok: { signal: okSignal.length, move: okMove.length },
        signalLatencyMs: {
            avg: Number(signalAvg.toFixed(2)),
            p50: Number(quantile(signalLat, 0.5).toFixed(2)),
            p95: Number(quantile(signalLat, 0.95).toFixed(2)),
            max: Number((signalLat.length ? Math.max(...signalLat) : 0).toFixed(2)),
        },
        moveLatencyMs: {
            avg: Number(moveAvg.toFixed(2)),
            p50: Number(quantile(moveLat, 0.5).toFixed(2)),
            p95: Number(quantile(moveLat, 0.95).toFixed(2)),
            max: Number((moveLat.length ? Math.max(...moveLat) : 0).toFixed(2)),
        },
        firstSignal: { suppressed, unsuppressed },
        outcomes: { rejects, corrections },
        transport: {
            c2sSends: link.c2sSends,
            c2sBytes: link.c2sBytes,
            s2cFrames: link.s2cFrames,
            s2cBytes: link.s2cBytes,
        },
    };
    console.log(JSON.stringify(report, null, 2));
}

async function startServer() {
    const repoRoot = new URL('../..', import.meta.url).pathname;
    const port = await getFreePort();
    const configPath = `${repoRoot}/server/.tmp-config.latency-harness-${port}.json`;
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
    const proc = Bun.spawn({
        cmd: ['bun', 'server/entry.ts', configPath],
        cwd: repoRoot,
        stdout: 'ignore',
        stderr: 'pipe',
    });
    await waitForHttpOk(`http://127.0.0.1:${port}/status`, 8000);
    return { port, proc, configPath };
}

async function main(): Promise<void> {
    const link: LinkConfig = {
        c2sBaseMs: parseArgNumber('--c2s', 80),
        c2sJitterMs: parseArgNumber('--c2s-jitter', 20),
        s2cBaseMs: parseArgNumber('--s2c', 80),
        s2cJitterMs: parseArgNumber('--s2c-jitter', 20),
        seed: parseArgNumber('--seed', 123456),
    };

    const mode = parseArgString('--mode', ['wasd', 'click'] as const, 'wasd');
    const trials = parseArgNumber('--trials', 30);

    const server = await startServer();
    try {
        const ws = new JitterWebSocket(`ws://127.0.0.1:${server.port}/ws`, link);
        const login = await loginAndAttachPump(ws);
        const { results, linkStats } = await runTrials(ws, login, { trials, mode });
        summarize(`movement-latency:${mode}`, results, link, linkStats);
        ws.close();
    } finally {
        await killProcess(server.proc);
        try {
            await Bun.file(server.configPath).delete();
        } catch {
            // ignore
        }
    }
}

await main();
