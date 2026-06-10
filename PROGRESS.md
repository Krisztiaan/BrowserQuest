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

### 2026-06-10 11:04 UTC - Ticket 1.5 Disable Missing Target Maps

- Status: done
- Scope:
  - Set `assets/maps/tiled/map-pack.config.json` `allow_missing_target_maps` to `false`.
  - Verify strict graph validation now passes with the Ticket 1.4 house maps.
  - Do not add more stub maps in this ticket.
- TODO:
  - done: Change `allow_missing_target_maps` to `false`.
  - done: Regenerate/check the runtime map pack under strict graph validation.
  - done: Run focused map-pack tests and verify the modern gate reaches map checks cleanly.
  - done: Update `PLAN.md`/`PROGRESS.md` evidence and commit Ticket 1.5.
- Key actions:
  - Confirmed clean branch state after Ticket 1.4.
  - Set `allow_missing_target_maps` to `false`.
  - Regenerated the runtime map pack; no artifact diff was produced under strict mode.
  - Committed Ticket 1.5 with message `chore: enforce strict map target validation`.
- Evidence:
  - `git status --short --branch`: `## modern/cx...origin/modern/cx [ahead 3]`.
  - `bun run build:maps`: pass, generated runtime map pack.
  - `bun run check:maps`: pass, map pack is up to date with strict graph validation.
  - `bun test tests/unit/map-pack.test.ts --timeout 20000`: pass, 20 pass / 0 fail.
  - `bun run verify:modern`: pass; includes strict `check:maps`, 638 pass / 1 skip / 0 fail tests, and client/server builds.
  - `git commit -m "chore: enforce strict map target validation"`: committed and amended with final live-doc metadata.
- Next action:
  - Proceed to Phase 2 door and authoring validation work.

### 2026-06-10 11:07 UTC - Ticket 2.1 Replace Class-Based Portal Detection With Explicit Semantics

- Status: done
- Scope:
  - Add explicit `door_kind` / `is_portal` portal semantics to map processing.
  - Update door/linked-door/portal templates with explicit semantics.
  - Add validator diagnostics for portal objects/templates without explicit portal semantics.
  - Preserve existing non-portal door output as `p: 0`.
- TODO:
  - done: Inspect current portal processing, templates, and validator portal checks.
  - done: Add map-pack/processMap tests for explicit portal semantics.
  - done: Implement portal semantic helper in `shared/maps/processmap.ts`.
  - done: Update Tiled templates.
  - done: Add `PORTAL_SEMANTIC_MISSING` validator rule.
  - done: Run map-pack tests, world target validation, map build/check, and static gates.
  - done: Update `PLAN.md`/`PROGRESS.md` evidence and commit Ticket 2.1.
- Key actions:
  - Confirmed clean branch state after Ticket 1.5.
  - Located class-based portal behavior in `shared/maps/processmap.ts` and `tools/content/world-map-validator.ts`.
  - Added a focused map-pack test for `door_kind=portal`, `is_portal=true`, and `door_kind=door`.
  - Added `isPortalDoorObject` in `shared/maps/processmap.ts`.
  - Added `door_kind` semantics to door, linked-door, and portal templates.
  - Added `PORTAL_SEMANTIC_MISSING` target validator rule and switched portal coordinate extraction to explicit semantics.
  - Committed Ticket 2.1 with message `feat: add explicit portal semantics`.
- Evidence:
  - `git status --short --branch`: `## modern/cx...origin/modern/cx [ahead 4]`.
  - Current processing uses `p: door.class === "Portal" ? 1 : 0`.
  - `bun test tests/unit/map-pack.test.ts --timeout 20000`: initially failed before implementation, then passed 21 pass / 0 fail.
  - `bun run check:world-map:target`: pass, 0 errors / 0 warnings / 0 infos.
  - `bun run build:maps`: pass; no runtime map-pack artifact diff remained.
  - `bun run check:maps`: pass, map pack is up to date.
  - `bun run typecheck`: pass.
  - `bun run typecheck:tools`: pass.
  - `bun run lint`: initially failed on one optional-chain warning, then passed after cleanup.
  - `git diff --check`: pass.
  - `git commit -m "feat: add explicit portal semantics"`: committed and amended with final live-doc metadata.
- Next action:
  - Proceed to Ticket 2.2 strict door graph contract.

### 2026-06-10 11:14 UTC - Ticket 2.2 Add Strict Door Graph Validator

- Status: done
- Scope:
  - Enforce complete graph-linked door metadata in map-pack compilation.
  - Require reverse links unless the source door has `one_way=true`.
  - Document the graph-linked door contract.
  - Preserve intentionally same-map plain coordinate doors that are not graph-linked.
- TODO:
  - done: Inspect current door graph types and validation path.
  - done: Add failing unit tests for missing orientation, raw `tx`/`ty`, and missing reverse links.
  - done: Implement strict graph-linked door validation and source-door `one_way` tracking.
  - done: Update current map-pack tests to satisfy the stricter contract where they are not testing failures.
  - done: Update template README and world-map validator checks.
  - done: Run map-pack tests, target world validation, map build/check, and static gates.
  - done: Update `PLAN.md`/`PROGRESS.md` evidence and commit Ticket 2.2.
- Key actions:
  - Confirmed clean branch state after Ticket 2.1.
  - Confirmed `MapGraphEdge` has only `from`/`to`, so `one_way` must be tracked separately from source door properties.
  - Added compiler errors for graph-linked doors missing `orientation` or declaring raw `tx`/`ty`.
  - Added reverse-link validation with explicit `one_way=true` exemptions tracked from the source door.
  - Updated the five same-map world portal graph sources to declare `one_way=true`.
  - Extended world-map target validation to require paired graph targets and forbid raw graph coordinates.
  - Documented the graph-linked door contract in the Tiled templates README.
- Evidence:
  - `bun test tests/unit/map-pack.test.ts --timeout 20000` initially failed for the new missing-orientation/raw-coordinate/reverse-link tests before implementation; after implementation it passed with 24 pass, 0 fail.
  - `bun run build:maps` initially failed on missing reverse links for the five authored one-way world portals; after adding `one_way=true`, it generated `assets/maps/runtime/map-pack.json`.
  - `bun run check:world-map:target` passed with 0 errors, 0 warnings, 0 infos.
  - `bun run check:maps` passed with map pack up to date.
  - `bun run typecheck` passed.
  - `bun run typecheck:tools` passed.
  - `bun run lint` initially failed on unsafe target property string coercion in `world-map-validator.ts`; after switching to `asString`, it passed.
  - `git diff --check` passed.
  - 2026-06-10 11:23 UTC: Verification complete.
  - Commit: `feat: enforce strict door graph contract`.
- Next action:
  - Proceed to Ticket 2.3 layer taxonomy validation.

### 2026-06-10 11:26 UTC - Ticket 2.3 Add Layer Taxonomy Validation

- Status: done
- Scope:
  - Define a shared authored map layer contract.
  - Report unknown recursive layer paths in `world-map-validator`.
  - Keep current known debt visible through an explicit legacy allowlist.
  - Document the taxonomy and legacy allowlist.
- TODO:
  - done: Inspect recursive layer traversal and validator test setup.
  - done: Add `shared/maps/layer-contract.ts`.
  - done: Wire `UNKNOWN_LAYER_PATH` diagnostics into the validator.
  - done: Add focused validator unit tests.
  - done: Add `docs/map-layer-contract.md`.
  - done: Run target validator, focused tests, and static gates.
  - done: Update `PLAN.md`/`PROGRESS.md` evidence and commit Ticket 2.3.
- Key actions:
  - Confirmed current world paths use recursive groups such as `render_world/beach_biome/sand` and `gameplay_markup/doors`.
  - Decided to keep current non-debt leaf paths explicit in the contract while listing `dry_ground_2`, `cliffs_2`, `village_boundaries_level_2`, and foreground overlay paths as legacy allowlist debt.
  - Added recursive `layerPath` tracking to flattened validator contexts.
  - Added `UNKNOWN_LAYER_PATH` diagnostics for paths outside the shared contract.
  - Added a focused CLI-backed validator test for unknown recursive paths.
  - Documented canonical targets, gameplay markup paths, and the legacy allowlist.
- Evidence:
  - 2026-06-10 11:26 UTC: Ticket started; next action is adding the contract and validator wiring.
  - `bun run check:world-map:target` passed with 0 errors, 0 warnings, 0 infos.
  - `bun test tests/unit/world-map-validator.test.ts --timeout 20000` passed with 2 pass, 0 fail.
  - `bun run typecheck` passed.
  - `bun run typecheck:tools` passed.
  - `bun run lint` initially failed on unsafe matcher typing in the new test; after replacing the matcher with typed diagnostic assertions, it passed.
  - `git diff --check` passed.
  - 2026-06-10 11:26 UTC: Verification complete.
  - Commit: `feat: add map layer contract`.
  - Next action: Proceed to Ticket 2.4 passability debug and parity checks.

### 2026-06-10 11:32 UTC - Ticket 2.4 Add Passability Debug and Parity Checks

- Status: done
- Scope:
  - Add a browser-toggleable passability debug overlay.
  - Render stable tile classification colors for walkable, blocked, water, damage, doors/portals, and interactables.
  - Add a browser pixel check for the overlay.
  - Preserve existing server/client collision parity.
- TODO:
  - done: Inspect client map/game render path and existing browser test setup.
  - done: Add overlay mode state and public setter.
  - done: Render the passability overlay in the map draw flow.
  - done: Add Playwright overlay pixel test.
  - done: Run collision parity, browser test, and static gates.
  - done: Update `PLAN.md`/`PROGRESS.md` evidence and commit Ticket 2.4.
- Key actions:
  - 2026-06-10 11:32 UTC: Ticket started.
  - Confirmed rendering is centralized in `client/renderer.ts` with separate static terrain, entity, and foreground canvases.
  - Added client debug passability arrays from authored layer/object semantics in the runtime map payload.
  - Added `Game.setMapDebugOverlayMode('none' | 'passability')` and exposed it through the existing Playwright test API.
  - Added translucent overlay drawing before depth-sorted entities and foreground tiles.
  - Added a browser alpha-band pixel check for the passability overlay.
- Evidence:
  - `bun run build:maps` regenerated `assets/maps/runtime/map-pack.json` with debug passability classes.
  - `bun test tests/unit/mmo/server-client-collision-parity.test.ts --timeout 20000` passed with 1 pass, 0 fail.
  - `bun run check:maps` passed with map pack up to date.
  - `bun run typecheck` passed.
  - `bun run typecheck:tools` passed.
  - `bun run lint` initially failed on an unreachable test API invalid-mode branch type; after widening the test API argument to `string`, it passed.
  - `git diff --check` passed.
  - `bun x playwright test --config=playwright.config.ts tests/browser/map-debug-overlays.playwright.ts` initially failed because port 8000 was occupied.
  - `PW_REUSE_SERVERS=1 bun x playwright test --config=playwright.config.ts tests/browser/map-debug-overlays.playwright.ts` initially hit a stale reused client bundle missing the new API.
  - After `bun run dev:bun:build-client` refreshed `.tmp/dev-client`, `PW_REUSE_SERVERS=1 bun x playwright test --config=playwright.config.ts tests/browser/map-debug-overlays.playwright.ts` passed with 1 passed.
  - 2026-06-10 11:32 UTC: Verification complete.
  - Commit: `feat: add passability debug overlay`.
  - Next action: Proceed to Ticket 2A.1 unified terrain authoring audit.

### 2026-06-10 11:45 UTC - Ticket 2A.1 Create Unified Terrain Authoring Audit

- Status: done
- Scope:
  - Add a read-only terrain authoring audit contract and CLI.
  - Generate JSON and Markdown audit artifacts under `artifacts/map-authoring/`.
  - Include direct map/tileset findings and reuse existing content audit logic where practical.
  - Add package script, docs, and focused tests.
- TODO:
  - done: Inspect existing content audit tools and package script style.
  - done: Add terrain authoring contract and audit module.
  - done: Add direct map property and Wang tileset findings.
  - done: Integrate or summarize existing audit outputs without shelling out.
  - done: Add package script, unit tests, and docs.
  - done: Generate audit artifacts and run verification gates.
  - done: Update `PLAN.md`/`PROGRESS.md` evidence and commit Ticket 2A.1.
- Key actions:
  - 2026-06-10 11:45 UTC: Ticket started.
  - Confirmed existing audit scripts are CLI-shaped and do not export reusable pure helpers.
  - Added `terrain-authoring-contract.ts` with severity/category/location/finding/audit types.
  - Added a read-only `terrain-authoring-audit.ts` CLI with exported pure helpers for map properties, Wang tilesets, tile paint, overlay layering, tile objects, door semantics, collision/passability, spawn regions, music regions, and asset references.
  - Added `check:terrain-authoring` package script.
  - Added generated JSON and Markdown artifacts under `artifacts/map-authoring/`.
  - Added interpretation docs and focused unit tests.
- Evidence:
  - `bun test tests/unit/terrain-authoring-audit.test.ts --timeout 20000` passed with 3 pass, 0 fail.
  - `bun run check:terrain-authoring` passed and wrote `artifacts/map-authoring/terrain-authoring-audit.json`.
  - Generated audit includes 546 findings with all summary categories present.
  - `bun run typecheck:tools` passed.
  - `bun run lint` initially failed on two audit module style issues, then on one redundant guard; after cleanup it passed.
  - `git diff --check` passed.
  - 2026-06-10 11:45 UTC: Verification complete.
  - Commit: `feat: add terrain authoring audit`.
  - Next action: Proceed to Ticket 2A.2 visual map authoring artifacts.

### 2026-06-10 11:59 UTC - Ticket 2A.2 Generate Tile Atlas and Suspicious Region Visuals

- Status: done
- Scope:
  - Add tile math helpers and a visual artifact generator.
  - Generate BrowserQuest tilesheet atlas labels, suspicious gid crops, suspicious region contact sheets, and optional reference contact sheets.
  - Add package script, tests, and generated visual artifacts.
- TODO:
  - done: Inspect ImageMagick and source image availability.
  - done: Implement `terrain-visual-artifacts.ts` with tile math helpers and ImageMagick runner.
  - done: Add unit tests and package script.
  - done: Generate visual artifacts.
  - done: Run visual verification and static gates.
  - done: Update `PLAN.md`/`PROGRESS.md` evidence and commit Ticket 2A.2.
- Key actions:
  - Confirmed `/usr/bin/file` exists.
  - Installed ImageMagick after approval; available commands are ImageMagick 6 `convert`, `identify`, and `montage`, not the ImageMagick 7 `magick` wrapper.
  - Exact `/Users/krisztiaan/...` Stardew reference paths are absent, but equivalent files exist under `/root/dev/StardewXnbHack/Content (unpacked-ts)/Maps/`.
  - Added tile math helpers, atlas label generation, ImageMagick command resolution, suspicious gid crops, suspicious region tile contact sheets, and reference contact sheets.
  - Added `build:terrain-visuals` package script and unit tests.
  - Appended visual reference notes to the generated terrain authoring audit Markdown.
- Evidence:
  - `identify -version`: ImageMagick 6.9.12-98.
  - `bun test tests/unit/terrain-visual-artifacts.test.ts --timeout 20000` passed with 2 pass, 0 fail.
  - `bun run check:terrain-authoring` passed and refreshed audit artifacts.
  - `bun run build:terrain-visuals` passed and wrote `artifacts/map-authoring/visual/browserquest-tilesheet-atlas.png`.
  - `file artifacts/map-authoring/visual/browserquest-tilesheet-atlas.png`: PNG image data, 320 x 1568, 8-bit/color RGBA.
  - `identify -format '%f %wx%h\n' artifacts/map-authoring/visual/browserquest-tilesheet-atlas.png`: `browserquest-tilesheet-atlas.png 320x1568`.
  - Generated 590 visual artifact files.
  - `bun run typecheck:tools` passed.
  - `bun run lint` passed.
  - `git diff --check` passed.
  - 2026-06-10 11:59 UTC: Verification complete.
  - Commit: `feat: generate terrain authoring visual artifacts`.
  - Next action: Proceed to Ticket 2A.3 terrain and overlay grammar.

### 2026-06-10 12:05 UTC - Ticket 2A.3 Define the Real Terrain and Overlay Grammar

- Status: done
- Scope:
  - Add source-of-truth terrain authoring grammar.
  - Add baseline grammar validator that reports gaps without failing.
  - Add package script, tests, generated report, and authoring model docs.
- TODO:
  - done: Create terrain grammar JSON.
  - done: Implement terrain grammar validator and package script.
  - done: Add unit tests and docs.
  - done: Run grammar audit, typecheck, lint, and diff checks.
  - done: Update `PLAN.md`/`PROGRESS.md` evidence and commit Ticket 2A.3.
- Key actions:
  - 2026-06-10 12:05 UTC: Ticket started.
  - Added `assets/maps/tiled/terrain-authoring.json` with current terrain families, transition pairs, layer roles, and compositing rules.
  - Added baseline `terrain-grammar-validator.ts` that writes `artifacts/map-authoring/terrain-grammar-report.json` and exits 0.
  - Added `audit:terrain-grammar` package script, focused unit tests, and terrain authoring model docs.
- Evidence:
  - `bun test tests/unit/terrain-grammar-validator.test.ts --timeout 20000` passed with 2 pass, 0 fail.
  - `bun run audit:terrain-grammar` passed and wrote `artifacts/map-authoring/terrain-grammar-report.json`.
  - Generated report: 4 missing map properties, 0 missing families, 95 missing transition shapes, 0 wrong layer-role samples.
  - `bun run typecheck:tools` passed.
  - `bun run lint` passed.
  - `git diff --check` passed.
  - 2026-06-10 12:05 UTC: Verification complete.
  - Commit: `feat: define terrain authoring grammar`.
  - Next action: Proceed to Ticket 2A.4 terrain asset decision/prototype.

### 2026-06-10 12:10 UTC - Ticket 2A.4 Decide and Prototype the Richer Terrain Asset Set

- Status: done
- Scope:
  - Decide between metadata-only repair, manual curation, generated overlays, or a hybrid terrain asset path.
  - Name terrain pairs that need new art before map authoring can be considered complete.
  - Verify no prototype runtime references.
- TODO:
  - done: Create terrain asset generation decision document.
  - done: Verify runtime isolation for prototype filenames.
  - done: Update `PLAN.md`/`PROGRESS.md` evidence and commit Ticket 2A.4.
- Key actions:
  - 2026-06-10 12:10 UTC: Ticket started.
  - Decided no prototype is needed in this ticket because the audit and grammar report already justify the hybrid path.
  - Added `docs/terrain-asset-generation-plan.md` with option comparison, hybrid recommendation, missing art table, asset model, and next steps.
  - Verified no prototype references in runtime map sources.
- Evidence:
  - `rg -n "terrain-transitions\\.prototype" assets/maps/tiled/world.json assets/maps/tiled/map-pack.config.json assets/maps/runtime/map-pack.json` returned no matches; exit code 1 is expected for an empty result set.
  - `git diff --check` passed.
  - Commit: `docs: plan richer terrain asset generation`.
  - Next action: Proceed to Ticket 2A.5 dry-run safe map authoring repair.

### 2026-06-10 12:16 UTC - Ticket 2A.5 Add Dry-Run Safe Map Authoring Repair

- Status: done
- Scope:
  - Add a deterministic dry-run-first repair tool for high-confidence map authoring defects.
  - Write JSON and Markdown repair plans without mutating `world.json` by default.
  - Require `--write` plus a clean target file before modifying `assets/maps/tiled/world.json`.
- TODO:
  - done: Inspect existing map/audit structures and define repair plan types.
  - done: Implement dry-run reports, write mode, write guard, and package scripts.
  - done: Add unit tests for dry-run and repair behavior.
  - done: Run verification and decide whether write mode is safe to execute.
  - done: Update `PLAN.md`/`PROGRESS.md` evidence and commit Ticket 2A.5.
- Key actions:
  - 2026-06-10 12:16 UTC: Ticket started.
  - Added `tools/content/world-authoring-repair.ts` with dry-run planning, Markdown/JSON reports, explicit `--write`, and a clean-target write guard for `world.json`.
  - Added `repair:world-authoring:dry` and `repair:world-authoring` package scripts.
  - Added unit tests for dry-run purity, duplicate covered paint repair, tiny component conservatism, and CLI dry-run behavior.
  - Tightened repair rules after review so cross-biome overlaps and checkerboard-style base paint are not classified as high-confidence repairs.
  - Reviewed the final dry-run plan and did not run `--write`; the plan has 10 high-confidence changes, but write mode needs explicit approval because the current writer would serialize `world.json` wholesale.
- Evidence:
  - `bun test tests/unit/world-authoring-repair.test.ts --timeout 20000` passed with 4 pass, 0 fail.
  - `bun run repair:world-authoring:dry` passed and wrote `artifacts/map-authoring/world-authoring-repair-plan.json` plus `.md`.
  - Final dry-run summary: 6 `remove_duplicate_covered_paint`, 0 `remove_accidental_tiny_component`, 4 `add_map_property`.
  - `git diff -- assets/maps/tiled/world.json` returned no diff.
  - `bun run check:world-map:target` passed with 0 errors and 0 warnings.
  - `bun run check:terrain-authoring` passed.
  - `bun run build:maps` passed.
  - `bun run check:maps` passed; map pack is up to date.
  - `bun run typecheck:tools` passed.
  - `bun run lint` passed.
  - `git diff --check` passed.
  - Commit: `feat: add dry-run world authoring repair`.
  - Next action: Proceed to Ticket 2A.6 manual visual review and richness pass.

### 2026-06-10 12:25 UTC - Ticket 2A.6 Complete Manual Visual Review and Richness Pass

- Status: done
- Scope:
  - Create the map authoring review log and region checklist.
  - Inventory high/error audit findings before any map repainting.
  - Record blocked asset-work decisions where the current sheet/grammar cannot satisfy visual completeness.
- TODO:
  - done: Create `docs/map-authoring-review-log.md` scaffold.
  - done: Inventory high/error audit findings with fix/keep/block decisions.
  - done: Run non-mutating validation/artifact refresh commands.
  - done: Update `PLAN.md`/`PROGRESS.md` evidence and commit a scoped review-log batch.
  - done: Apply first high-confidence duplicate-paint repair batch.
  - todo: Decide whether transition asset generation is the next approved step for Ticket 2A.6.
- Key actions:
  - 2026-06-10 12:25 UTC: Ticket started.
  - Added `docs/map-authoring-review-log.md` with region checklist, high-finding decisions, gameplay review checklist, and collision/passability review status.
  - Fixed `MAP_PROPERTIES_EMPTY` by adding required map-level authoring properties to `assets/maps/tiled/world.json`.
  - Reclassified the remaining 8 high findings as blocked Wang transition asset/metadata work.
  - Refreshed terrain audit, grammar report, repair plan, visual artifacts, and runtime map pack after the metadata fix.
  - Updated `tools/content/world-authoring-repair.ts` so `--write` uses text-preserving tile-data token replacement instead of serializing the whole map.
  - Ran `bun run repair:world-authoring` and applied 6 high-confidence duplicate covered paint repairs.
  - Regenerated the dry-run repair plan after the write; it now reports 0 planned high-confidence repairs.
- Evidence:
  - `bun run check:world-map:target` passed with 0 errors and 0 warnings.
  - `bun run check:terrain-authoring` passed and regenerated audit artifacts.
  - `bun run audit:terrain-grammar` passed and regenerated `terrain-grammar-report.json`.
  - `bun run repair:world-authoring:dry` passed; plan now has 6 duplicate-paint repairs and 0 map-property additions.
  - `bun run build:terrain-visuals` passed.
  - `bun run build:maps` passed.
  - `bun run check:maps` passed; map pack is up to date.
  - `bun test tests/unit/mmo/server-client-collision-parity.test.ts --timeout 20000` passed with 1 pass, 0 fail.
  - Current high/error audit count: 8, all `WANG_PAIR_HAS_NO_MIXED_TRANSITIONS` blocked by transition asset gaps.
  - Browser passability overlay review remains open.
  - Scoped batch commit: `feat: start world authoring review pass`.
  - `bun test tests/unit/world-authoring-repair.test.ts --timeout 20000` passed with 5 pass, 0 fail.
  - `bun run repair:world-authoring` passed and wrote `assets/maps/tiled/world.json` with targeted token replacements.
  - `bun run repair:world-authoring:dry` passed after the write with 0 planned repairs.
  - `bun run check:world-map:target` passed with 0 errors and 0 warnings after the repair batch.
  - `bun run check:terrain-authoring` passed after the repair batch.
  - `bun run audit:terrain-grammar` passed after the repair batch.
  - `bun run build:terrain-visuals` passed after the repair batch.
  - `bun run build:maps` and `bun run check:maps` passed after the repair batch.
  - `bun test tests/unit/mmo/server-client-collision-parity.test.ts --timeout 20000` passed after the repair batch.
  - `bun run typecheck:tools` passed after the repair batch.
  - `bun run lint` passed after the repair batch.
  - `git diff --check` passed after the repair batch.
  - Scoped batch commit: `fix: repair duplicate covered world paint`.
  - Next action: Decide whether to start transition asset generation or pause on the asset blocker before continuing Ticket 2A.6.

### 2026-06-10 12:38 UTC - Ticket 2A.7 Generate First Deterministic Transition Prototype

- Status: done
- Scope:
  - Generate a non-runtime shoreline transition prototype sheet.
  - Record source tile IDs, GIDs, shapes, and masks in deterministic metadata.
  - Verify prototype files are not referenced by runtime map sources.
- TODO:
  - done: Add prototype generator.
  - done: Add metadata helper tests.
  - done: Generate prototype PNG/TSJ/manifest artifacts.
  - done: Verify runtime isolation, typecheck, lint, and diff checks.
  - done: Update live docs and commit Ticket 2A.7.
- Key actions:
  - 2026-06-10 12:38 UTC: Ticket started.
  - Added `tools/content/terrain-transition-prototype.ts` with deterministic shoreline entries, mask definitions, TSJ/manifest generation, and ImageMagick rendering.
  - Added `build:terrain-transition-prototype` package script.
  - Added focused unit tests for shape ordering, mask definitions, and source provenance metadata.
  - Generated non-runtime prototype artifacts under `assets/maps/tiled/prototypes/`.
- Evidence:
  - `bun test tests/unit/terrain-transition-prototype.test.ts --timeout 20000` passed with 3 pass, 0 fail.
  - `bun run build:terrain-transition-prototype` passed and generated 15 shoreline prototype transitions.
  - `identify -format '%f %wx%h\n' assets/maps/tiled/prototypes/terrain-transitions.prototype.png` reported `terrain-transitions.prototype.png 80x48`.
  - `rg -n "terrain-transitions\\.prototype" assets/maps/tiled/world.json assets/maps/tiled/map-pack.config.json assets/maps/runtime/map-pack.json` returned no matches; exit code 1 is expected for an empty result set.
  - `bun run typecheck:tools` passed.
  - `bun run lint` passed.
  - `git diff --check` passed.
  - Commit: `feat: generate shoreline transition prototype`.
  - Next action: Continue Ticket 2A.6 by reviewing the shoreline prototype and deciding whether to promote generated transition assets beyond prototypes.

### 2026-06-10 12:42 UTC - Ticket 3.1 Remove Client-to-Server Legacy `ATTACK` From Schema

- Status: done
- Scope:
  - Remove legacy client-to-server `ATTACK` from protocol schema and binary C2S decoding.
  - Keep server-to-client `ATTACK` broadcasts intact.
  - Update tests to expect `INTENT attack.entity` for client combat.
- TODO:
  - done: Inspect protocol manifest, codec, and existing tests.
  - done: Remove C2S `ATTACK` schema/codec support.
  - done: Update unit, browser, and smoke protocol tests.
  - done: Commit Ticket 3.1.
- Key actions:
  - 2026-06-10 12:42 UTC: Ticket started.
  - Removed client-to-server `ATTACK` from `CLIENT_TO_SERVER_PROTOCOL_MANIFEST`, C2S protocol action types, binary C2S encode/decode/skip paths, and player-session dispatch opcode coverage.
  - Removed dead client `createAttackAction`; client combat remains `INTENT attack.entity`.
  - Kept server-to-client `ATTACK` schema, codec, and browser assertions for received attack broadcasts.
  - Updated browser protocol observer and replay invariant to decode/send FixedBin frames instead of JSON gameplay frames.
  - Updated modern gameplay parity smoke to send `INTENT attack.entity`.
  - Added `.gitignore` coverage for generated `server/.tmp-config.playwright.json`.
  - Resolved verification environment issue: stale repo-local Bun server on port 8000 was stopped with approval; generated Playwright traces filled disk during debugging and generated `dist` artifacts were removed.
- Evidence:
  - `bun test tests/unit/mmo/protocol-capabilities.test.ts tests/unit/player-session.test.ts tests/unit/protocol/registry.test.ts --timeout 20000` passed: 28 pass, 0 fail.
  - `bun run typecheck` passed.
  - `bun run typecheck:tools` passed.
  - `bun run lint` passed.
  - `bun run test:browser:protocol -- --grep "modern browser receives HEALTH"` passed: 1 pass, 0 fail.
  - `bun run test:browser:protocol` passed: 6 pass, 0 fail.
  - `bun run test:modern-parity` passed: 1 pass, 0 fail.
  - `git diff --check` passed.
  - Commit: `fix: remove legacy client attack opcode`.
  - Next action: Continue Phase 3 with Ticket 3.2 server-authoritative combat contract.

### 2026-06-10 13:24 UTC - Ticket 3.2 Finish Server-Authoritative Combat Contract

- Status: done
- Scope:
  - Prove attack intent/command starts server windup without immediate damage.
  - Keep damage mutation owned by server hit-frame only.
  - Preserve kill/despawn/respawn smoke behavior.
- TODO:
  - done: Add explicit no-immediate-damage regression.
  - done: Run combat hit-frame and parity verification.
  - done: Commit Ticket 3.2.
- Key actions:
  - 2026-06-10 13:24 UTC: Ticket started.
  - Existing combat code already applies damage under the hit-frame branch in `runServerAuthoritativeCombatSystem`.
  - Added `attack intent never applies damage before server hit-frame` regression to `combat-hitframe-state-machine.test.ts`.
  - No production combat pipeline change was needed; the new regression passed against the existing hit-frame authority implementation.
- Evidence:
  - `bun test tests/unit/ecs/combat-hitframe-state-machine.test.ts --timeout 20000` passed: 8 pass, 0 fail.
  - `bun test tests/unit/ecs/combat-hitframe-state-machine.test.ts tests/unit/ecs/mob-ai-chase.test.ts tests/smoke/modern-gameplay-parity.test.ts --timeout 30000` passed: 30 pass, 0 fail.
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `git diff --check` passed.
  - Commit: `fix: enforce server-authoritative combat hit frames`.
  - Next action: Continue Phase 3 with Ticket 3.3 client combat graph cleanup.

### 2026-06-10 13:27 UTC - Ticket 3.3 Make Client Combat Graph Cleanup Idempotent

- Status: done
- Scope:
  - Prove duplicate client attack-link cleanup is a no-op.
  - Verify despawn/death ordering does not surface combat cleanup errors.
- TODO:
  - done: Add idempotency regression for duplicate attack-link removal.
  - done: Run unit/browser verification.
  - done: Commit Ticket 3.3.
- Key actions:
  - 2026-06-10 13:27 UTC: Ticket started.
  - Current codebase uses `Character.removeTarget`/`removeAttacker` and `characterClearTarget`; there is no separate `Game.removeAttackLink` method.
  - Added regression proving duplicate `removeTarget`/`removeAttacker` calls do not throw and leave the attack graph clean.
  - Updated the UI smoke footer toggles to invoke DOM handlers directly; the foreground canvas intercepts pointer clicks in-session, but the test needs to verify UI state and page errors.
  - No production cleanup change was needed; existing `Character` cleanup is idempotent.
- Evidence:
  - `bun test tests/unit/client-combat-runtime-plumbing.test.ts --timeout 20000` passed: 4 pass, 0 fail.
  - `npx playwright test --config=playwright.config.ts tests/browser/modern-ui-smoke.playwright.ts` passed: 2 pass, 0 fail.
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `git diff --check` passed.
  - Commit: `fix: make client combat cleanup idempotent`.
  - Next action: Continue Phase 4 with Ticket 4.1 friend-server product target.

### 2026-06-10 13:36 UTC - Ticket 4.1 Lower Product Target From MMO Shard to Friend Server

- Status: done
- Scope:
  - Lower default per-world player capacity to the 16-64 friend-server target.
  - Document the product target and keep larger explicit config values valid for load experiments.
- TODO:
  - done: Update config defaults and product target docs.
  - done: Add validation regression for larger explicit values.
  - done: Run config verification and modern verify lane.
  - done: Commit Ticket 4.1.
- Key actions:
  - 2026-06-10 13:36 UTC: Ticket started.
  - Lowered `server/config.json` and `server/config_local.json-dist` default `nb_players_per_world` from 2000 to 64.
  - Added `docs/product-target.md` and README/server README notes for the 16-64 friend-server target.
  - Added a config preflight regression proving larger explicit world capacity remains valid for load experiments.
- Evidence:
  - `bun test tests/unit/server-config-preflight.test.ts --timeout 20000` passed: 7 pass, 0 fail.
  - `bun run verify:modern` passed: 663 pass, 1 skip, 0 fail; client and server builds completed.
  - `git diff --check` passed.
  - Commit: `docs: align defaults with friend-server target`.
  - Next action: Continue Phase 4 with Ticket 4.2 persistence schema versioning and backup CLI.
