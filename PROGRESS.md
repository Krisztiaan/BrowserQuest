# BrowserQuest Modernization Progress

This is the live execution notebook for `PLAN.md`.

## Current Constraints

- Branch: `modern/cx`.
- Use `rtk` for commands.
- Do not revert unrelated user changes.
- Keep `PLAN.md` as the live plan and update it when investigations change scope or order.
- Treat `EXTERNAL-AUDIT.md` as evidence until Phase 0A archives/imports it.
- Do not run write-capable legacy map or tileset tools unless the relevant ticket explicitly requires it.

## Current Working Tree Snapshot

- `PLAN.md` is untracked plan work from the planning phase.
- `EXTERNAL-AUDIT.md` is untracked external evidence from the audit phase.

## Ticket Log

### 2026-06-10 11:00 - Ticket 0.1 Restore Formatting Baseline

- Status: done
- Scope:
  - Fix only current formatting failures in the configured Prettier lane.
  - Do not broaden Prettier scope.
- Key actions:
  - Created `PROGRESS.md` as the live notebook.
  - Confirmed the formatting failure was scoped to `server/log.ts`.
  - Ran the configured formatter.
- Evidence:
  - `rtk bun run format:check`: failed before fix with `server/log.ts`.
  - `rtk bun run format`: rewrote `server/log.ts`; all other configured files unchanged.
  - `rtk bun run format:check`: pass, `All matched files use Prettier code style!`
  - `rtk git diff --check`: pass.
- Next action:
  - Commit Ticket 0.1 and start Ticket 0.2 typecheck baseline.

### 2026-06-10 11:10 - Ticket 0.2 Restore TypeScript Baseline

- Status: done
- Scope:
  - Fix current `bun run typecheck` failures without feature refactors or map-pack behavior changes.
- Key actions:
  - Ticket 0.1 committed as execution baseline.
  - Fixed combat windup logging position narrowing in `server/world/ecs-command-pipeline.ts`.
  - Preserved branded `GridPos` through `resolvePlanOrigin` in `client-command-apply-system.ts`.
  - Extended the movement prediction host player contract to match `VisualBridgeCharacterLike`.
  - Replaced fragile non-character interpolation narrowing with an explicit adapter/predicate pair.
  - Updated `tests/unit/mmo/server-door-traversal.test.ts` to use the current `world_01` map id contract.
- Evidence:
  - `rtk bun run typecheck`: failed before fixes with TS18048, TS2345, VisualBridgeCharacterLike, and `never` narrowing errors.
  - `rtk bun run typecheck`: pass after fixes.
  - `rtk bun test tests/unit/ecs/client-attack-intent-follow.test.ts tests/unit/ecs/client-auto-aggro-system.test.ts tests/unit/mmo/server-door-traversal.test.ts --timeout 20000`: pass, 17 pass / 0 fail.
- Next action:
  - Commit Ticket 0.2 and start Ticket 0.3 lint baseline.

### 2026-06-10 11:20 - Ticket 0.3 Restore Lint Baseline

- Status: done
- Scope:
  - Fix current lint errors after Ticket 0.2.
  - Keep changes mechanical and local.
- Key actions:
  - Ticket 0.2 committed.
  - Captured current lint baseline: 25 errors and 96 warnings.
  - Ran ESLint autofix; remaining lint baseline is 7 errors and 83 warnings.
- Evidence:
  - `rtk bun run lint`: failed, 25 errors / 96 warnings.
  - `rtk bun x eslint --fix "client/**/*.{ts,js}" "server/**/*.{ts,js}" "shared/**/*.{ts,js}" "tools/**/*.ts" "tests/**/*.ts"`: failed after autofix with 7 errors / 83 warnings.
  - `rtk bun run lint`: failed, 0 errors / 67 warnings after unused-declaration cleanup.
  - `rtk bun run lint`: passed with `--max-warnings=0` after typed warning cleanup.
  - `rtk bun run typecheck`: initially failed on position narrowing and queue reads; fixed with explicit local guards/helpers.
  - `rtk bun run lint`: passed after typecheck follow-up.
  - `rtk bun run typecheck`: passed.
  - `rtk bun run format:check`: passed.
  - `rtk git commit -m "fix: restore lint baseline"`: committed Ticket 0.3.
- Next action:
  - Proceed to Ticket 0.4 test baseline.

### 2026-06-10 11:32 - Ticket 0.4 Restore Current Unit and Smoke Test Baseline

- Status: done
- Scope:
  - Refresh and fix the focused smoke/unit failures listed in `PLAN.md`.
  - Preserve the intended startup-preflight, door teleport, and chunk resync semantics.
- Key actions:
  - Ticket 0.3 committed as `22916e8 fix: restore lint baseline`.
  - Updated smoke tests to assert the canonical runtime map source error and reason.
  - Confirmed door traversal focused tests already pass under the current `world_01` fixture from Ticket 0.2.
  - Fixed stale `world` scoped fixtures in chunk resync, chunk AOI pruning, and transitional C2S teleport allowlist tests.
- Evidence:
  - `rtk bun test tests/smoke/server/config-preflight.test.ts tests/smoke/server/config-preflight-entry.test.ts tests/unit/mmo/server-door-traversal.test.ts tests/unit/mmo/server-chunk-resync-fallback.test.ts --timeout 20000`: initially failed 3 tests, then passed 10 pass / 0 fail after smoke wording and chunk scoped-key fixes.
  - `rtk bun test --timeout 20000`: initially failed 2 additional stale `world` fixture tests, then passed 619 pass / 1 skip / 0 fail across 620 tests.
  - `rtk bun test ./tests/unit/mmo/server-chunk-aoi-snapshots.test.ts ./tests/unit/mmo/server-c2s-teleport-deny.test.ts --timeout 20000`: passed 4 pass / 0 fail after stale map-id fixture fixes.
  - `rtk bun run lint`: passed.
  - `rtk bun run typecheck`: passed.
  - `rtk bun run format:check`: passed.
  - `rtk git commit -m "fix: restore test baseline"`: committed Ticket 0.4.
- Next action:
  - Proceed to Ticket 0.5 dependency audit baseline.

### 2026-06-10 11:37 - Ticket 0.5 Restore Dependency Audit Baseline

- Status: done
- Scope:
  - Capture current dependency audit output.
  - Resolve or explicitly document remaining dependency risk per `PLAN.md`.
- Key actions:
  - Ticket 0.4 committed as `4d6dd17 fix: restore test baseline`.
  - Captured audit failures in ESLint tooling transitive dependencies: `minimatch`, `brace-expansion`, `flatted`, and `picomatch`.
  - Applied compatible dev-tooling updates for ESLint, TypeScript ESLint, Playwright, Bun types, globals, and Prettier.
  - Added flat Bun overrides for `minimatch`, `brace-expansion`, `flatted`, and `picomatch`; no runtime dependency was added.
  - Ran ESLint autofix for new lint behavior from the updated TypeScript ESLint stack, then restored explicit type-safe narrowing where autofix was too aggressive.
  - Completed Ticket 1.2 early by generating `assets/maps/runtime/map-pack.json`, because `verify:modern` could not pass with the missing/outdated runtime map-pack artifact.
- Evidence:
  - `rtk bun audit`: initially failed with 12 vulnerabilities, then passed with `No vulnerabilities found`.
  - `rtk bun install --frozen-lockfile`: passed.
  - `rtk bun run build:maps`: generated `assets/maps/runtime/map-pack.json`.
  - `rtk bun run check:maps`: passed, map pack is up to date.
  - `rtk bun run lint`: passed after ESLint autofix and narrow manual type fixes.
  - `rtk bun run typecheck`: passed.
  - `rtk bun run verify:modern`: passed, including 619 pass / 1 skip / 0 fail tests plus client/server builds.
  - `rtk git commit -m "chore: refresh dependency audit and map-pack baselines"`: committed Ticket 0.5 and the early Ticket 1.2 generated map-pack artifact.
- Next action:
  - Proceed to Phase 0A project-surface cleanup inventory.
