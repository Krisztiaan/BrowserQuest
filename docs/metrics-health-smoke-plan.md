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

Repository context:

- Upstream `mozilla/BrowserQuest` is archived/read-only in current access context, so workflow-dispatch evidence is captured on fork `Krisztiaan/BrowserQuest`.
- Baseline successful fork runs:
  - `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21773648845`
  - `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21773675770` (hardened `--no-save` step)

Observed/runtime policy matrix:

- Node: `22.x` (workflow matrix target)
- Bun: `1.3.8` (workflow matrix pin)

Revalidation trigger:

- Rerun `verify-metrics-healthy` after any Node policy change, Bun major/minor bump in CI setup, or workflow dependency-step edits.

- Trigger: GitHub Actions UI -> `verify-metrics-healthy` -> `Run workflow`.
- Provisioning: job starts a memcached service container (`127.0.0.1:11211`), installs `memcache` via `bun add --no-save memcache`, and runs `bun run test:metrics:healthy`.

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

## Fork workflow hygiene (dispatch readiness)

When validating this optional workflow on a fork where workflow files only exist on a feature branch:

1. Push the branch containing workflow definitions:
- `git push fork modernize`

2. Set fork default branch to that branch so GitHub indexes workflows:
- `gh api -X PATCH repos/<user>/BrowserQuest -f default_branch=modernize`

3. Run workflow dispatch:
- `gh workflow run verify-metrics-healthy --repo <user>/BrowserQuest --ref modernize`

4. After evidence capture, reset default branch if desired:
- `gh api -X PATCH repos/<user>/BrowserQuest -f default_branch=master`

5. Verify active workflow inventory for the current default branch:
- `gh workflow list --repo <user>/BrowserQuest`

This keeps workflow-dispatch behavior deterministic and prevents confusion about missing/404 workflows.

## Upstream alignment checklist (when write access exists)

If upstream write access to `mozilla/BrowserQuest` becomes available, replicate this setup in order:

1. Ensure branch with workflow changes is pushed to upstream.
2. Keep or add `.github/workflows/verify-metrics-healthy.yml` with:
- memcached service container
- `bun add --no-save memcache`
- `bun run test:metrics:healthy`
3. Confirm workflow appears:
- `gh workflow list --repo mozilla/BrowserQuest`
4. Trigger and verify run:
- `gh workflow run verify-metrics-healthy --repo mozilla/BrowserQuest --ref <branch>`
- `gh run watch <run-id> --repo mozilla/BrowserQuest --exit-status`
5. Capture baseline run evidence (URL/id/date) in `MODERNIZE.md`.
6. Keep default verify gates unchanged (`verify:modern`, `verify:legacy`) and leave healthy workflow optional/manual unless policy changes.

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
