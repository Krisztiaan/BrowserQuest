# BrowserQuest Modernization and Friend-Server RPG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring BrowserQuest from the current red verification state to a stable Bun-first, server-authoritative, casual co-op RPG foundation with clean map-pack runtime data, strict content validation, reliable persistence, and an MVP friend-server gameplay loop.

**Architecture:** The server remains Bun-first and authoritative for identity, movement, map transitions, combat, inventory, chests, crops, resources, and persistent world state. The map-pack becomes the single runtime source for client and server, with `world_01` as the canonical overworld id, explicit interior maps, strict door graph validation, and no fallback gameplay transport or legacy runtime migration paths. Client work focuses on consuming authoritative state, rendering/debug tooling, and ergonomic interactions before any renderer or framework rewrite.

**Tech Stack:** Bun `>=1.3`, TypeScript `5.9`, ESM, Bun WebSockets via `Bun.serve`, SQLite via `bun:sqlite`, Tiled JSON/TSJ/TX assets, shared binary protocol modules under `shared/protocol`, Playwright browser tests, `bun test`, ESLint, Prettier.

---

## Current Constraints and Decisions

- Runtime is Bun-first. Do not add a Node production server path unless a separate task explicitly changes that decision.
- No fallback implementations. Do not reintroduce JSON gameplay WebSocket fallback, HTMLAudioElement fallback, or runtime legacy storage/schema migration fallback.
- The working tree is allowed to be dirty. Before editing any ticket, run `rtk git status --short --branch` and do not revert unrelated user changes.
- For any git operation that may open an editor, prefix with `EDITOR=true`.
- All numerical claims in this plan come from the audit run on 2026-06-10 in `/Users/krisztiaan/dev/BrowserQuest`.
- `world_01` is the target canonical map id because code and map-pack tooling already normalize `world.json` to `world_01`.
- `assets/maps/tiled/map-pack.config.json` must become the runtime map source. Raw `assets/maps/tiled/world.json` can remain an authoring input.
- `allow_missing_target_maps` must end as `false`. It may stay `true` only inside an intermediate ticket where missing target maps are being made explicit and tracked by tests.
- The practical product target is a casual co-op friend server, not a 2000-player MMO shard. Existing `nb_players_per_world: 2000` is a legacy/config debt item to lower after gameplay and load assumptions are updated.

## Verified Baseline From 2026-06-10 Audit

Commands run from `/Users/krisztiaan/dev/BrowserQuest`:

- `rtk bun run check:content:prefabs`: pass.
- `rtk bun run check:world-map:target`: pass, `0 errors, 0 warnings, 0 infos`.
- `rtk bun run test:ws:runtime:decision`: pass.
- `rtk bun run check:maps`: fail, runtime map pack out of date.
- `rtk bun run typecheck`: fail with TypeScript errors in server ECS and client ECS systems.
- `rtk bun run lint`: fail with 25 errors and 93 warnings.
- `rtk bun run format:check`: fail on `server/log.ts`.
- `rtk bun test --timeout 20000`: fail with 613 pass, 1 skip, 6 fail.
- `rtk bun audit`: fail with 12 vulnerabilities through dev-tooling dependency chains.

Recursive map inspection results from `assets/maps/tiled/world.json`:

- Map dimensions: 172 x 314 tiles, 16 x 16 tile size.
- Layer nodes: 74 total, including 43 tile layers and 22 object layers.
- Objects: 5000 total.
- Doors: 84 total.
- Linked doors: 47 using `templates/door_linked.tx`.
- Plain doors: 37 using `templates/door.tx`.
- Door object class: all 84 are `Door`; no door object has class `Portal`.
- Linked `target_map` values include `world` and `house_01` through `house_40`.
- Tile objects: 4930 total, 0 off-grid, 0 rotated, 0 resized.
- Blank/no-template tile objects: 4592.
- Tileset metadata: 1960 tiles, 835 tile records, 472 objectgroups, 258 `footprint` properties, 67 `collider` properties, 6 `passable` properties, 37 animations.

Additional terrain and tileset authoring findings from the same audit session:

- `assets/maps/tiled/tilesheet.wang.tsj` points at `../../../client/public/img/1/tilesheet.webp`, a 320 x 1568 WebP sheet with 1960 16 x 16 tiles.
- `assets/maps/tiled/world.json` has no top-level map properties, so biome, music, authoring, terrain, and runtime intent are mostly implicit in layer names and object properties.
- `rtk bun tools/content/world-tile-paint-audit.ts --json` reported 43 visible tile layers, 140 suspicious tiny components, and 55 duplicate paint cases.
- The primary Wang set `browserquest-terrain` has 9 colors, 766 Wang-tagged tiles, 60 unique Wang IDs, 740 pure/single-terrain entries, and only 26 mixed-transition entries.
- Several pair scaffold sets are not usable complete transition grammars because they contain zero mixed-transition entries: `scaffold-shoreline`, `scaffold-riverbank`, `scaffold-village_ground`, `scaffold-field_edges`, `scaffold-cave_rock`, `scaffold-lava_rock`, and `scaffold-lava_cave`.
- `scaffold-forest_edges` has only 6 mixed-transition entries, which is still far short of a complete edge/corner/inner-corner/path grammar.
- `rtk bun tools/content/tileset-wang-audit.ts --json` reported real map usage that disagrees with the scaffold metadata, including tiles used on terrain-transition layers that are missing from the relevant scaffold or tagged with foreign terrain colors.
- Local reference assets exist at `/Users/krisztiaan/dev/stardew-assets/Maps`. The useful reference pattern is organization and authoring shape, not asset copying: seasonal outdoor sheets such as `spring_outdoorsTileSheet.png` are 400 x 1264, and focused overlay sheets such as `paths.png` are 64 x 256.
- Stardew map `.json` files in that folder are wrappers around `.tbin` content, not plain Tiled JSON. They are reference material for asset organization, layer/overlay concepts, and visual completeness, not a direct import format.

## Completion Definition

This plan is complete only when all of these are true:

- `rtk bun run verify:modern` passes.
- `rtk bun run test:browser:protocol` passes or has a documented local browser dependency blocker with a passing CI/browser run attached later.
- Runtime server config loads `assets/maps/tiled/map-pack.config.json`, not raw `world.json`.
- Runtime map-pack generation is deterministic and `rtk bun run check:maps` passes.
- `assets/maps/tiled/map-pack.config.json` has `allow_missing_target_maps: false`.
- Door graph validation rejects missing maps, missing doors, partial links, raw graph-linked `tx`/`ty`, and `target_map: world`.
- Every linked door points to a real map id and a real destination `door_id`.
- No gameplay object is semantically blank.
- Render-only tile objects are either typed as render props or generated from known prop metadata.
- The map has an explicit terrain and overlay authoring contract that distinguishes base terrain, transition terrain, transparent overlays, structural foreground, collision/passability masks, gameplay regions, and music zones.
- `rtk bun run check:terrain-authoring` passes with no high-confidence terrain paint, overlay layering, wrong-layer tile, missing-transition, collider/passability, gate/portal, spawn, bounds, or music-zone errors.
- Generated map-authoring artifacts include a tile atlas, suspicious-GID contact sheets, region crops, and a reviewed missing-transition matrix under `artifacts/map-authoring/`.
- `assets/maps/tiled/tilesheet.wang.tsj` either becomes a real complete terrain/Wang authoring tileset or is explicitly replaced by a new generated authoring tileset whose metadata is the source of truth.
- Every remaining low-confidence visual/artistic map issue has a dated review-log entry with before/after region images and an explicit keep/fix decision.
- Package scripts, content tools, historical audits, external audit docs, generated artifact policies, and project plans are inventoried, classified, indexed, and cleaned so new work starts from a known active surface.
- No active `package.json` script points at a known stale or superseded tool; retired tools are either deleted with evidence or moved behind an explicit `legacy:`/archive boundary with a replacement named.
- Client and server collision parity tests pass.
- Server-authoritative movement, door traversal, chunk streaming, combat, inventory, chests, resources, crops, and persistence have focused unit tests plus at least one smoke/browser path through the gameplay loop.
- Project handoff archives exclude `node_modules`, `dist`, `generated`, `.DS_Store`, `server/.data`, map backups, and local SQLite/WAL/SHM files.

---

## Phase 0 - Stabilize the Current Tree

### Ticket 0.1: Restore Formatting Baseline

**Scope:** Fix only current formatting failures in the configured Prettier lane.

**Out of scope:** Do not broaden Prettier scope. Do not reformat unrelated files outside the configured script.

**Files:**
- Modify: `server/log.ts`
- Reference: `package.json:70-71`

**Acceptance criteria:**
- `rtk bun run format:check` passes.
- `rtk git diff -- server/log.ts` contains only Prettier-equivalent formatting changes.

**Verification plan:**
- `rtk bun run format:check`
- `rtk git diff --check`

**Dependencies/blockers:** None.

- [x] **Step 1: Confirm the failure**

Run:

```bash
rtk bun run format:check
```

Expected before the fix:

```text
server/log.ts
Code style issues found
```

- [x] **Step 2: Apply the scoped formatter**

Run:

```bash
rtk bun run format
```

Expected:

```text
server/log.ts
```

may be rewritten by Prettier, with no other files outside the configured script touched.

- [x] **Step 3: Verify formatting**

Run:

```bash
rtk bun run format:check
rtk git diff --check
```

Expected:

```text
All matched files use Prettier code style!
```

and no whitespace errors.

- [x] **Step 4: Commit**

Run:

```bash
rtk git add server/log.ts
rtk git commit -m "chore: restore configured formatting baseline"
```

### Ticket 0.2: Restore TypeScript Baseline

**Scope:** Fix the current `bun run typecheck` failures without changing runtime behavior.

**Out of scope:** No feature refactors, no map-pack behavior changes, no lint-only cleanup except where needed by type fixes.

**Files:**
- Modify: `server/world/ecs-command-pipeline.ts`
- Modify: `client/ecs/systems/client-command-apply-system.ts`
- Modify: `client/ecs/systems/client-move-input-prediction-system.ts`
- Modify: `client/ecs/systems/client-simulation-system.ts`
- Test: existing unit tests that cover the touched systems.

**Acceptance criteria:**
- `rtk bun run typecheck` passes.
- Focused tests for touched systems pass.
- No behavior-bearing type cast is added where a guard or domain helper exists.

**Verification plan:**
- `rtk bun run typecheck`
- `rtk bun test tests/unit/ecs/client-attack-intent-follow.test.ts tests/unit/ecs/client-auto-aggro-system.test.ts tests/unit/mmo/server-door-traversal.test.ts --timeout 20000`

**Dependencies/blockers:** Ticket 0.1 can run independently.

- [x] **Step 1: Capture current errors**

Run:

```bash
rtk bun run typecheck
```

Expected current errors include:

```text
server/world/ecs-command-pipeline.ts(1390,39): error TS18048: 'attackerPos' is possibly 'undefined'.
client/ecs/systems/client-command-apply-system.ts(443,93): error TS2345: Argument of type '{ x: number; y: number; }' is not assignable to parameter of type 'GridPos'.
client/ecs/systems/client-move-input-prediction-system.ts(123,40): missing VisualBridgeCharacterLike members
client/ecs/systems/client-simulation-system.ts(139,16): error TS2339: Property 'id' does not exist on type 'never'.
```

- [x] **Step 2: Fix `attackerPos` narrowing**

In `server/world/ecs-command-pipeline.ts`, find the block around the reported `attackerPos` line. Use an early guard that proves `attackerPos` exists before reading `.x` or `.y`.

Use this shape:

```ts
const attackerPos = Position.store.get(attackerId);
const targetPos = Position.store.get(targetId);
if (!attackerPos || !targetPos) {
    continue;
}

const distance = Math.abs(attackerPos.x - targetPos.x) + Math.abs(attackerPos.y - targetPos.y);
```

If the surrounding function currently uses `return` instead of `continue`, preserve the local control-flow style.

- [x] **Step 3: Fix raw grid object construction**

In `client/ecs/systems/client-command-apply-system.ts`, import and use the domain helper:

```ts
import { gridPos } from '../../../shared/domain/positions';
```

Replace raw `{ x, y }` where a `GridPos` is required with:

```ts
gridPos(x, y)
```

Use the actual in-scope coordinate names from the file.

- [x] **Step 4: Fix `VisualBridgeCharacterLike` test doubles or adapter shape**

In `client/ecs/systems/client-move-input-prediction-system.ts`, inspect the failing call sites. If the object is a local test/helper adapter, add the missing members with no-op behavior that preserves runtime semantics:

```ts
orientation: 0,
setVisualFacing(_orientation: number): void {},
walk(_orientation: number): void {},
idle(_orientation?: number): void {},
```

If the object is production data, prefer narrowing to the existing full character object instead of inventing a fake bridge.

- [x] **Step 5: Fix `never` narrowing in client simulation**

In `client/ecs/systems/client-simulation-system.ts`, inspect the branch around lines 139-141. Replace a too-narrow inferred variable with an explicit structural type that matches the later reads.

Use this type shape near the helper if no local type already exists:

```ts
type AggroCandidate = Readonly<{
    id: number;
    x: number;
    y: number;
}>;
```

Declare the collection as:

```ts
const candidates: AggroCandidate[] = [];
```

Then preserve existing filtering logic.

- [x] **Step 6: Verify typecheck and focused behavior**

Run:

```bash
rtk bun run typecheck
rtk bun test tests/unit/ecs/client-auto-aggro-system.test.ts tests/unit/ecs/client-attack-intent-follow.test.ts tests/unit/mmo/server-door-traversal.test.ts --timeout 20000
```

Expected:

```text
0 fail
```

for the focused tests unless Ticket 1.4 door traversal is still pending. If door traversal still fails, record that as the known remaining functional failure and do not mark Ticket 1.4 done.

- [x] **Step 7: Commit**

Run:

```bash
rtk git add server/world/ecs-command-pipeline.ts client/ecs/systems/client-command-apply-system.ts client/ecs/systems/client-move-input-prediction-system.ts client/ecs/systems/client-simulation-system.ts
rtk git commit -m "fix: restore TypeScript baseline"
```

### Ticket 0.3: Restore Lint Baseline

**Scope:** Fix current lint errors after Ticket 0.2, keeping changes mechanical and local.

**Out of scope:** Do not silence lint globally. Do not remove useful tools just because they are noisy; fix or narrow them.

**Files:**
- Modify as reported by `rtk bun run lint`, currently including:
  - `server/startup/preflight.ts`
  - `server/world-server.ts`
  - `server/world/chest-item-lifecycle.ts`
  - `server/world/ecs-command-pipeline.ts`
  - `tests/unit/mmo/server-door-traversal.test.ts`
  - `tests/unit/server-world-map-pack-bootstrap.test.ts`
  - `tests/unit/server/runtime/runtime-map-pack-route.test.ts`
  - `tests/unit/world/move-to-planning.test.ts`
  - `tools/content/house-regenerate.ts`
  - `tools/content/map-pack-modernize-legacy.ts`
  - `tools/content/tileset-wang-scaffold.ts`
  - `tools/content/world-map-validator.ts`
  - `tools/content/world-null-outside-void.ts`
  - `tools/content/world-render-cluster-audit.ts`
  - `tools/content/world-resplit.ts`
  - `tools/content/world-standardize-idiomatic.ts`
  - `tools/content/world-standardize-pipeline.ts`
  - `tools/content/world-tile-paint-audit.ts`
- Reference: `eslint.config.mjs`

**Acceptance criteria:**
- `rtk bun run lint` passes with `--max-warnings=0`.
- Any generated file fix is either applied to the generator or documented as intentionally direct if the generator is out of current scope.

**Verification plan:**
- `rtk bun run lint`
- `rtk bun run typecheck`

**Dependencies/blockers:** Ticket 0.2.

- [x] **Step 1: Re-run lint after type fixes**

Run:

```bash
rtk bun run lint
```

Expected before cleanup: lint errors remain, but the exact list may be smaller after Ticket 0.2.

- [x] **Step 2: Fix unused declarations**

For every `no-unused-vars` error, either delete the unused declaration or prefix only intentionally required callback parameters with `_`.

Use this pattern for callback parameters:

```ts
function visitLayer(_unusedLayerName: string, layer: LayerRecord): void {
    processLayer(layer);
}
```

Do not prefix unused top-level functions that are genuinely dead; delete those functions.

- [x] **Step 3: Fix unnecessary assertions**

For every `no-unnecessary-type-assertion`, remove only the redundant assertion.

Change:

```ts
const entry = value as ExistingType;
```

to:

```ts
const entry = value;
```

only where TypeScript already infers `ExistingType`.

- [x] **Step 4: Fix redundant Boolean calls**

Change redundant Boolean wrappers:

```ts
Boolean(condition)
```

to:

```ts
condition
```

when the surrounding expression already requires a boolean.

- [x] **Step 5: Fix generated eslint-disable directive**

Status: not applicable in the final Ticket 0.3 lint output. `server/generated/mob-properties.generated.ts` did not require a generated-file edit after the earlier autofix/type cleanup reduced the warning set.

If this returns in a later lint run, update the generator that emits it if one exists. Search:

```bash
rtk rg -n "mob-properties.generated|eslint-disable" tools server shared
```

If no generator emits the header, remove the directive from the generated file and run:

```bash
rtk bun run check:content:prefabs
```

- [x] **Step 6: Verify lint and typecheck**

Run:

```bash
rtk bun run lint
rtk bun run typecheck
```

Expected:

```text
0 errors
0 warnings
```

from ESLint.

- [x] **Step 7: Commit**

Run:

```bash
rtk git add server/generated/mob-properties.generated.ts tests tools server client shared eslint.config.mjs
rtk git commit -m "chore: restore lint baseline"
```

If some paths did not change, `git add` simply leaves them untouched.

### Ticket 0.4: Restore Current Unit and Smoke Test Baseline

**Scope:** Fix the six current `bun test` failures.

**Out of scope:** Do not update expectations blindly. For each failure, decide whether the test captures intended behavior or stale wording.

**Files:**
- Modify: `server/startup/preflight.ts`
- Modify or test-adjust: `tests/smoke/server/config-preflight.test.ts`
- Modify or test-adjust: `tests/smoke/server/config-preflight-entry.test.ts`
- Modify: `server/world/ecs-command-pipeline.ts`
- Modify: `server/world/ecs-command-pipeline/core-module-registry.ts`
- Modify: `server/world/ecs-command-pipeline/chunk-aoi-streaming.ts`
- Test: `tests/unit/mmo/server-door-traversal.test.ts`
- Test: `tests/unit/mmo/server-chunk-resync-fallback.test.ts`
- Test: the full `bun test` suite.

**Acceptance criteria:**
- `rtk bun test --timeout 20000` passes.
- Startup preflight emits one stable, documented error class for invalid runtime map source shape.
- Door traversal test passes because server-authoritative door teleport works, not because the assertion was weakened.
- Chunk resync fallback test passes because version gaps are healed by snapshot resync, not because deltas are accepted across gaps.

**Verification plan:**
- `rtk bun test tests/smoke/server/config-preflight.test.ts tests/smoke/server/config-preflight-entry.test.ts tests/unit/mmo/server-door-traversal.test.ts tests/unit/mmo/server-chunk-resync-fallback.test.ts --timeout 20000`
- `rtk bun test --timeout 20000`

**Dependencies/blockers:** Tickets 0.1-0.3.

- [x] **Step 1: Re-run the focused failures**

Run:

```bash
rtk bun test tests/smoke/server/config-preflight.test.ts tests/smoke/server/config-preflight-entry.test.ts tests/unit/mmo/server-door-traversal.test.ts tests/unit/mmo/server-chunk-resync-fallback.test.ts --timeout 20000
```

Expected before fixes:

```text
server fails fast when startup preflight reads map JSON with invalid payload shape
server entry fails fast when configured map payload shape is invalid
stepping onto a door tile produces a server-issued TELEPORT to its destination
delta version gaps are healed by snapshot resync fallback
```

fail.

- [x] **Step 2: Stabilize invalid map payload wording**

Choose the newer runtime source wording if keeping `compileRuntimeMapPackFromPayload` as the canonical validator:

```text
Startup preflight: runtime map source is invalid:
```

Update the two smoke tests to assert this string and the reason:

```text
Invalid runtime map source: expected map-pack, map-pack config, or Tiled map payload.
```

Do not make the tests accept both old and new strings.

- [x] **Step 3: Fix door traversal default map id mismatch**

In `tests/unit/mmo/server-door-traversal.test.ts`, the fixture currently resolves only `mapId === 'world'`. Production defaults are now `world_01`. Update the fixture to implement:

```ts
getDefaultMapId() {
    return 'world_01';
},
resolveDoorTeleport(mapId: string, x: number, y: number) {
    if (mapId !== 'world_01') {
        return null;
    }
    return x === 5 && y === 5 ? { toMapId: 'world_01', to: gridPos(10, 10) } : null;
},
isValidPositionForMap(mapId: string, x: number, y: number) {
    return mapId === 'world_01' && Number.isInteger(x) && Number.isInteger(y);
},
```

If production code still fails with that fixture, inspect `server/world/ecs-command-pipeline.ts:2853-2909` and `server/world/ecs-command-pipeline/core-module-registry.ts:321-367` for mismatched raw `{ x, y }` vs `GridPos` and missing `MapId` state updates.

- [x] **Step 4: Fix chunk resync version-gap behavior**

Inspect `server/world/ecs-command-pipeline/chunk-aoi-streaming.ts:536-653`. Preserve this invariant:

```ts
if (known !== delta.fromVersion) {
    if (known >= delta.toVersion) {
        continue;
    }
    sub.knownChunks.delete(key);
    sub.knownChunkVersions.delete(key);
    if (!sub.inFlightSnapshotKeys.has(key)) {
        enqueuePendingChunk(sub, chunk.mapId, chunk.chunkX, chunk.chunkY, { front: true });
    }
    continue;
}
```

If the current failure remains, inspect `ChunkOverlayStore.drainPendingDeltaForChunk` and test fixture map id. The test currently uses `makeScopedChunkKey('world', 0, 0)` while many defaults are `world_01`. Make the test and fixture use one explicit map id consistently.

Result: root cause was stale `world` fixture state. `tests/unit/mmo/server-chunk-resync-fallback.test.ts` now mutates the actual `world_01` scoped chunk key.

- [x] **Step 5: Verify focused tests**

Run:

```bash
rtk bun test tests/smoke/server/config-preflight.test.ts tests/smoke/server/config-preflight-entry.test.ts tests/unit/mmo/server-door-traversal.test.ts tests/unit/mmo/server-chunk-resync-fallback.test.ts --timeout 20000
```

Expected:

```text
0 fail
```

- [x] **Step 6: Verify full tests**

Run:

```bash
rtk bun test --timeout 20000
```

Expected:

```text
0 fail
```

- [x] **Step 7: Commit**

Run:

```bash
rtk git add server tests
rtk git commit -m "fix: restore test baseline"
```

### Ticket 0.5: Restore Dependency Audit Baseline

**Scope:** Resolve or explicitly risk-accept dev-tooling vulnerabilities reported by `bun audit`.

**Out of scope:** No runtime dependency upgrades that alter game behavior unless vulnerability data requires it.

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Create if risk acceptance is needed: `docs/security/dependency-audit-2026-06-10.md`

**Acceptance criteria:**
- `rtk bun audit` exits 0, or a documented risk acceptance exists for dev-only transitive vulnerabilities with a dated recheck command.
- `rtk bun run verify:modern` still passes after dependency changes.

**Verification plan:**
- `rtk bun audit`
- `rtk bun install --frozen-lockfile`
- `rtk bun run verify:modern`

**Dependencies/blockers:** Tickets 0.1-0.4 reduce noise before dependency updates.

- [x] **Step 1: Capture current audit**

Run:

```bash
rtk bun audit
```

Expected current vulnerable chains include `minimatch`, `brace-expansion`, `flatted`, and `picomatch` through ESLint tooling.

- [x] **Step 2: Try compatible updates first**

Run targeted compatible dev-tooling updates first:

```bash
rtk bun update eslint @eslint/js @typescript-eslint/eslint-plugin @typescript-eslint/parser bun-types globals prettier @playwright/test minimatch brace-expansion flatted picomatch
rtk bun audit
```

Expected:

```text
0 vulnerabilities
```

Result: package updates plus flat Bun `overrides` for `minimatch`, `brace-expansion`, `flatted`, and `picomatch` cleared `rtk bun audit`.

- [x] **Step 3: Try latest updates in a separate branch or isolated worktree**

Status: not needed. Compatible updates and overrides cleared the audit without moving to breaking latest major versions.

If compatible updates stop clearing the audit in a later run, use:

```bash
rtk bun update --latest
rtk bun run verify:modern
```

If this introduces breaking lint or TypeScript changes, either fix them in the same ticket or document why the upgrade must be split.

- [x] **Step 4: Document any dev-only risk acceptance**

Status: not needed. `rtk bun audit` exits 0 after compatible updates and overrides.

If an advisory remains only in dev tooling and no compatible update exists, create `docs/security/dependency-audit-2026-06-10.md` with this exact structure:

```markdown
# Dependency Audit Risk Acceptance - 2026-06-10

## Command

`rtk bun audit`

## Remaining Advisories

| Package | Severity | Chain | Runtime reachable | Decision |
| --- | --- | --- | --- | --- |
| package-name | high | eslint -> package-name | No | Recheck after upstream release |

## Recheck

Run `rtk bun audit` before release and after dependency updates.
```

Replace `package-name` with actual package names from the command output.

- [x] **Step 5: Verify install and full lane**

Run:

```bash
rtk bun install --frozen-lockfile
rtk bun run verify:modern
```

Expected:

```text
0 fail
```

- [x] **Step 6: Commit**

Run:

```bash
rtk git add package.json bun.lock docs/security/dependency-audit-2026-06-10.md
rtk git commit -m "chore: refresh dependency audit baseline"
```

---

## Phase 0A - Clean Legacy Project Surface

This phase makes the repo easier to work in before deep map, terrain, protocol, and gameplay changes. It must preserve useful evidence while removing or clearly quarantining stale scripts, outdated docs, superseded audits, wrong plans, one-off migration tools, and generated artifacts that currently obscure the active path.

### Ticket 0A.1: Inventory and Classify Scripts, Tools, Docs, Plans, and Audits

**Scope:** Build a current project-surface inventory that classifies every package script, content tool, active doc, historical audit, plan, and generated artifact policy.

**Out of scope:** Do not delete, move, or rename files in this ticket. This ticket is read-only except for the new inventory tool, inventory output, and documentation.

**Files:**
- Create: `tools/maintenance/project-surface-inventory.ts`
- Create: `tests/unit/project-surface-inventory.test.ts`
- Create: `docs/project-surface-inventory.md`
- Modify: `package.json`
- Generate: `artifacts/project-surface-inventory.json`

**Acceptance criteria:**
- Every `package.json` script is listed with status `active`, `legacy`, `replace`, `archive`, or `delete`.
- Every `tools/content/*.ts` file is listed with status `active`, `legacy`, `replace`, `archive`, or `delete`.
- Every `docs/*.md` file is listed with status `active`, `historical`, `archive`, `replace`, or `delete`.
- `PLAN.md` and `EXTERNAL-AUDIT.md` are explicitly classified when present.
- The inventory names a replacement for each `replace` item.
- The inventory names a preserve reason for each `historical` or `archive` item.
- The inventory does not decide based only on filename; it reads command references and known active scripts.

**Verification plan:**
- `rtk bun test tests/unit/project-surface-inventory.test.ts --timeout 20000`
- `rtk bun run audit:project-surface`
- `rtk bun run typecheck:tools`

**Dependencies/blockers:** Phase 0. Run after the current red baseline is documented so cleanup does not hide original failures.

- [x] **Step 1: Create inventory types and classifier**

Create `tools/maintenance/project-surface-inventory.ts`:

```ts
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export type SurfaceStatus = 'active' | 'legacy' | 'replace' | 'archive' | 'delete' | 'historical';

export type SurfaceEntry = Readonly<{
    path: string;
    kind: 'package_script' | 'content_tool' | 'doc' | 'plan' | 'external_audit' | 'generated_policy';
    name: string;
    status: SurfaceStatus;
    reason: string;
    replacement?: string;
    preserveReason?: string;
}>;

type PackageJson = Readonly<{
    scripts?: Record<string, string>;
}>;

const activeScriptPrefixes = ['dev', 'build', 'check', 'audit', 'repair', 'typecheck', 'test', 'lint', 'format', 'verify', 'bench', 'bots', 'admin'] as const;

function classifyPackageScript(name: string, command: string): SurfaceEntry {
    const knownReplaceScripts: Record<string, string> = {
        'fix:world-portals': 'Phase 2A world-authoring-repair replaces stale portal curation.',
        'fix:tileset-wang:scaffold': 'Phase 2A terrain grammar replaces scaffold-as-authority flow.',
        'fix:tileset-modernize': 'Phase 2A terrain grammar replaces broad tileset metadata modernization writes.',
        'fix:foreground-layers': 'Phase 2 layer contract and Phase 2A authoring repair replace broad foreground migration writes.',
        'check:world-standardize:dry': 'Phase 2A terrain authoring audit replaces broad standardize dry-run as the first review surface.',
        'fix:world-standardize': 'Phase 2A safe repair replaces broad standardize writes.',
        'check:tileset-modernize:dry': 'Phase 2A terrain authoring audit replaces broad tileset modernization dry-run as the first review surface.',
        'check:foreground-layers:dry': 'Phase 2 layer contract replaces broad foreground migration dry-run as the first review surface.',
    };
    if (knownReplaceScripts[name]) {
        return {
            path: 'package.json',
            kind: 'package_script',
            name,
            status: 'replace',
            reason: knownReplaceScripts[name],
            replacement: knownReplaceScripts[name],
        };
    }
    const prefix = name.split(':')[0] ?? name;
    const status: SurfaceStatus = activeScriptPrefixes.includes(prefix as (typeof activeScriptPrefixes)[number]) ? 'active' : 'legacy';
    return {
        path: 'package.json',
        kind: 'package_script',
        name,
        status,
        reason: status === 'active' ? `Script is in the active ${prefix} lane: ${command}` : `Script is outside the active script prefix set: ${command}`,
    };
}

function classifyContentTool(file: string): SurfaceEntry {
    const basename = path.basename(file);
    const replacements: Record<string, string> = {
        'world-curate-portals.ts': 'tools/content/world-authoring-repair.ts',
        'tileset-wang-scaffold.ts': 'assets/maps/tiled/terrain-authoring.json plus tools/content/terrain-grammar-validator.ts',
        'tileset-modernize-metadata.ts': 'assets/maps/tiled/terrain-authoring.json plus tools/content/terrain-grammar-validator.ts',
        'maps-migrate-v-to-foreground.ts': 'shared/maps/layer-contract.ts plus tools/content/world-authoring-repair.ts',
        'world-standardize-pipeline.ts': 'tools/content/world-authoring-repair.ts',
        'world-standardize-idiomatic.ts': 'tools/content/world-authoring-repair.ts',
    };
    if (replacements[basename]) {
        return {
            path: file,
            kind: 'content_tool',
            name: basename,
            status: 'replace',
            reason: 'Tool is a broad or stale map-authoring migration surface and must not be treated as the current source of truth.',
            replacement: replacements[basename],
        };
    }
    return {
        path: file,
        kind: 'content_tool',
        name: basename,
        status: 'active',
        reason: 'No stale classification rule matched; keep until dependency/reference audit proves otherwise.',
    };
}

function classifyDoc(file: string): SurfaceEntry {
    const basename = path.basename(file);
    if (basename.startsWith('audit-') || basename.includes('legacy-parity')) {
        return {
            path: file,
            kind: 'doc',
            name: basename,
            status: 'historical',
            reason: 'Historical audit evidence; preserve but move behind docs archive/index if no longer active guidance.',
            preserveReason: 'Contains dated evidence and decisions useful for regression analysis.',
        };
    }
    return {
        path: file,
        kind: 'doc',
        name: basename,
        status: 'active',
        reason: 'Current documentation candidate; verify through docs index in Ticket 0A.3.',
    };
}

async function listFiles(dir: string, suffix: string): Promise<string[]> {
    const out: string[] = [];
    async function walk(current: string): Promise<void> {
        for (const entry of await readdir(current, { withFileTypes: true })) {
            const absolute = path.join(current, entry.name);
            if (entry.isDirectory()) {
                await walk(absolute);
            } else if (entry.name.endsWith(suffix)) {
                out.push(path.relative(process.cwd(), absolute).replace(/\\/g, '/'));
            }
        }
    }
    try {
        await walk(dir);
    } catch {
        return [];
    }
    return out.sort();
}

export async function buildProjectSurfaceInventory(): Promise<SurfaceEntry[]> {
    const entries: SurfaceEntry[] = [];
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as PackageJson;
    for (const [name, command] of Object.entries(packageJson.scripts ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
        entries.push(classifyPackageScript(name, command));
    }
    for (const file of await listFiles('tools/content', '.ts')) {
        entries.push(classifyContentTool(file));
    }
    for (const file of await listFiles('docs', '.md')) {
        entries.push(classifyDoc(file));
    }
    try {
        await readFile('PLAN.md', 'utf8');
        entries.push({
            path: 'PLAN.md',
            kind: 'plan',
            name: 'PLAN.md',
            status: 'active',
            reason: 'Current implementation plan requested by the user.',
        });
    } catch {}
    try {
        await readFile('EXTERNAL-AUDIT.md', 'utf8');
        entries.push({
            path: 'EXTERNAL-AUDIT.md',
            kind: 'external_audit',
            name: 'EXTERNAL-AUDIT.md',
            status: 'archive',
            reason: 'External audit evidence should be imported into docs/audits/ or referenced from PLAN.md, not left as an untracked root file.',
            preserveReason: 'Contains external review findings that may drive implementation tickets.',
        });
    } catch {}
    entries.push({
        path: 'artifacts/',
        kind: 'generated_policy',
        name: 'artifacts',
        status: 'active',
        reason: 'Generated review artifacts are allowed when deterministic and named by the producing tool.',
    });
    return entries;
}

async function main(): Promise<void> {
    const entries = await buildProjectSurfaceInventory();
    await mkdir('artifacts', { recursive: true });
    await writeFile('artifacts/project-surface-inventory.json', `${JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2)}\n`);
    console.log(`Project surface inventory entries: ${entries.length}`);
}

if (import.meta.main) {
    await main();
}
```

- [x] **Step 2: Add inventory tests**

Create `tests/unit/project-surface-inventory.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { buildProjectSurfaceInventory } from '../../tools/maintenance/project-surface-inventory';

test('project surface inventory classifies package scripts', async () => {
    const entries = await buildProjectSurfaceInventory();
    expect(entries.some((entry) => entry.kind === 'package_script' && entry.name === 'verify:modern' && entry.status === 'active')).toBe(true);
});

test('project surface inventory flags known stale map curation script', async () => {
    const entries = await buildProjectSurfaceInventory();
    const entry = entries.find((candidate) => candidate.kind === 'package_script' && candidate.name === 'fix:world-portals');
    expect(entry?.status).toBe('replace');
    expect(entry?.replacement).toContain('world-authoring-repair');
});

test('project surface inventory preserves historical audits instead of deleting them blindly', async () => {
    const entries = await buildProjectSurfaceInventory();
    const historical = entries.filter((entry) => entry.kind === 'doc' && entry.status === 'historical');
    expect(historical.length).toBeGreaterThan(0);
    expect(historical.every((entry) => Boolean(entry.preserveReason))).toBe(true);
});
```

- [x] **Step 3: Add package script**

In `package.json`, add:

```json
"audit:project-surface": "bun tools/maintenance/project-surface-inventory.ts"
```

- [x] **Step 4: Create human-readable inventory doc**

Create `docs/project-surface-inventory.md`:

```markdown
# Project Surface Inventory

The project surface inventory classifies scripts, content tools, docs, plans, external audits, and generated artifact policy before cleanup work starts.

Status values:

- `active`: Current supported entry point.
- `legacy`: Still usable for historical compatibility or fixture support, but not the preferred path.
- `replace`: Superseded by a named tool, plan, or ticket.
- `archive`: Preserve as evidence outside the active workflow.
- `delete`: Remove after dependency/reference checks prove it has no remaining value.
- `historical`: Keep as dated evidence and move under an archive/index when appropriate.

Current known replacement candidates:

- `fix:world-portals` -> Phase 2A `world-authoring-repair`.
- `fix:tileset-wang:scaffold` -> `terrain-authoring.json` plus `terrain-grammar-validator`.
- `check:world-standardize:dry` -> `terrain-authoring-audit`.
- `fix:world-standardize` -> dry-run-first `world-authoring-repair`.
```

- [x] **Step 5: Verify**

Run:

```bash
rtk bun test tests/unit/project-surface-inventory.test.ts --timeout 20000
rtk bun run audit:project-surface
rtk bun run typecheck:tools
```

Expected:

```text
0 fail
Project surface inventory entries:
```

- [x] **Step 6: Commit**

Run:

```bash
rtk git add tools/maintenance/project-surface-inventory.ts tests/unit/project-surface-inventory.test.ts docs/project-surface-inventory.md package.json artifacts/project-surface-inventory.json
rtk git commit -m "chore: inventory project maintenance surface"
```

### Ticket 0A.2: Normalize Package Scripts and Check Names

**Scope:** Make `package.json` scripts reflect active entry points and move stale or dangerous one-off authoring scripts out of the normal `fix:` lane.

**Out of scope:** Do not delete tool files in this ticket. Do not change runtime behavior. Do not run any write script against map files.

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/project-surface-inventory.md`
- Test: `tests/unit/package-scripts-contract.test.ts`

**Acceptance criteria:**
- Active scripts are grouped by purpose: `build:*`, `check:*`, `audit:*`, `repair:*`, `test:*`, `typecheck:*`, `lint:*`, `format:*`, `verify:*`.
- Scripts that write map or tileset data use `repair:*` or `legacy:*`, not ambiguous `fix:*`.
- Known stale script `fix:world-portals` is removed or renamed to `legacy:fix:world-portals` with documentation that it must not be used for current portal work.
- Known broad script `fix:world-standardize` is removed or renamed to `legacy:fix:world-standardize` with documentation that Phase 2A safe repair replaces it.
- Known broad scripts `fix:tileset-modernize` and `fix:foreground-layers` are removed or renamed to `legacy:*` names with documentation that Phase 2/2A replacements own current work.
- `verify:modern` continues to use only active non-legacy scripts.
- `README.md` documents the active script lanes and warns that `legacy:*` scripts are preserved evidence or migration aids, not current workflow.

**Verification plan:**
- `rtk bun test tests/unit/package-scripts-contract.test.ts --timeout 20000`
- `rtk bun run audit:project-surface`
- `rtk bun run verify:modern` after Phase 0 baseline is green.

**Dependencies/blockers:** Ticket 0A.1.

- [x] **Step 1: Add script contract test**

Create `tests/unit/package-scripts-contract.test.ts`:

```ts
import { expect, test } from 'bun:test';
import packageJson from '../../package.json';

const scripts = packageJson.scripts as Record<string, string>;

test('verify modern does not call legacy scripts', () => {
    expect(scripts['verify:modern']).toBeDefined();
    expect(scripts['verify:modern']).not.toContain('legacy:');
    expect(scripts['verify:modern']).not.toContain('fix:world-portals');
    expect(scripts['verify:modern']).not.toContain('fix:world-standardize');
});

test('map write scripts are explicit repair or legacy lanes', () => {
    const writeScripts = Object.entries(scripts).filter(([, command]) => command.includes('tools/content/') && command.includes('--write'));
    for (const [name] of writeScripts) {
        expect(name.startsWith('repair:') || name.startsWith('legacy:')).toBe(true);
    }
});

test('known stale world portal script is not an active fix script', () => {
    expect(scripts['fix:world-portals']).toBeUndefined();
});
```

- [x] **Step 2: Rename stale write scripts**

In `package.json`, rename these scripts:

```json
"fix:tileset-wang:scaffold": "bun tools/content/tileset-wang-scaffold.ts --write",
"fix:tileset-modernize": "bun tools/content/tileset-modernize-metadata.ts --write",
"fix:foreground-layers": "bun tools/content/maps-migrate-v-to-foreground.ts --strip-v --write",
"fix:world-standardize": "bun tools/content/world-standardize-pipeline.ts --write --drop-plateau-mask --drop-blocking-mask",
"fix:world-portals": "bun tools/content/world-curate-portals.ts --write"
```

to:

```json
"legacy:fix:tileset-wang:scaffold": "bun tools/content/tileset-wang-scaffold.ts --write",
"legacy:fix:tileset-modernize": "bun tools/content/tileset-modernize-metadata.ts --write",
"legacy:fix:foreground-layers": "bun tools/content/maps-migrate-v-to-foreground.ts --strip-v --write",
"legacy:fix:world-standardize": "bun tools/content/world-standardize-pipeline.ts --write --drop-plateau-mask --drop-blocking-mask",
"legacy:fix:world-portals": "bun tools/content/world-curate-portals.ts --write"
```

Keep dry-run audit scripts active only when they are read-only:

```json
"check:tileset-wang:audit": "bun tools/content/tileset-wang-audit.ts",
"check:world-tile-paints": "bun tools/content/world-tile-paint-audit.ts"
```

- [x] **Step 3: Update README script lane docs**

In `README.md`, add:

```markdown
### Script Lanes

- `check:*`: read-only content or project checks.
- `audit:*`: read-only inventory and review reports that usually write artifacts under `artifacts/`.
- `repair:*`: write-capable maintenance scripts. Prefer dry-run variants when available.
- `legacy:*`: preserved migration or historical scripts. Do not use for new work unless the current plan explicitly says to.
- `verify:*`: aggregate release gates; these must not call `legacy:*` scripts.
```

- [x] **Step 4: Update inventory docs**

In `docs/project-surface-inventory.md`, add:

```markdown
## Script Cleanup Decisions

- `fix:world-portals` was moved to `legacy:fix:world-portals` because it is non-recursive and writes `target_map=world`; current portal work belongs in Phase 2 and Phase 2A repair tooling.
- `fix:world-standardize` was moved to `legacy:fix:world-standardize` because broad authoring writes must go through dry-run-first repair plans.
- `fix:tileset-wang:scaffold` was moved to `legacy:fix:tileset-wang:scaffold` because the scaffold Wang sets are audit evidence, not the final terrain grammar.
- `fix:tileset-modernize` was moved to `legacy:fix:tileset-modernize` because final tileset metadata should come from the terrain grammar and generated authoring contract.
- `fix:foreground-layers` was moved to `legacy:fix:foreground-layers` because foreground migration must be validated by the layer contract and region visual audit.
```

- [x] **Step 5: Verify**

Run:

```bash
rtk bun test tests/unit/package-scripts-contract.test.ts --timeout 20000
rtk bun run audit:project-surface
rtk bun run typecheck:tools
```

Expected:

```text
0 fail
```

- [x] **Step 6: Commit**

Run:

```bash
rtk git add package.json README.md docs/project-surface-inventory.md tests/unit/package-scripts-contract.test.ts artifacts/project-surface-inventory.json
rtk git commit -m "chore: normalize maintenance script lanes"
```

### Ticket 0A.3: Archive Historical Audits and Create Documentation Index

**Scope:** Move outdated or historical docs behind an archive/index boundary while keeping active docs easy to find.

**Out of scope:** Do not delete audit evidence. Do not rewrite historical conclusions except to add an archive banner.

**Files:**
- Create: `docs/README.md`
- Create: `docs/archive/2026-02/README.md`
- Move: `docs/audit-typing-rules-streamlining-2026-02-12.md` -> `docs/archive/2026-02/audit-typing-rules-streamlining-2026-02-12.md`
- Move: `docs/audit-typing-rules-streamlining-2026-02-12-followup.md` -> `docs/archive/2026-02/audit-typing-rules-streamlining-2026-02-12-followup.md`
- Move: `docs/audit-legacy-parity-combat-ai-2026-02-13.md` -> `docs/archive/2026-02/audit-legacy-parity-combat-ai-2026-02-13.md`
- Create if root file exists: `docs/audits/external-audit-2026-06-10.md`
- Modify: `README.md`
- Modify: `docs/project-surface-inventory.md`
- Test: `tests/unit/docs-index.test.ts`

**Acceptance criteria:**
- `docs/README.md` lists active docs and archived docs separately.
- Historical February audits are under `docs/archive/2026-02/`.
- Each archived audit starts with an archive banner that says it is historical evidence, not current implementation guidance.
- `EXTERNAL-AUDIT.md`, when present, is moved into `docs/audits/external-audit-2026-06-10.md` or explicitly referenced from `docs/README.md` if it must remain root-local during review.
- Root docs no longer mix current guidance and dated audit evidence without an index.

**Verification plan:**
- `rtk bun test tests/unit/docs-index.test.ts --timeout 20000`
- `rtk rg -n "audit-typing-rules-streamlining|audit-legacy-parity-combat-ai" docs README.md PLAN.md`
- `rtk git status --short docs EXTERNAL-AUDIT.md README.md`

**Dependencies/blockers:** Ticket 0A.1.

- [x] **Step 1: Add docs index test**

Create `tests/unit/docs-index.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';

test('docs index names active and archived documentation sections', () => {
    const index = readFileSync('docs/README.md', 'utf8');
    expect(index).toContain('## Active Documentation');
    expect(index).toContain('## Archived Evidence');
});

test('historical February audits are archived', () => {
    expect(existsSync('docs/archive/2026-02/audit-typing-rules-streamlining-2026-02-12.md')).toBe(true);
    expect(existsSync('docs/archive/2026-02/audit-typing-rules-streamlining-2026-02-12-followup.md')).toBe(true);
    expect(existsSync('docs/archive/2026-02/audit-legacy-parity-combat-ai-2026-02-13.md')).toBe(true);
});

test('archived audits carry a historical evidence banner', () => {
    const audit = readFileSync('docs/archive/2026-02/audit-legacy-parity-combat-ai-2026-02-13.md', 'utf8');
    expect(audit.startsWith('> Historical evidence:')).toBe(true);
});
```

- [x] **Step 2: Move historical audits**

Run:

```bash
rtk mkdir -p docs/archive/2026-02
rtk git mv docs/audit-typing-rules-streamlining-2026-02-12.md docs/archive/2026-02/audit-typing-rules-streamlining-2026-02-12.md
rtk git mv docs/audit-typing-rules-streamlining-2026-02-12-followup.md docs/archive/2026-02/audit-typing-rules-streamlining-2026-02-12-followup.md
rtk git mv docs/audit-legacy-parity-combat-ai-2026-02-13.md docs/archive/2026-02/audit-legacy-parity-combat-ai-2026-02-13.md
```

- [x] **Step 3: Add archive banners**

At the top of each moved audit, add:

```markdown
> Historical evidence: this audit records the state and decisions from February 2026. Use `PLAN.md` and `docs/README.md` for current implementation guidance.

```

- [x] **Step 4: Import external audit evidence**

If `EXTERNAL-AUDIT.md` exists at repo root, run:

```bash
rtk mkdir -p docs/audits
rtk git mv EXTERNAL-AUDIT.md docs/audits/external-audit-2026-06-10.md
```

Add this banner to the top:

```markdown
> External audit evidence: preserve original findings, but drive current work from `PLAN.md` tickets and verified local code state.

```

If `EXTERNAL-AUDIT.md` is not tracked yet, use `rtk mv EXTERNAL-AUDIT.md docs/audits/external-audit-2026-06-10.md` and then stage the destination.

- [x] **Step 5: Create docs index**

Create `docs/README.md`:

```markdown
# BrowserQuest Documentation Index

## Active Documentation

- `../PLAN.md`: Current implementation plan and ticket order.
- `protocol-wire.md`: Current protocol format reference.
- `protocol-fixedbin.md`: Fixed binary protocol notes.
- `map-transition-rollout.md`: Map transition rollout notes.
- `server-logging-taxonomy.md`: Logging taxonomy.
- `css-modernization-progress.md`: Client CSS modernization progress.
- `project-surface-inventory.md`: Script, tool, doc, plan, and audit surface classification.

## Active Map Authoring Documentation

- `../assets/maps/tiled/templates/README.md`: Tiled object templates.
- `../assets/maps/tiled/terrain-scaffold-guide.md`: Historical scaffold notes; use Phase 2A terrain grammar for current terrain work.

## Archived Evidence

- `archive/2026-02/audit-typing-rules-streamlining-2026-02-12.md`
- `archive/2026-02/audit-typing-rules-streamlining-2026-02-12-followup.md`
- `archive/2026-02/audit-legacy-parity-combat-ai-2026-02-13.md`
- `audits/external-audit-2026-06-10.md`, when present.
```

- [x] **Step 6: Update README**

In `README.md`, add a short pointer:

```markdown
Documentation starts at `docs/README.md`. Historical audits are archived under `docs/archive/` and should be treated as evidence, not current implementation instructions.
```

- [x] **Step 7: Verify**

Run:

```bash
rtk bun test tests/unit/docs-index.test.ts --timeout 20000
rtk rg -n "audit-typing-rules-streamlining|audit-legacy-parity-combat-ai" docs README.md PLAN.md
rtk git status --short docs EXTERNAL-AUDIT.md README.md
```

Expected:

```text
0 fail
```

and audit references point to `docs/archive/2026-02/`.

- [x] **Step 8: Commit**

Run:

```bash
rtk git add docs README.md tests/unit/docs-index.test.ts
rtk git commit -m "docs: archive historical audits and add docs index"
```

### Ticket 0A.4: Quarantine Superseded Content Tools

**Scope:** Move or mark known superseded content tools so they are not mistaken for current workflows.

**Out of scope:** Do not delete a tool that still has a package script, test, or docs reference. Do not move a tool before references are updated.

**Files:**
- Create: `tools/content/legacy/README.md`
- Move after reference audit: `tools/content/world-curate-portals.ts` -> `tools/content/legacy/world-curate-portals.ts`
- Move after reference audit: `tools/content/tileset-wang-scaffold.ts` -> `tools/content/legacy/tileset-wang-scaffold.ts`
- Move after reference audit: `tools/content/tileset-modernize-metadata.ts` -> `tools/content/legacy/tileset-modernize-metadata.ts`
- Move after reference audit: `tools/content/maps-migrate-v-to-foreground.ts` -> `tools/content/legacy/maps-migrate-v-to-foreground.ts`
- Move after reference audit: `tools/content/world-standardize-pipeline.ts` -> `tools/content/legacy/world-standardize-pipeline.ts`
- Move after reference audit: `tools/content/world-standardize-idiomatic.ts` -> `tools/content/legacy/world-standardize-idiomatic.ts`
- Modify: `package.json`
- Modify: `docs/project-surface-inventory.md`
- Test: `tests/unit/content-tool-surface.test.ts`

**Acceptance criteria:**
- No active script references a file under `tools/content/legacy/`.
- Every `legacy:*` package script that remains points at `tools/content/legacy/` and is documented as preserved evidence.
- `tools/content/legacy/README.md` names the current replacement for each moved tool.
- `rtk rg` confirms no active docs tell users to run a legacy tool as current workflow.

**Verification plan:**
- `rtk bun test tests/unit/content-tool-surface.test.ts --timeout 20000`
- `rtk bun run audit:project-surface`
- `rtk rg -n "tools/content/(world-curate-portals|tileset-wang-scaffold|tileset-modernize-metadata|maps-migrate-v-to-foreground|world-standardize-pipeline|world-standardize-idiomatic)\\.ts" package.json docs README.md PLAN.md assets/maps/tiled`

**Dependencies/blockers:** Tickets 0A.1 and 0A.2.

- [ ] **Step 1: Add content tool surface test**

Create `tests/unit/content-tool-surface.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import packageJson from '../../package.json';

const scripts = packageJson.scripts as Record<string, string>;

test('active scripts do not reference legacy content tools', () => {
    for (const [name, command] of Object.entries(scripts)) {
        if (name.startsWith('legacy:')) {
            continue;
        }
        expect(command).not.toContain('tools/content/legacy/');
    }
});

test('legacy content tools have replacement documentation', () => {
    const readme = readFileSync('tools/content/legacy/README.md', 'utf8');
    for (const file of readdirSync('tools/content/legacy')) {
        if (!file.endsWith('.ts')) {
            continue;
        }
        expect(readme).toContain(file);
        expect(readme).toContain('Replacement:');
    }
});

test('legacy scripts point at legacy content tool paths', () => {
    for (const [name, command] of Object.entries(scripts)) {
        if (name.startsWith('legacy:fix:')) {
            expect(command).toContain('tools/content/legacy/');
        }
    }
});
```

- [ ] **Step 2: Create legacy README**

Create `tools/content/legacy/README.md`:

```markdown
# Legacy Content Tools

These tools are preserved as historical migration evidence. They are not current authoring workflow entry points.

## Tools

- `world-curate-portals.ts`
  - Replacement: Phase 2 explicit door/portal semantics plus Phase 2A `world-authoring-repair`.
  - Reason: The old tool is non-recursive and writes stale `target_map=world` semantics.
- `tileset-wang-scaffold.ts`
  - Replacement: `assets/maps/tiled/terrain-authoring.json` plus `tools/content/terrain-grammar-validator.ts`.
  - Reason: Scaffold Wang sets are incomplete audit hints, not the target terrain grammar.
- `tileset-modernize-metadata.ts`
  - Replacement: `assets/maps/tiled/terrain-authoring.json` plus generated tileset metadata from Phase 2A.
  - Reason: Broad metadata writes must be driven by the approved terrain grammar.
- `maps-migrate-v-to-foreground.ts`
  - Replacement: `shared/maps/layer-contract.ts`, `world-map-validator.ts`, and Phase 2A visual review.
  - Reason: Foreground migration must be validated against layer taxonomy and visual artifacts.
- `world-standardize-pipeline.ts`
  - Replacement: Phase 2A dry-run-first authoring repair.
  - Reason: Broad write pipelines are too risky before the terrain grammar and visual audit exist.
- `world-standardize-idiomatic.ts`
  - Replacement: Phase 2A dry-run-first authoring repair and targeted validators.
  - Reason: Broad normalization should be decomposed into explicit, reviewed repair rules.
```

- [ ] **Step 3: Move superseded tools**

Run:

```bash
rtk mkdir -p tools/content/legacy
rtk git mv tools/content/world-curate-portals.ts tools/content/legacy/world-curate-portals.ts
rtk git mv tools/content/tileset-wang-scaffold.ts tools/content/legacy/tileset-wang-scaffold.ts
rtk git mv tools/content/tileset-modernize-metadata.ts tools/content/legacy/tileset-modernize-metadata.ts
rtk git mv tools/content/maps-migrate-v-to-foreground.ts tools/content/legacy/maps-migrate-v-to-foreground.ts
rtk git mv tools/content/world-standardize-pipeline.ts tools/content/legacy/world-standardize-pipeline.ts
rtk git mv tools/content/world-standardize-idiomatic.ts tools/content/legacy/world-standardize-idiomatic.ts
```

- [ ] **Step 4: Update legacy package scripts**

In `package.json`, update legacy scripts to point to moved paths:

```json
"legacy:fix:tileset-wang:scaffold": "bun tools/content/legacy/tileset-wang-scaffold.ts --write",
"legacy:fix:tileset-modernize": "bun tools/content/legacy/tileset-modernize-metadata.ts --write",
"legacy:fix:foreground-layers": "bun tools/content/legacy/maps-migrate-v-to-foreground.ts --strip-v --write",
"legacy:fix:world-standardize": "bun tools/content/legacy/world-standardize-pipeline.ts --write --drop-plateau-mask --drop-blocking-mask",
"legacy:fix:world-portals": "bun tools/content/legacy/world-curate-portals.ts --write"
```

If `check:world-standardize:dry` remains, rename it to:

```json
"legacy:check:world-standardize:dry": "bun tools/content/legacy/world-standardize-pipeline.ts --drop-plateau-mask --drop-blocking-mask --skip-validate"
```

If `check:tileset-modernize:dry` or `check:foreground-layers:dry` remain, rename them to:

```json
"legacy:check:tileset-modernize:dry": "bun tools/content/legacy/tileset-modernize-metadata.ts",
"legacy:check:foreground-layers:dry": "bun tools/content/legacy/maps-migrate-v-to-foreground.ts"
```

- [ ] **Step 5: Update docs references**

Replace active references to the moved tools in `docs/project-surface-inventory.md`, `docs/README.md`, `README.md`, and `assets/maps/tiled/terrain-scaffold-guide.md` so they either point at `tools/content/legacy/` as historical evidence or at the Phase 2A replacement.

Use this wording in `assets/maps/tiled/terrain-scaffold-guide.md`:

```markdown
This guide is historical scaffold documentation. It is useful for understanding how the current incomplete Wang metadata was produced, but current terrain work should use `assets/maps/tiled/terrain-authoring.json`, `tools/content/terrain-grammar-validator.ts`, and the Phase 2A visual audit workflow.
```

- [ ] **Step 6: Verify**

Run:

```bash
rtk bun test tests/unit/content-tool-surface.test.ts --timeout 20000
rtk bun run audit:project-surface
rtk rg -n "tools/content/(world-curate-portals|tileset-wang-scaffold|tileset-modernize-metadata|maps-migrate-v-to-foreground|world-standardize-pipeline|world-standardize-idiomatic)\\.ts" package.json docs README.md PLAN.md assets/maps/tiled
```

Expected:

```text
0 fail
```

and every reference is either under `tools/content/legacy/` or describes the historical location.

- [ ] **Step 7: Commit**

Run:

```bash
rtk git add tools/content/legacy package.json docs README.md assets/maps/tiled/terrain-scaffold-guide.md tests/unit/content-tool-surface.test.ts artifacts/project-surface-inventory.json
rtk git commit -m "chore: quarantine superseded content tools"
```

### Ticket 0A.5: Add Clean Base State Gate

**Scope:** Add a single check that confirms the project surface is classified, docs are indexed, active scripts avoid legacy tools, and generated artifact policy is clear.

**Out of scope:** Do not make `verify:modern` depend on this gate until Phase 0 and Phase 0A are green.

**Files:**
- Create: `tools/maintenance/check-clean-base-state.ts`
- Modify: `package.json`
- Modify: `README.md`
- Test: `tests/unit/clean-base-state.test.ts`

**Acceptance criteria:**
- `rtk bun run check:clean-base-state` fails if:
  - `docs/README.md` is missing
  - `artifacts/project-surface-inventory.json` is missing
  - an active package script calls `tools/content/legacy/`
  - `EXTERNAL-AUDIT.md` exists at repo root after docs archive cleanup
  - historical audit docs reappear at `docs/audit-*.md`
- `README.md` names `check:clean-base-state` as the pre-work hygiene gate.
- The gate can run independently from `verify:modern`.

**Verification plan:**
- `rtk bun test tests/unit/clean-base-state.test.ts --timeout 20000`
- `rtk bun run check:clean-base-state`
- `rtk bun run audit:project-surface`

**Dependencies/blockers:** Tickets 0A.1 through 0A.4.

- [ ] **Step 1: Create clean base checker**

Create `tools/maintenance/check-clean-base-state.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';

type PackageJson = Readonly<{
    scripts?: Record<string, string>;
}>;

const failures: string[] = [];

function requireExists(path: string): void {
    if (!existsSync(path)) {
        failures.push(`Missing required clean-base file: ${path}`);
    }
}

requireExists('docs/README.md');
requireExists('docs/project-surface-inventory.md');
requireExists('artifacts/project-surface-inventory.json');

if (existsSync('EXTERNAL-AUDIT.md')) {
    failures.push('EXTERNAL-AUDIT.md must be moved under docs/audits/ or explicitly removed from the repo root.');
}

if (existsSync('docs')) {
    for (const file of readdirSync('docs')) {
        if (file.startsWith('audit-') && file.endsWith('.md')) {
            failures.push(`Historical audit remains in active docs root: docs/${file}`);
        }
    }
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as PackageJson;
for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
    if (!name.startsWith('legacy:') && command.includes('tools/content/legacy/')) {
        failures.push(`Active script "${name}" calls legacy content tool: ${command}`);
    }
}

if (failures.length > 0) {
    console.error(`Clean base state check failed:\n${failures.join('\n')}`);
    process.exit(1);
}

console.log('Clean base state check passed.');
```

- [ ] **Step 2: Add clean base tests**

Create `tests/unit/clean-base-state.test.ts`:

```ts
import { expect, test } from 'bun:test';

test('clean base checker source guards root external audit files', async () => {
    const source = await Bun.file('tools/maintenance/check-clean-base-state.ts').text();
    expect(source).toContain('EXTERNAL-AUDIT.md');
});

test('clean base checker source guards active scripts from legacy tools', async () => {
    const source = await Bun.file('tools/maintenance/check-clean-base-state.ts').text();
    expect(source).toContain('tools/content/legacy/');
    expect(source).toContain("!name.startsWith('legacy:')");
});
```

- [ ] **Step 3: Add script**

In `package.json`, add:

```json
"check:clean-base-state": "bun tools/maintenance/check-clean-base-state.ts"
```

- [ ] **Step 4: Update README**

In `README.md`, add:

```markdown
Before starting a new implementation slice, run `bun run check:clean-base-state` after the Phase 0A cleanup lands. It verifies that active scripts, docs, archived audits, external audit evidence, and generated artifact policy are in a known state.
```

- [ ] **Step 5: Verify**

Run:

```bash
rtk bun test tests/unit/clean-base-state.test.ts --timeout 20000
rtk bun run check:clean-base-state
rtk bun run audit:project-surface
```

Expected:

```text
0 fail
Clean base state check passed.
```

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add tools/maintenance/check-clean-base-state.ts tests/unit/clean-base-state.test.ts package.json README.md artifacts/project-surface-inventory.json
rtk git commit -m "chore: add clean base state gate"
```

---

## Phase 1 - Make the Map-Pack the Runtime Source of Truth

### Ticket 1.1: Runtime Config Loads `map-pack.config.json`

**Scope:** Change default runtime config, tests, and docs so the server loads `assets/maps/tiled/map-pack.config.json`.

**Out of scope:** Do not split interiors yet. Do not turn off `allow_missing_target_maps` in this ticket unless all target maps already exist.

**Files:**
- Modify: `server/config.json`
- Modify: `server/config_local.json-dist`
- Modify: `README.md`
- Modify: tests that hard-code `./assets/maps/tiled/world.json` as production config.
- Keep support in `server/runtime-map-pack-source.ts` for raw Tiled maps as a test/tooling input only.

**Acceptance criteria:**
- `server/config.json` and `server/config_local.json-dist` use `"map_filepath": "./assets/maps/tiled/map-pack.config.json"`.
- Runtime `/assets/maps/runtime/map-pack.json` still serves compiled map-pack JSON.
- Existing tests that intentionally validate raw `world.json` support are renamed to make that intent explicit.

**Verification plan:**
- `rtk bun test tests/unit/server/runtime/runtime-map-pack-route.test.ts tests/unit/server/startup/preflight.test.ts tests/smoke/server-health-version.test.ts --timeout 20000`
- `rtk bun run check:maps`

**Dependencies/blockers:** Phase 0.

- [ ] **Step 1: Write config-focused tests**

Add or update a test in `tests/unit/server/runtime/factories.test.ts` asserting the configured map path is passed through unchanged:

```ts
test('main runtime createWorlds passes configured map-pack config path to worlds', () => {
    const config = createValidConfig({ map_filepath: './assets/maps/tiled/map-pack.config.json' });
    const created: Array<{ runPath?: string }> = [];
    const deps = createDependencies({
        WorldServer: class {
            runPath?: string;
            constructor() {
                created.push(this);
            }
            on() {}
            run(path: string) {
                this.runPath = path;
            }
        },
    });

    createWorlds(config, createServer(), deps);

    expect(created[0]?.runPath).toBe('./assets/maps/tiled/map-pack.config.json');
});
```

Adapt helper names to the actual exports in `tests/unit/server/runtime/factories.test.ts`.

- [ ] **Step 2: Update config files**

Change:

```json
"map_filepath": "./assets/maps/tiled/world.json"
```

to:

```json
"map_filepath": "./assets/maps/tiled/map-pack.config.json"
```

in both `server/config.json` and `server/config_local.json-dist`.

- [ ] **Step 3: Update docs**

In `README.md`, update the server config section to state:

```markdown
Runtime map loading uses `assets/maps/tiled/map-pack.config.json` as the default source. The pack config lists authored Tiled maps and compiles them into the client/server runtime map-pack payload. `assets/maps/tiled/world.json` remains an authoring input, not the configured production source.
```

- [ ] **Step 4: Update tests that represent production config**

Search:

```bash
rtk rg -n "map_filepath: './assets/maps/tiled/world.json'|\\\"map_filepath\\\": \\\"./assets/maps/tiled/world.json\\\"" tests server tools
```

For runtime/startup tests that model production config, replace with:

```ts
map_filepath: './assets/maps/tiled/map-pack.config.json'
```

For tests that intentionally verify raw Tiled bootstrap, keep `world.json` and rename the test to include `raw Tiled map compatibility`.

- [ ] **Step 5: Verify**

Run:

```bash
rtk bun test tests/unit/server/runtime/runtime-map-pack-route.test.ts tests/unit/server/startup/preflight.test.ts tests/unit/server/runtime/factories.test.ts tests/smoke/server-health-version.test.ts --timeout 20000
rtk bun run check:maps
```

Expected:

```text
0 fail
Map pack is up to date
```

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add server/config.json server/config_local.json-dist README.md tests
rtk git commit -m "feat: use map-pack config as runtime map source"
```

### Ticket 1.2: Regenerate and Enforce Runtime Map-Pack Artifact

**Status:** Completed early during Ticket 0.5 because `rtk bun run verify:modern` could not pass until `assets/maps/runtime/map-pack.json` existed and matched the authored maps.

**Scope:** Make `assets/maps/runtime/map-pack.json` current and enforce deterministic generation.

**Out of scope:** Do not change map semantics except as required to generate the same pack deterministically.

**Files:**
- Modify: `assets/maps/runtime/map-pack.json`
- Reference: `tools/content/map-pack.ts`
- Reference: `shared/maps/map-pack.ts`

**Acceptance criteria:**
- `rtk bun run build:maps` creates or updates `assets/maps/runtime/map-pack.json`.
- `rtk bun run check:maps` passes immediately after generation.
- `rtk bun run verify:modern` reaches past `check:maps`.

**Verification plan:**
- `rtk bun run build:maps`
- `rtk bun run check:maps`
- `rtk bun run verify:modern`

**Dependencies/blockers:** Ticket 1.1.

- [x] **Step 1: Regenerate**

Run:

```bash
rtk bun run build:maps
```

Expected:

```text
Generated /Users/krisztiaan/dev/BrowserQuest/assets/maps/runtime/map-pack.json
```

- [x] **Step 2: Check determinism**

Run:

```bash
rtk bun run check:maps
```

Expected:

```text
Map pack is up to date
```

- [x] **Step 3: Inspect generated diff**

Run:

```bash
rtk git diff --stat -- assets/maps/runtime/map-pack.json
rtk git diff -- assets/maps/runtime/map-pack.json | sed -n '1,160p'
```

Expected: generated JSON changes only. No source map file should change unless `build:maps` is discovered to be mutating authoring sources, which would be a bug to fix before proceeding.

- [x] **Step 4: Commit**

Run:

```bash
rtk git add assets/maps/runtime/map-pack.json
rtk git commit -m "chore: refresh runtime map-pack artifact"
```

### Ticket 1.3: Canonicalize Map Ids to `world_01`

**Scope:** Replace authored `target_map: world` door links with `target_map: world_01` and add a validator that rejects new `world` references.

**Out of scope:** Do not create interior maps yet. Do not alter door coordinates.

**Files:**
- Modify: `assets/maps/tiled/world.json`
- Modify: `tools/content/map-pack.ts` or create `tools/content/map-id-contract.ts`
- Modify: `package.json`
- Test: `tests/unit/map-pack.test.ts`

**Acceptance criteria:**
- Recursive map inspection shows zero door properties with `target_map: world`.
- New validation fails if any map-pack source has `target_map: world`.
- `rtk bun run check:maps` passes after regeneration.

**Verification plan:**
- `rtk bun test tests/unit/map-pack.test.ts --timeout 20000`
- `rtk bun run build:maps && rtk bun run check:maps`
- A one-off recursive count command returns `{ "world": 0 }`.

**Dependencies/blockers:** Ticket 1.2.

- [ ] **Step 1: Add failing unit test**

In `tests/unit/map-pack.test.ts`, add:

```ts
test('compileMapPack rejects legacy target_map world references', () => {
    const tiled = createTinyTiledMap({
        layers: [
            createDoorsLayer([
                createDoorObject({
                    id: 1,
                    x: 16,
                    y: 16,
                    properties: [
                        { name: 'door_id', type: 'string', value: 'entry' },
                        { name: 'target_map', type: 'string', value: 'world' },
                        { name: 'target_door', type: 'string', value: 'exit' },
                    ],
                }),
            ]),
        ],
    });

    expect(() =>
        compileMapPack({
            maps: [{ id: 'world_01', tiled }],
            edges: [],
            allowMissingTargetMaps: true,
        })
    ).toThrow('target_map \"world\" is not supported; use \"world_01\"');
});
```

Adapt helper names to the existing helpers in `tests/unit/map-pack.test.ts`.

- [ ] **Step 2: Implement the validation**

In `shared/maps/map-pack.ts`, inside `extractDoorGraphEntries`, after reading `targetMap`, add:

```ts
if (targetMap === 'world') {
    errors.push(
        `Invalid map "${mapId}" door "${resolvedDoorId.id}": target_map "world" is not supported; use "world_01".`
    );
}
```

- [ ] **Step 3: Update authored map data**

Use a structured JSON edit. Do not use broad string replacement over the file.

Run a Bun script command:

```bash
rtk bun -e '
const fs = require("fs");
const path = "assets/maps/tiled/world.json";
const root = JSON.parse(fs.readFileSync(path, "utf8"));
function visitLayers(layers) {
  for (const layer of layers ?? []) {
    for (const object of layer.objects ?? []) {
      for (const property of object.properties ?? []) {
        if (property.name === "target_map" && property.value === "world") {
          property.value = "world_01";
        }
      }
    }
    visitLayers(layer.layers);
  }
}
visitLayers(root.layers);
fs.writeFileSync(path, JSON.stringify(root, null, 2) + "\\n");
'
```

- [ ] **Step 4: Verify map id count**

Run:

```bash
rtk bun -e '
const fs = require("fs");
const root = JSON.parse(fs.readFileSync("assets/maps/tiled/world.json", "utf8"));
let world = 0, world01 = 0;
function visitLayers(layers) {
  for (const layer of layers ?? []) {
    for (const object of layer.objects ?? []) {
      for (const property of object.properties ?? []) {
        if (property.name === "target_map" && property.value === "world") world++;
        if (property.name === "target_map" && property.value === "world_01") world01++;
      }
    }
    visitLayers(layer.layers);
  }
}
visitLayers(root.layers);
console.log(JSON.stringify({ world, world_01: world01 }));
'
```

Expected:

```json
{"world":0,"world_01":7}
```

- [ ] **Step 5: Regenerate and test**

Run:

```bash
rtk bun test tests/unit/map-pack.test.ts --timeout 20000
rtk bun run build:maps
rtk bun run check:maps
```

Expected:

```text
0 fail
Map pack is up to date
```

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add shared/maps/map-pack.ts tests/unit/map-pack.test.ts assets/maps/tiled/world.json assets/maps/runtime/map-pack.json
rtk git commit -m "fix: canonicalize authored map ids"
```

### Ticket 1.4: Create Stub Interior Maps for Existing House Links

**Scope:** Create explicit minimal maps for `house_01` through `house_40` so linked doors resolve to real map ids.

**Out of scope:** Do not design final interiors. These maps are functional stub interiors with visible floor, collision boundaries, and a reverse door.

**Files:**
- Create: `assets/maps/tiled/maps/house_01.json` through `assets/maps/tiled/maps/house_40.json`
- Modify: `assets/maps/tiled/map-pack.config.json`
- Modify: `assets/maps/tiled/world.json`
- Modify or create: `tools/content/house-regenerate.ts`
- Test: `tests/unit/map-pack.test.ts`

**Acceptance criteria:**
- All `house_*` target maps referenced by `world.json` exist in `map-pack.config.json`.
- Every house map has an entry door with `door_id` matching the world door target.
- Every house entry door links back to the originating world door.
- `allow_missing_target_maps` can be set to `false` after this ticket.

**Verification plan:**
- `rtk bun run build:maps`
- `rtk bun run check:maps`
- `rtk bun test tests/unit/map-pack.test.ts tests/unit/server-world-map-pack-bootstrap.test.ts --timeout 20000`

**Dependencies/blockers:** Ticket 1.3.

- [ ] **Step 1: Extract current house targets**

Run:

```bash
rtk bun -e '
const fs = require("fs");
const root = JSON.parse(fs.readFileSync("assets/maps/tiled/world.json", "utf8"));
const targets = new Set();
function visitLayers(layers) {
  for (const layer of layers ?? []) {
    for (const object of layer.objects ?? []) {
      const props = Object.fromEntries((object.properties ?? []).map((p) => [p.name, p.value]));
      if (typeof props.target_map === "string" && props.target_map.startsWith("house_")) {
        targets.add(props.target_map);
      }
    }
    visitLayers(layer.layers);
  }
}
visitLayers(root.layers);
console.log([...targets].sort().join("\\n"));
'
```

Expected: `house_01` through `house_40`.

- [ ] **Step 2: Write generator output contract test**

Add a test to `tests/unit/map-pack.test.ts` that compiles a tiny world plus tiny house and verifies the edge:

```ts
test('compileMapPack accepts a world-to-house door with reverse house link', () => {
    const world = createTinyTiledMap({
        layers: [
            createDoorsLayer([
                createDoorObject({
                    id: 1,
                    x: 16,
                    y: 16,
                    properties: [
                        { name: 'door_id', type: 'string', value: 'world_house_01' },
                        { name: 'target_map', type: 'string', value: 'house_01' },
                        { name: 'target_door', type: 'string', value: 'house_01_entry' },
                    ],
                }),
            ]),
        ],
    });
    const house = createTinyTiledMap({
        layers: [
            createDoorsLayer([
                createDoorObject({
                    id: 2,
                    x: 32,
                    y: 48,
                    properties: [
                        { name: 'door_id', type: 'string', value: 'house_01_entry' },
                        { name: 'target_map', type: 'string', value: 'world_01' },
                        { name: 'target_door', type: 'string', value: 'world_house_01' },
                    ],
                }),
            ]),
        ],
    });

    const pack = compileMapPack({
        maps: [
            { id: 'world_01', tiled: world },
            { id: 'house_01', tiled: house },
        ],
        edges: [],
        allowMissingTargetMaps: false,
    });

    expect(pack.graph.edges).toContainEqual({
        from: { mapId: 'world_01', doorId: 'world_house_01' },
        to: { mapId: 'house_01', doorId: 'house_01_entry' },
    });
});
```

- [ ] **Step 3: Generate minimal house maps**

Update `tools/content/house-regenerate.ts` so it can write deterministic minimal house maps for every current `house_*` target.

Each generated map must include:

```json
{
  "type": "map",
  "version": "1.10",
  "tiledversion": "1.11.2",
  "orientation": "orthogonal",
  "renderorder": "right-down",
  "width": 12,
  "height": 10,
  "tilewidth": 16,
  "tileheight": 16,
  "layers": [
    {
      "type": "tilelayer",
      "name": "floor",
      "width": 12,
      "height": 10,
      "data": []
    },
    {
      "type": "objectgroup",
      "name": "doors",
      "objects": []
    }
  ],
  "tilesets": [
    { "firstgid": 1, "source": "../tilesheet.wang.tsj" }
  ]
}
```

Fill `floor.data` with a valid walkable floor gid used in the current tileset. Add one `Door` object at a walkable tile with properties `door_id`, `target_map`, `target_door`, and `orientation`.

- [ ] **Step 4: Add maps to pack config**

Change `assets/maps/tiled/map-pack.config.json` to:

```json
{
  "maps": [
    { "id": "world_01", "filepath": "./world.json" },
    { "id": "house_01", "filepath": "./maps/house_01.json" }
  ],
  "edges": [],
  "allow_missing_target_maps": true
}
```

Then add entries for every generated house map, keeping ids sorted ascending.

- [ ] **Step 5: Verify house graph**

Run:

```bash
rtk bun run build:maps
rtk bun run check:maps
rtk bun test tests/unit/map-pack.test.ts tests/unit/server-world-map-pack-bootstrap.test.ts --timeout 20000
```

Expected:

```text
0 fail
Map pack is up to date
```

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add assets/maps/tiled/maps assets/maps/tiled/map-pack.config.json assets/maps/runtime/map-pack.json tools/content/house-regenerate.ts tests/unit/map-pack.test.ts
rtk git commit -m "feat: add stub interior map pack entries"
```

### Ticket 1.5: Disable Missing Target Maps

**Scope:** Set `allow_missing_target_maps` to `false` and make missing target map validation part of the normal gate.

**Out of scope:** Do not add more stub maps in this ticket; Ticket 1.4 must already cover current targets.

**Files:**
- Modify: `assets/maps/tiled/map-pack.config.json`
- Modify: tests if they relied on missing targets.

**Acceptance criteria:**
- `allow_missing_target_maps` is `false`.
- `rtk bun run check:maps` fails if any linked door points to a missing map.
- `rtk bun run verify:modern` passes through map checks.

**Verification plan:**
- `rtk bun run build:maps`
- `rtk bun run check:maps`
- `rtk bun test tests/unit/map-pack.test.ts --timeout 20000`

**Dependencies/blockers:** Ticket 1.4.

- [ ] **Step 1: Change config**

Set:

```json
"allow_missing_target_maps": false
```

in `assets/maps/tiled/map-pack.config.json`.

- [ ] **Step 2: Verify strict graph**

Run:

```bash
rtk bun run build:maps
rtk bun run check:maps
rtk bun test tests/unit/map-pack.test.ts --timeout 20000
```

Expected:

```text
0 fail
Map pack is up to date
```

- [ ] **Step 3: Commit**

Run:

```bash
rtk git add assets/maps/tiled/map-pack.config.json assets/maps/runtime/map-pack.json tests/unit/map-pack.test.ts
rtk git commit -m "chore: enforce strict map target validation"
```

---

## Phase 2 - Door, Portal, Collision, and Map Authoring Contracts

### Ticket 2.1: Replace Class-Based Portal Detection With Explicit Semantics

**Scope:** Add explicit portal/door semantics to map processing and templates.

**Out of scope:** Do not redesign all object templates.

**Files:**
- Modify: `assets/maps/tiled/templates/door.tx`
- Modify: `assets/maps/tiled/templates/door_linked.tx`
- Modify: `assets/maps/tiled/templates/portal.tx`
- Modify: `shared/maps/processmap.ts`
- Modify: `tools/content/world-map-validator.ts`
- Test: `tests/unit/map-pack.test.ts`

**Acceptance criteria:**
- Portal detection no longer depends only on `door.class === "Portal"`.
- Door objects can use property `door_kind: "door" | "portal"` or boolean `is_portal`.
- Validator rejects a portal template/object without explicit portal semantic property.
- Existing non-portal doors remain `p: 0`.

**Verification plan:**
- `rtk bun test tests/unit/map-pack.test.ts --timeout 20000`
- `rtk bun run check:world-map:target`
- `rtk bun run build:maps && rtk bun run check:maps`

**Dependencies/blockers:** Phase 1.

- [ ] **Step 1: Add tests for explicit portal semantics**

In `tests/unit/map-pack.test.ts`, add a map-processing test that verifies:

```ts
expect(processed.doors[0]?.p).toBe(1);
```

when a door object has:

```ts
properties: [{ name: 'door_kind', type: 'string', value: 'portal' }]
```

and class `Door`.

- [ ] **Step 2: Implement semantic helper**

In `shared/maps/processmap.ts`, add:

```ts
function isPortalDoorObject(door: TiledObject): boolean {
    const kind = getPropertyValue(door, 'door_kind');
    if (typeof kind === 'string' && kind.trim().toLowerCase() === 'portal') {
        return true;
    }
    const isPortal = getPropertyValue(door, 'is_portal');
    if (isPortal === true || isPortal === 'true' || isPortal === 1) {
        return true;
    }
    return door.class === 'Portal';
}
```

Use the actual local object type name if `TiledObject` is named differently.

Replace:

```ts
p: door.class === "Portal" ? 1 : 0,
```

with:

```ts
p: isPortalDoorObject(door) ? 1 : 0,
```

- [ ] **Step 3: Update templates**

Add to `portal.tx`:

```xml
<property name="door_kind" type="string" value="portal"/>
```

Add to `door.tx` and `door_linked.tx`:

```xml
<property name="door_kind" type="string" value="door"/>
```

- [ ] **Step 4: Add validator rule**

In `tools/content/world-map-validator.ts`, when an object uses `templates/portal.tx` or class `Portal`, require `door_kind=portal` or `is_portal=true`.

Diagnostic name:

```text
PORTAL_SEMANTIC_MISSING
```

- [ ] **Step 5: Verify**

Run:

```bash
rtk bun test tests/unit/map-pack.test.ts --timeout 20000
rtk bun run check:world-map:target
rtk bun run build:maps
rtk bun run check:maps
```

Expected:

```text
0 fail
0 errors, 0 warnings
Map pack is up to date
```

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add shared/maps/processmap.ts tools/content/world-map-validator.ts assets/maps/tiled/templates tests/unit/map-pack.test.ts assets/maps/runtime/map-pack.json
rtk git commit -m "feat: add explicit portal semantics"
```

### Ticket 2.2: Add Strict Door Graph Validator

**Scope:** Enforce complete graph-linked door metadata and reject unsafe legacy door shapes.

**Out of scope:** Do not remove plain coordinate doors that are intentionally same-map and not graph-linked.

**Files:**
- Modify: `shared/maps/map-pack.ts`
- Modify: `tools/content/world-map-validator.ts`
- Modify: `assets/maps/tiled/templates/README.md`
- Test: `tests/unit/map-pack.test.ts`

**Acceptance criteria:**
- Graph-linked doors require `door_id`, `target_map`, `target_door`, and `orientation`.
- Destination doors require `door_id`.
- `target_map` and `target_door` must be both present or both absent.
- Graph-linked doors must not use raw `tx` or `ty`.
- Reverse link is required unless `one_way: true`.

**Verification plan:**
- `rtk bun test tests/unit/map-pack.test.ts --timeout 20000`
- `rtk bun run check:world-map:target`
- `rtk bun run check:maps`

**Dependencies/blockers:** Ticket 2.1.

- [ ] **Step 1: Add unit tests for each rejected shape**

Add tests to `tests/unit/map-pack.test.ts` with expected error substrings:

```text
graph-linked doors require explicit "door_id" property
graph-linked doors require explicit "orientation" property
graph-linked doors must not declare raw "tx" or "ty"
reverse link missing
```

Each test should compile a tiny two-map pack and assert `toThrow('the expected error substring')`.

- [ ] **Step 2: Implement validations**

In `shared/maps/map-pack.ts`, inside door extraction/graph validation:

```ts
if (hasTargetMap && hasTargetDoor && !orientation) {
    errors.push(`Invalid map "${mapId}" door "${resolvedDoorId.id}": graph-linked doors require explicit "orientation" property.`);
}
if (hasTargetMap && hasTargetDoor && (properties.tx !== undefined || properties.ty !== undefined)) {
    errors.push(`Invalid map "${mapId}" door "${resolvedDoorId.id}": graph-linked doors must not declare raw "tx" or "ty".`);
}
```

After all edges are collected, add reverse-link validation:

```ts
const edgeKeys = new Set(edges.map((edge) => `${mapGraphDoorRefKey(edge.from)}->${mapGraphDoorRefKey(edge.to)}`));
for (const edge of edges) {
    const reverseKey = `${mapGraphDoorRefKey(edge.to)}->${mapGraphDoorRefKey(edge.from)}`;
    if (!edgeKeys.has(reverseKey) && !isOneWayEdge(edge)) {
        errors.push(`Invalid map pack graph: reverse link missing for "${mapGraphDoorRefKey(edge.from)}" -> "${mapGraphDoorRefKey(edge.to)}".`);
    }
}
```

Implement `isOneWayEdge` using a door property lookup, not a global edge assumption.

- [ ] **Step 3: Update docs**

In `assets/maps/tiled/templates/README.md`, add:

```markdown
Graph-linked doors must define `door_id`, `target_map`, `target_door`, and `orientation`. They must not define raw `tx` or `ty`; runtime destination coordinates come from the target door. Reverse links are required unless the source door has `one_way=true`.
```

- [ ] **Step 4: Verify**

Run:

```bash
rtk bun test tests/unit/map-pack.test.ts --timeout 20000
rtk bun run check:world-map:target
rtk bun run build:maps
rtk bun run check:maps
```

Expected:

```text
0 fail
Map pack is up to date
```

- [ ] **Step 5: Commit**

Run:

```bash
rtk git add shared/maps/map-pack.ts tools/content/world-map-validator.ts assets/maps/tiled/templates/README.md tests/unit/map-pack.test.ts assets/maps/runtime/map-pack.json
rtk git commit -m "feat: enforce strict door graph contract"
```

### Ticket 2.3: Add Layer Taxonomy Validation

**Scope:** Define and enforce a stable map layer taxonomy while initially allowing current known legacy names through explicit mappings.

**Out of scope:** Do not rename every layer in this ticket.

**Files:**
- Create: `shared/maps/layer-contract.ts`
- Modify: `tools/content/world-map-validator.ts`
- Test: `tests/unit/world-map-validator.test.ts` or nearest existing validator test file.
- Modify: `docs/map-layer-contract.md`

**Acceptance criteria:**
- Validator reports unknown layer paths.
- Current world passes because all current layer paths are either canonical or explicitly allowed as legacy.
- The legacy allowlist names `dry_ground_2`, `cliffs_2`, `village_boundaries_level_2`, and `foreground_overlays` so they are visible debt, not accidental contract.

**Verification plan:**
- `rtk bun run check:world-map:target`
- `rtk bun test tests/unit/world-map-validator.test.ts --timeout 20000`

**Dependencies/blockers:** Ticket 2.2.

- [ ] **Step 1: Create the contract file**

Create `shared/maps/layer-contract.ts`:

```ts
export const CANONICAL_LAYER_PREFIXES = [
    'render_world/terrain',
    'render_world/water',
    'render_world/roads',
    'render_world/floors',
    'render_world/walls',
    'render_world/structures',
    'render_world/props',
    'render_world/foreground',
    'collision',
    'gameplay_markup',
] as const;

export const LEGACY_LAYER_PATH_ALLOWLIST = [
    'render_world/village_biome/village_boundaries_level_2',
    'render_world/deadlands_biome/dry_ground_2',
    'render_world/badlands_biome/cliffs_2',
    'render_world/foreground_overlays',
    'render_world/foreground_overlays/cliffs_foreground',
    'render_world/foreground_overlays/cave_walls_foreground',
    'render_world/foreground_overlays/indoor_doors_foreground',
    'render_world/foreground_overlays/bridge_shadows_foreground',
    'render_world/foreground_overlays/maze_walls_foreground',
] as const;

export function isKnownLayerPath(path: string): boolean {
    return CANONICAL_LAYER_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
        || (LEGACY_LAYER_PATH_ALLOWLIST as readonly string[]).includes(path);
}
```

- [ ] **Step 2: Wire validator**

In `tools/content/world-map-validator.ts`, import `isKnownLayerPath` and add a diagnostic:

```text
UNKNOWN_LAYER_PATH
```

for any recursive layer path that returns false.

- [ ] **Step 3: Add docs**

Create `docs/map-layer-contract.md` with the layer taxonomy and the current legacy allowlist.

- [ ] **Step 4: Verify**

Run:

```bash
rtk bun run check:world-map:target
rtk bun test tests/unit/world-map-validator.test.ts --timeout 20000
```

Expected:

```text
0 errors, 0 warnings
0 fail
```

- [ ] **Step 5: Commit**

Run:

```bash
rtk git add shared/maps/layer-contract.ts tools/content/world-map-validator.ts docs/map-layer-contract.md tests
rtk git commit -m "feat: add map layer contract"
```

### Ticket 2.4: Add Passability Debug and Parity Checks

**Scope:** Make passability visible and testable for client and server.

**Out of scope:** Do not redesign movement taxonomy fully; this ticket exposes current state and prevents drift.

**Files:**
- Modify: `client/map.ts`
- Modify: `client/game.ts`
- Modify: `client/css/main.css` or nearest active CSS file.
- Modify: `tests/unit/mmo/server-client-collision-parity.test.ts`
- Create: `tests/browser/map-debug-overlays.playwright.ts`

**Acceptance criteria:**
- Browser can toggle a passability overlay.
- Overlay colors are stable: walkable green, blocked red, water blue, damage orange, door/portal purple, interactable yellow.
- Existing client/server collision parity test continues to pass.
- Browser test verifies overlay renders non-empty pixels.

**Verification plan:**
- `rtk bun test tests/unit/mmo/server-client-collision-parity.test.ts --timeout 20000`
- `rtk npx playwright test --config=playwright.config.ts tests/browser/map-debug-overlays.playwright.ts`

**Dependencies/blockers:** Ticket 2.3.

- [ ] **Step 1: Add overlay state**

In the client map/game state, add:

```ts
type MapDebugOverlayMode = 'none' | 'passability';
```

Expose a setter:

```ts
setMapDebugOverlayMode(mode: MapDebugOverlayMode): void {
    this.mapDebugOverlayMode = mode;
}
```

- [ ] **Step 2: Render overlay**

In `client/map.ts`, add a rendering pass after base map render and before entity render:

```ts
if (debugOverlayMode === 'passability') {
    this.renderPassabilityOverlay(context, viewport);
}
```

The overlay must use fixed colors with alpha:

```ts
const PASSABILITY_COLORS = {
    walkable: 'rgba(0, 180, 80, 0.28)',
    blocked: 'rgba(220, 40, 40, 0.34)',
    water: 'rgba(40, 120, 230, 0.32)',
    damage: 'rgba(255, 140, 0, 0.34)',
    door: 'rgba(145, 70, 255, 0.38)',
    interactable: 'rgba(240, 210, 40, 0.38)',
} as const;
```

- [ ] **Step 3: Add browser test**

Create `tests/browser/map-debug-overlays.playwright.ts`:

```ts
import { expect, test } from '@playwright/test';

test('passability debug overlay renders visible classified tiles', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as any).game));
    await page.evaluate(() => {
        (window as any).game.setMapDebugOverlayMode('passability');
    });
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    const pixels = await canvas.evaluate((node: HTMLCanvasElement) => {
        const ctx = node.getContext('2d');
        if (!ctx) return 0;
        const data = ctx.getImageData(0, 0, node.width, node.height).data;
        let visible = 0;
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 0) visible += 1;
        }
        return visible;
    });
    expect(pixels).toBeGreaterThan(0);
});
```

Adapt the global handle if this project exposes game state under a different debug/test hook.

- [ ] **Step 4: Verify**

Run:

```bash
rtk bun test tests/unit/mmo/server-client-collision-parity.test.ts --timeout 20000
rtk npx playwright test --config=playwright.config.ts tests/browser/map-debug-overlays.playwright.ts
```

Expected:

```text
0 fail
```

- [ ] **Step 5: Commit**

Run:

```bash
rtk git add client tests/browser/map-debug-overlays.playwright.ts
rtk git commit -m "feat: add passability debug overlay"
```

---

## Phase 2A - Terrain, Tileset, and Visual Map Authoring Modernization

This phase is intentionally separate from Phase 2's runtime contracts. Phase 2 makes map data safe for the server and client. Phase 2A makes the world visually and authorially correct: real terrain families, proper overlays, complete transitions, correct layer placement, explicit map properties, collision/passability confidence, and reviewed richness.

### Ticket 2A.1: Create Unified Terrain Authoring Audit

**Scope:** Consolidate the current terrain, Wang, layer, tile-object, door/portal, passability, spawn, region, and music-zone audits into one read-only report.

**Out of scope:** Do not modify `world.json`, tilesets, images, or generated map-pack artifacts in this ticket.

**Files:**
- Create: `tools/content/terrain-authoring-contract.ts`
- Create: `tools/content/terrain-authoring-audit.ts`
- Modify: `package.json`
- Create: `tests/unit/terrain-authoring-audit.test.ts`
- Create: `docs/map-authoring-audit.md`
- Reference: `tools/content/world-tile-paint-audit.ts`
- Reference: `tools/content/world-render-cluster-audit.ts`
- Reference: `tools/content/world-typed-object-audit.ts`
- Reference: `tools/content/tileset-wang-audit.ts`
- Reference: `tools/content/world-map-validator.ts`

**Acceptance criteria:**
- Audit is read-only by default and has no `--write` option.
- Audit writes `artifacts/map-authoring/terrain-authoring-audit.json`.
- Audit writes `artifacts/map-authoring/terrain-authoring-audit.md`.
- Report includes counts and samples for:
  - missing or empty map properties
  - incomplete or scaffold-only Wang sets
  - pure versus mixed Wang entries by set
  - base terrain fills
  - transparent overlays
  - terrain-transition layers
  - tiny suspicious paint components
  - duplicate fully covered paints
  - wrong-layer tile candidates
  - foreground/base/overlay misbucket candidates
  - blank tile objects
  - door, gate, and portal semantic mismatches
  - collider and passability metadata gaps
  - resource nodes, static entities, chest spawns, chest areas, roaming areas, music zones, and checkpoints
- Findings have confidence levels: `error`, `high`, `medium`, `low`, and `info`.
- Every finding includes enough location data to inspect it later: layer path and tile coordinate for tile findings, object layer and object id for object findings, or tileset/tile id for tileset findings.

**Verification plan:**
- `rtk bun test tests/unit/terrain-authoring-audit.test.ts --timeout 20000`
- `rtk bun run check:terrain-authoring`
- `rtk bun run typecheck:tools`

**Dependencies/blockers:** Phase 0 for type/lint stability. Can be developed before Phase 1 because it is read-only.

- [ ] **Step 1: Define finding contract**

Create `tools/content/terrain-authoring-contract.ts`:

```ts
export type TerrainAuthoringSeverity = 'error' | 'high' | 'medium' | 'low' | 'info';

export type TerrainAuthoringCategory =
    | 'map_properties'
    | 'wang_tileset'
    | 'terrain_paint'
    | 'overlay_layering'
    | 'wrong_layer'
    | 'tile_object'
    | 'door_portal_gate'
    | 'collision_passability'
    | 'spawn_region'
    | 'music_region'
    | 'asset_reference';

export type TerrainAuthoringLocation = Readonly<{
    map?: string;
    layerPath?: string;
    x?: number;
    y?: number;
    objectLayerPath?: string;
    objectId?: number;
    tileset?: string;
    tileId?: number;
    gid?: number;
}>;

export type TerrainAuthoringFinding = Readonly<{
    id: string;
    severity: TerrainAuthoringSeverity;
    category: TerrainAuthoringCategory;
    title: string;
    detail: string;
    location: TerrainAuthoringLocation;
    evidence: ReadonlyArray<string>;
}>;

export type TerrainAuthoringAudit = Readonly<{
    generatedAt: string;
    world: string;
    tileset: string;
    findings: ReadonlyArray<TerrainAuthoringFinding>;
    summary: Readonly<Record<TerrainAuthoringCategory, number>>;
}>;
```

- [ ] **Step 2: Add audit CLI skeleton**

Create `tools/content/terrain-authoring-audit.ts` with:

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TerrainAuthoringAudit, TerrainAuthoringFinding } from './terrain-authoring-contract';

const defaultWorld = 'assets/maps/tiled/world.json';
const defaultTileset = 'assets/maps/tiled/tilesheet.wang.tsj';
const defaultOutDir = 'artifacts/map-authoring';

function summarize(findings: readonly TerrainAuthoringFinding[]): TerrainAuthoringAudit['summary'] {
    const summary: Partial<Record<TerrainAuthoringFinding['category'], number>> = {};
    for (const finding of findings) {
        summary[finding.category] = (summary[finding.category] ?? 0) + 1;
    }
    return summary as TerrainAuthoringAudit['summary'];
}

function renderMarkdown(audit: TerrainAuthoringAudit): string {
    const lines = [
        '# Terrain Authoring Audit',
        '',
        `Generated: ${audit.generatedAt}`,
        `World: ${audit.world}`,
        `Tileset: ${audit.tileset}`,
        '',
        '## Summary',
        '',
        ...Object.entries(audit.summary).map(([category, count]) => `- ${category}: ${count}`),
        '',
        '## Findings',
        '',
    ];
    for (const finding of audit.findings) {
        lines.push(`### ${finding.id}: ${finding.title}`);
        lines.push('');
        lines.push(`- Severity: ${finding.severity}`);
        lines.push(`- Category: ${finding.category}`);
        lines.push(`- Detail: ${finding.detail}`);
        lines.push(`- Location: \`${JSON.stringify(finding.location)}\``);
        lines.push(`- Evidence: ${finding.evidence.join('; ')}`);
        lines.push('');
    }
    return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
    const outDir = path.resolve(process.cwd(), defaultOutDir);
    const findings: TerrainAuthoringFinding[] = [];

    // Later steps populate this from existing audit modules and direct JSON inspection.
    const audit: TerrainAuthoringAudit = {
        generatedAt: new Date().toISOString(),
        world: defaultWorld,
        tileset: defaultTileset,
        findings,
        summary: summarize(findings),
    };

    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, 'terrain-authoring-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
    await writeFile(path.join(outDir, 'terrain-authoring-audit.md'), renderMarkdown(audit));
    console.log(`Wrote ${path.relative(process.cwd(), outDir)}/terrain-authoring-audit.json`);
}

await main();
```

- [ ] **Step 3: Populate map and tileset findings**

In `terrain-authoring-audit.ts`, add direct JSON inspection that emits findings for:

```text
MAP_PROPERTIES_EMPTY
WANG_SET_MOSTLY_PURE
WANG_PAIR_HAS_NO_MIXED_TRANSITIONS
WANG_PAIR_HAS_TOO_FEW_MIXED_TRANSITIONS
TILESET_IMAGE_REFERENCE
```

Use the current thresholds:

```ts
const minimumMixedTransitionsForPair = 16;
const mostlyPureRatio = 0.9;
```

For a pair Wang set, classify `mixedTransitionCount === 0` as `high`, and `mixedTransitionCount > 0 && mixedTransitionCount < 16` as `medium`.

- [ ] **Step 4: Integrate existing audit outputs**

Import or refactor shared helpers from these existing tools instead of shelling out:

```text
tools/content/world-tile-paint-audit.ts
tools/content/world-render-cluster-audit.ts
tools/content/world-typed-object-audit.ts
tools/content/tileset-wang-audit.ts
```

If any current tool is too CLI-shaped to import cleanly, move its pure logic into a sibling exported function in the same file and keep the CLI behavior unchanged.

- [ ] **Step 5: Add npm scripts**

In `package.json`, add:

```json
"check:terrain-authoring": "bun tools/content/terrain-authoring-audit.ts"
```

- [ ] **Step 6: Add tests**

Create `tests/unit/terrain-authoring-audit.test.ts` with fixtures that verify:

```ts
import { expect, test } from 'bun:test';

test('terrain authoring audit classifies a pair set with no mixed transitions as high confidence debt', () => {
    // Construct a tiny tileset object with one pair Wang set whose wangids are all pure.
    // Assert that the finding id is WANG_PAIR_HAS_NO_MIXED_TRANSITIONS and severity is high.
});

test('terrain authoring audit requires map-level authoring properties', () => {
    // Construct a tiny Tiled map with no properties.
    // Assert that MAP_PROPERTIES_EMPTY is reported.
});
```

Use real helper names exported from the audit module; do not duplicate classification logic in the test.

- [ ] **Step 7: Document interpretation**

Create `docs/map-authoring-audit.md` explaining:

```markdown
# Map Authoring Audit

The terrain authoring audit is a content-quality gate. It is separate from `check:world-map:target`, which validates structural safety. A map can be structurally valid and still have bad terrain painting, incomplete transitions, wrong-layer tiles, weak overlays, or missing authoring metadata.

Severity meanings:

- `error`: must block release or map-pack generation.
- `high`: must be fixed before the map is considered authored correctly.
- `medium`: fix in the same authoring pass unless a review entry explains why it is intentional.
- `low`: review opportunistically.
- `info`: evidence only.
```

- [ ] **Step 8: Verify**

Run:

```bash
rtk bun test tests/unit/terrain-authoring-audit.test.ts --timeout 20000
rtk bun run check:terrain-authoring
rtk bun run typecheck:tools
```

Expected:

```text
0 fail
Wrote artifacts/map-authoring/terrain-authoring-audit.json
```

- [ ] **Step 9: Commit**

Run:

```bash
rtk git add tools/content/terrain-authoring-contract.ts tools/content/terrain-authoring-audit.ts tests/unit/terrain-authoring-audit.test.ts docs/map-authoring-audit.md package.json artifacts/map-authoring/terrain-authoring-audit.json artifacts/map-authoring/terrain-authoring-audit.md
rtk git commit -m "feat: add terrain authoring audit"
```

### Ticket 2A.2: Generate Tile Atlas and Suspicious Region Visuals

**Scope:** Generate visual evidence for tile IDs, Wang families, suspicious terrain findings, and Stardew-style reference organization.

**Out of scope:** Do not import or copy Stardew assets into runtime BrowserQuest assets. Do not edit `client/public/img/1/tilesheet.webp` in this ticket.

**Files:**
- Create: `tools/content/terrain-visual-artifacts.ts`
- Modify: `package.json`
- Create: `tests/unit/terrain-visual-artifacts.test.ts`
- Create or update generated evidence under: `artifacts/map-authoring/visual/`
- Reference: `client/public/img/1/tilesheet.webp`
- Reference: `/Users/krisztiaan/dev/stardew-assets/Maps/spring_outdoorsTileSheet.png`
- Reference: `/Users/krisztiaan/dev/stardew-assets/Maps/paths.png`

**Acceptance criteria:**
- Tool requires ImageMagick `magick` and prints a clear error if unavailable.
- Tool emits:
  - `artifacts/map-authoring/visual/browserquest-tilesheet-atlas.png`
  - `artifacts/map-authoring/visual/browserquest-tilesheet-atlas-labels.json`
  - `artifacts/map-authoring/visual/suspicious-gids/`
  - `artifacts/map-authoring/visual/suspicious-regions/`
  - `artifacts/map-authoring/visual/reference/stardew-spring-outdoors-contact.png`
  - `artifacts/map-authoring/visual/reference/stardew-paths-contact.png`
- Atlas labels map every local tile id and global gid to source pixel coordinates.
- Suspicious-region filenames include layer path slug and tile coordinate.
- The tool reads `terrain-authoring-audit.json` when present and uses its findings as the crop source.

**Verification plan:**
- `rtk bun test tests/unit/terrain-visual-artifacts.test.ts --timeout 20000`
- `rtk bun run build:terrain-visuals`
- `rtk file artifacts/map-authoring/visual/browserquest-tilesheet-atlas.png`
- `rtk identify -format '%f %wx%h\n' artifacts/map-authoring/visual/browserquest-tilesheet-atlas.png`

**Dependencies/blockers:** Ticket 2A.1.

- [ ] **Step 1: Add pure tile math helpers**

Create `tools/content/terrain-visual-artifacts.ts` with exported helpers:

```ts
export type TileSheetGeometry = Readonly<{
    columns: number;
    tileWidth: number;
    tileHeight: number;
    firstGid: number;
}>;

export function tileIdToSourceRect(tileId: number, geometry: TileSheetGeometry): { x: number; y: number; width: number; height: number } {
    const column = tileId % geometry.columns;
    const row = Math.floor(tileId / geometry.columns);
    return {
        x: column * geometry.tileWidth,
        y: row * geometry.tileHeight,
        width: geometry.tileWidth,
        height: geometry.tileHeight,
    };
}

export function gidToTileId(gid: number, firstGid: number): number {
    return gid - firstGid;
}
```

- [ ] **Step 2: Add tests for tile math**

Create `tests/unit/terrain-visual-artifacts.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { gidToTileId, tileIdToSourceRect } from '../../tools/content/terrain-visual-artifacts';

test('tile id maps to source rectangle in a 20-column 16px sheet', () => {
    expect(tileIdToSourceRect(21, { columns: 20, tileWidth: 16, tileHeight: 16, firstGid: 1 })).toEqual({
        x: 16,
        y: 16,
        width: 16,
        height: 16,
    });
});

test('gid maps to local tile id', () => {
    expect(gidToTileId(22, 1)).toBe(21);
});
```

- [ ] **Step 3: Implement ImageMagick command runner**

In `terrain-visual-artifacts.ts`, add:

```ts
async function runMagick(args: readonly string[]): Promise<void> {
    const proc = Bun.spawn(['magick', ...args], { stdout: 'pipe', stderr: 'pipe' });
    const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
    ]);
    if (exitCode !== 0) {
        throw new Error(`magick ${args.join(' ')} failed with ${exitCode}\n${stdout}\n${stderr}`);
    }
}
```

Before the first image operation, run:

```ts
await runMagick(['-version']);
```

- [ ] **Step 4: Generate BrowserQuest atlas**

Read `assets/maps/tiled/tilesheet.wang.tsj`, resolve its `image` path, and write:

```text
artifacts/map-authoring/visual/browserquest-tilesheet-atlas.png
artifacts/map-authoring/visual/browserquest-tilesheet-atlas-labels.json
```

The labels JSON must use this shape:

```ts
type AtlasLabel = Readonly<{
    tileId: number;
    gid: number;
    sourceX: number;
    sourceY: number;
    sourceWidth: number;
    sourceHeight: number;
}>;
```

- [ ] **Step 5: Generate suspicious GID and region crops**

Read `artifacts/map-authoring/terrain-authoring-audit.json`. For findings with `gid` or `tileId`, export a 16 x 16 tile crop scaled to 128 x 128 under:

```text
artifacts/map-authoring/visual/suspicious-gids/gid-<gid>-tile-<tileId>.png
```

For findings with map `x`, `y`, and `layerPath`, export a region crop name:

```text
artifacts/map-authoring/visual/suspicious-regions/<layer-slug>-x<X>-y<Y>.png
```

If full rendered map-region cropping is not available yet, write a contact sheet containing the involved tile crop and a JSON sidecar with the layer coordinate. Do not claim it is a rendered map crop until actual map rendering exists.

- [ ] **Step 6: Generate reference contact sheets**

If these files exist:

```text
/Users/krisztiaan/dev/stardew-assets/Maps/spring_outdoorsTileSheet.png
/Users/krisztiaan/dev/stardew-assets/Maps/paths.png
```

write scaled contact sheets to:

```text
artifacts/map-authoring/visual/reference/stardew-spring-outdoors-contact.png
artifacts/map-authoring/visual/reference/stardew-paths-contact.png
```

Record in `terrain-authoring-audit.md` that these are visual organization references only, not source assets for copying.

- [ ] **Step 7: Add script**

In `package.json`, add:

```json
"build:terrain-visuals": "bun tools/content/terrain-visual-artifacts.ts"
```

- [ ] **Step 8: Verify**

Run:

```bash
rtk bun test tests/unit/terrain-visual-artifacts.test.ts --timeout 20000
rtk bun run check:terrain-authoring
rtk bun run build:terrain-visuals
rtk file artifacts/map-authoring/visual/browserquest-tilesheet-atlas.png
rtk identify -format '%f %wx%h\n' artifacts/map-authoring/visual/browserquest-tilesheet-atlas.png
```

Expected:

```text
0 fail
PNG image data
```

- [ ] **Step 9: Commit**

Run:

```bash
rtk git add tools/content/terrain-visual-artifacts.ts tests/unit/terrain-visual-artifacts.test.ts package.json artifacts/map-authoring/visual
rtk git commit -m "feat: generate terrain authoring visual artifacts"
```

### Ticket 2A.3: Define the Real Terrain and Overlay Grammar

**Scope:** Create a source-of-truth authoring grammar for terrain families, transitions, overlays, structural layers, passability, and map-level properties.

**Out of scope:** Do not repaint the world or generate final replacement art in this ticket.

**Files:**
- Create: `assets/maps/tiled/terrain-authoring.json`
- Create: `tools/content/terrain-grammar-validator.ts`
- Modify: `package.json`
- Create: `tests/unit/terrain-grammar-validator.test.ts`
- Create: `docs/terrain-authoring-model.md`

**Acceptance criteria:**
- Grammar defines every terrain family currently used by `world.json`.
- Grammar distinguishes:
  - base fill tiles
  - full-tile transition tiles
  - transparent overlay tiles
  - decorative variation tiles
  - foreground/occluding structural tiles
  - collision/passability tiles or objectgroups
  - gameplay markup regions
- Grammar defines required transition shapes for each terrain pair:
  - north, south, east, west edges
  - outer corners
  - inner corners
  - diagonal hints if the art style supports them
  - one-tile islands/caps
  - channels and narrow paths where relevant
- Grammar defines compositing rules:
  - exactly one base terrain owns a cell's full visual fill
  - transparent overlays may decorate but not replace base terrain
  - water/lava damage terrain must carry explicit passability/damage semantics
  - foreground/roof/cliff tops must not be used as base terrain
  - gameplay markup layers do not render
- Validator reports current missing variants without failing the baseline audit command.

**Verification plan:**
- `rtk bun test tests/unit/terrain-grammar-validator.test.ts --timeout 20000`
- `rtk bun run audit:terrain-grammar`
- `rtk bun run typecheck:tools`

**Dependencies/blockers:** Ticket 2A.1.

- [ ] **Step 1: Create grammar file**

Create `assets/maps/tiled/terrain-authoring.json`:

```json
{
  "version": 1,
  "tileSize": 16,
  "sourceTilesets": ["tilesheet.wang.tsj"],
  "mapPropertiesRequired": ["map_id", "authoring_version", "default_music", "default_biome"],
  "families": [
    {
      "id": "grass",
      "kind": "base",
      "allowedLayerRoles": ["base", "variation", "transition", "overlay"],
      "representativeTileIds": [51],
      "passability": "walkable"
    },
    {
      "id": "sand",
      "kind": "base",
      "allowedLayerRoles": ["base", "variation", "transition", "overlay"],
      "representativeTileIds": [140],
      "passability": "walkable"
    },
    {
      "id": "soil",
      "kind": "base",
      "allowedLayerRoles": ["base", "variation", "transition", "overlay"],
      "representativeTileIds": [10],
      "passability": "walkable"
    },
    {
      "id": "water",
      "kind": "liquid",
      "allowedLayerRoles": ["liquid", "transition"],
      "representativeTileIds": [405],
      "passability": "blocked"
    },
    {
      "id": "lava",
      "kind": "liquid",
      "allowedLayerRoles": ["liquid", "transition", "damage"],
      "representativeTileIds": [1180],
      "passability": "damage"
    }
  ],
  "transitionPairs": [
    { "id": "shoreline", "from": "water", "to": "sand", "requiredShapes": ["edge_n", "edge_s", "edge_e", "edge_w", "outer_ne", "outer_nw", "outer_se", "outer_sw", "inner_ne", "inner_nw", "inner_se", "inner_sw", "island", "channel_h", "channel_v"] },
    { "id": "riverbank", "from": "water", "to": "grass", "requiredShapes": ["edge_n", "edge_s", "edge_e", "edge_w", "outer_ne", "outer_nw", "outer_se", "outer_sw", "inner_ne", "inner_nw", "inner_se", "inner_sw", "island", "channel_h", "channel_v"] },
    { "id": "field_edges", "from": "soil", "to": "grass", "requiredShapes": ["edge_n", "edge_s", "edge_e", "edge_w", "outer_ne", "outer_nw", "outer_se", "outer_sw", "inner_ne", "inner_nw", "inner_se", "inner_sw", "island"] }
  ],
  "layerRoles": {
    "base": ["ground", "dry_ground", "canyon", "cave", "forest"],
    "variation": ["ground_variations", "grass_variations", "dry_ground_2"],
    "transition": ["shoreline", "river", "lakes", "village_boundaries", "forest_boundaries", "lava_boundaries"],
    "foreground": ["cliffs_foreground", "cave_walls_foreground", "indoor_doors_foreground", "maze_walls_foreground"],
    "gameplay": ["resource_nodes", "static_entities", "chest_spawns", "chest_areas", "doors", "roaming_areas", "music_zones", "checkpoints"]
  }
}
```

Extend this initial file with every family found by the audit before marking the ticket done.

- [ ] **Step 2: Create grammar validator**

Create `tools/content/terrain-grammar-validator.ts` that:

```ts
type TerrainGrammarReport = Readonly<{
    missingMapProperties: readonly string[];
    missingFamiliesUsedByMap: readonly string[];
    missingTransitionShapes: readonly { pair: string; shape: string }[];
    wrongLayerRoleSamples: readonly { layerPath: string; tileId: number; expectedRoles: readonly string[] }[];
}>;
```

The default command must write:

```text
artifacts/map-authoring/terrain-grammar-report.json
```

and exit 0 while the project is in baseline-audit mode.

- [ ] **Step 3: Add tests**

Create `tests/unit/terrain-grammar-validator.test.ts` verifying:

```ts
import { expect, test } from 'bun:test';

test('grammar validator reports missing transition shapes by pair', () => {
    // Tiny grammar has shoreline requiring edge_n.
    // Tiny tileset has no tile tagged as shoreline edge_n.
    // Assert missingTransitionShapes includes { pair: 'shoreline', shape: 'edge_n' }.
});

test('grammar validator reports required map properties', () => {
    // Tiny map has no properties.
    // Assert missingMapProperties includes map_id.
});
```

- [ ] **Step 4: Add scripts**

In `package.json`, add:

```json
"audit:terrain-grammar": "bun tools/content/terrain-grammar-validator.ts"
```

Do not include this in `verify:modern` until the strict variant is introduced after map and asset fixes.

- [ ] **Step 5: Document authoring model**

Create `docs/terrain-authoring-model.md` describing the target model:

```markdown
# Terrain Authoring Model

Base terrain owns the full cell. Overlay terrain is transparent decoration. Transition terrain connects two named base/liquid families and must declare its shape. Foreground terrain occludes entities and never fills base cells. Gameplay markup layers do not render and must stay invisible in Tiled.

Stardew-style reference assets under `/Users/krisztiaan/dev/stardew-assets/Maps` are used only to study organization: seasonal outdoor sheets, focused path/overlay sheets, shadows, water, cliffs, and building chunks. BrowserQuest must use its own assets or newly authored/generated assets.
```

- [ ] **Step 6: Verify**

Run:

```bash
rtk bun test tests/unit/terrain-grammar-validator.test.ts --timeout 20000
rtk bun run audit:terrain-grammar
rtk bun run typecheck:tools
```

Expected:

```text
0 fail
```

- [ ] **Step 7: Commit**

Run:

```bash
rtk git add assets/maps/tiled/terrain-authoring.json tools/content/terrain-grammar-validator.ts tests/unit/terrain-grammar-validator.test.ts docs/terrain-authoring-model.md package.json artifacts/map-authoring/terrain-grammar-report.json
rtk git commit -m "feat: define terrain authoring grammar"
```

### Ticket 2A.4: Decide and Prototype the Richer Terrain Asset Set

**Scope:** Determine whether the final terrain system should be curated manually, generated from templates, or a hybrid; create a prototype non-runtime asset sheet only if it helps validate the decision.

**Out of scope:** Do not replace `client/public/img/1/tilesheet.webp` or change map tile IDs in this ticket.

**Files:**
- Create: `docs/terrain-asset-generation-plan.md`
- Create if prototyping: `tools/content/terrain-transition-prototype.ts`
- Create if prototyping: `assets/maps/tiled/prototypes/terrain-transitions.prototype.png`
- Create if prototyping: `assets/maps/tiled/prototypes/terrain-transitions.prototype.tsj`
- Test if prototyping: `tests/unit/terrain-transition-prototype.test.ts`

**Acceptance criteria:**
- Decision document compares:
  - fixing metadata only on current sheet
  - manually curating new transition chunks
  - generating transparent overlay transitions from masks
  - hybrid generation plus manual polish
- Decision document names which terrain pairs need new art before the map can be considered complete.
- If a prototype is created, it is clearly under `assets/maps/tiled/prototypes/` and is not referenced by `world.json` or `map-pack.config.json`.
- Prototype generation is deterministic and records every source tile id and mask used.

**Verification plan:**
- `rtk rg -n "terrain-transitions.prototype" assets/maps/tiled/world.json assets/maps/tiled/map-pack.config.json` returns no runtime references.
- If prototyping: `rtk bun test tests/unit/terrain-transition-prototype.test.ts --timeout 20000`.

**Dependencies/blockers:** Tickets 2A.2 and 2A.3.

- [ ] **Step 1: Write decision document**

Create `docs/terrain-asset-generation-plan.md` with sections:

```markdown
# Terrain Asset Generation Plan

## Current State

- Current BrowserQuest sheet is a hand-packed prop/terrain sheet.
- Current Wang metadata is scaffold-level and incomplete.
- Current world has suspicious tiny terrain components and duplicate paints.

## Reference Pattern

Stardew assets are used as organizational reference only: seasonal outdoor sheets, focused overlay/path sheets, shadows, water, cliffs, and building chunks.

## Options

### Option A: Metadata-only repair

- Strengths: lowest image churn; preserves current tile IDs; easiest to review with `git diff` because only `.tsj` metadata changes.
- Weaknesses: cannot create missing visual shapes; current scaffold sets have zero mixed transitions for most terrain pairs; would leave rough edges and patchy transitions unresolved.

### Option B: Manual curated sheet

- Strengths: best final art quality; lets an artist intentionally match BrowserQuest style; can add missing edge, corner, inner-corner, island, channel, and overlay variants.
- Weaknesses: slowest path; requires careful tile ID allocation; every new tile needs metadata, passability, objectgroup, and map migration review.

### Option C: Generated transition overlays

- Strengths: fastest way to fill systematic edge/corner gaps; deterministic; can generate transparent overlays from masks and source base tiles.
- Weaknesses: generated tiles may look mechanical; needs visual QA; still requires manual polish for cliffs, water, lava, cave walls, and high-style areas.

### Option D: Hybrid generated base plus manual polish

- Strengths: uses generation to cover the full grammar and manual work where art quality matters most; keeps transitions complete while preserving room for richer authored regions.
- Weaknesses: requires both tooling and visual review; needs strict naming/metadata so generated and curated tiles do not drift.

## Recommendation

Use Option D unless the visual atlas proves the current sheet already contains enough curated transition art. The audit evidence currently points away from metadata-only repair because the scaffold sets mostly lack mixed-transition entries.
```

- [ ] **Step 2: Identify missing art by pair**

Use `artifacts/map-authoring/terrain-grammar-report.json` and visual atlas output to refine this initial audit-backed table:

```markdown
| Pair | Required missing shapes | Current candidate tile ids | New art needed | Notes |
| --- | --- | --- | --- | --- |
| shoreline | edge/corner/inner/island/channel family | representatives 405 water, 140 sand; current shoreline top-used 1819, 1780, 1799, 1800, 1920 | yes | scaffold has 0 mixed transitions |
| riverbank | edge/corner/inner/island/channel family | representatives 405 water, 51 grass, 629 lake | yes | scaffold has 0 mixed transitions and map usage includes lake/forest foreign-color cases |
| village_ground | edge/corner/inner/island family | representatives 140 sand, 51 grass; current top-used 1011, 1010, 1032, 933, 953 | yes | scaffold has 0 mixed transitions and map usage includes many rock-tagged candidates |
| field_edges | edge/corner/inner/island family | representatives 10 soil, 51 grass | yes | scaffold has 0 mixed transitions |
| forest_edges | edge/corner/inner/island family | representatives 51 grass, 112 forest | yes | scaffold has only 6 mixed transitions |
| cave_rock | edge/corner/inner/cliff mouth family | representatives 17 rock, 3 cave | yes | scaffold has 0 mixed transitions |
| lava_rock | edge/corner/inner/damage-boundary family | representatives 1180 lava, 17 rock | yes | scaffold has 0 mixed transitions |
| lava_cave | edge/corner/inner/damage-boundary family | representatives 1180 lava, 3 cave | yes | scaffold has 0 mixed transitions |
```

- [ ] **Step 3: Prototype only if needed**

If the decision requires generated transitions, create `tools/content/terrain-transition-prototype.ts` that reads:

```text
assets/maps/tiled/terrain-authoring.json
client/public/img/1/tilesheet.webp
```

and writes prototype PNG/TSJ files under:

```text
assets/maps/tiled/prototypes/
```

The prototype must be deterministic and must not be referenced by runtime map files.

- [ ] **Step 4: Verify runtime isolation**

Run:

```bash
rtk rg -n "terrain-transitions\\.prototype" assets/maps/tiled/world.json assets/maps/tiled/map-pack.config.json assets/maps/runtime/map-pack.json
```

Expected:

```text
no matches
```

- [ ] **Step 5: Commit**

Run:

```bash
rtk git add docs/terrain-asset-generation-plan.md tools/content/terrain-transition-prototype.ts tests/unit/terrain-transition-prototype.test.ts assets/maps/tiled/prototypes
rtk git commit -m "docs: plan richer terrain asset generation"
```

If no prototype was created, omit prototype paths from `git add`.

### Ticket 2A.5: Add Dry-Run Safe Map Authoring Repair

**Scope:** Add a deterministic repair tool for high-confidence map authoring defects only.

**Out of scope:** Do not make subjective terrain/art changes. Do not generate new art. Do not move gameplay regions unless the audit proves a structural inconsistency.

**Files:**
- Create: `tools/content/world-authoring-repair.ts`
- Modify: `package.json`
- Test: `tests/unit/world-authoring-repair.test.ts`
- Modify when `--write` is intentionally run: `assets/maps/tiled/world.json`

**Acceptance criteria:**
- Default mode is dry-run and writes a planned changes report.
- `--write` is required to modify `world.json`.
- Repair rules are limited to:
  - remove exact duplicate fully covered paint when an equal or higher-priority layer makes the lower paint unreachable
  - remove tiny fully covered components classified as high confidence accidental paint
  - normalize explicit portal/door/gate semantics after Phase 2 contracts exist
  - normalize `target_map: world` only after the map-id validator exists
  - add required map properties with conservative values after the terrain grammar is approved
- Every write preserves JSON validity and Tiled-compatible structure.
- Repair tool refuses to run `--write` if `rtk git status --short assets/maps/tiled/world.json` shows unrelated unstaged modifications not produced by the current dry-run plan.

**Verification plan:**
- `rtk bun test tests/unit/world-authoring-repair.test.ts --timeout 20000`
- `rtk bun run repair:world-authoring:dry`
- If approved for write: `rtk bun run repair:world-authoring`
- `rtk bun run check:world-map:target`
- `rtk bun run check:terrain-authoring`
- `rtk bun run build:maps && rtk bun run check:maps`

**Dependencies/blockers:** Tickets 2.1, 2.2, 2A.1, 2A.2, and 2A.3.

- [ ] **Step 1: Create repair plan types**

Create `tools/content/world-authoring-repair.ts` with:

```ts
type RepairKind =
    | 'remove_duplicate_covered_paint'
    | 'remove_accidental_tiny_component'
    | 'normalize_door_portal_semantics'
    | 'normalize_target_map'
    | 'add_map_property';

type RepairChange = Readonly<{
    kind: RepairKind;
    confidence: 'high';
    layerPath?: string;
    x?: number;
    y?: number;
    objectLayerPath?: string;
    objectId?: number;
    before: unknown;
    after: unknown;
    reason: string;
}>;
```

- [ ] **Step 2: Implement dry-run report**

Default command writes:

```text
artifacts/map-authoring/world-authoring-repair-plan.json
artifacts/map-authoring/world-authoring-repair-plan.md
```

and does not modify map files.

- [ ] **Step 3: Implement write guard**

Require `--write` for modifications. Before writing, check current git status for the target file:

```ts
const proc = Bun.spawn(['git', 'status', '--short', '--', 'assets/maps/tiled/world.json'], { stdout: 'pipe' });
```

If status is non-empty and does not match a prior generated repair state, print the exact status and exit non-zero. This prevents overwriting user map edits.

- [ ] **Step 4: Add tests**

Create `tests/unit/world-authoring-repair.test.ts` with fixture maps for:

```ts
test('dry run does not mutate the map object', () => {});
test('duplicate covered paint repair clears only the lower layer cell', () => {});
test('tiny component repair does not remove visible gameplay or collision layers', () => {});
test('write mode requires explicit --write', () => {});
```

- [ ] **Step 5: Add scripts**

In `package.json`, add:

```json
"repair:world-authoring:dry": "bun tools/content/world-authoring-repair.ts",
"repair:world-authoring": "bun tools/content/world-authoring-repair.ts --write"
```

- [ ] **Step 6: Verify dry-run**

Run:

```bash
rtk bun test tests/unit/world-authoring-repair.test.ts --timeout 20000
rtk bun run repair:world-authoring:dry
rtk git diff -- assets/maps/tiled/world.json
```

Expected:

```text
0 fail
```

and no diff to `world.json`.

- [ ] **Step 7: Write only after review**

After reviewing `artifacts/map-authoring/world-authoring-repair-plan.md`, run:

```bash
rtk bun run repair:world-authoring
rtk bun run check:world-map:target
rtk bun run check:terrain-authoring
rtk bun run build:maps
rtk bun run check:maps
```

Expected:

```text
0 errors, 0 warnings
Map pack is up to date
```

- [ ] **Step 8: Commit**

Run:

```bash
rtk git add tools/content/world-authoring-repair.ts tests/unit/world-authoring-repair.test.ts package.json artifacts/map-authoring/world-authoring-repair-plan.json artifacts/map-authoring/world-authoring-repair-plan.md assets/maps/tiled/world.json assets/maps/runtime/map-pack.json
rtk git commit -m "fix: repair high-confidence world authoring defects"
```

### Ticket 2A.6: Complete Manual Visual Review and Richness Pass

**Scope:** Use generated evidence to review and improve terrain richness, overlays, transitions, layer placement, properties, collision, passability, gates, portals, spawns, bounds, regions, and music zones.

**Out of scope:** Do not perform unreviewed mass repainting. Do not copy external commercial assets into the project.

**Files:**
- Modify: `assets/maps/tiled/world.json`
- Modify if approved: `assets/maps/tiled/tilesheet.wang.tsj`
- Modify if approved: `client/public/img/1/tilesheet.webp`
- Modify if approved: generated or curated tileset files under `assets/maps/tiled/`
- Create: `docs/map-authoring-review-log.md`
- Update: `artifacts/map-authoring/visual/`
- Update: `assets/maps/runtime/map-pack.json`

**Acceptance criteria:**
- Review log divides the world into named regions and records pass/fail/fix decisions.
- Every high-confidence audit finding is fixed or reclassified with evidence.
- Every medium-confidence visual finding is either fixed or has a review-log keep decision.
- Terrain transitions are complete for the approved grammar or explicitly listed as asset work that remains blocking.
- Base terrain and overlays obey the grammar:
  - one base fill per visible cell
  - transitions on transition layers
  - decorative transparent overlays on overlay/variation layers
  - structural/foreground tiles on structural or foreground layers
  - gameplay markup invisible and non-rendering
- Door, gate, and portal objects use explicit semantics and valid graph links.
- Spawn, chest, roaming, checkpoint, bounds, and music regions are aligned to actual playable space.
- Collision and passability metadata match visible blockers, liquids, damage tiles, doors, bridges, cliffs, cave walls, and interiors.

**Verification plan:**
- `rtk bun run check:world-map:target`
- `rtk bun run check:terrain-authoring`
- `rtk bun run audit:terrain-grammar`
- `rtk bun run build:terrain-visuals`
- `rtk bun run build:maps && rtk bun run check:maps`
- `rtk bun test tests/unit/mmo/server-client-collision-parity.test.ts --timeout 20000`
- Browser smoke after the map can load: `rtk bun run test:browser:modern`

**Dependencies/blockers:** Tickets 2A.1 through 2A.5.

- [ ] **Step 1: Create review log**

Create `docs/map-authoring-review-log.md`:

```markdown
# Map Authoring Review Log

## Review Rules

- Fix high-confidence audit findings.
- Use before/after images from `artifacts/map-authoring/visual/`.
- Do not mark a region complete until terrain, overlay, collision, passability, objects, spawns, bounds, and music zones are checked.

## Regions

| Region | Coordinate bounds | Status | Evidence | Decision |
| --- | --- | --- | --- | --- |
| beach_biome | x 0-92, y 245-313 | open |  |  |
| village_biome | x 0-144, y 55-297 | open |  |  |
| deadlands_biome | x 0-169, y 0-252 | open |  |  |
| badlands_biome | x 0-169, y 0-303 | open |  |  |
| subterranean_region | x 0-169, y 6-312 | open |  |  |
| forest_region | x 0-165, y 4-271 | open |  |  |
```

The bounds above come from non-zero tile cells and object extents in each current `render_world` group. They are intentionally broad because multiple region groups overlap on the full overworld canvas.

- [ ] **Step 2: Review high-confidence findings first**

For each `error` or `high` finding in `terrain-authoring-audit.json`:

```markdown
### Finding <id>

- Status: fixed | kept | blocked
- Coordinates:
- Before image:
- After image:
- Decision:
- Verification:
```

- [ ] **Step 3: Apply region fixes in small batches**

For each region, apply map edits in Tiled or through approved repair scripts. After each batch, run:

```bash
rtk bun run check:world-map:target
rtk bun run check:terrain-authoring
rtk bun run build:terrain-visuals
```

Do not batch unrelated biome edits into one commit.

- [ ] **Step 4: Verify gameplay regions**

For each gameplay object layer:

```text
resource_nodes
static_entities
chest_spawns
chest_areas
doors
roaming_areas
music_zones
checkpoints
```

check that every object is inside intended playable space and does not overlap blocked-only terrain unless the object is intentionally inaccessible.

- [ ] **Step 5: Verify collision and passability**

Run:

```bash
rtk bun test tests/unit/mmo/server-client-collision-parity.test.ts --timeout 20000
rtk bun run check:world-map:target
```

Then use the browser passability overlay from Ticket 2.4 to inspect at least one representative area per region.

- [ ] **Step 6: Final visual artifact refresh**

Run:

```bash
rtk bun run check:terrain-authoring
rtk bun run audit:terrain-grammar
rtk bun run build:terrain-visuals
rtk bun run build:maps
rtk bun run check:maps
```

Expected:

```text
0 high-confidence authoring errors
Map pack is up to date
```

- [ ] **Step 7: Commit**

Run:

```bash
rtk git add assets/maps/tiled assets/maps/runtime/map-pack.json client/public/img/1/tilesheet.webp docs/map-authoring-review-log.md artifacts/map-authoring
rtk git commit -m "feat: complete world terrain authoring pass"
```

---

## Phase 3 - Protocol and Server Authority Cleanup

### Ticket 3.1: Remove Client-to-Server Legacy `ATTACK` From Schema

**Scope:** Align protocol schema with runtime policy: client combat uses `INTENT attack.entity`, not legacy C2S `ATTACK`.

**Out of scope:** Do not remove server-to-client `ATTACK`, which still represents attack animation/relationship broadcast.

**Files:**
- Modify: `shared/protocol/manifest.ts`
- Modify: `shared/protocol/types.ts`
- Modify: `shared/protocol/binary-action-codec.ts`
- Modify: `tests/unit/mmo/protocol-capabilities.test.ts`
- Modify: `tests/unit/player-session.test.ts`
- Modify browser tests that still expect C2S `ATTACK`.

**Acceptance criteria:**
- `checkClientToServerProtocolAction([Types.Messages.ATTACK, id])` returns false.
- Binary client-to-server decoder rejects C2S `ATTACK`.
- Runtime translator no longer needs a C2S `ATTACK` case except as a defensive unreachable branch if TypeScript requires it.
- Browser combat test expects `INTENT attack.entity`, not C2S `ATTACK`.

**Verification plan:**
- `rtk bun test tests/unit/mmo/protocol-capabilities.test.ts tests/unit/player-session.test.ts tests/unit/protocol/registry.test.ts --timeout 20000`
- `rtk bun run test:browser:protocol`

**Dependencies/blockers:** Phase 0.

- [ ] **Step 1: Add failing schema assertion**

In `tests/unit/mmo/protocol-capabilities.test.ts`, add:

```ts
test('protocol schema rejects legacy C2S ATTACK actions', () => {
    expect(checkClientToServerProtocolAction([Types.Messages.ATTACK, 101])).toBe(false);
});
```

- [ ] **Step 2: Remove manifest entry**

In `shared/protocol/manifest.ts`, remove this line from `CLIENT_TO_SERVER_PROTOCOL_MANIFEST`:

```ts
{ key: 'ATTACK', opcode: Types.Messages.ATTACK, direction: 'client_to_server', schema: { kind: 'fixed', args: ['n'] } },
```

Keep the server-to-client entry:

```ts
{ key: 'ATTACK', opcode: Types.Messages.ATTACK, direction: 'server_to_client', schema: { kind: 'fixed', args: ['n', 'n'] } },
```

- [ ] **Step 3: Update binary codec direction tables**

In `shared/protocol/binary-action-codec.ts`, remove `Types.Messages.ATTACK` from the client-to-server fixed single-number action cases. Keep it in server-to-client cases.

- [ ] **Step 4: Update tests**

In `tests/browser/modern-protocol-actions.playwright.ts`, replace assertions that count sent C2S `MSG_ATTACK` with assertions that the sent action is `MSG_INTENT` and the intent type decodes to `attack.entity`.

Use the existing intent codec helpers if present. If not, decode the intent payload using `shared/protocol/intents.ts` utilities rather than hard-coded bytes.

- [ ] **Step 5: Verify**

Run:

```bash
rtk bun test tests/unit/mmo/protocol-capabilities.test.ts tests/unit/player-session.test.ts tests/unit/protocol/registry.test.ts --timeout 20000
rtk bun run test:browser:protocol
```

Expected:

```text
0 fail
```

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add shared/protocol tests
rtk git commit -m "fix: remove legacy client attack opcode"
```

### Ticket 3.2: Finish Server-Authoritative Combat Contract

**Scope:** Ensure all player and mob damage is applied by server tick/hit-frame state, not client timing.

**Out of scope:** No new combat balance values.

**Files:**
- Modify: `server/world/ecs-command-pipeline.ts`
- Modify: `server/world/ecs-command-pipeline/core-module-registry.ts`
- Modify: `client/ecs/systems/client-interaction-intent-system.ts`
- Test: `tests/unit/ecs/combat-hitframe-state-machine.test.ts`
- Test: `tests/unit/ecs/mob-ai-chase.test.ts`
- Test: `tests/smoke/modern-gameplay-parity.test.ts`

**Acceptance criteria:**
- Client sends only attack intent.
- Server acknowledges intent and starts windup only when authoritative range/grace rules allow it.
- Damage happens only on server hit-frame.
- Out-of-range attack intent can be accepted as intent but does not deal immediate damage.
- Kill/despawn/respawn smoke path remains green.

**Verification plan:**
- `rtk bun test tests/unit/ecs/combat-hitframe-state-machine.test.ts tests/unit/ecs/mob-ai-chase.test.ts tests/smoke/modern-gameplay-parity.test.ts --timeout 30000`

**Dependencies/blockers:** Ticket 3.1.

- [ ] **Step 1: Add regression for no immediate damage on intent**

In `tests/unit/ecs/combat-hitframe-state-machine.test.ts`, add:

```ts
test('attack intent never applies damage before server hit-frame', () => {
    const fixture = createCombatFixture();
    const beforeHp = fixture.pipeline.combat.HitPoints.store.get(fixture.mobId);

    fixture.pipeline.enqueue({
        type: 'ATTACK',
        source: { connectionId: 'c', playerId: fixture.player.id },
        targetId: fixture.mobId,
    });
    fixture.pipeline.tick();

    expect(fixture.pipeline.combat.HitPoints.store.get(fixture.mobId)).toBe(beforeHp);
});
```

Adapt fixture names to the existing file.

- [ ] **Step 2: Verify existing hit-frame system**

Run:

```bash
rtk bun test tests/unit/ecs/combat-hitframe-state-machine.test.ts --timeout 20000
```

Expected: new test fails only if damage is still applied too early.

- [ ] **Step 3: Fix command pipeline**

If early damage exists, move damage application behind the existing windup/hit-frame component state. Do not add client-driven damage commands.

Use this invariant in code comments near the damage branch:

```ts
// Damage authority lives here: player intent may start windup, but only the server hit-frame mutates HP.
```

- [ ] **Step 4: Verify combat suite**

Run:

```bash
rtk bun test tests/unit/ecs/combat-hitframe-state-machine.test.ts tests/unit/ecs/mob-ai-chase.test.ts tests/smoke/modern-gameplay-parity.test.ts --timeout 30000
```

Expected:

```text
0 fail
```

- [ ] **Step 5: Commit**

Run:

```bash
rtk git add server client tests
rtk git commit -m "fix: enforce server-authoritative combat hit frames"
```

### Ticket 3.3: Make Client Combat Graph Cleanup Idempotent

**Scope:** Remove noisy or throwing cleanup behavior when despawn/death/attack-link events arrive in different orders.

**Out of scope:** No visual redesign of combat UI.

**Files:**
- Modify: `client/game.ts`
- Modify: `client/ecs/systems/client-combat-system.ts`
- Modify: `client/ecs/systems/client-kernel-replication-sync-system.ts`
- Test: `tests/unit/client-combat-runtime-plumbing.test.ts`
- Test: `tests/browser/modern-ui-smoke.playwright.ts`

**Acceptance criteria:**
- Removing an attack link that is already absent is a no-op.
- Despawn followed by death or death followed by despawn does not log `X is not attacked by Y`.
- Browser kill/despawn smoke path has no console errors from combat cleanup.

**Verification plan:**
- `rtk bun test tests/unit/client-combat-runtime-plumbing.test.ts --timeout 20000`
- `rtk npx playwright test --config=playwright.config.ts tests/browser/modern-ui-smoke.playwright.ts`

**Dependencies/blockers:** Ticket 3.2.

- [ ] **Step 1: Add idempotency test**

In `tests/unit/client-combat-runtime-plumbing.test.ts`, add:

```ts
test('combat cleanup tolerates duplicate attack-link removal', () => {
    const game = createClientCombatFixture();

    game.createAttackLink(100, 200);
    game.removeAttackLink(100, 200);
    expect(() => game.removeAttackLink(100, 200)).not.toThrow();
});
```

Adapt helper names to the existing test fixture.

- [ ] **Step 2: Implement no-op cleanup**

In `client/game.ts`, change attack-link removal from throwing/logging error on absent edge to:

```ts
if (!attacker || !target || !target.isAttackedBy(attacker)) {
    return;
}
```

Preserve logging only for genuinely corrupt states where an entity exists with inconsistent reciprocal links.

- [ ] **Step 3: Verify**

Run:

```bash
rtk bun test tests/unit/client-combat-runtime-plumbing.test.ts --timeout 20000
rtk npx playwright test --config=playwright.config.ts tests/browser/modern-ui-smoke.playwright.ts
```

Expected:

```text
0 fail
```

- [ ] **Step 4: Commit**

Run:

```bash
rtk git add client tests
rtk git commit -m "fix: make client combat cleanup idempotent"
```

---

## Phase 4 - Persistence and Friend-Server Gameplay Foundations

### Ticket 4.1: Lower Product Target From MMO Shard to Friend Server

**Scope:** Align config/docs/tests around a practical 16-64 player friend-server target.

**Out of scope:** Do not remove existing capacity code paths; only change defaults and docs.

**Files:**
- Modify: `server/config.json`
- Modify: `server/config_local.json-dist`
- Modify: `README.md`
- Modify or create: `docs/product-target.md`
- Test: `tests/unit/server-config-preflight.test.ts`

**Acceptance criteria:**
- Default `nb_players_per_world` is no higher than 64.
- Docs explicitly state 16-64 practical design target.
- Config validation still accepts larger explicit values for load experiments unless intentionally capped.

**Verification plan:**
- `rtk bun test tests/unit/server-config-preflight.test.ts --timeout 20000`
- `rtk bun run verify:modern`

**Dependencies/blockers:** Phase 0.

- [ ] **Step 1: Update defaults**

Change:

```json
"nb_players_per_world": 2000
```

to:

```json
"nb_players_per_world": 64
```

in `server/config.json` and `server/config_local.json-dist`.

- [ ] **Step 2: Add product target doc**

Create `docs/product-target.md`:

```markdown
# Product Target

BrowserQuest targets a casual co-op friend-server RPG: stable persistence, shared world state, interiors, farming, resources, chests, NPCs, shops, chat, and simple combat for 16-64 concurrent players per world.

The project does not currently target 2000-player MMO shards. High-scale sharding, cross-shard migration, complex anti-cheat, and distributed world simulation are deferred until the friend-server loop is stable and measured.
```

- [ ] **Step 3: Verify config**

Run:

```bash
rtk bun test tests/unit/server-config-preflight.test.ts --timeout 20000
rtk bun run verify:modern
```

Expected:

```text
0 fail
```

- [ ] **Step 4: Commit**

Run:

```bash
rtk git add server/config.json server/config_local.json-dist README.md docs/product-target.md tests/unit/server-config-preflight.test.ts
rtk git commit -m "docs: align defaults with friend-server target"
```

### Ticket 4.2: Add Persistence Schema Versioning and Backup CLI

**Scope:** Add operational safety for SQLite persistence before adding more world state.

**Out of scope:** No online migration framework beyond schema version table and explicit backup command.

**Files:**
- Modify: `server/player-persistence.ts`
- Modify: `server/world/claims/claims-persistence.ts`
- Modify: `server/world/chunks/chunk-overlay-persistence.ts`
- Create: `tools/admin/backup-sqlite.ts`
- Modify: `package.json`
- Test: `tests/unit/server-player-persistence.test.ts`
- Test: `tests/unit/mmo/server-claims-store.test.ts`
- Test: `tests/unit/mmo/server-chunk-overlay-store.test.ts`

**Acceptance criteria:**
- Each SQLite DB has a `schema_meta` table with key `schema_version`.
- Backup CLI copies DB, WAL, and SHM files when present.
- Backup CLI verifies byte sizes and reports JSON output.

**Verification plan:**
- `rtk bun test tests/unit/server-player-persistence.test.ts tests/unit/mmo/server-claims-store.test.ts tests/unit/mmo/server-chunk-overlay-store.test.ts --timeout 20000`
- `rtk bun tools/admin/backup-sqlite.ts --db server/.data/player-profiles.sqlite --out .tmp/player-profiles.backup --json`

**Dependencies/blockers:** Phase 0.

- [ ] **Step 1: Add schema meta helper**

Create a local helper in each persistence module or a shared helper `server/sqlite-schema-meta.ts`:

```ts
import type { Database } from 'bun:sqlite';

export function ensureSchemaVersion(db: Database, version: number): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS schema_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);
    const existing = db.query(`SELECT value FROM schema_meta WHERE key = 'schema_version'`).get() as { value?: string } | null;
    if (!existing) {
        db.query(`INSERT INTO schema_meta (key, value) VALUES ('schema_version', ?1)`).run(String(version));
    }
}
```

- [ ] **Step 2: Call helper during DB init**

Call:

```ts
ensureSchemaVersion(this.#db, 1);
```

after opening each SQLite DB and before creating application tables.

- [ ] **Step 3: Add backup CLI**

Create `tools/admin/backup-sqlite.ts`:

```ts
import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../../shared/cli-args';

const args = parseCliArgs(process.argv.slice(2), [
    { key: 'db', kind: 'string' },
    { key: 'out', kind: 'string' },
    { key: 'json', kind: 'boolean', defaultValue: false },
]);

const dbPath = String(args.db ?? '').trim();
const outDir = String(args.out ?? '').trim();
if (!dbPath || !outDir) {
    throw new Error('Usage: bun tools/admin/backup-sqlite.ts --db <path> --out <dir> [--json]');
}

await mkdir(outDir, { recursive: true });
const suffixes = ['', '-wal', '-shm'];
const copied: Array<{ source: string; target: string; bytes: number }> = [];

for (const suffix of suffixes) {
    const source = `${dbPath}${suffix}`;
    const sourceStat = await stat(source).catch(() => null);
    if (!sourceStat?.isFile()) {
        continue;
    }
    const target = path.join(outDir, path.basename(source));
    await copyFile(source, target);
    const targetStat = await stat(target);
    copied.push({ source, target, bytes: targetStat.size });
}

if (copied.length === 0) {
    throw new Error(`No SQLite files found for ${dbPath}`);
}

if (args.json) {
    console.log(JSON.stringify({ ok: true, copied }, null, 2));
} else {
    for (const entry of copied) {
        console.log(`${entry.source} -> ${entry.target} (${entry.bytes} bytes)`);
    }
}
```

- [ ] **Step 4: Add package script**

In `package.json`, add:

```json
"admin:backup-sqlite": "bun tools/admin/backup-sqlite.ts"
```

- [ ] **Step 5: Verify**

Run:

```bash
rtk bun test tests/unit/server-player-persistence.test.ts tests/unit/mmo/server-claims-store.test.ts tests/unit/mmo/server-chunk-overlay-store.test.ts --timeout 20000
rtk bun run admin:backup-sqlite -- --db server/.data/player-profiles.sqlite --out .tmp/player-profiles.backup --json
```

Expected: tests pass and backup command emits JSON with `ok: true`.

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add server tools/admin/backup-sqlite.ts package.json tests
rtk git commit -m "feat: add sqlite schema metadata and backup cli"
```

### Ticket 4.3: Implement Inventory and Chest Transactions

**Scope:** Add server-authoritative inventory/chest transfer semantics backed by SQLite.

**Out of scope:** No drag-and-drop UI polish; text/debug UI is acceptable for first pass.

**Files:**
- Modify: `server/player-persistence.ts`
- Modify: `server/world/ecs-command-pipeline.ts`
- Modify: `server/world/ecs-command-pipeline/core-module-registry.ts`
- Modify: `shared/protocol/intents.ts`
- Modify: `client/ecs/systems/client-interaction-intent-system.ts`
- Test: `tests/unit/server-player-persistence.test.ts`
- Create: `tests/unit/mmo/server-inventory-chest-transactions.test.ts`

**Acceptance criteria:**
- Inventory supports stackable item entries.
- Chest transfer is atomic: source decrement and destination increment happen together.
- Server rejects transfers when player is out of interaction range or lacks permission.
- Client receives outcome/reject action for each transfer intent.

**Verification plan:**
- `rtk bun test tests/unit/server-player-persistence.test.ts tests/unit/mmo/server-inventory-chest-transactions.test.ts --timeout 20000`
- `rtk bun run verify:modern`

**Dependencies/blockers:** Ticket 4.2.

- [ ] **Step 1: Add intent constants**

In `shared/protocol/intents.ts`, add:

```ts
export const INTENT_CHEST_TRANSFER = 'chest.transfer' as const;
```

Include it in the union of supported intent ids.

- [ ] **Step 2: Add failing transaction tests**

Create `tests/unit/mmo/server-inventory-chest-transactions.test.ts` with tests:

```ts
test('chest transfer moves one stack atomically from chest to inventory', () => {
    const fixture = createChestTransactionFixture();
    fixture.seedChest({ chestId: 100, itemKind: Types.Entities.FLASK, quantity: 3 });

    fixture.pipeline.enqueueIntent({
        playerId: fixture.player.id,
        intentTypeId: INTENT_CHEST_TRANSFER,
        payload: { chestId: 100, itemKind: Types.Entities.FLASK, quantity: 2, direction: 'chest_to_inventory' },
    });
    fixture.pipeline.tick();

    expect(fixture.getInventoryQuantity(fixture.player.id, Types.Entities.FLASK)).toBe(2);
    expect(fixture.getChestQuantity(100, Types.Entities.FLASK)).toBe(1);
});

test('chest transfer rejects out-of-range player without mutating state', () => {
    const fixture = createChestTransactionFixture({ playerPosition: { x: 1, y: 1 }, chestPosition: { x: 50, y: 50 } });
    fixture.seedChest({ chestId: 100, itemKind: Types.Entities.FLASK, quantity: 3 });

    fixture.pipeline.enqueueIntent({
        playerId: fixture.player.id,
        intentTypeId: INTENT_CHEST_TRANSFER,
        payload: { chestId: 100, itemKind: Types.Entities.FLASK, quantity: 1, direction: 'chest_to_inventory' },
    });
    fixture.pipeline.tick();

    expect(fixture.getInventoryQuantity(fixture.player.id, Types.Entities.FLASK)).toBe(0);
    expect(fixture.getChestQuantity(100, Types.Entities.FLASK)).toBe(3);
    expect(fixture.rejections).toContain('out_of_range');
});
```

Implement fixture helpers in the test file using existing persistence and pipeline helpers.

- [ ] **Step 3: Implement persistence transaction**

In `server/player-persistence.ts`, add methods:

```ts
transferChestItemToInventory(args: {
    accountNameKey: string;
    chestId: number;
    itemKind: EntityKind;
    quantity: number;
}): { accepted: true } | { accepted: false; reason: string }
```

Use `this.#db.transaction((args) => { /* mutation statements */ })` so all mutations commit or rollback together.

- [ ] **Step 4: Wire server intent**

In `server/world/ecs-command-pipeline/core-module-registry.ts`, register `INTENT_CHEST_TRANSFER`. Decode payload fields strictly:

```ts
chestId: positive integer
itemKind: known EntityKind
quantity: positive safe integer
direction: 'chest_to_inventory' | 'inventory_to_chest'
```

Reject out-of-range before calling persistence.

- [ ] **Step 5: Verify**

Run:

```bash
rtk bun test tests/unit/server-player-persistence.test.ts tests/unit/mmo/server-inventory-chest-transactions.test.ts --timeout 20000
rtk bun run verify:modern
```

Expected:

```text
0 fail
```

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add shared server client tests
rtk git commit -m "feat: add authoritative chest inventory transfers"
```

---

## Phase 5 - Farming, Resources, NPCs, and Mines MVP

### Ticket 5.1: Add Crop Tile State and Day Advancement

**Scope:** Add server-persistent crop tile state with till, plant, water, grow, and harvest operations.

**Out of scope:** Seasons and crop death rules. Add those after basic loop is verified.

**Files:**
- Create: `server/world/farming/crop-state.ts`
- Create: `server/world/farming/crop-persistence.ts`
- Modify: `server/world/ecs-command-pipeline/core-module-registry.ts`
- Modify: `shared/protocol/intents.ts`
- Create: `assets/content/crops.json`
- Test: `tests/unit/mmo/server-farming.test.ts`

**Acceptance criteria:**
- Crop state persists by `map_id`, `x`, `y`.
- Tilling an unfarmable tile is rejected.
- Planting requires a seed item.
- Watered crops advance one growth step on day advancement.
- Harvest grants configured item and clears/updates crop tile.

**Verification plan:**
- `rtk bun test tests/unit/mmo/server-farming.test.ts --timeout 20000`
- `rtk bun run verify:modern`

**Dependencies/blockers:** Ticket 4.3.

- [ ] **Step 1: Add crop definitions**

Create `assets/content/crops.json`:

```json
{
  "turnip": {
    "seedItem": "turnip_seed",
    "harvestItem": "turnip",
    "growthDays": 3,
    "regrows": false
  }
}
```

- [ ] **Step 2: Add state type**

Create `server/world/farming/crop-state.ts`:

```ts
export type CropTileState = Readonly<{
    mapId: string;
    x: number;
    y: number;
    cropId: string | null;
    tilled: boolean;
    wateredToday: boolean;
    growth: number;
}>;
```

- [ ] **Step 3: Add failing tests**

Create `tests/unit/mmo/server-farming.test.ts` with tests for till, plant, water, day advance, and harvest.

Use exact assertions:

```ts
expect(fixture.getCropTile('world_01', 10, 10)).toMatchObject({
    tilled: true,
    cropId: 'turnip',
    wateredToday: false,
    growth: 0,
});
```

After three watered day advances:

```ts
expect(fixture.harvest('world_01', 10, 10)).toEqual({ accepted: true, itemId: 'turnip', quantity: 1 });
```

- [ ] **Step 4: Implement persistence**

Create SQLite table:

```sql
CREATE TABLE IF NOT EXISTS crop_tiles (
    map_id TEXT NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    crop_id TEXT,
    tilled INTEGER NOT NULL,
    watered_today INTEGER NOT NULL,
    growth INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (map_id, x, y)
);
```

- [ ] **Step 5: Wire intents**

Add intents:

```ts
export const INTENT_TOOL_USE = 'tool.use' as const;
export const INTENT_CROP_PLANT = 'crop.plant' as const;
export const INTENT_CROP_HARVEST = 'crop.harvest' as const;
```

Tool payload includes:

```ts
{ tool: 'hoe' | 'watering_can', x: number, y: number }
```

- [ ] **Step 6: Verify**

Run:

```bash
rtk bun test tests/unit/mmo/server-farming.test.ts --timeout 20000
rtk bun run verify:modern
```

Expected:

```text
0 fail
```

- [ ] **Step 7: Commit**

Run:

```bash
rtk git add assets/content/crops.json shared server tests/unit/mmo/server-farming.test.ts
rtk git commit -m "feat: add persistent crop tile loop"
```

### Ticket 5.2: Add Resource Node Harvesting

**Scope:** Add persistent trees, rocks, ore, and forage nodes with respawn rules.

**Out of scope:** Tool durability and rare drop tables.

**Files:**
- Create: `assets/content/resources.json`
- Create: `server/world/resources/resource-state.ts`
- Create: `server/world/resources/resource-persistence.ts`
- Modify: `server/world/ecs-command-pipeline/core-module-registry.ts`
- Modify: `shared/protocol/intents.ts`
- Test: `tests/unit/mmo/server-resource-harvesting.test.ts`

**Acceptance criteria:**
- Resource nodes have stable ids, map id, position, kind, depleted state, and respawn day.
- Harvest checks tool type and range.
- Harvest grants configured item stack.
- Depleted nodes persist and respawn after configured days.

**Verification plan:**
- `rtk bun test tests/unit/mmo/server-resource-harvesting.test.ts --timeout 20000`
- `rtk bun run verify:modern`

**Dependencies/blockers:** Ticket 5.1.

- [ ] **Step 1: Add resource definitions**

Create `assets/content/resources.json`:

```json
{
  "tree_oak_small": {
    "tool": "axe",
    "drops": [{ "item": "wood", "quantity": 3 }],
    "respawnDays": 3
  },
  "rock_small": {
    "tool": "pickaxe",
    "drops": [{ "item": "stone", "quantity": 2 }],
    "respawnDays": 2
  }
}
```

- [ ] **Step 2: Add resource tests**

Create tests asserting:

```ts
expect(result).toEqual({ accepted: true, drops: [{ item: 'wood', quantity: 3 }] });
expect(fixture.getResourceNode('oak_1')?.depleted).toBe(true);
```

and after day advancement:

```ts
expect(fixture.getResourceNode('oak_1')?.depleted).toBe(false);
```

- [ ] **Step 3: Implement persistence table**

Use:

```sql
CREATE TABLE IF NOT EXISTS resource_nodes (
    id TEXT PRIMARY KEY,
    map_id TEXT NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    kind TEXT NOT NULL,
    depleted INTEGER NOT NULL,
    respawn_day INTEGER,
    updated_at INTEGER NOT NULL
);
```

- [ ] **Step 4: Wire harvest intent**

Add:

```ts
export const INTENT_RESOURCE_HARVEST = 'resource.harvest' as const;
```

Payload:

```ts
{ nodeId: string, tool: 'axe' | 'pickaxe' | 'scythe' }
```

- [ ] **Step 5: Verify**

Run:

```bash
rtk bun test tests/unit/mmo/server-resource-harvesting.test.ts --timeout 20000
rtk bun run verify:modern
```

Expected:

```text
0 fail
```

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add assets/content/resources.json shared server tests/unit/mmo/server-resource-harvesting.test.ts
rtk git commit -m "feat: add persistent resource harvesting"
```

### Ticket 5.3: Add NPC Dialogue and Shops

**Scope:** Add static NPC dialogue and simple buy/sell shops.

**Out of scope:** NPC schedules, relationships, quests.

**Files:**
- Create: `assets/content/npcs.json`
- Create: `assets/content/shops.json`
- Modify: `server/world/ecs-command-pipeline/core-module-registry.ts`
- Modify: `shared/protocol/intents.ts`
- Modify: `client/ecs/systems/client-interaction-intent-system.ts`
- Test: `tests/unit/mmo/server-npc-shop.test.ts`

**Acceptance criteria:**
- NPC interaction returns configured dialogue id/text.
- Shop buy validates currency and inventory capacity.
- Shop sell validates item ownership and grants currency.
- All shop mutations are server-side and atomic.

**Verification plan:**
- `rtk bun test tests/unit/mmo/server-npc-shop.test.ts --timeout 20000`
- `rtk bun run verify:modern`

**Dependencies/blockers:** Ticket 4.3.

- [ ] **Step 1: Add content files**

Create `assets/content/npcs.json`:

```json
{
  "shopkeeper_general": {
    "displayName": "Mara",
    "dialogue": ["Need supplies?"]
  }
}
```

Create `assets/content/shops.json`:

```json
{
  "general_store": {
    "npc": "shopkeeper_general",
    "buys": ["turnip", "wood", "stone"],
    "sells": [
      { "item": "turnip_seed", "price": 5 }
    ]
  }
}
```

- [ ] **Step 2: Add intents**

Add:

```ts
export const INTENT_NPC_TALK = 'npc.talk' as const;
export const INTENT_SHOP_BUY = 'shop.buy' as const;
export const INTENT_SHOP_SELL = 'shop.sell' as const;
```

- [ ] **Step 3: Add tests**

Create `tests/unit/mmo/server-npc-shop.test.ts` with:

```ts
test('shop buy spends gold and adds item', () => {
    const fixture = createShopFixture({ gold: 10 });
    const result = fixture.buy({ shopId: 'general_store', item: 'turnip_seed', quantity: 1 });
    expect(result).toEqual({ accepted: true });
    expect(fixture.profile.gold).toBe(5);
    expect(fixture.inventoryQuantity('turnip_seed')).toBe(1);
});
```

- [ ] **Step 4: Implement server handlers**

Keep all price and item resolution server-side. Reject unknown `shopId`, unknown item, non-positive quantity, insufficient gold, and missing inventory item.

- [ ] **Step 5: Verify**

Run:

```bash
rtk bun test tests/unit/mmo/server-npc-shop.test.ts --timeout 20000
rtk bun run verify:modern
```

Expected:

```text
0 fail
```

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add assets/content/npcs.json assets/content/shops.json shared server client tests/unit/mmo/server-npc-shop.test.ts
rtk git commit -m "feat: add npc dialogue and shops"
```

### Ticket 5.4: Add Simple Mines Loop

**Scope:** Add basic mine/cave map flow with simple mobs and shared loot.

**Out of scope:** Procedural generation, boss rooms, party finder.

**Files:**
- Create: `assets/maps/tiled/maps/mine_floor_001.json`
- Modify: `assets/maps/tiled/map-pack.config.json`
- Modify: `assets/content/resources.json`
- Modify: server combat/resource modules as needed.
- Test: `tests/smoke/modern-gameplay-parity.test.ts`
- Create: `tests/browser/mines-loop.playwright.ts`

**Acceptance criteria:**
- Player can enter mine map through a graph-linked door.
- Mine map spawns at least one mob and one ore/resource node.
- Killing a mob and harvesting a resource grants loot through server-side state.
- Returning to overworld preserves player inventory.

**Verification plan:**
- `rtk bun test tests/smoke/modern-gameplay-parity.test.ts --timeout 30000`
- `rtk npx playwright test --config=playwright.config.ts tests/browser/mines-loop.playwright.ts`
- `rtk bun run verify:modern`

**Dependencies/blockers:** Tickets 1.5, 3.2, 5.2.

- [ ] **Step 1: Create mine map**

Create `assets/maps/tiled/maps/mine_floor_001.json` using the same minimal map shape as the stub house interiors, with:

- floor layer
- collision boundary
- `doors` objectgroup with reverse door to `world_01`
- `roaming_areas` objectgroup
- `resource_nodes` objectgroup

- [ ] **Step 2: Add pack entry**

Add:

```json
{ "id": "mine_floor_001", "filepath": "./maps/mine_floor_001.json" }
```

to `assets/maps/tiled/map-pack.config.json`.

- [ ] **Step 3: Add browser smoke**

Create `tests/browser/mines-loop.playwright.ts` that:

1. Starts client.
2. Logs in.
3. Triggers door teleport to mine through test control.
4. Waits for active map id `mine_floor_001`.
5. Harvests one node through test control.
6. Asserts inventory contains expected item.

- [ ] **Step 4: Verify**

Run:

```bash
rtk bun run build:maps
rtk bun run check:maps
rtk bun test tests/smoke/modern-gameplay-parity.test.ts --timeout 30000
rtk npx playwright test --config=playwright.config.ts tests/browser/mines-loop.playwright.ts
rtk bun run verify:modern
```

Expected:

```text
0 fail
Map pack is up to date
```

- [ ] **Step 5: Commit**

Run:

```bash
rtk git add assets/maps assets/content server client tests
rtk git commit -m "feat: add simple mines gameplay loop"
```

---

## Phase 6 - Client Build, Renderer Boundary, and Debuggability

### Ticket 6.1: Document Bun Build as Intentional

**Scope:** Decide and document whether to keep custom Bun build or migrate to Vite.

**Out of scope:** Do not migrate to Vite in this ticket.

**Files:**
- Create: `docs/client-build-decision.md`
- Modify: `README.md`

**Acceptance criteria:**
- Document says whether the project stays on Bun build for now.
- If Vite is deferred, the reason is tied to map/gameplay priorities.
- Existing build scripts remain unchanged unless a concrete problem is fixed.

**Verification plan:**
- `rtk bun run build:client`
- `rtk bun run verify:modern`

**Dependencies/blockers:** Phase 0.

- [ ] **Step 1: Create decision doc**

Create `docs/client-build-decision.md`:

```markdown
# Client Build Decision

The project keeps the current Bun-based client build until the map-pack, door graph, persistence, and MVP friend-server gameplay loop are stable.

Vite remains a candidate for browser development ergonomics, HMR, and asset pipeline simplification. It is not the next migration because it does not fix runtime map consistency, passability, persistence, or gameplay authority.

Revisit Vite after `rtk bun run verify:modern` is stable and the MVP loop has browser coverage.
```

- [ ] **Step 2: Verify current build**

Run:

```bash
rtk bun run build:client
rtk bun run verify:modern
```

Expected:

```text
0 fail
```

- [ ] **Step 3: Commit**

Run:

```bash
rtk git add docs/client-build-decision.md README.md
rtk git commit -m "docs: record client build decision"
```

### Ticket 6.2: Introduce Renderer Boundary Without Rewriting Renderer

**Scope:** Add a small renderer interface around current Canvas renderer so debug overlays and future renderer work have a seam.

**Out of scope:** Do not migrate to Pixi, Phaser, Three.js, React, or Vite.

**Files:**
- Create: `client/rendering/renderer-contract.ts`
- Modify: `client/map.ts`
- Modify: `client/game.ts`
- Test: `tests/unit/renderer-terrain.test.ts`

**Acceptance criteria:**
- Current Canvas rendering is behind a named interface.
- Existing game visuals are unchanged.
- Debug overlays can be called through the renderer boundary.

**Verification plan:**
- `rtk bun test tests/unit/renderer-terrain.test.ts --timeout 20000`
- `rtk npx playwright test --config=playwright.config.ts tests/browser/modern-ui-smoke.playwright.ts`

**Dependencies/blockers:** Ticket 2.4.

- [ ] **Step 1: Create renderer contract**

Create `client/rendering/renderer-contract.ts`:

```ts
export type RenderFrameContext = Readonly<{
    nowMs: number;
}>;

export interface GameRenderer {
    renderFrame(ctx: RenderFrameContext): void;
    setDebugOverlayMode(mode: 'none' | 'passability'): void;
}
```

- [ ] **Step 2: Adapt current renderer**

In `client/map.ts` or nearest renderer owner, expose an adapter class:

```ts
export class CanvasGameRenderer implements GameRenderer {
    constructor(private readonly game: Game) {}

    renderFrame(ctx: RenderFrameContext): void {
        void ctx;
        this.game.render();
    }

    setDebugOverlayMode(mode: 'none' | 'passability'): void {
        this.game.setMapDebugOverlayMode(mode);
    }
}
```

Use actual local render function names.

- [ ] **Step 3: Verify**

Run:

```bash
rtk bun test tests/unit/renderer-terrain.test.ts --timeout 20000
rtk npx playwright test --config=playwright.config.ts tests/browser/modern-ui-smoke.playwright.ts
```

Expected:

```text
0 fail
```

- [ ] **Step 4: Commit**

Run:

```bash
rtk git add client/rendering/renderer-contract.ts client tests/unit/renderer-terrain.test.ts
rtk git commit -m "refactor: add canvas renderer boundary"
```

---

## Phase 7 - Handoff Hygiene and Release Gates

### Ticket 7.1: Add Handoff Archive Hygiene Check

**Scope:** Prevent ignored local/generated artifacts from entering handoff archives.

**Out of scope:** Do not delete the user's local ignored files unless explicitly requested.

**Files:**
- Create: `tools/release/check-handoff-hygiene.ts`
- Modify: `package.json`
- Test: `tests/unit/release-hygiene.test.ts`

**Acceptance criteria:**
- Check fails if archive candidate contains `.DS_Store`, `server/.data`, `generated`, `dist`, `node_modules`, `world.original.json`, `world.backup.*.json`, or SQLite WAL/SHM files.
- Check can run against the repo root and an explicit directory.
- Normal working tree can still contain ignored local files; this is a release/archive gate.

**Verification plan:**
- `rtk bun test tests/unit/release-hygiene.test.ts --timeout 20000`
- `rtk bun run check:handoff-hygiene -- .`

**Dependencies/blockers:** Phase 0.

- [ ] **Step 1: Create checker**

Create `tools/release/check-handoff-hygiene.ts`:

```ts
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const forbiddenNames = new Set(['.DS_Store', 'node_modules', 'dist', 'generated']);
const forbiddenPathParts = ['server/.data'];
const forbiddenPatterns = [/world\.original\.json$/, /world\.backup\..*\.json$/, /\.sqlite-(wal|shm)$/];

async function walk(dir: string, out: string[]): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const absolute = path.join(dir, entry.name);
        const relative = path.relative(root, absolute).replace(/\\/g, '/');
        if (forbiddenNames.has(entry.name) || forbiddenPathParts.some((part) => relative === part || relative.startsWith(`${part}/`)) || forbiddenPatterns.some((pattern) => pattern.test(relative))) {
            out.push(relative);
            if (entry.isDirectory()) {
                continue;
            }
        }
        if (entry.isDirectory()) {
            await walk(absolute, out);
        }
    }
}

const violations: string[] = [];
await walk(root, violations);
if (violations.length > 0) {
    console.error(`Handoff hygiene check failed:\n${violations.sort().join('\n')}`);
    process.exit(1);
}
console.log('Handoff hygiene check passed.');
```

- [ ] **Step 2: Add script**

In `package.json`, add:

```json
"check:handoff-hygiene": "bun tools/release/check-handoff-hygiene.ts"
```

- [ ] **Step 3: Add tests**

Create `tests/unit/release-hygiene.test.ts` using temp directories. Assert that `.DS_Store` fails and a clean directory passes.

- [ ] **Step 4: Verify**

Run:

```bash
rtk bun test tests/unit/release-hygiene.test.ts --timeout 20000
rtk bun run check:handoff-hygiene -- .tmp/clean-handoff-fixture
```

Expected:

```text
0 fail
Handoff hygiene check passed.
```

Do not run the checker against repo root as a release gate until ignored local files are cleaned or a clean archive directory exists.

- [ ] **Step 5: Commit**

Run:

```bash
rtk git add tools/release/check-handoff-hygiene.ts package.json tests/unit/release-hygiene.test.ts
rtk git commit -m "chore: add handoff hygiene gate"
```

### Ticket 7.2: Final Verification and Release Checklist

**Scope:** Establish the final release gate after all phases are complete.

**Out of scope:** No feature work.

**Files:**
- Create: `docs/release-checklist.md`
- Modify: `README.md`

**Acceptance criteria:**
- Release checklist names exact commands.
- Checklist includes archive hygiene, audit, browser tests, and runtime smoke.
- All final commands pass.

**Verification plan:**
- Run every command in the checklist.

**Dependencies/blockers:** All previous tickets.

- [ ] **Step 1: Create release checklist**

Create `docs/release-checklist.md`:

````markdown
# Release Checklist

Run from repo root:

```bash
rtk git status --short --branch
rtk bun install --frozen-lockfile
rtk bun audit
rtk bun run verify:modern
rtk bun run test:browser:protocol
rtk bun run test:browser:modern
rtk bun run check:handoff-hygiene -- <clean-archive-directory>
```

Expected:

- No unexpected dirty files.
- Dependency audit passes or has a current documented dev-only risk acceptance.
- Modern verification passes.
- Browser protocol and UI tests pass.
- Clean archive directory contains no generated/local/private artifacts.
````

- [ ] **Step 2: Run final gate**

Run:

```bash
rtk git status --short --branch
rtk bun install --frozen-lockfile
rtk bun audit
rtk bun run verify:modern
rtk bun run test:browser:protocol
rtk bun run test:browser:modern
```

Expected:

```text
0 fail
```

- [ ] **Step 3: Commit**

Run:

```bash
rtk git add docs/release-checklist.md README.md
rtk git commit -m "docs: add release checklist"
```

---

## Execution Order

1. Phase 0: restore formatting, typecheck, lint, tests, dependency audit.
2. Phase 0A: clean the legacy project surface by inventorying, indexing, archiving, and quarantining stale scripts/docs/tools.
3. Phase 1: make map-pack config the runtime source, regenerate pack, canonicalize map ids, add interiors, enforce strict target maps.
4. Phase 2: strict door/portal/layer/passability contracts.
5. Phase 2A: terrain, tileset, overlay, visual authoring, Wang/grammar, and map richness audit/repair.
6. Phase 3: protocol and server-authoritative combat cleanup.
7. Phase 4: persistence safety and friend-server product target.
8. Phase 5: gameplay MVP systems: farming, resources, NPC shops, mines.
9. Phase 6: client build decision and renderer boundary.
10. Phase 7: handoff/release gates.

Do not start Phase 5 gameplay expansion until Phase 1 map-pack strictness and Phase 3 protocol authority are green. Gameplay systems built on unstable map ids or split protocol policy will create avoidable migration work.

Do not run broad map or tileset write tools from legacy package scripts after Phase 0A. New map writes should go through the dry-run-first repair tooling planned in Phase 2A.

Do not start subjective map repainting until Phase 2A.1 through Phase 2A.3 have produced an audit, visual evidence, and an approved terrain grammar. Mechanical safe repairs from Phase 2A.5 may run before the manual richness pass if their dry-run report is reviewed first.

## Critical Reviewer Pass Before Starting Implementation

Check these likely failure points before editing:

- Map id drift: search for hard-coded `'world'` and `'world_01'` before every map-related ticket.

```bash
rtk rg -n "'world'|\"world\"|'world_01'|\"world_01\"" server client shared tests tools assets/maps/tiled -g '*.{ts,json,tx,md}'
```

- Runtime source drift: search for direct `world.json` runtime config usage.

```bash
rtk rg -n "map_filepath.*world.json|assets/maps/tiled/world.json" server client shared tests tools README.md docs -g '*.{ts,json,md}'
```

- Protocol drift: search for client-to-server legacy attack assumptions.

```bash
rtk rg -n "MSG_ATTACK|Types\\.Messages\\.ATTACK|createAttackAction|INTENT_ATTACK" client server shared tests -g '*.ts'
```

- Terrain authoring drift: search for scripts or docs that still treat the current Wang scaffold as a complete terrain system.

```bash
rtk rg -n "wang|Wang|terrain-authoring|tilesheet\\.wang|scaffold-|TerrainPairScaffold" tools assets/maps/tiled docs tests -g '*.{ts,json,tsj,md}'
```

- Asset-source drift: verify BrowserQuest runtime assets and external reference assets stay separate.

```bash
rtk rg -n "stardew-assets|spring_outdoorsTileSheet|paths\\.png" assets client server shared tools docs tests -g '*.{ts,json,md,tsj}'
```

Expected: references to `/Users/krisztiaan/dev/stardew-assets` appear only in audit/reference tooling or docs, never in runtime map-pack config, runtime client asset references, or production server code.

For each search, classify hits as production runtime, authoring/tool compatibility, test fixture, or documentation before changing them.

## Progress Documentation Template

For every ticket, append a concise progress entry to this file or a ticket-specific execution log:

```markdown
### YYYY-MM-DD HH:mm - Ticket X.Y

- Status: in_progress | blocked | done
- Key actions:
  - Command or file change
- Evidence:
  - `command`: pass/fail and key output
- Next action:
  - Specific next command or edit
```

Do not mark a ticket done until its verification plan has passed.
