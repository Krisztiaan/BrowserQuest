import { parseCliArgs } from '../shared/cli-args';

export type SoakArgs = Readonly<{
    host: string;
    port: number | null;
    seconds: number;
    bots: number;
    moveHz: number;
    enableChunks: boolean;
    chunkRadius: number;
    tileEdits: Readonly<{
        enabled: boolean;
        mode: 'leader' | 'all' | 'none';
        hz: number;
    }>;
    spawnServer: boolean;
    serverConfigPath: string | null;
    fixedSpawn: Readonly<{
        enabled: boolean;
        areaIndex: number;
        center: boolean;
    }>;
    budget: Readonly<{
        maxConnectErrors: number;
        minWelcomeRate: number;
        minChunkSnapshotsPerBot: number;
        maxChunkDeltaApplyFailures: number;
        minObserverPeerEdits: number;
        maxAvgAckRttMs: number;
        maxCorrectionsPerMinute: number;
        maxRejectsPerMinute: number;
    }>;
}>;

function printUsageAndExit(code: number): never {
    // Keep this terse; TODO.md is the canonical plan. This is for quick CLI help.
    console.error(
        [
            'Usage: bun run bots:soak -- [options]',
            '',
            'Options:',
            '  --bots N                 number of bots (default: 5)',
            '  --seconds N              run duration (default: 30)',
            '  --move-hz N              moves per second per bot (default: 2)',
            '  --host HOST              server host (default: 127.0.0.1)',
            '  --port PORT              server port (required if not --spawn-server)',
            '  --spawn-server            spawn a local server with temp config (default: true)',
            '  --server-config PATH      use an explicit server config when spawning',
            '  --fixed-spawn             force deterministic spawn (default: true)',
            '  --fixed-spawn-area-index N  starting area index (default: 0)',
            '  --fixed-spawn-center      spawn at area center (default: true)',
            '  --enable-chunks           send CHUNK_SUBSCRIBE and apply snapshots/deltas (default: false)',
            '  --chunk-radius N          subscription radius (default: 0)',
            '  --enable-tile-edits       send tile.edit intents (default: false)',
            '  --tile-edit-mode MODE     leader|all|none (default: leader)',
            '  --tile-edit-hz N          edits per second (default: 1)',
            '',
            'Budgets:',
            '  --budget-connect-errors N         (default: 0)',
            '  --budget-min-welcome-rate N       (default: 1)',
            '  --budget-min-chunk-snapshots-per-bot N (default: 1)',
            '  --budget-max-chunk-delta-apply-failures N (default: 0)',
            '  --budget-min-observer-peer-edits N (default: 1)',
            '  --budget-avg-ack-rtt-ms N         (default: 200)',
            '  --budget-corrections-per-minute N (default: 10)',
            '  --budget-rejects-per-minute N     (default: 10)',
        ].join('\n')
    );
    process.exit(code);
}

export function parseSoakArgs(argv: string[]): SoakArgs {
    const parsed = parseCliArgs(
        argv,
        [
            { key: 'host', kind: 'string', defaultValue: '127.0.0.1' },
            { key: 'port', kind: 'number' },
            { key: 'seconds', kind: 'number', defaultValue: 30 },
            { key: 'bots', kind: 'number', defaultValue: 5 },
            { key: 'move-hz', kind: 'number', defaultValue: 2 },
            { key: 'enable-chunks', kind: 'boolean', defaultValue: false },
            { key: 'chunk-radius', kind: 'number', defaultValue: 0 },
            { key: 'enable-tile-edits', kind: 'boolean', defaultValue: false },
            { key: 'tile-edit-mode', kind: 'string', defaultValue: 'leader' },
            { key: 'tile-edit-hz', kind: 'number', defaultValue: 1 },
            { key: 'spawn-server', kind: 'boolean', defaultValue: true },
            { key: 'server-config', kind: 'string' },
            { key: 'fixed-spawn', kind: 'boolean', defaultValue: true },
            { key: 'fixed-spawn-area-index', kind: 'number', defaultValue: 0 },
            { key: 'fixed-spawn-center', kind: 'boolean', defaultValue: true },
            { key: 'budget-connect-errors', kind: 'number', defaultValue: 0 },
            { key: 'budget-min-welcome-rate', kind: 'number', defaultValue: 1 },
            { key: 'budget-min-chunk-snapshots-per-bot', kind: 'number', defaultValue: 1 },
            { key: 'budget-max-chunk-delta-apply-failures', kind: 'number', defaultValue: 0 },
            { key: 'budget-min-observer-peer-edits', kind: 'number', defaultValue: 1 },
            { key: 'budget-avg-ack-rtt-ms', kind: 'number', defaultValue: 200 },
            { key: 'budget-corrections-per-minute', kind: 'number', defaultValue: 10 },
            { key: 'budget-rejects-per-minute', kind: 'number', defaultValue: 10 },
        ],
        { onHelp: () => printUsageAndExit(0) }
    );

    const bots = Math.max(1, Math.floor(parsed.bots as number));
    const seconds = Math.max(1, Math.floor(parsed.seconds as number));
    const moveHz = Math.max(0, Math.floor(parsed['move-hz'] as number));
    const enableChunks = Boolean(parsed['enable-chunks']);
    const chunkRadius = Math.max(0, Math.floor(parsed['chunk-radius'] as number));
    const tileEditModeRaw =
        typeof parsed['tile-edit-mode'] === 'string' ? String(parsed['tile-edit-mode']).trim() : 'leader';
    const tileEditMode = tileEditModeRaw === 'all' || tileEditModeRaw === 'none' ? tileEditModeRaw : 'leader';
    const tileEditsEnabled = Boolean(parsed['enable-tile-edits']);
    const tileEditHz = Math.max(0, Math.floor(parsed['tile-edit-hz'] as number));

    const spawnServer = Boolean(parsed['spawn-server']);
    const host = String(parsed.host);
    const port = typeof parsed.port === 'number' ? Math.floor(parsed.port) : null;
    const serverConfigPath =
        typeof parsed['server-config'] === 'string' ? String(parsed['server-config']).trim() : null;
    const fixedSpawn = Object.freeze({
        enabled: Boolean(parsed['fixed-spawn']),
        areaIndex: Math.max(0, Math.floor(parsed['fixed-spawn-area-index'] as number)),
        center: Boolean(parsed['fixed-spawn-center']),
    });

    if (!spawnServer && (port === null || port <= 0)) {
        throw new Error('Missing --port (required when --spawn-server is not set).');
    }

    const budget = Object.freeze({
        maxConnectErrors: Math.max(0, Math.floor(parsed['budget-connect-errors'] as number)),
        minWelcomeRate: Math.max(0, Math.min(1, Number(parsed['budget-min-welcome-rate'] as number))),
        minChunkSnapshotsPerBot: Math.max(0, Math.floor(parsed['budget-min-chunk-snapshots-per-bot'] as number)),
        maxChunkDeltaApplyFailures: Math.max(0, Math.floor(parsed['budget-max-chunk-delta-apply-failures'] as number)),
        minObserverPeerEdits: Math.max(0, Math.floor(parsed['budget-min-observer-peer-edits'] as number)),
        maxAvgAckRttMs: Math.max(0, Math.floor(parsed['budget-avg-ack-rtt-ms'] as number)),
        maxCorrectionsPerMinute: Math.max(0, Math.floor(parsed['budget-corrections-per-minute'] as number)),
        maxRejectsPerMinute: Math.max(0, Math.floor(parsed['budget-rejects-per-minute'] as number)),
    });

    return Object.freeze({
        host,
        port,
        seconds,
        bots,
        moveHz,
        enableChunks,
        chunkRadius,
        tileEdits: Object.freeze({
            enabled: tileEditsEnabled,
            mode: tileEditMode,
            hz: tileEditHz,
        }),
        spawnServer,
        serverConfigPath,
        fixedSpawn,
        budget,
    });
}
