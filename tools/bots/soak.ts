import { parseSoakArgs } from './args';
import { BotClient, type BotRunResult } from './bot-client';
import { cleanupLocalServer, spawnLocalServer } from './server-harness';

type Aggregate = Readonly<{
    bots: number;
    seconds: number;
    connectErrors: number;
    welcomes: number;
    closes: number;
    closeCodes: Record<string, number>;
    bytesIn: number;
    bytesOut: number;
    actionsIn: number;
    acks: number;
    rejects: number;
    corrections: number;
    avgAckRttMs: number | null;
    p95AckRttMs: number | null;
    chunkSnapshots: number;
    chunkSnapshotPayloadBytes: Readonly<{
        min: number | null;
        avg: number | null;
        p95: number | null;
        max: number | null;
    }>;
    chunkSnapshotOverrideCounts: Readonly<{
        min: number | null;
        avg: number | null;
        p95: number | null;
        max: number | null;
    }>;
    chunkDeltas: number;
    chunkDeltaPayloadBytes: Readonly<{
        min: number | null;
        avg: number | null;
        p95: number | null;
        max: number | null;
    }>;
    chunkDeltaChangeCounts: Readonly<{
        min: number | null;
        avg: number | null;
        p95: number | null;
        max: number | null;
    }>;
    chunkDeltaApplyFailures: number;
    tileEditsSent: number;
    tileEditsAcked: number;
    tileEditsRejected: number;
    observedPeerTileEdits: number;
}>;

function mean(values: number[]): number | null {
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function percentile(values: number[], p: number): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.floor((sorted.length - 1) * p);
    return sorted[idx] ?? null;
}

function stats(values: number[]): { min: number | null; avg: number | null; p95: number | null; max: number | null } {
    if (values.length === 0) {
        return { min: null, avg: null, p95: null, max: null };
    }
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < values.length; i += 1) {
        const v = values[i];
        if (v === undefined) {
            continue;
        }
        if (v < min) min = v;
        if (v > max) max = v;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return { min: null, avg: null, p95: null, max: null };
    }
    return { min, avg: mean(values), p95: percentile(values, 0.95), max };
}

function summarize(results: ReadonlyArray<BotRunResult>): Aggregate {
    let connectErrors = 0;
    let welcomes = 0;
    let closes = 0;
    const closeCodes: Record<string, number> = {};
    let bytesIn = 0;
    let bytesOut = 0;
    let actionsIn = 0;
    let acks = 0;
    let rejects = 0;
    let corrections = 0;
    let chunkSnapshots = 0;
    let chunkDeltas = 0;
    let chunkDeltaApplyFailures = 0;
    let tileEditsSent = 0;
    let tileEditsAcked = 0;
    let tileEditsRejected = 0;
    let observedPeerTileEdits = 0;
    const allRtt: number[] = [];
    const allSnapshotBytes: number[] = [];
    const allSnapshotOverrides: number[] = [];
    const allDeltaBytes: number[] = [];
    const allDeltaChanges: number[] = [];

    for (const r of results) {
        if (r.welcomeReceived) welcomes += 1;
        connectErrors += r.metrics.connectErrors;
        closes += r.metrics.closes;
        const codeKey = String(r.metrics.closeCode ?? 'null');
        closeCodes[codeKey] = (closeCodes[codeKey] ?? 0) + 1;
        bytesIn += r.metrics.bytesIn;
        bytesOut += r.metrics.bytesOut;
        actionsIn += r.metrics.actionsIn;
        acks += r.metrics.acks;
        rejects += r.metrics.rejects;
        corrections += r.metrics.corrections;
        chunkSnapshots += r.metrics.chunkSnapshots;
        chunkDeltas += r.metrics.chunkDeltas;
        chunkDeltaApplyFailures += r.metrics.chunkDeltaApplyFailures;
        tileEditsSent += r.metrics.tileEditsSent;
        tileEditsAcked += r.metrics.tileEditsAcked;
        tileEditsRejected += r.metrics.tileEditsRejected;
        observedPeerTileEdits += r.metrics.observedPeerTileEdits;
        allRtt.push(...r.metrics.ackRttMs);
        allSnapshotBytes.push(...r.metrics.chunkSnapshotPayloadBytes);
        allSnapshotOverrides.push(...r.metrics.chunkSnapshotOverrideCounts);
        allDeltaBytes.push(...r.metrics.chunkDeltaPayloadBytes);
        allDeltaChanges.push(...r.metrics.chunkDeltaChangeCounts);
    }

    return Object.freeze({
        bots: results.length,
        seconds: 0,
        connectErrors,
        welcomes,
        closes,
        closeCodes,
        bytesIn,
        bytesOut,
        actionsIn,
        acks,
        rejects,
        corrections,
        avgAckRttMs: mean(allRtt),
        p95AckRttMs: percentile(allRtt, 0.95),
        chunkSnapshots,
        chunkSnapshotPayloadBytes: Object.freeze(stats(allSnapshotBytes)),
        chunkSnapshotOverrideCounts: Object.freeze(stats(allSnapshotOverrides)),
        chunkDeltas,
        chunkDeltaPayloadBytes: Object.freeze(stats(allDeltaBytes)),
        chunkDeltaChangeCounts: Object.freeze(stats(allDeltaChanges)),
        chunkDeltaApplyFailures,
        tileEditsSent,
        tileEditsAcked,
        tileEditsRejected,
        observedPeerTileEdits,
    });
}

function fmtBytesPerSec(bytes: number, seconds: number): string {
    const perSec = seconds > 0 ? bytes / seconds : 0;
    const kbps = perSec / 1024;
    return `${kbps.toFixed(1)} KiB/s`;
}

function fail(message: string): never {
    throw new Error(message);
}

const args = (() => {
    try {
        return parseSoakArgs(process.argv.slice(2));
    } catch (err) {
        console.error(String(err));
        process.exit(2);
    }
})();

let server: Awaited<ReturnType<typeof spawnLocalServer>> | null = null;
let host = args.host;
let port = args.port;
let exitCode = 0;

try {
    if (args.spawnServer) {
        server = await spawnLocalServer({ configPath: args.serverConfigPath, fixedSpawn: args.fixedSpawn });
        host = '127.0.0.1';
        port = server.port;
    }
    if (port === null || port <= 0) {
        fail('Missing port.');
    }

    const url = `ws://${host}:${port}/ws`;
    const bots: BotClient[] = [];
    for (let i = 0; i < args.bots; i += 1) {
        const role =
            args.tileEdits.enabled && args.tileEdits.mode === 'leader'
                ? i === 0
                    ? 'leader'
                    : 'observer'
                : args.tileEdits.enabled && args.tileEdits.mode === 'all'
                  ? 'leader'
                  : 'observer';
        bots.push(
            new BotClient({
                name: `bot-${process.pid}-${i}`,
                url,
                moveHz: args.moveHz,
                enableChunks: args.enableChunks,
                chunkRadius: args.chunkRadius,
                enableTileEdits: args.tileEdits.enabled,
                tileEditHz: args.tileEdits.hz,
                role,
            })
        );
    }

    const startedAt = Date.now();
    const results = await Promise.all(bots.map((bot) => bot.runFor(args.seconds)));
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));

    const aggregate = { ...summarize(results), seconds: elapsedSeconds };
    console.log(
        JSON.stringify(
            {
                kind: 'bots_soak_summary',
                ...aggregate,
                inRate: fmtBytesPerSec(aggregate.bytesIn, elapsedSeconds),
                outRate: fmtBytesPerSec(aggregate.bytesOut, elapsedSeconds),
            },
            null,
            2
        )
    );

    const correctionsPerMinute = (aggregate.corrections / elapsedSeconds) * 60;
    const rejectsPerMinute = (aggregate.rejects / elapsedSeconds) * 60;
    const welcomeRate = aggregate.bots > 0 ? aggregate.welcomes / aggregate.bots : 0;

    if (aggregate.connectErrors > args.budget.maxConnectErrors) {
        fail(`Budget exceeded: connectErrors=${aggregate.connectErrors} > ${args.budget.maxConnectErrors}`);
    }
    if (welcomeRate < args.budget.minWelcomeRate) {
        fail(`Budget exceeded: welcomeRate=${welcomeRate.toFixed(2)} < ${args.budget.minWelcomeRate}`);
    }
    if ((aggregate.avgAckRttMs ?? 0) > args.budget.maxAvgAckRttMs) {
        fail(`Budget exceeded: avgAckRttMs=${aggregate.avgAckRttMs} > ${args.budget.maxAvgAckRttMs}`);
    }
    if (correctionsPerMinute > args.budget.maxCorrectionsPerMinute) {
        fail(
            `Budget exceeded: correctionsPerMinute=${correctionsPerMinute.toFixed(2)} > ${args.budget.maxCorrectionsPerMinute}`
        );
    }
    if (rejectsPerMinute > args.budget.maxRejectsPerMinute) {
        fail(`Budget exceeded: rejectsPerMinute=${rejectsPerMinute.toFixed(2)} > ${args.budget.maxRejectsPerMinute}`);
    }
    if (args.enableChunks) {
        const minSnapshots = results.reduce(
            (min, r) => Math.min(min, r.metrics.chunkSnapshots),
            Number.POSITIVE_INFINITY
        );
        if (minSnapshots < args.budget.minChunkSnapshotsPerBot) {
            fail(`Budget exceeded: minChunkSnapshotsPerBot=${minSnapshots} < ${args.budget.minChunkSnapshotsPerBot}`);
        }
        if (aggregate.chunkDeltaApplyFailures > args.budget.maxChunkDeltaApplyFailures) {
            fail(
                `Budget exceeded: chunkDeltaApplyFailures=${aggregate.chunkDeltaApplyFailures} > ${args.budget.maxChunkDeltaApplyFailures}`
            );
        }
    }
    if (args.enableChunks && args.tileEdits.enabled && args.tileEdits.mode === 'leader') {
        const observerResults = results
            .map((r, idx) => ({ r, role: bots[idx]?.role }))
            .filter((entry) => entry.role === 'observer')
            .map((entry) => entry.r);
        if (observerResults.length === 0) {
            fail('Budget check error: tile-edit-mode=leader requires at least one observer bot');
        }
        const minObserved = observerResults.reduce(
            (min, r) => Math.min(min, r.metrics.observedPeerTileEdits),
            Number.POSITIVE_INFINITY
        );
        if (minObserved < args.budget.minObserverPeerEdits) {
            fail(`Budget exceeded: minObserverPeerEdits=${minObserved} < ${args.budget.minObserverPeerEdits}`);
        }
    }
} catch (err) {
    exitCode = 1;
    console.error(String(err));
} finally {
    await cleanupLocalServer(server);
    process.exitCode = exitCode;
}
