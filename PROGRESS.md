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

- 2026-06-10 10:44 UTC: `git status --short --branch` shows clean branch `modern/cx...origin/modern/cx`.
- `rtk` is not available in this shell (`zsh:1: command not found: rtk`), so verification commands in this session use the underlying `bun`/`git` commands directly and record that substitution.

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

### 2026-06-10 11:48 - Ticket 0A.1 Inventory and Classify Scripts, Tools, Docs, Plans, and Audits

- Status: done
- Scope:
  - Add read-only project surface inventory tooling, tests, generated JSON, and a human-readable summary doc.
  - Classify package scripts, content tools, docs, `PLAN.md`, `EXTERNAL-AUDIT.md`, and generated artifact policy.
- Key actions:
  - Added `tools/maintenance/project-surface-inventory.ts`.
  - Added `tests/unit/project-surface-inventory.test.ts` test-first; verified the initial missing-module failure before implementation.
  - Added `audit:project-surface` package script.
  - Added `docs/project-surface-inventory.md`.
  - Generated `artifacts/project-surface-inventory.json` with 94 entries.
- Evidence:
  - `rtk bun test tests/unit/project-surface-inventory.test.ts --timeout 20000`: first failed because the module was missing, then passed 3 pass / 0 fail.
  - `rtk bun run audit:project-surface`: passed, `Project surface inventory entries: 94`.
  - `rtk bun run typecheck:tools`: passed.
  - `rtk bun run lint`: passed.
  - `rtk git commit -m "chore: inventory project maintenance surface"`: committed Ticket 0A.1.
- Next action:
  - Proceed to Ticket 0A.2 script normalization.

### 2026-06-10 11:51 - Ticket 0A.2 Normalize Package Scripts and Check Names

- Status: done
- Scope:
  - Move stale write-capable map/tileset scripts out of the active `fix:*` lane.
  - Document active script lanes and legacy-script policy.
  - Add a package script contract test.
- Key actions:
  - Added `tests/unit/package-scripts-contract.test.ts` test-first and verified it failed against the old active `fix:*` scripts.
  - Renamed stale write scripts to `legacy:fix:*`.
  - Updated `README.md` with script lane policy.
  - Updated `docs/project-surface-inventory.md` with cleanup decisions.
  - Updated `tools/maintenance/project-surface-inventory.ts` to classify renamed legacy scripts as replacement candidates.
  - Regenerated `artifacts/project-surface-inventory.json`.
- Evidence:
  - `rtk bun test tests/unit/package-scripts-contract.test.ts --timeout 20000`: first failed on active write scripts, then passed 3 pass / 0 fail.
  - `rtk bun run audit:project-surface`: passed, `Project surface inventory entries: 94`.
  - `rtk bun run typecheck:tools`: passed.
  - `rtk bun run lint`: passed.
  - `rtk git commit -m "chore: normalize maintenance script lanes"`: committed Ticket 0A.2.
- Next action:
  - Proceed to Ticket 0A.3 docs archive/index.

### 2026-06-10 11:54 - Ticket 0A.3 Archive Historical Audits and Create Documentation Index

- Status: done
- Scope:
  - Move historical February audits behind `docs/archive/2026-02/`.
  - Import the external audit into `docs/audits/`.
  - Add docs index and README pointer.
- Key actions:
  - Added `tests/unit/docs-index.test.ts` test-first and verified it failed before the index/archive files existed.
  - Moved three February audit docs into `docs/archive/2026-02/`.
  - Added historical evidence banners to archived audits.
  - Moved `EXTERNAL-AUDIT.md` to `docs/audits/external-audit-2026-06-10.md` with an external audit evidence banner.
  - Added `docs/README.md` and README documentation pointer.
- Evidence:
  - `rtk bun test tests/unit/docs-index.test.ts --timeout 20000`: first failed on missing docs/index/archive files, then passed 4 pass / 0 fail.
  - `rtk rg -n "audit-typing-rules-streamlining|audit-legacy-parity-combat-ai" docs README.md PLAN.md`: references point to `docs/archive/2026-02/` or the plan's move instructions.
  - `rtk git status --short docs EXTERNAL-AUDIT.md README.md`: shows archive moves, imported external audit path, README update, and no root `EXTERNAL-AUDIT.md`.
  - `rtk bun run lint`: passed.
  - `rtk git diff --check`: passed.
- Next action:
  - Proceed to Ticket 0A.4 content tool quarantine.

### 2026-06-10 12:07 - Ticket 0A.4 Quarantine Superseded Content Tools

- Status: done
- Scope:
  - Move superseded content tools under `tools/content/legacy/`.
  - Rename remaining dry-run package scripts into the `legacy:` lane.
  - Update docs, Tiled project commands, and project-surface inventory output so old write tools cannot be mistaken for current map authoring workflow.
- Key actions:
  - Added `tests/unit/content-tool-surface.test.ts` test-first and confirmed it failed on the missing legacy README and old package script paths.
  - Moved six superseded tools into `tools/content/legacy/`.
  - Added `tools/content/legacy/README.md` with replacement guidance for every moved tool.
  - Updated `package.json` legacy scripts and renamed dry-run checks to `legacy:check:*`.
  - Disabled legacy Tiled write commands and updated scaffold documentation to point at Phase 2A replacement workflow.
  - Updated `tools/maintenance/project-surface-inventory.ts` and regenerated `artifacts/project-surface-inventory.json`.
- Evidence:
  - `rtk bun test tests/unit/content-tool-surface.test.ts --timeout 20000`: first failed as expected, then passed 3 pass / 0 fail.
  - `rtk bun run audit:project-surface`: passed, 95 entries.
  - `rtk rg -n "tools/content/(world-curate-portals|tileset-wang-scaffold|tileset-modernize-metadata|maps-migrate-v-to-foreground|world-standardize-pipeline|world-standardize-idiomatic)\\.ts" package.json docs README.md PLAN.md assets/maps/tiled`: remaining old-path references are only historical source paths in `PLAN.md`; active package/docs/Tiled references use `tools/content/legacy/` or replacement guidance.
  - `rtk bun run typecheck:tools`: first caught stale moved relative imports, then passed after fixing them.
  - `rtk bun run lint`: first caught the same unresolved moved imports as unsafe typed values, then passed.
  - `rtk git diff --check`: passed.
- Next action:
  - Proceed to Ticket 0A.5 clean base state gate.

### 2026-06-10 12:24 - Ticket 0A.5 Add Clean Base State Gate

- Status: done
- Scope:
  - Add an independent `check:clean-base-state` gate for docs/index/archive/script hygiene.
  - Document the gate as the pre-work hygiene check.
  - Keep the gate independent from `verify:modern`.
- Key actions:
  - Added `tools/maintenance/check-clean-base-state.ts`.
  - Added `tests/unit/clean-base-state.test.ts` test-first and confirmed it failed before the checker existed.
  - Added `check:clean-base-state` to `package.json` and documented it in `README.md`.
  - Updated stale project-surface inventory test expectations to the renamed `legacy:fix:world-portals` script.
  - Regenerated `artifacts/project-surface-inventory.json`.
- Evidence:
  - `rtk bun test tests/unit/clean-base-state.test.ts --timeout 20000`: first failed on missing checker, then passed.
  - `rtk bun test tests/unit/clean-base-state.test.ts tests/unit/project-surface-inventory.test.ts --timeout 20000`: passed 5 pass / 0 fail.
  - `rtk bun run check:clean-base-state`: passed with `Clean base state check passed.`
  - `rtk bun run audit:project-surface`: passed, 96 entries.
  - `rtk bun run typecheck:tools`: passed.
  - `rtk bun run lint`: passed.
  - `rtk git diff --check`: passed.
- Next action:
  - Proceed to Phase 1 runtime map-pack source-of-truth work.

### 2026-06-10 10:44 UTC - Ticket 1.1 Runtime Config Loads `map-pack.config.json`

- Status: done
- Scope:
  - Change default runtime config, tests, and docs so the server loads `assets/maps/tiled/map-pack.config.json`.
  - Keep raw Tiled `world.json` support only where tests/tooling explicitly validate compatibility.
  - Do not split interiors or disable `allow_missing_target_maps` in this ticket.
- TODO:
  - done: Update config-focused tests and runtime route wording for the map-pack config source.
  - done: Update `server/config.json` and `server/config_local.json-dist`.
  - done: Update README/server docs that still describe `world.json` as the runtime source.
  - done: Update production-shaped server test/harness configs to use `map-pack.config.json`.
  - done: Run focused tests plus `bun run check:maps`.
  - done: Update `PLAN.md` checkboxes and final progress evidence.
- Key actions:
  - Confirmed clean branch state with `git status --short --branch`.
  - Confirmed local command wrapper blocker: `rtk` is absent in this shell.
  - Read Ticket 1.1 requirements and current runtime config/tests/docs.
  - Changed default server configs to `./assets/maps/tiled/map-pack.config.json`.
  - Updated runtime route/preflight/factory/health tests for the map-pack config runtime source.
  - Updated server docs and production-shaped server smoke/harness config fixtures.
  - Committed Ticket 1.1 with message `feat: use map-pack config as runtime map source`.
- Evidence:
  - `git status --short --branch`: `## modern/cx...origin/modern/cx`.
  - `server/config.json` and `server/config_local.json-dist` use `./assets/maps/tiled/map-pack.config.json`.
  - `tests/unit/server/runtime/runtime-map-pack-route.test.ts` describes the runtime route as a map-pack config source.
  - `bun test tests/unit/server/runtime/runtime-map-pack-route.test.ts tests/unit/server/startup/preflight.test.ts tests/unit/server/runtime/factories.test.ts tests/smoke/server-health-version.test.ts --timeout 20000`: pass, 15 pass / 0 fail.
  - `bun run check:maps`: pass, map pack is up to date.
  - `bun run typecheck`: pass.
  - `bun run lint`: pass.
  - `bun run format:check`: pass.
  - `git diff --check`: pass.
  - `git commit -m "feat: use map-pack config as runtime map source"`: committed and amended with final live-doc metadata.
- Next action:
  - Proceed to Ticket 1.3 canonical map id work.

### 2026-06-10 10:49 UTC - Ticket 1.3 Canonicalize Map Ids to `world_01`

- Status: done
- Scope:
  - Replace authored `target_map: world` door links with `target_map: world_01`.
  - Add map-pack validation that rejects new `target_map: world` references.
  - Regenerate the runtime map-pack artifact after the structured JSON edit.
  - Do not create interior maps or alter door coordinates in this ticket.
- TODO:
  - done: Inspect current map-pack test helpers, door extraction, and authored `target_map` counts.
  - done: Add failing unit test for legacy `target_map: world`.
  - done: Implement validation in shared map-pack compilation.
  - done: Update `assets/maps/tiled/world.json` via structured JSON edit.
  - done: Regenerate `assets/maps/runtime/map-pack.json`.
  - done: Run map-pack tests, map build/check, recursive count, and static gates as needed.
  - done: Update `PLAN.md`/`PROGRESS.md` evidence and commit Ticket 1.3.
- Key actions:
  - Confirmed Ticket 1.1 commit left a clean branch ahead of origin by one commit.
  - Added a `compileMapPack` regression test that rejects `target_map: world`.
  - Added map-pack extraction validation for legacy `target_map: world`.
  - Replaced 7 authored `target_map` values from `world` to `world_01` with a structure-checked text-preserving edit.
  - Regenerated `assets/maps/runtime/map-pack.json`.
  - Committed Ticket 1.3 with message `fix: canonicalize authored map ids`.
- Evidence:
  - `git status --short --branch`: `## modern/cx...origin/modern/cx [ahead 1]`.
  - `bun test tests/unit/map-pack.test.ts --timeout 20000`: initially failed before validation, then passed 18 pass / 0 fail.
  - Recursive authored map count: `{"world":0,"world_01":7}`.
  - `bun run build:maps`: regenerated `assets/maps/runtime/map-pack.json`.
  - `bun run check:maps`: pass, map pack is up to date.
  - `bun run typecheck`: pass.
  - `bun run lint`: pass.
  - `git diff --check`: pass.
  - `git commit -m "fix: canonicalize authored map ids"`: committed and amended with final live-doc metadata.
- Next action:
  - Proceed to Ticket 1.4 explicit interior maps.

### 2026-06-10 10:56 UTC - Ticket 1.4 Create Stub Interior Maps for Existing House Links

- Status: done
- Scope:
  - Create deterministic functional stub maps for `house_01` through `house_40`.
  - Add every generated house map to `assets/maps/tiled/map-pack.config.json`.
  - Ensure every world-to-house door has a matching house entry door and reverse link.
  - Keep `allow_missing_target_maps: true`; strict missing-map enforcement is Ticket 1.5.
  - Do not design final interiors or alter world door coordinates.
- TODO:
  - done: Extract current house targets and world door contracts.
  - done: Add graph contract test for world-to-house plus reverse house link.
  - done: Replace `tools/content/house-regenerate.ts` with deterministic stub map generation/check/report behavior.
  - done: Generate `assets/maps/tiled/maps/house_01.json` through `house_40.json`.
  - done: Update `assets/maps/tiled/map-pack.config.json` with sorted house entries.
  - done: Regenerate `assets/maps/runtime/map-pack.json`.
  - done: Run map-pack tests, bootstrap tests, map checks, and static gates.
  - done: Update `PLAN.md`/`PROGRESS.md` evidence and commit Ticket 1.4.
- Key actions:
  - Confirmed clean branch state before Ticket 1.4 edits.
  - Extracted 40 authored house targets from `world.json`.
  - Replaced the legacy house crop extraction tool with a deterministic stub map generator/checker.
  - Generated 40 stub house maps under `assets/maps/tiled/maps/`.
  - Added 40 sorted house map entries to `assets/maps/tiled/map-pack.config.json`.
  - Updated map-pack graph extraction to read authored door graph data before `processMap` mutates map objects.
  - Updated map-pack graph extraction to include hidden `doors` objectgroups, matching the authored `gameplay_markup/doors` layer.
  - Regenerated `assets/maps/runtime/map-pack.json`.
  - Committed Ticket 1.4 with message `feat: add stub interior map pack entries`.
- Evidence:
  - `git status --short --branch`: `## modern/cx...origin/modern/cx [ahead 2]`.
  - Extracted targets are `house_01` through `house_40`.
  - World door contract shape is `world_house_##_entry -> house_##:house_##_entry`.
  - `find assets/maps/tiled/maps -maxdepth 1 -type f -name 'house_*.json' | sort | wc -l`: `40`.
  - `bun tools/content/house-regenerate.ts check`: pass, 40 maps up to date.
  - `bun run build:maps`: pass, regenerated runtime map pack.
  - `bun run check:maps`: pass, map pack is up to date.
  - `bun test tests/unit/map-pack.test.ts tests/unit/server-world-map-pack-bootstrap.test.ts --timeout 20000`: pass, 23 pass / 0 fail.
  - Direct contract check: 40 targets, 41 config maps, no missing config maps, no missing pack maps, no missing reverse edges.
  - `bun run typecheck`: pass.
  - `bun run typecheck:tools`: pass.
  - `bun run lint`: pass.
  - `bun run format:check`: pass.
  - `git diff --check`: pass.
  - `git commit -m "feat: add stub interior map pack entries"`: committed and amended with final live-doc metadata.
- Next action:
  - Proceed to Ticket 1.5 strict missing-target validation.
