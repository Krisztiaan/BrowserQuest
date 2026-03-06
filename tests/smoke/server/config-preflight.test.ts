import { afterEach, expect, test } from 'bun:test';
import { killBunProcess } from '../../support/process-cleanup';
import {
    deleteFileIfExists,
    startStructuredLogCapture,
    waitForProcessExit,
    type StructuredEventRecord,
} from '../../support/server-harness';

const repoRoot = new URL('../../..', import.meta.url).pathname;

let proc: ReturnType<typeof Bun.spawn> | null = null;
let configPath: string | null = null;
let mapPath: string | null = null;

afterEach(async () => {
    await killBunProcess(proc);
    proc = null;
    await deleteFileIfExists(configPath);
    await deleteFileIfExists(mapPath);
    configPath = null;
    mapPath = null;
});

test('server fails fast with structured config-invalid event when config preflight fails', async () => {
    configPath = `${repoRoot}/server/.tmp-config.invalid-preflight.json`;
    await Bun.write(
        configPath,
        JSON.stringify({
            port: 0,
            debug_level: 'info',
            nb_players_per_world: 5,
            nb_worlds: 1,
            map_filepath: './assets/maps/tiled/world.json',
            metrics_enabled: false,
        })
    );

    const events: StructuredEventRecord[] = [];
    const stderrLines: string[] = [];

    proc = Bun.spawn({
        cmd: ['bun', 'server/entry.ts', configPath],
        cwd: repoRoot,
        stdout: 'pipe',
        stderr: 'pipe',
    });

    startStructuredLogCapture(proc.stdout, events);
    startStructuredLogCapture(proc.stderr, events, stderrLines);

    const code = await waitForProcessExit(proc, 4000);
    expect(code).toBe(1);

    const invalidEvent = events.find((eventRecord) => eventRecord.event === 'server.config.invalid');
    const hasPreflightMessage = stderrLines.some((line) =>
        line.includes('Startup preflight: invalid server configuration')
    );
    expect(Boolean(invalidEvent) || hasPreflightMessage).toBe(true);
});

test('server fails fast when startup preflight cannot read configured map file', async () => {
    configPath = `${repoRoot}/server/.tmp-config.invalid-map-missing.json`;
    await Bun.write(
        configPath,
        JSON.stringify({
            port: 8000,
            debug_level: 'info',
            nb_players_per_world: 5,
            nb_worlds: 1,
            map_filepath: './assets/maps/tiled/does-not-exist.json',
            metrics_enabled: false,
        })
    );

    const stderrLines: string[] = [];
    proc = Bun.spawn({
        cmd: ['bun', 'server/entry.ts', configPath],
        cwd: repoRoot,
        stdout: 'pipe',
        stderr: 'pipe',
    });
    startStructuredLogCapture(proc.stderr, [], stderrLines);

    const code = await waitForProcessExit(proc, 4000);
    expect(code).toBe(1);
    expect(stderrLines.some((line) => line.includes('Startup preflight: map file missing or unreadable:'))).toBe(true);
});

test('server fails fast when startup preflight reads map JSON with invalid payload shape', async () => {
    mapPath = `${repoRoot}/server/.tmp-map.invalid-shape.json`;
    await Bun.write(mapPath, JSON.stringify({ width: 1 }));

    configPath = `${repoRoot}/server/.tmp-config.invalid-map-shape.json`;
    await Bun.write(
        configPath,
        JSON.stringify({
            port: 8000,
            debug_level: 'info',
            nb_players_per_world: 5,
            nb_worlds: 1,
            map_filepath: mapPath,
            metrics_enabled: false,
        })
    );

    const stderrLines: string[] = [];
    proc = Bun.spawn({
        cmd: ['bun', 'server/entry.ts', configPath],
        cwd: repoRoot,
        stdout: 'pipe',
        stderr: 'pipe',
    });
    startStructuredLogCapture(proc.stderr, [], stderrLines);

    const code = await waitForProcessExit(proc, 4000);
    expect(code).toBe(1);
    expect(stderrLines.some((line) => line.includes('Startup preflight: map pack file has invalid schema:'))).toBe(true);
});
