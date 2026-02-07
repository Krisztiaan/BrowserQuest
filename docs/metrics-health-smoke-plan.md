# Metrics Healthy-Path Smoke Plan

## Goal

Validate that the server runs with `metrics_enabled: true` on a real memcache-backed path (not fallback/no-op), while keeping default local/CI flows dependency-free.

## Constraints

- Default verification (`verify:modern`, `verify:legacy`) must remain green without memcache package/daemon.
- Healthy metrics smoke should be opt-in and environment-gated.
- Failures should be actionable for operators.

## Proposed gating strategy

1. Keep current fallback-path coverage in default suites:
- `tests/smoke/server-handshake.test.ts`
- `tests/smoke/server-structured-logs.lifecycle.test.ts`

2. Add optional healthy-path smoke behind env gate:
- test file: `tests/smoke/server-metrics-healthy.optional.test.ts`
- enable with: `BQ_TEST_METRICS_HEALTH=1`
- dedicated command: `bun run test:metrics:healthy` (runs preflight first)

3. Do not wire healthy-path smoke into default CI until memcache service provisioning is standardized.

## Environment prerequisites (for optional healthy smoke)

- Memcache package installed in runtime environment:
  - `bun add memcache`
- Memcached daemon reachable:
  - default host/port: `127.0.0.1:11211` (or override via env)
- Server config fields present and valid:
  - `metrics_enabled: true`
  - `memcached_host`
  - `memcached_port`
  - `server_name`
  - `game_servers`

Preflight command:

- `bun run check:metrics:healthy-prereqs`
  - verifies `memcache` package is installed.
  - verifies memcached is reachable at `BQ_TEST_METRICS_HOST:BQ_TEST_METRICS_PORT` (defaults `127.0.0.1:11211`).

## Optional CI workflow runbook

Workflow: `.github/workflows/verify-metrics-healthy.yml`

- Trigger: GitHub Actions UI -> `verify-metrics-healthy` -> `Run workflow`.
- Provisioning: job starts a memcached service container (`127.0.0.1:11211`), installs `memcache`, and runs `bun run test:metrics:healthy`.

Expected success signals:

- preflight logs:
  - `metrics-healthy-prereqs: ok (...)`
- test output:
  - optional healthy smoke executes (not skipped) and passes.
  - no `server.metrics.unavailable` fallback event in parsed structured logs.
  - `server.metrics.ready` is observed.

Common failure triage:

- `metrics-healthy-prereqs: fail (Missing optional dependency "memcache" ...)`
  - ensure workflow step `Install optional metrics dependency` completed successfully.
- `metrics-healthy-prereqs: fail (Memcached is not reachable ...)`
  - inspect memcached service startup and `Wait for memcached service` step logs.
- healthy smoke fails on fallback event:
  - inspect structured log lines for `server.metrics.unavailable`.
  - verify config fields injected by test are valid (`memcached_host`, `memcached_port`, `server_name`, `game_servers`).

## Pass/fail criteria (healthy smoke)

- Server starts and serves `/status`.
- WebSocket handshake returns initial `"go"`.
- No fallback event is emitted:
  - `server.metrics.unavailable`
- Explicit positive metrics-ready signal is emitted and asserted:
  - `server.metrics.ready`

## Follow-up implementation tickets

- Dedicated optional CI profile exists:
  - `.github/workflows/verify-metrics-healthy.yml`
  - trigger manually via `workflow_dispatch` to validate healthy metrics path in automation without affecting default verify gates.
