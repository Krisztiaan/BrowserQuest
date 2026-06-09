# BrowserQuest Modernization & Co-op RPG Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Phases 0–5 contain executable bite-sized tasks. Phases 6–8 are detailed specifications that MUST each be expanded into their own plan document (via superpowers:writing-plans) when their phase begins — they depend on decisions and code that earlier phases produce.

**Goal:** Take the `modernize` branch from its current red-verify state to a correct, strictly-validated map/content pipeline, a resilient Bun-only server, and then a casual co-op RPG (16–64 players) with a Stardew-like gameplay loop — explicitly *not* a 2000-player MMO.

**Architecture:** Server-authoritative Bun runtime (`Bun.serve` + `bun:sqlite`) running a 30 UPS ECS tick pipeline with binary FixedBin v2 protocol, chunk-based AOI replication, and SQLite persistence (player profiles, chunk overlays, claims). Canvas client with sub-tile prediction/reconciliation behind an emerging visual-bridge boundary. Tiled-authored content compiled by a build-time map-pack compiler into a single runtime artifact.

**Tech Stack:** Bun ≥1.3, TypeScript 5.9 (strict), bun:test, Playwright, Tiled (JSON maps + .tx templates), SQLite (WAL), WebAuthn passkeys, ESLint 9 / Prettier.

---

## 0. Context: where this plan comes from

Two audits feed this plan:

1. **EXTERNAL-AUDIT.md** (static review, could not run the toolchain). Verified-correct findings: server loads raw `world.json` instead of the map-pack config; `allow_missing_target_maps: true` silently drops door edges; 40 of 84 doors target nonexistent `house_01`–`house_40` maps and 7 target `world` while the canonical id is `world_01`; portal semantics hinge on Tiled's `class === "Portal"`; layer/object taxonomy is organic. Its strategic pivot — stop building for MMO scale, build a 16–64 player co-op friend server — is adopted by this plan. Its repo-hygiene findings (backup files, `.DS_Store`, sqlite files) were artifacts of a stale upload archive and are already handled by `.gitignore`; they are NOT tasks here.
2. **Internal audit (2026-06-09, ran the toolchain).** The branch is currently red: `bun run typecheck` fails (4 errors), `bun run lint` fails (24 errors / 93 warnings), and `bun test` has 6 failures out of 620 — including a live functional regression where server-side door traversal does not teleport the player. Additional findings: ECS pipeline has no error boundaries (one throwing handler = fatal shutdown), persistence lacks multi-statement transactions, the auth session secret regenerates on every restart unless `BQ_AUTH_SESSION_SECRET` is set, `memcache@1.3.0` (unmaintained since 2015) is a live dependency, `format:check` covers only ~8 files, and the 1,292-line strict map validator (`tools/content/world-map-validator.ts --profile target`) exists but is not wired into `verify`.

**Phase order is deliberate:** nothing is trustworthy while verify is red (Phase 0); content correctness must precede content expansion (Phases 1–2); the server must not crash on one bad input before we invite friends onto it (Phase 3); gameplay (Phase 7) builds on interiors (Phase 6) which build on a strict door graph (Phase 1).

### Standing rules for every task

- TDD: write/extend the failing test first, watch it fail, implement, watch it pass.
- After each task: `bun run typecheck && bun run lint` must pass for touched scopes; commit with a conventional message.
- Never weaken a failing assertion to make it pass without diagnosing why it changed (`superpowers:systematic-debugging`).
- `bun run verify` (full gate) at every phase boundary.
- All commands run from `/root/dev/BrowserQuest`.

---

## Phase 0 — Restore a green verify gate

> **Progress note (2026-06-09): PHASE COMPLETE.** `bun run verify` passes end-to-end (content checks, typecheck, lint, format, 627 tests, both builds) as of commit `bb368c4`. Notable deltas from the tasks below: the door-traversal/teleport-deny AND chunk-AOI failures were all stale `world`→`world_01` mock drift (the pipeline logic was correct); the preflight fail-fast behavior was intact with a drifted message (tests updated, not the server); the `never`-collapse root cause was an early `'id' in entity` guard narrowing the union to Character; the original "4 errors" baseline was a truncated capture of 8. Lint/format debt cleared across server, tests, and tools/content.

**Exit criteria:** `bun run verify` passes end-to-end on `modernize` (content checks, typecheck, lint, format, all 620 tests, both builds).

### Task 0.1: Fix TS errors in `client-simulation-system.ts` (narrowing collapses to `never`)

**Files:**
- Modify: `client/ecs/systems/client-simulation-system.ts:106-115` (predicate) and `:135-142` (call site)

**Background:** `syncRenderedWorldPosition` early-returns for `Character`, leaving `entity: NonCharacterEntity`. The guard `isInterpolatedEntity` is declared as `entity is SimulationEntity & InterpolatedEntity`; TypeScript's narrowing of the already-narrowed union collapses to `never`, so `entity.x` / `entity.y` at lines 140–141 fail with TS2339.

- [ ] **Step 1: Reproduce**

Run: `bun x tsc -p tsconfig.browser.json 2>&1 | grep client-simulation`
Expected: `client/ecs/systems/client-simulation-system.ts(140,17): error TS2339: Property 'x' does not exist on type 'never'.` (and the same for `y` at 141).

- [ ] **Step 2: Loosen the predicate parameter so narrowing intersects instead of filtering**

Replace lines 106–115:

```ts
function isInterpolatedEntity(entity: SimulationEntity): entity is SimulationEntity & InterpolatedEntity {
    const candidate = entity as unknown as Partial<InterpolatedEntity>;
```

with:

```ts
function isInterpolatedEntity(entity: unknown): entity is InterpolatedEntity {
    const candidate = entity as Partial<InterpolatedEntity>;
```

(The function body — the five `typeof` checks — is unchanged.)

- [ ] **Step 3: Verify the errors are gone**

Run: `bun x tsc -p tsconfig.browser.json`
Expected: no output, exit 0 (if other errors appear, they are pre-existing — do not fix here, report them).

- [ ] **Step 4: Run the simulation-system unit tests**

Run: `bun test tests/unit --timeout 20000 2>&1 | tail -3` (the client visual-movement and simulation tests live under `tests/unit/`)
Expected: same pass count as before the change; zero new failures.

- [ ] **Step 5: Commit**

```bash
git add client/ecs/systems/client-simulation-system.ts
git commit -m "fix(client): repair never-collapse in interpolated entity narrowing"
```

### Task 0.2: Fix TS18048 `attackerPos` possibly undefined in combat logging

**Files:**
- Modify: `server/world/ecs-command-pipeline.ts:1390`

**Background:** The `isVisible` computation (line 1362) guards `attackerPos !== undefined`, but the `combat.player_windup_started` log call inside the `isPlayerVsMob` branch dereferences `attackerPos.x` unguarded. This is a real potential crash path, not just a types nit.

- [ ] **Step 1: Reproduce**

Run: `bun x tsc -p tsconfig.node.json 2>&1 | grep ecs-command-pipeline`
Expected: `server/world/ecs-command-pipeline.ts(1390,39): error TS18048: 'attackerPos' is possibly 'undefined'.` (twice: cols 39 and 57).

- [ ] **Step 2: Guard the log field**

Replace line 1390:

```ts
                    attackerPos: { x: attackerPos.x, y: attackerPos.y },
```

with:

```ts
                    attackerPos: attackerPos === undefined ? null : { x: attackerPos.x, y: attackerPos.y },
```

- [ ] **Step 3: Verify**

Run: `bun run typecheck`
Expected: exit 0, no errors. (This command builds all referenced tsconfigs; Task 0.1 must be done first.)

- [ ] **Step 4: Run combat tests**

Run: `bun test tests/unit/mmo --timeout 20000 2>&1 | tail -3`
Expected: only the four known mmo failures (door-traversal ×1, c2s-teleport-deny ×1, chunk-aoi-snapshots ×1, chunk-resync-fallback ×1) remain — they are fixed in Tasks 0.4/0.5. No NEW failures.

- [ ] **Step 5: Commit**

```bash
git add server/world/ecs-command-pipeline.ts
git commit -m "fix(server): guard attackerPos in player windup log"
```

### Task 0.3: Clear the 24 lint errors (tools/content scripts)

**Files:**
- Modify: `tools/content/house-regenerate.ts`, `tools/content/world-map-validator.ts`, `tools/content/world-render-cluster-audit.ts`, `tools/content/world-resplit.ts`, `tools/content/world-standardize-idiomatic.ts` (plus whatever `--fix` touches)

**Background:** All 24 errors are in `tools/content/`. 17 are auto-fixable (`no-unnecessary-type-assertion`, `no-extra-boolean-cast`). The remainder are `no-unused-vars` for genuinely dead symbols: `ScalarValue` (house-regenerate.ts:7), `LegacyDoor` (:76), `computeDominantNonZeroGid` (:171), `tileSize` param (:209), `checkUniqueIdProperty` (world-map-validator.ts:976), `isVisibleLayer` (world-resplit.ts:116), `clamp` (:126). The lint script runs with `--max-warnings=0`, so the 93 warnings ALSO gate — they must reach zero in this task. Most are mechanical (`no-unnecessary-condition`, `prefer-optional-chain`, `no-non-null-assertion`, `no-unsafe-*` in the same tools scripts); fix them with `--fix` plus targeted one-line edits, never by adding eslint-disable comments.

- [ ] **Step 1: Auto-fix**

Run: `bun x eslint --fix "tools/content/**/*.ts"`
Expected: exit may still be nonzero (unused-vars are not auto-fixable); 17 errors disappear from a re-run.

- [ ] **Step 2: Delete dead symbols**

In each file, delete the unused declarations listed above entirely (do not underscore-prefix exported-looking helpers — they are file-local and dead). For the unused `tileSize` parameter in `house-regenerate.ts:209`, rename it to `_tileSize` (it is positional).

- [ ] **Step 3: Re-run lint to zero errors**

Run: `bun run lint 2>&1 | tail -3`
Expected: if warnings still fail the gate, fix remaining warnings in `tools/content/` only (most are `no-unnecessary-condition` / `prefer-optional-chain` one-liners); re-run until exit 0.

- [ ] **Step 4: Confirm tools still typecheck and the content checks still pass**

Run: `bun run typecheck:tools && bun run check:maps && bun run check:content:prefabs`
Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add tools/content/
git commit -m "chore(tools): clear lint errors in content scripts"
```

### Task 0.4: Fix door traversal + C2S teleport-deny regressions (map-id contract drift)

**Files:**
- Modify: `server/world/ecs-command-pipeline.ts` (MOVE-onto-door path, see `resolveDoorTeleportDestination` import at `:137` and call at `:2853`) and/or `server/world/ecs-command-pipeline/core-module-registry.ts:329`
- Test: `tests/unit/mmo/server-door-traversal.test.ts`, `tests/unit/mmo/server-c2s-teleport-deny.test.ts`

**Background (diagnosed):** `core-module-registry.ts:329` resolves the player's map id as `ctx.MapId.store.get(...) ?? ctx.world.getDefaultMapId?.() ?? 'world_01'`. The failing tests' host mocks answer `resolveDoorTeleport` only when `mapId === 'world'` and provide no `getDefaultMapId`, so resolution returns null and the player never teleports (`server-door-traversal.test.ts:97`). This is the `world` vs `world_01` identity drift from the external audit, live in code. **The canonical id is `world_01`** (decided in Phase 1) — fix the tests' mocks to the new contract, NOT the production default.

- [ ] **Step 1: Reproduce and confirm the hypothesis**

Run: `bun test tests/unit/mmo/server-door-traversal.test.ts 2>&1 | tail -8`
Expected: 1 pass / 1 fail, player stuck at `{x:5,y:5}`.
Then add a temporary `console.log(mapId)` inside the test host's `resolveDoorTeleport` and re-run: expected log `world_01` (proving the pipeline asks with the default id). Remove the log.
If the hypothesis does NOT hold (no call at all reaches the mock), STOP and apply `superpowers:systematic-debugging`: instrument the MOVE-onto-door path around `ecs-command-pipeline.ts:2853` (`resolveDoorTeleportDestination`) to find where the chain breaks, and record findings before changing anything.

- [ ] **Step 2: Update both test hosts to the canonical contract**

In `tests/unit/mmo/server-door-traversal.test.ts:96-101`, change the mock:

```ts
        host.resolveDoorTeleport = (mapId: string, x: number, y: number) => {
            if (mapId !== 'world_01') {
                return null;
            }
            return x === 5 && y === 5 ? { toMapId: 'world_01', to: { x: 10, y: 10 } } : null;
        };
```

Apply the same `'world'` → `'world_01'` substitution in `tests/unit/mmo/server-c2s-teleport-deny.test.ts` (same host-factory pattern).

- [ ] **Step 3: Run both test files**

Run: `bun test tests/unit/mmo/server-door-traversal.test.ts tests/unit/mmo/server-c2s-teleport-deny.test.ts 2>&1 | tail -4`
Expected: all pass. If the MOVE path (first test) still fails after the mock fix, the MOVE-onto-door resolution at `:2853` uses a different id source than the intent path — unify it to the same `MapId-component ?? getDefaultMapId() ?? 'world_01'` resolution used at `core-module-registry.ts:329`, then re-run.

- [ ] **Step 4: Grep for other test hosts pinned to `'world'`**

Run: `grep -rn "mapId !== 'world'" tests/ | grep -v world_01`
Expected: zero remaining hits; fix any found the same way.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/mmo/ server/world/
git commit -m "fix(server): align door teleport map-id contract on canonical world_01"
```

### Task 0.5: Fix chunk AOI snapshot pruning + delta resync fallback failures

**Files:**
- Test: `tests/unit/mmo/server-chunk-aoi-snapshots.test.ts:293`, `tests/unit/mmo/server-chunk-resync-fallback.test.ts:161`
- Likely modify: `server/world/ecs-command-pipeline/chunk-aoi-streaming.ts`

**Background:** Two replication invariants fail: (a) stale/out-of-window chunk state is not pruned / pending queue caps not enforced; (b) delta version gaps are not healed by snapshot resync. Root cause not yet diagnosed — this task is a debugging task; do NOT guess a fix.

- [ ] **Step 1: Reproduce with full output**

Run: `bun test tests/unit/mmo/server-chunk-aoi-snapshots.test.ts tests/unit/mmo/server-chunk-resync-fallback.test.ts 2>&1 | head -60`
Record exactly which assertion fails and the received vs expected values.

- [ ] **Step 2: Bisect against history**

Run: `git log --oneline -10 -- server/world/ecs-command-pipeline/chunk-aoi-streaming.ts tests/unit/mmo/server-chunk-aoi-snapshots.test.ts`
Then: `git stash && git checkout <previous-commit> -- server/world/ecs-command-pipeline/chunk-aoi-streaming.ts && bun test tests/unit/mmo/server-chunk-aoi-snapshots.test.ts; git checkout HEAD -- server/world/ecs-command-pipeline/chunk-aoi-streaming.ts && git stash pop`
This tells you whether the regression is in the streaming module or its callers/contracts.

- [ ] **Step 3: Apply superpowers:systematic-debugging**

Form a hypothesis from Steps 1–2, instrument, confirm, then write the minimal fix in `chunk-aoi-streaming.ts` (or wherever the bisect points). The tests are the spec: pruning must evict out-of-window chunk state and enforce the pending-queue cap; a delta arriving with a version gap must trigger a snapshot resync for that chunk.

- [ ] **Step 4: Run the full mmo suite**

Run: `bun test tests/unit/mmo --timeout 20000 2>&1 | tail -3`
Expected: 0 failures.

- [ ] **Step 5: Commit**

```bash
git add server/world/ tests/unit/mmo/
git commit -m "fix(server): restore chunk AOI pruning and delta-gap snapshot resync"
```

### Task 0.6: Restore startup preflight fail-fast on invalid map payloads

**Files:**
- Test: `tests/smoke/server/config-preflight.test.ts:118`, `tests/smoke/server/config-preflight-entry.test.ts:111`
- Likely modify: `server/startup/preflight.ts` (map_filepath schema check around `:75`)

**Background:** Both smoke tests boot the server with an intentionally malformed map JSON and expect stderr to contain `Startup preflight: map pack file has invalid schema:` followed by a fast exit. The message is no longer emitted — the server presumably proceeds (or fails differently). This is precisely the "weak fallback instead of strict validation" failure mode the external audit warns about; the fix must restore fail-fast, not relax the test.

- [ ] **Step 1: Reproduce**

Run: `bun test tests/smoke/server/config-preflight.test.ts 2>&1 | head -30`
Note what stderr the spawned server actually produced (the test harness usually captures it; if not, run the server manually against the fixture map the test writes).

- [ ] **Step 2: Trace the preflight path**

Read `server/startup/preflight.ts` and `server/runtime-map-pack-source.ts`. Identify where a raw-`world.json` source vs map-pack source is detected and where schema validation runs. The recent map-pack-source refactor (`loadRuntimeMapPackFromSource`, `runtime.ts:470`) most likely rerouted loading around the old schema check.

- [ ] **Step 3: Reinstate validation with the exact message**

Ensure the preflight validates the configured map file's payload shape before the world starts and, on failure, writes `Startup preflight: map pack file has invalid schema: <reason>` to stderr and exits nonzero. Keep the message prefix byte-identical — two tests and possibly ops tooling grep for it.

- [ ] **Step 4: Run both smoke tests**

Run: `bun test tests/smoke/server/config-preflight.test.ts tests/smoke/server/config-preflight-entry.test.ts 2>&1 | tail -4`
Expected: all pass.

- [ ] **Step 5: Full gate, then commit**

Run: `bun run verify` — expected: exit 0 (this is the Phase 0 exit criterion).

```bash
git add server/ tests/
git commit -m "fix(server): fail fast on invalid map payload in startup preflight"
```

---

## Phase 1 — Canonical map identity & strict door graph

**Exit criteria:** the server loads the map-pack config (not raw `world.json`); every door edge either resolves or is explicitly declared pending; `allow_missing_target_maps` is gone (strict by default); portal semantics no longer depend on Tiled `class` naming.

> **Progress note (2026-06-09):** Task 1.2 is done — all 7 `target_map=world` doors now reference `world_01` (commit `15f2ce4`). That commit also fixed a code bug this plan did not anticipate: `extractDoorObjects` in `shared/maps/map-pack.ts` skipped invisible layers, while the validator requires markup layers to be invisible — so the compiled door graph was always empty. The graph now compiles with 84 doors / 7 edges. Tasks 1.1, 1.3–1.5 remain.

**Decisions locked in this phase (do not relitigate downstream):**
- Canonical overworld id: **`world_01`**.
- Source of truth for the runtime map set: **`assets/maps/tiled/map-pack.config.json`**.
- House interiors are deferred to Phase 6, but the authored `target_map=house_NN` data is **preserved**, not stripped — declared via an explicit `pending_target_maps` list.

### Task 1.1: Make the map-pack compiler report dropped edges

**Files:**
- Modify: `shared/maps/map-pack.ts:533-536` (silent filter)
- Test: create `tests/unit/maps/map-pack-dropped-edges.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from 'bun:test';
import { compileMapPack } from '../../../shared/maps/map-pack';

// Minimal two-door fixture: one edge resolves, one targets a missing map.
// Build the fixture inline using the same raw-map shape the compiler consumes
// (mirror the fixture style used in existing map-pack tests under tests/unit/maps/).

test('compiling with missing target maps surfaces each dropped edge', () => {
    const result = compileMapPackFixtureWithMissingTarget(); // local helper built from existing fixtures
    expect(result.droppedEdges).toEqual([
        expect.objectContaining({ fromMapId: 'world_01', targetMapId: 'house_01' }),
    ]);
});
```

Adapt names to the real compile API in `shared/maps/map-pack.ts` (the compiler entry takes the parsed config + map sources; copy the fixture-construction helper from the nearest existing test). The contract to enforce: the compile result gains a `droppedEdges: ReadonlyArray<{ fromMapId: string; doorId: string; targetMapId: string }>` field, and the build CLI (`tools/content/map-pack.ts`) prints one line per dropped edge.

- [ ] **Step 2: Run it to confirm failure** — `bun test tests/unit/maps/map-pack-dropped-edges.test.ts` → fails (field doesn't exist).

- [ ] **Step 3: Implement** — in `shared/maps/map-pack.ts:533-536`, collect filtered edges into `droppedEdges` instead of discarding silently; thread through the compile result type. In `tools/content/map-pack.ts`, after compile, `console.warn(\`map-pack: dropped edge ${e.fromMapId}/${e.doorId} -> ${e.targetMapId} (target map not in pack)\`)` for each.

- [ ] **Step 4: Run** — the new test passes; `bun run check:maps` still exits 0 but now prints the ~40 dropped house edges + any `world` edges.

- [ ] **Step 5: Commit** — `git commit -m "feat(maps): surface dropped door edges from map-pack compile"`

### Task 1.2: Migrate `target_map=world` → `world_01` in world.json

**Files:**
- Create: `tools/content/world-canonical-map-id.ts` (one-off migration, same CLI style as siblings: dry-run by default, `--write` to apply, using `tools/shared/cli-args.ts` + `tools/shared/fs-helpers.ts`)
- Modify: `assets/maps/tiled/world.json` (via the tool)

- [ ] **Step 1: Write the migration tool.** It loads `assets/maps/tiled/world.json`, walks every object's `properties`, and rewrites `{name: "target_map", value: "world"}` → `"world_01"`. Print a per-door report (`object id, layer, old → new`). Expected hit count: **7** (from the audit). Refuse to write if hit count differs from the dry-run count.

- [ ] **Step 2: Dry run** — `bun tools/content/world-canonical-map-id.ts` → reports 7 rewrites, writes nothing. If the count is not 7, investigate before proceeding (the map may have changed).

- [ ] **Step 3: Apply** — `bun tools/content/world-canonical-map-id.ts --write`, then `bun run check:maps` → exit 0, and the dropped-edge report no longer mentions `world` (only `house_*`).

- [ ] **Step 4: Sanity-check no other `"world"` map references remain** — `grep -o '"target_map"[^}]*' assets/maps/tiled/world.json | sort | uniq -c` → only `world_01` and `house_NN` values.

- [ ] **Step 5: Commit** — `git add tools/content/world-canonical-map-id.ts assets/maps/tiled/world.json && git commit -m "fix(content): canonicalize door target_map world -> world_01"`

### Task 1.3: Replace `allow_missing_target_maps` with an explicit `pending_target_maps` allowlist

**Files:**
- Modify: `shared/maps/map-pack.ts` (config parsing + edge filtering), `tools/content/map-pack.ts:162`, `server/runtime-map-pack-source.ts:17,171`, `assets/maps/tiled/map-pack.config.json`
- Test: extend `tests/unit/maps/map-pack-dropped-edges.test.ts`

**Semantics:** an edge whose `target_map` is in `pending_target_maps` is dropped *with a notice* (intentional, interiors come in Phase 6). An edge whose target is neither in the pack nor pending **fails the compile**. The old boolean is removed everywhere — no silent mode survives.

- [ ] **Step 1: Write failing tests** for the three behaviors (pending → dropped+reported; unknown → compile error listing map id and door id; all-resolving → no errors). Same fixture helper as Task 1.1.

- [ ] **Step 2: Implement** the config field `pending_target_maps: string[]` (default `[]`), delete `allow_missing_target_maps` parsing from all three sites (`shared/maps/map-pack.ts`, `tools/content/map-pack.ts:162`, `server/runtime-map-pack-source.ts:171`), and update `assets/maps/tiled/map-pack.config.json`:

```json
{
  "maps": [{ "id": "world_01", "filepath": "./world.json" }],
  "edges": [],
  "pending_target_maps": [
    "house_01", "house_02", "house_03", "house_04", "house_05",
    "house_06", "house_07", "house_08", "house_09", "house_10",
    "house_11", "house_12", "house_13", "house_14", "house_15",
    "house_16", "house_17", "house_18", "house_19", "house_20",
    "house_21", "house_22", "house_23", "house_24", "house_25",
    "house_26", "house_27", "house_28", "house_29", "house_30",
    "house_31", "house_32", "house_33", "house_34", "house_35",
    "house_36", "house_37", "house_38", "house_39", "house_40"
  ]
}
```

(Verify the actual house ids referenced via the Task 1.2 grep — list exactly those, no more.)

- [ ] **Step 3: Run** — new tests pass; `bun run check:maps` exits 0 with 40 pending notices; introduce a deliberate typo `target_map=house_99` in a scratch copy and confirm compile fails (then discard the scratch).

- [ ] **Step 4: Full test suite** — `bun test --timeout 20000` → 0 failures (the runtime source change can affect smoke tests).

- [ ] **Step 5: Commit** — `git commit -m "feat(maps): strict door graph with explicit pending_target_maps allowlist"`

### Task 1.4: Point the server at the map-pack config

**Files:**
- Modify: `server/config.json:6`, `server/config-preflight.ts`, `server/startup/preflight.ts:75` (if it special-cases raw map JSON)
- Test: extend `tests/smoke/server/config-preflight.test.ts`

- [ ] **Step 1: Write the failing smoke assertion**: boot with `"map_filepath": "./assets/maps/tiled/map-pack.config.json"` and assert the server reaches ready (reuse the boot helper already in the smoke test file) and serves `/healthz`.

- [ ] **Step 2: Implement**: change `server/config.json` `map_filepath` to `./assets/maps/tiled/map-pack.config.json`. Confirm `loadRuntimeMapPackFromSource` (`server/runtime-map-pack-source.ts`) already accepts a pack config path — it does (it normalizes single-map sources); fix preflight if it rejects the new shape.

- [ ] **Step 3: Run** — the smoke test passes; `bun run dev:server` boots locally and `curl -s 127.0.0.1:8000/healthz` returns OK (port per `server/config.json`).

- [ ] **Step 4: Playwright sanity** — `bun run test:browser:protocol` → passes (client receives the runtime pack via `/assets/maps/runtime/map-pack.json` regardless of server-side source).

- [ ] **Step 5: Commit** — `git commit -m "feat(server): load runtime maps from map-pack config"`

### Task 1.5: Explicit portal semantics (`door_kind` property)

**Files:**
- Modify: `shared/maps/processmap.ts:847`, `assets/maps/tiled/templates/portal.tx`, `assets/maps/tiled/templates/door.tx`, `assets/maps/tiled/templates/door_linked.tx`, `tools/content/world-map-validator.ts` (target profile door rules, around the portal checks at `:713-752`)
- Test: extend the existing processmap unit tests (find via `grep -rl processmap tests/unit`)

**Contract:** every door object carries `door_kind: "door" | "portal"` as a Tiled custom property. `processmap.ts` reads the property; during a one-release migration window it falls back to `class === "Portal"` **with a deprecation warning**; the target-profile validator rejects doors missing `door_kind`.

- [ ] **Step 1: Failing test**: a door object with `door_kind=portal` and class `Door` exports `p: 1`; a door with `door_kind=door` and class `Portal` exports `p: 0`; a door with neither errors under the target validator profile.

- [ ] **Step 2: Implement** in `processmap.ts:847`:

```ts
                p: resolveDoorKind(door) === 'portal' ? 1 : 0,
```

with, near the other door helpers:

```ts
function resolveDoorKind(door: { class?: string; properties?: ReadonlyArray<{ name: string; value: unknown }> }): 'door' | 'portal' {
    const explicit = door.properties?.find((p) => p.name === 'door_kind')?.value;
    if (explicit === 'door' || explicit === 'portal') {
        return explicit;
    }
    // Migration fallback — remove once the target validator profile gates verify (Task 2.1).
    return door.class === 'Portal' ? 'portal' : 'door';
}
```

- [ ] **Step 3: Update the three `.tx` templates** to include `door_kind` (value `portal` in portal.tx, `door` in the two door templates) and add the target-profile validator rule (`world-map-validator.ts`): error `door missing door_kind property` when absent.

- [ ] **Step 4: Add `door_kind` to existing world doors** — extend `tools/content/world-canonical-map-id.ts` (or write `world-door-kind-backfill.ts`, same dry-run/--write pattern): objects using the portal template / class Portal get `door_kind=portal`, all other doors get `door_kind=door`. Dry-run, verify counts against the audit (84 doors total), `--write`, re-run `bun run check:maps`.

- [ ] **Step 5: Run all tests + commit** — `bun test --timeout 20000` → 0 failures. `git commit -m "feat(maps): explicit door_kind property replaces class-based portal detection"`

---

## Phase 2 — Validation becomes the gate

**Exit criteria:** `bun run verify` runs the strict map validator and typed-object audit; content violations fail CI; authors can *see* passability in the client.

### Task 2.1: Wire `check:world-map:target` into `verify` (and fix the content until it passes)

**Files:**
- Modify: `package.json` (`verify:modern`), `.github/workflows/verify-modern.yml`
- Likely modify: `assets/maps/tiled/world.json` via existing fix-scripts

- [ ] **Step 1: Baseline** — run `bun run check:world-map:target 2>&1 | tail -30` and save the full report to `docs/audits/world-map-target-baseline.txt` (commit it — it is the worklist).
- [ ] **Step 2: Burn down the violations** using the existing fixers first (`fix:world-standardize`, `fix:foreground-layers`, `fix:world-portals`, `fix:tileset-modernize` — all dry-run first), then targeted edits/Tiled work for the rest. Iterate: fixer dry-run → review diff → `--write` → re-run validator. Multiple commits, one per fixer applied.
- [ ] **Step 3: Add to the gate** — in `package.json`, insert into `verify:modern` after `check:maps`: `&& bun run check:world-map:target && bun run check:world-typed-objects`. Mirror in `verify-modern.yml`.
- [ ] **Step 4: Run** — `bun run verify` → exit 0.
- [ ] **Step 5: Commit** — `git commit -m "feat(ci): gate verify on strict world-map and typed-object validation"`

**Note:** if burn-down reveals a class of violation that is genuinely months of authoring (e.g. the 4,592 untyped render objects), do NOT block this task on it: encode that one class as a ratchet (validator accepts a checked-in baseline count that may only decrease — add `--baseline docs/audits/world-map-target-baseline.json` support to the validator) and file the authoring work as Phase 6 content tasks. Everything else gates absolutely.

### Task 2.2: Passability/trigger debug overlay in the client

**Files:**
- Create: `client/ecs/systems/client-debug-overlay-system.ts`
- Modify: `client/renderer.ts` (one hook: draw overlay canvas after entities), `client/game.ts` (register system), `client/main.ts` (keybind)
- Test: `tests/unit/client-debug-overlay.test.ts` (pure color-classification logic), plus a Playwright screenshot case in `tests/browser/modern-ui-smoke.playwright.ts`

**Spec:** toggled with `F3` or `?debug=overlay`. Per visible tile, fill 30%-alpha: red = `map.isColliding`, blue = water (tile metadata), purple = door/portal tile (`map` doors list), yellow = interactable (chest/NPC/resource occupancy from the kernel), green = otherwise walkable. Classification lives in a pure function `classifyTileForOverlay(map, kernel, x, y): OverlayColor` so it is unit-testable without a canvas; the system only iterates camera-visible tiles and draws.

- [ ] **Step 1:** failing unit test for `classifyTileForOverlay` (door tile → purple beats green; colliding → red beats all).
- [ ] **Step 2:** implement classification + system + renderer hook + keybind.
- [ ] **Step 3:** Playwright: boot, press F3, screenshot, assert the overlay canvas is non-empty (pixel sample), F3 again → empty.
- [ ] **Step 4:** `bun run verify && bun run test:browser:modern` → green.
- [ ] **Step 5:** `git commit -m "feat(client): passability and trigger debug overlay"`

### Task 2.3: Reachability checks in the validator

**Files:**
- Modify: `tools/content/world-map-validator.ts` (target profile)
- Test: extend its existing test file (locate via `grep -rl world-map-validator tests/`; if none exists, create `tests/unit/tools/world-map-validator-reachability.test.ts` with small synthetic map fixtures)

**Spec (from both audits):** target profile errors when — a door tile is itself colliding; a door's destination tile is colliding or outside the map; a checkpoint/spawn tile is colliding; a chest spawn or resource node sits on a colliding tile; a roaming area contains zero walkable tiles. Use the same collision derivation the runtime uses (`shared/maps/processmap.ts` output), not a parallel re-implementation.

- [ ] Steps: failing fixture tests per rule → implement rules → run validator against the real world (`bun run check:world-map:target`) → fix any real content hits → commit `feat(tools): reachability validation for doors, spawns, chests, resources`.

---

## Phase 3 — Server resilience & security hardening

**Exit criteria:** a malformed or throwing intent cannot take the world down; multi-statement persistence is transactional; restarts don't log everyone out; abandoned WebAuthn challenges don't accumulate.

### Task 3.1: Error boundaries around intent handlers and systems

**Files:**
- Modify: `server/world/ecs-command-pipeline.ts` (command dispatch loop), `server/ecs/scheduler.ts:~40-85` (system run loop)
- Test: `tests/unit/mmo/server-pipeline-error-boundary.test.ts`

- [ ] **Step 1: Failing test** (reuse the host-factory pattern from `server-door-traversal.test.ts`):

```ts
test('a throwing intent handler is isolated: logged, dropped, world keeps ticking', () => {
    // register a handler that throws, enqueue its intent, tick
    // assert: tick() does not throw; a structured log event 'pipeline.intent_handler_error' fired;
    // a subsequent normal MOVE intent still applies.
});
test('a throwing system is isolated per tick and re-runs next tick', () => { /* same shape via scheduler */ });
```

- [ ] **Step 2: Implement**: wrap each intent-handler invocation and each scheduled system call in try/catch; on catch, `log.event('error', 'pipeline.intent_handler_error', { intentTypeId, playerId, error: String(err) })` (resp. `'pipeline.system_error'`), drop the one command, continue the tick. Add a per-connection strike counter: ≥3 handler errors from one connection within 60s → close that connection with the protocol's error close code (see `tests/unit/ws/` close-codes contract test for the right code).
- [ ] **Step 3: Run** new tests + full mmo suite → green.
- [ ] **Step 4:** `bun run verify` → green.
- [ ] **Step 5:** `git commit -m "feat(server): per-handler and per-system error boundaries in ECS pipeline"`

### Task 3.2: Transactions for multi-statement persistence

**Files:**
- Modify: `server/player-persistence.ts` (session claim ~`:570-629`, profile upsert + achievement writes), `server/claims-persistence.ts` (upsert/delete)
- Test: extend `tests/unit/.../server-player-persistence.test.ts` and `server-claims-store.test.ts` (locate with `grep -rl player-persistence tests/`)

- [ ] **Step 1: Failing tests**: (a) session claim that fails mid-way (force by passing a poisoned statement via a fault-injection seam — add an optional `onBeforeCommitForTest` hook) leaves no partial rows; (b) claim upsert is atomic across the claims row + index updates.
- [ ] **Step 2: Implement** with `bun:sqlite`'s transaction API:

```ts
const claimSessionTx = this.db.transaction((args: ClaimArgs) => {
    // existing statements, unchanged, executed inside the transaction
});
```

Convert: session claim/release, profile-create + initial achievement rows, achievement progress + unlock pairs, claims upsert/delete. Single-statement writes stay as they are.
- [ ] **Step 3–5:** run targeted tests → full suite → commit `feat(server): transactional multi-statement persistence`.

### Task 3.3: Persistent auth session secret

**Files:**
- Modify: `server/auth-session.ts:29` (secret resolution)
- Test: `tests/unit/auth-session.test.ts` (exists — extend)

**Spec:** resolution order becomes (1) `BQ_AUTH_SESSION_SECRET` env; (2) `server/.data/auth-session-secret` file (0600, created with 32 random bytes on first boot); (3) only if the data dir is unwritable: ephemeral + `log.event('warn', 'auth.ephemeral_session_secret', …)`. Memory-backed test configs keep using injected secrets.

- [ ] Steps: failing test (two resolver instances against the same data dir produce tokens that cross-verify) → implement file-backed secret with `node:fs` (mode 0o600, `mkdirSync recursive` like the persistence modules) → run auth tests + smoke suite → commit `feat(auth): persist session secret across restarts`.

### Task 3.4: WebAuthn challenge expiry sweep

**Files:**
- Modify: `server/passkey-auth.ts:59-60` (pending challenge map)
- Test: extend `tests/unit/passkey-auth.test.ts`

- [ ] Steps: failing test (insert challenge, advance injected clock past the 5-min TTL, trigger sweep, map size is 0 — add a `now()` seam if the module uses `Date.now()` directly) → implement a 60s `setInterval` sweep registered/disposed with the auth handler lifecycle (mirror how flush schedulers are disposed in `chunk-overlay-persistence.ts`) → run tests → commit `fix(auth): sweep expired webauthn challenges`.

---

## Phase 4 — Dependency, docs, and gate hygiene

**Exit criteria:** no unmaintained runtime deps; docs say what is true; formatting gate is meaningful.

### Task 4.1: Replace `memcache@1.3.0` with `memjs`

**Files:**
- Modify: `server/metrics-client.ts:26-31` (adapter), `server/metrics.ts:1`, `server/metrics-runtime.ts`, `package.json`, `types/memcache.d.ts` (delete)
- Test: existing metrics unit tests + `verify-metrics-healthy.yml` lane

- [ ] Steps: the `MemcacheModuleShape` abstraction already isolates the client — write/extend the unit test against the interface, swap the adapter to `memjs` (maintained, same get/set surface), `bun add memjs && bun remove memcache`, delete `types/memcache.d.ts`, run `bun run test:metrics:healthy` against a local memcached if available (`docker run --rm -d -p 11211:11211 memcached:1.6-alpine`) else rely on the manual CI lane, commit `chore(server): replace unmaintained memcache with memjs`.

### Task 4.2: Drop unused `ajv` devDependency

- [ ] `grep -rn "from 'ajv'\|require('ajv')" client server shared tools tests` → expect zero hits → `bun remove ajv` → `bun run verify` → commit `chore(deps): remove unused ajv`.

### Task 4.3: Make `format:check` either real or gone

**Files:** `package.json:70-71`, possibly `.prettierignore`

- [ ] **Decision (locked):** expand, don't delete. Run `bun x prettier --check "client/**/*.ts" "server/**/*.ts" "shared/**/*.ts" "tools/**/*.ts" "tests/**/*.ts"` to measure the diff blast radius. If reformat churn is acceptable (review `git diff --stat` after `--write` on a branch), adopt repo-wide prettier in one isolated commit (`style: repo-wide prettier adoption`) + update both scripts. If the churn collides with in-flight branches, scope to `server/ shared/ tools/ tests/` now and client after Phase 5's client refactors land. Either way the script must cover whole directories, not 8 files.

### Task 4.4: Documentation truth pass

**Files:** `README.md`, `docs/` (add `docs/README.md` index), `package.json` engines

- [ ] Update README: (1) state plainly that the server is **Bun-only** (`Bun.serve`, `bun:sqlite`) and Node is used for tooling compatibility only; widen engines to `"node": ">=22"` or drop the node engines pin entirely since nothing production runs on Node; (2) document that Playwright browser tests are a separate lane (`test:browser:modern`) not included in `verify`; (3) document the metrics/memcached setup (`BQ_TEST_METRICS_HEALTH=1`, service on 11211) and the new `BQ_AUTH_SESSION_SECRET` / secret-file behavior (Task 3.3); (4) document `tools/` layout: durable (build, admin, bots, bench, dev, metrics) vs one-off content migrations; (5) add `docs/README.md` indexing the audit/protocol/logging docs; (6) document the deployment artifact story: `build:bundle` (client build + server build + `tools/build/bundle.ts`) is the intentional ship path — describe what it emits and how to run the result under Bun (external audit BQ-TECH-004). Also update README's project framing to the co-op (16–64) target so contributors stop building for 2000 players. Commit `docs: align README and docs index with Bun-only runtime and co-op target`.

### Task 4.5: Delete stray `bin/build.txt` and archive `EXTERNAL-AUDIT.md`

- [ ] `git rm bin/build.txt` (stale build log); move `EXTERNAL-AUDIT.md` → `docs/audits/2026-06-external-audit.md` and commit it (it is referenced by this plan); commit `chore: tidy stray artifacts, archive external audit under docs/audits`.

---

## Phase 5 — Decomposition (continue what's started)

**Exit criteria:** no server file > 2,000 lines; all character *and non-character* entity visuals flow through the visual bridge; renderer consumes a defined interface.

### Task 5.1: Extract combat out of `ecs-command-pipeline.ts`

**Files:**
- Create: `server/world/ecs-command-pipeline/combat-engagements.ts`
- Modify: `server/world/ecs-command-pipeline.ts` (3,768 lines today)

The submodule pattern already exists (`chunk-aoi-streaming.ts`, `core-module-registry.ts`, `claim-intents.ts`, `interest-replication.ts`). Move the engagement/windup/damage loop (the region around `:1355-1414` and its helpers `buildAttackAction`, `resolveAttackCooldownTicks`, `resolveAttackWindupTicks`, hit application) behind the same options-injection style used by `core-module-registry.ts`.

- [ ] Steps: identify the exact function boundaries with `grep -n "function \|^const " server/world/ecs-command-pipeline.ts | sed -n '...'`; move code verbatim (no behavior change — this is a pure extraction, tests are the safety net); imports updated; `bun test tests/unit/mmo --timeout 20000` must be byte-identical in pass count; commit `refactor(server): extract combat engagements module from command pipeline`. Repeat the same recipe in follow-up commits for loot/equipment and movement-intent regions until the pipeline file is < 2,000 lines (orchestration + registration only).

### Task 5.2: Route non-character entities through the visual bridge (client ticket 768)

**Files:**
- Modify: `client/ecs/visual-movement-bridge.ts`, `client/ecs/systems/client-simulation-system.ts` (the `NonCharacterEntity` fade/movement block), `client/ecs/systems/client-command-apply-system.ts` (direct render-state mutations)
- Test: extend `tests/unit/` visual-movement tests (locate: `ls tests/unit | grep visual`)

- [ ] Steps: add `bridgeEntityRenderPosition(entity, …)` covering items/chests/projectile-like entities; replace direct `entity.x/.y` render mutations found via `grep -n "setDirty()" client/ecs/systems/client-command-apply-system.ts` context lines; failing test first for one representative entity kind (item drop animates via bridge state, not direct mutation); commit `refactor(client): route non-character visuals through the bridge (ticket 768)`.

### Task 5.3: Renderer interface seam (precondition for any future Pixi/Phaser evaluation)

**Files:**
- Create: `client/render/renderer-contract.ts` (interface: `resize, setScale, renderStaticCanvases, drawFrame(view), getTileBoundingRect, FPS/mobile/tablet/scale` — derive the exact member list from `grep -n "renderer\." client/game.ts | sort -u`)
- Modify: `client/game.ts` to depend on the interface; `client/renderer.ts` implements it.

- [ ] Steps: generate the call-surface list from game.ts; declare the interface; `implements` it on the existing Renderer (zero behavior change); typecheck is the test here plus the Playwright smoke lane; commit `refactor(client): renderer behind explicit contract`. **Per both audits: do NOT replace the renderer.** This task only creates the seam.

---

## Phase 6 — Real interiors (multi-map)

> Expand into its own plan (superpowers:writing-plans) when Phase 5 completes. The specification below is binding.

**Exit criteria:** at least `house_01` is a real map in the pack; its doors round-trip (enter/exit) under a Playwright test; `pending_target_maps` shrinks monotonically; a Tiled `.world` file exists for multi-map editing.

**Specification:**
1. **Interior template** — author `assets/maps/tiled/maps/house_interior_template.json` (Tiled, 16×16 tiles, ~15×12 size): floor/wall layers per the layer contract, one `door_linked` object back to `world_01` with `door_kind=door`, matching `door_id`/`target_door` pair, plus `checkpoint` and optional `chest_spawn`. Reuse the existing tileset (`tilesheet.wang.tsj`).
2. **Generator** — finish `tools/content/house-regenerate.ts` (exists, currently lints-clean after Task 0.3): given a house id and the world-side door object, stamp a copy of the template, set both doors' `target_map`/`target_door` symmetrically. Dry-run/--write CLI like its siblings.
3. **Pack compilation** — add each generated map to `map-pack.config.json` `maps[]` and remove its id from `pending_target_maps` in the same commit; `check:maps` enforces the edge symmetry added in Task 1.3 (extend: every cross-map edge must have a reverse edge unless the door object carries `one_way=true`).
4. **Runtime** — the server already keys chunk overlays and claims by `map_id`, the pipeline resolves per-entity `MapId`, and the client map source caches multiple decoded maps (`client/map-source.ts` validates a `maps` array) — so the runtime work is: spawn-position routing on TELEPORT across maps, AOI/interest scoping by map id (verify with a two-players-two-maps unit test: player in `house_01` must NOT receive spawns from `world_01`), and client map switching on TELEPORT with a loading fade (extend `client/ecs/systems/client-door-portal-system.ts`).
5. **Editing** — add `assets/maps/tiled/browserquest.world` listing `world_01` + houses; register in `browserquest.tiled-project`.
6. **Tests** — unit: cross-map TELEPORT moves MapId component + despawns from old map's interest set; Playwright: extend `tests/browser/modern-door-roundtrip.playwright.ts` to walk into `house_01` and back, asserting position and visible-entity reset.
7. **Rollout** — one pair first (`house_01`), verify, then batch-generate the remaining 39 with the generator; each batch shrinks `pending_target_maps`.

---

## Phase 7 — Co-op gameplay MVP (Stardew-like loop)

> Each numbered feature below becomes its own plan document when picked up, in this order. The specification is binding; the order maximizes "playable with friends" per unit of work. Scale target for ALL of it: 16–64 concurrent players, one Bun process, 30 UPS. No sharding, no cross-world migration, no MMO anti-cheat — reject scope that serves only >100-player cases.

**Existing leverage (do not rebuild):** chunk overlays (`server/chunk-overlay-persistence.ts`, versioned 32×32 blobs with flush scheduler) are the substrate for tile state (tilled/watered/crop stage); land claims + editors (`server/world/claims/claims-store.ts`, `tools/admin/claims.ts`) are the farm-permission system; the INTENT/ACK/REJECT/CORRECTION envelope (`shared/protocol/manifest.ts`, opcodes INTENT=…/OUTCOME/REJECT/ACK) carries new intent type-ids without new opcodes; chat, achievements, checkpoints, chests, doors already work end-to-end.

1. **World clock & scheduled growth.** Server-side day cycle (config: `day_length_minutes`, default 20 real minutes) ticked by the slow lane of the update loop; broadcast `TIME` via a new S2C action in the manifest (follow the existing pattern: add to `shared/protocol/manifest.ts` + schema + compile-time coverage keeps client/server honest). Crop/resource growth advances on day boundaries via a scheduled task queue persisted in a new `world_schedule` SQLite table (so restarts don't lose pending growth). Client: sky tint overlay + clock UI.
2. **Inventory & items (data-driven).** New `assets/content/items.json` (id, name, stackable, max_stack, kind: tool|seed|crop|material|equipment, sprite, sell/buy price) validated by a new `check:content:items` script in `verify` (extend `entity-kind-domain.ts` mechanically from content at build time rather than hand-editing the enum). Server: `inventories` table (name_key, slot, item_id, qty) with transactional moves (Task 3.2 pattern); intents `inventory.move`, `item.pickup`, `item.drop`; full-inventory REJECT path. Client: hotbar + bag UI (extend the parchment/UI layer in `app.ts`).
3. **Chest storage v2.** Promote chests from loot-bags to persistent shared containers: `chest_contents` table keyed by chest id + map_id; open/close/deposit/withdraw intents with optimistic-locking REJECT on concurrent mutation (two friends at one chest is the canonical test).
4. **Tools & farming.** Tool items (hoe, watering can, axe, pickaxe) gate intents `tile.till`, `tile.water`, `crop.plant`, `crop.harvest`. Tile states live in chunk overlays (new overlay channels: soil state, moisture, crop id + stage); growth advances via the world-clock schedule; claims gate who may till/plant on claimed land (already enforced for tile edits — extend the same check). `assets/content/crops.json` (seed item, stages, days per stage, yield, regrow). Client: overlay-driven soil/crop rendering via the existing chunk delta path (CHUNK_DELTA already streams overlay changes), tool-use animation via the visual bridge.
5. **Resource nodes.** The `resource_nodes` object class already exists in `processmap.ts` strict classes — implement server respawning harvest state (`resource_nodes` table: node id, map, depleted_until), `resource.harvest` intent requiring the right tool, yields to inventory, scheduled respawn via world clock.
6. **NPC dialogue & shops.** `assets/content/npcs.json` (dialogue lines, shop inventory referencing items.json with prices). Intents `npc.talk` (returns dialogue page), `shop.buy`/`shop.sell` (transactional against inventory + a `currency` column on players). Static dialogue first; schedules later or never.
7. **Mines & combat loop polish.** Reuse existing mob/combat systems; author `mine_01` map (Phase 6 machinery) with ladder-style door chain, per-floor roaming areas, shared loot drops to inventory, respawn on checkpoint. No new combat mechanics in MVP.
8. **Social.** Chat exists; add emote intent + bubble rendering, `/who` UI from the existing WHO action, and claim-editor invitations (`claim.invite` intent wrapping the existing editors_json model).

**MVP acceptance (from EXTERNAL-AUDIT.md, kept verbatim as the bar):** join, create/load character, spawn, walk with friends, chat, enter/exit houses and caves, collect resources, farm crops, use tools, store items in chests, buy/sell at shops, fight simple mobs in mines, and have everything survive a server restart.

---

## Phase 8 — Client DX (deliberately last)

> Expand when picked up. Cheap wins first; the big migration only if justified.

1. **Sourcemaps now** — add `sourcemap: 'linked'` to `tools/dev/build-client-for-bun.ts` and `tools/build/client.ts` Bun.build options (one-line each; verify stack traces in DevTools). Do this immediately when any client work starts; it needs no plan.
2. **Watch-mode rebuild** — wrap `dev:bun:full` with a file-watcher rebuild of the client bundle (Bun `--watch` already restarts the server; add `fs.watch` over `client/` in `build-client-for-bun.ts` behind a `--watch` flag) + browser auto-reload via a dev-only WS ping. This closes most of the no-HMR pain at trivial cost.
3. **Vite evaluation gate** — only AFTER Phases 0–6: timebox a 1-day spike branch moving `home.ts` to Vite dev server with the Bun server proxied. Adopt only if the spike shows materially better DX than item 2 *and* Playwright lanes pass unchanged. Otherwise document "why Bun.build remains" in README and close the question (external audit's BQ-TECH-003 answered either way).

---

## Acceptance criteria (whole plan)

Merged from EXTERNAL-AUDIT.md and the internal audit — the project is "done" with this plan when:

- [ ] `bun run verify` is green and includes strict map validation (target profile + typed objects + reachability).
- [ ] Server loads `map-pack.config.json`; map ids are consistent (`world_01`); no silent edge dropping exists in any mode; every linked door resolves or is explicitly pending, and `pending_target_maps` is empty.
- [ ] Portal/door behavior is property-driven (`door_kind`), validated, and round-trips in Playwright.
- [ ] A throwing intent/system cannot crash the world; multi-statement persistence is transactional; restarts preserve sessions; no unmaintained runtime dependencies.
- [ ] No server file exceeds 2,000 lines; client visuals (all entity kinds) flow through the visual bridge; renderer sits behind a contract.
- [ ] Interiors are real maps; debug overlay shows passability/triggers; client and server collision agree (existing parity test stays green).
- [ ] The gameplay MVP acceptance list (Phase 7) passes in a live two-player session, and survives `SIGTERM` + restart with state intact.
- [ ] README tells the truth: Bun-only runtime, co-op 16–64 target, test-lane layout, metrics and auth-secret configuration.

## Explicit non-goals (rejected scope)

- 2000-player shards, zone migration, distributed anything, heavyweight anti-cheat (the protocol's existing validation + rate limiting is the ceiling).
- Renderer replacement (Pixi/Phaser) — only the Phase 5.3 seam.
- Protocol rewrite — FixedBin v2 stays; new gameplay rides INTENT type-ids and a handful of new manifest actions.
- Stripping authored `house_*` door data — it is preserved via `pending_target_maps` and consumed by Phase 6.
