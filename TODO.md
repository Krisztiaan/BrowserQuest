# TODO Backlog (Merged from `review-*.md`)

Last merged: 2026-02-10
Status legend: `todo` | `in_progress` | `done` | `blocked`

## How to Use This Backlog

- Keep one issue per ticket below.
- Keep implementation details in PR threads.
- Keep architecture decisions in an ADR-style comment in the ticket and link it in the PR.
- Do not mark a ticket `done` until the listed verification passes.

## Discussion Lanes (Where We Should Be Discussing)

- Architecture and boundary changes: ticket issue thread + explicit ADR note in that issue.
- Product/UX direction (visual style, Classic vs Enhanced rendering): dedicated design discussion issue before implementation.
- Operational/deployment policy (artifact model, containerization, env config): infra ticket issue, with final policy copied to `README.md` / `server/README.md`.
- Code-level implementation choices: PR thread only.
- Regressions and release risk: release checklist issue tied to verify lane output.

## Outstanding Workboard (Actionable Order)

1. Ticket 7 (`P2`, `in_progress`) - Server/client decomposition of god objects
   - Precondition:
     - Open architecture issue and define first extraction seam (recommend: Player session layer boundary).
2. Ticket 8 (`P2`, `todo`) - Content canonicalization + data-driven authoring
   - Precondition:
     - Define canonical content source schema and generator contract before implementation.
3. Ticket 11 (`P2`, `todo`) - Operational hardening + health surfaces
   - First executable slice:
     - Define `/healthz` and `/version` contract and shutdown behavior acceptance test.
4. Ticket 12 (`P2`, `todo`) - Rendering modernization track
   - Product-gated:
     - Requires product/design decision issue before technical implementation slices.

## Ticket 1: Runtime/Tools Boundary + Map Asset Boundary

- Status: `done`
- Priority: P0
- Scope:
  - Move runtime map processor out of `tools/` into runtime/shared path.
  - Update runtime imports in server and client.
  - Stop default runtime map path from pointing to a tooling directory.
- Out of scope:
  - Full map format redesign.
- Acceptance criteria:
  - No runtime import path under `tools/**` from client/server runtime code.
  - Default server config points to runtime asset location.
- Verification:
  - `bun run typecheck`
  - `bun run build:vite`
  - `bun run test:modern-parity`
- Dependencies/blockers:
  - None.
- Discussion venue:
  - Architecture issue (boundary decision + final canonical paths).

## Ticket 2: Deployment Truth and Single Artifact Definition

- Status: `done`
- Priority: P0
- Scope:
  - Make deployment docs match real runtime dependencies.
  - Define `build:server` and `build:bundle` artifact contract.
  - Decide single-origin serving vs split origin as default model.
  - Resolve client runtime host config toward same-origin default and retire legacy host injection path.
  - Define canonical static asset root/layout for runtime and deployment.
- Out of scope:
  - Full production platform migration.
- Acceptance criteria:
  - One documented command path produces a runnable deploy artifact.
  - `README.md` and `server/README.md` agree on required files and run command.
  - Same-origin runtime path works without `BQ_LOCAL_CONFIG` injection hacks.
  - Asset root decision is explicit (including cache and CORS policy notes).
- Verification:
  - `bun run build:vite`
  - `bun run start:server` from artifact layout
- Dependencies/blockers:
  - Depends on Ticket 1 path decisions.
- Discussion venue:
  - Infra/deployment issue; decision summary copied into READMEs.

## Ticket 3: Remove Dead/Legacy Protocol Paths (BISON, SPAWN_BATCH, format-esm)

- Status: `done`
- Priority: P0
- Scope:
  - Remove BISON toggles and dead paths in client/server runtime.
  - Remove dead `SPAWN_BATCH` handling if server does not emit it.
  - Remove `server/js/format-esm.ts` compatibility path and parity-only tests.
  - Collapse remaining ESM wrapper/parity shims that only preserve transitional dual paths.
- Out of scope:
  - Protocol feature additions.
- Acceptance criteria:
  - No dead branches remain for unsupported protocol modes.
  - Runtime/tests use single active server format validator.
  - Transitional wrapper-only modules are removed or justified.
- Verification:
  - `bun run test:ws:runtime:parity`
  - `bun run test`
- Dependencies/blockers:
  - None.
- Discussion venue:
  - PR thread unless backward compatibility concerns appear; then open architecture issue.

## Ticket 4: Canonical Protocol + Gametype Source of Truth

- Status: `done`
- Priority: P1
- Scope:
  - Introduce canonical message/opcode constants.
  - Derive protocol validators/types from shared schema source.
  - Normalize `gametypes` entrypoint and remove drift wrappers.
  - Add canonical `shared/js/gametypes.ts` entrypoint and route imports through it.
- Out of scope:
  - Rewriting all gameplay systems.
- Acceptance criteria:
  - Phase A (done): runtime/tests import canonical `shared/js/gametypes.ts` and drift wrappers are removed.
  - Phase B (done): client/server validation logic references shared canonical schema/constants.
  - Phase B (done): no duplicate opcode literals in separate validation paths.
- Verification:
  - `bun run typecheck`
  - `bun run test`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - Ticket 3 simplifies cleanup first.
- Discussion venue:
  - Architecture issue with schema design proposal before coding.

## Ticket 5: Type Safety Migration (Surgical Strict Zones)

- Status: `done`
- Priority: P1
- Scope:
  - Add strict TS configs for selected modules (shared + modern server path first).
  - Remove `[key: string]: any` in top offenders through explicit fields.
  - Align `ServerConfig` type with runtime preflight behavior.
  - Standardize module export style to reduce `as unknown as` interop probes.
- Out of scope:
  - Whole-repo strict migration in one pass.
- Acceptance criteria:
  - Strict projects compile cleanly.
  - Config typing cannot express runtime-invalid defaults.
- Verification:
  - `bun run typecheck`
  - strict project `tsc -p` command(s)
- Dependencies/blockers:
  - None.
- Discussion venue:
  - Architecture issue for strict-zone boundaries; implementation in PRs.

## Ticket 6: Server Runtime Performance Hotspots

- Status: `done`
- Priority: P1
- Scope:
  - Remove per-tick array reallocations in hot loops.
  - Apply serialize-once fanout where payload is identical and immutable.
  - Evaluate `Map`/`Set` substitution in high-churn collections.
  - Modernize UTF-8 truncation utility and logging helper plumbing where low-risk.
- Out of scope:
  - Broad gameplay behavior changes.
- Acceptance criteria:
  - Hot paths avoid avoidable per-tick allocations.
  - No protocol behavior change in parity/smoke tests.
  - Before/after profiling notes are captured for implemented hotspots.
  - `Map`/`Set` substitution decision is documented (implemented or rejected with rationale).
- Verification:
  - `bun run test:modern-parity`
  - `bun run test`
- Dependencies/blockers:
  - None.
- Discussion venue:
  - PR thread with before/after profiling notes.

## Ticket 7: Server/Client Decomposition of God Objects

- Status: `in_progress`
- Priority: P2
- Scope:
  - Extract `Player` protocol/session handling into dedicated session layer.
  - Slice `WorldServer` into coarse subsystems.
  - Slice `Game` into state/network/input/render/UI/audio systems.
  - Decouple gameplay/domain methods from protocol message construction boundaries.
  - Retire shadow-contract scaffolding made redundant by explicit typed subsystems.
- Out of scope:
  - Public protocol redesign.
- Acceptance criteria:
  - Existing behavior and public runtime entrypoints preserved.
  - Large orchestrators reduced to coordination role.
- Verification:
  - `bun run verify:modern`
- Dependencies/blockers:
  - Benefits from Tickets 3-5 completed first.
- Discussion venue:
  - Architecture issue first, then phased implementation PRs.

## Ticket 8: Content Canonicalization + Data-Driven Authoring

- Status: `todo`
- Priority: P2
- Scope:
  - Define canonical content sources (entities/mobs/drops/etc.).
  - Add generation/validation scripts to produce runtime mappings.
  - Move hardcoded balance tables toward data files.
  - Add fast validation checks for content/map authoring errors pre-runtime.
- Out of scope:
  - New gameplay systems.
- Acceptance criteria:
  - Adding an entity/mob requires one canonical content edit + generator run.
  - CI detects drift between generated and committed outputs.
- Verification:
  - generator + validation script
  - `bun run test:modern-parity`
- Dependencies/blockers:
  - Ticket 4 canonical schema work helps.
- Discussion venue:
  - Content model discussion issue before generator contracts are frozen.

## Ticket 9: Dev Loop + CI Correctness and Speed

- Status: `done`
- Priority: P1
- Scope:
  - Fix workflow path filters that reference non-existent file extensions/paths.
  - Fix browser test runtime command/config drift (entrypoint mismatch).
  - Add server auto-restart/watch to full-stack dev loop.
  - Improve caching in CI (bun + Playwright browsers).
  - Expand lint/format coverage (or codify explicit legacy exclusions).
- Out of scope:
  - New test suites.
- Acceptance criteria:
  - Relevant workflow triggers fire on real changed files.
  - Local dev loop reflects server code changes without manual restarts.
- Verification:
  - Workflow dry-run / changed-path validation
  - `bun run dev` manual smoke
- Dependencies/blockers:
  - None.
- Discussion venue:
  - CI/infra issue; PRs for each workflow/dev-tool adjustment.

## Ticket 10: Runtime Config and Metrics Reproducibility

- Status: `done`
- Priority: P1
- Scope:
  - Make metrics dependency reproducible from lockfile.
  - Replace ad-hoc optional install behavior in CI.
  - Standardize env-overrides for runtime config where appropriate.
- Out of scope:
  - External metrics platform migration.
- Acceptance criteria:
  - Metrics-enabled path works from repo lockfile + documented config.
  - CI does not install runtime deps ad-hoc with `--no-save`.
- Verification:
  - metrics workflow run
  - `bun run check:metrics:healthy-prereqs`
- Dependencies/blockers:
  - None.
- Discussion venue:
  - Infra issue with explicit dependency policy decision.

## Ticket 11: Operational Hardening + Runtime Health Surfaces

- Status: `todo`
- Priority: P2
- Scope:
  - Add graceful SIGTERM/SIGINT shutdown behavior for server runtime.
  - Add `/healthz` and `/version` endpoints (or explicitly extend `/status` contract).
  - Ensure artifact/container runtime probes have stable health/version signals.
- Out of scope:
  - Full orchestration platform migration.
- Acceptance criteria:
  - Controlled shutdown behavior is documented and testable.
  - Health/version probes are available and stable.
- Verification:
  - shutdown smoke test
  - health endpoint smoke test
- Dependencies/blockers:
  - None.
- Discussion venue:
  - Infra issue (runtime operability contract).

## Ticket 12: Rendering Modernization Track (Optional Product Track)

- Status: `todo`
- Priority: P2
- Scope:
  - Modernize smoothing/scale detection and decouple silhouette support.
  - Add renderer backend interface (Canvas baseline + optional GPU backend).
  - Add Enhanced-mode FX track (hurt flash/outline/particles) incrementally.
- Out of scope:
  - Mandatory migration to a new rendering engine in one release.
- Acceptance criteria:
  - Classic mode parity preserved.
  - Enhanced mode is optional and feature-flagged.
- Verification:
  - `bun run test:browser:modern`
  - visual/manual QA checklist
- Dependencies/blockers:
  - None.
- Discussion venue:
  - Product/design discussion issue first; then technical implementation tickets.

## Merge Notes (Conceptual Deduping Applied)

- Merged repeated map-boundary findings from all five reviews into Ticket 1.
- Merged deployment artifact + docs + same-origin config drift into Ticket 2.
- Merged BISON/SPAWN_BATCH/format-esm cleanup into Ticket 3.
- Merged protocol and gametype drift concerns into Ticket 4.
- Merged strict-mode + `any` + config typing inconsistencies into Ticket 5.
- Kept rendering modernization as optional product track (Ticket 12) to avoid blocking core reliability work.

## Review Coverage Ledger (Delete-Readiness)

`review-granit.md`

- Runtime imports from `tools/`, map/source packaging drift: Ticket 1, Ticket 2.
- Hot-loop allocation and fanout serialization inefficiency: Ticket 6.
- Dead protocol branches (`BISON`, `SPAWN_BATCH`), `format-esm` parity drift: Ticket 3.
- Protocol/gametype single source and opcode constants: Ticket 4.
- Typed core classes, strict migration, shadow-contract removal: Ticket 5, Ticket 7.
- Client/server god-object slicing: Ticket 7.
- Missing/default map artifact risk: Ticket 1.

`review-jade.md`

- Runtime/tools boundary and map path normalization: Ticket 1, Ticket 2.
- Canonical `shared/js/gametypes.ts` and wrapper cleanup: Ticket 4, Ticket 3.
- Remove `format-esm` legacy path: Ticket 3.
- Strict-zone rollout, index-signature removal, config typing: Ticket 5.
- Export style unification to reduce `as unknown as` interop: Ticket 5.
- Unified shared protocol schema and validation: Ticket 4.
- `Map`/`Set` hot-path modernization + UTF-8 utils cleanup: Ticket 6.
- Workflow path fixes + lint/format coverage decisions: Ticket 9.

`review-sun.md`

- Runtime/tools boundary and deployment doc drift: Ticket 1, Ticket 2.
- Same-origin websocket config and removal of legacy injection path: Ticket 2.
- Build artifact definition and optional container path: Ticket 2.
- Metrics dependency reproducibility from lockfile: Ticket 10.
- CI trigger/config mismatch and performance caching: Ticket 9.
- Asset-root/cache/CORS policy standardization: Ticket 2.
- Operational health/shutdown surfaces: Ticket 11.

`review-xilit.md`

- Runtime/tools boundary and map asset placement: Ticket 1.
- Domain/protocol entanglement and session layer extraction: Ticket 7.
- God-object decomposition (`WorldServer`, `Game`): Ticket 7.
- Content canonicalization + codegen + data-driven balance: Ticket 8.
- Strict TypeScript surgical rollout: Ticket 5.
- Dev loop server restart + lint/validation streamlining: Ticket 9, Ticket 8.

`review-sugar.md`

- Scaling/smoothing modernization and silhouette decoupling: Ticket 12.
- Renderer backend abstraction and optional Pixi track: Ticket 12.
- Shader/tint replacement for CPU pixel effects and FX system: Ticket 12.
- Map-driven visual metadata (emitters/lights/biome FX): Ticket 12.
- Enhanced-mode optionality and product design gating: Ticket 12.

Coverage status: all actionable review themes are mapped to a ticket with a discussion venue.

## Execution Log

### 2026-02-10 12:37 CET — Ticket 1

- Status: `done`
- Key actions:
  - Moved runtime map processor to `shared/js/maps/processmap.ts`.
  - Rewired runtime imports in `server/js/map.ts` and `client/js-esm/map-source.ts`.
  - Moved canonical Tiled source from `tools/maps/tiled/**` to `assets/maps/tiled/**`.
  - Updated default runtime map path in `server/config.json` and all map-path smoke/unit fixtures.
- Evidence:
  - `bun run check:package-mode-boundaries` passed.
  - `bun run typecheck:server-esm` passed.
  - `bun run typecheck:client-runtime` passed.
  - `bun test tests/smoke/server-handshake.test.ts --timeout 30000` passed.
  - `bun test tests/smoke/modern-gameplay-parity.test.ts --timeout 30000` passed.
- Next action:
  - Continue Ticket 2 artifact-definition scope.

### 2026-02-10 12:55 CET — Ticket 2

- Status: `done`
- Key actions:
  - Removed legacy client host-injection (`BQ_LOCAL_CONFIG`) from `client/modern.html`.
  - Replaced legacy pragma-driven host selection with runtime config resolution in `client/js-esm/config.ts`.
  - Simplified runtime server selection flow in `client/js-esm/app.ts` and `client/js-esm/game.ts`.
  - Added `build:server` and `build:bundle` scripts and artifact generators.
  - Updated deployment docs to include `assets/` runtime dependency and bundle deployment flow.
- Evidence:
  - `bun run typecheck:client-runtime` passed.
  - `bun run test:browser:protocol-invariant:node22` passed.
  - `bun run build:bundle` passed.
  - bundle server smoke (`dist/bundle` + `/status`) passed.
- Next action:
  - Continue Ticket 3 cleanup and wrapper-shim pruning.

### 2026-02-10 12:50 CET — Ticket 3

- Status: `done`
- Key actions:
  - Removed client BISON path and SPAWN_BATCH dead handler from `client/js-esm/gameclient.ts`.
  - Removed `client/js-esm/lib/bison.ts`.
  - Removed `useBison` dependency seam from server ws runtime factory.
  - Added missing ws runtime compatibility (`getConnection`) in `server/js/ws-runtime-esm.ts` discovered during browser verification.
- Evidence:
  - `bun run test:ws:runtime:parity` passed.
  - `bun x tsc -p tsconfig.typecheck-runtime.json` passed.
- Next action:
  - Completed.

### 2026-02-10 13:10 CET — Ticket 4

- Status: `done`
- Key actions:
  - Added canonical gametypes entrypoint `shared/js/gametypes.ts`.
  - Rewired core runtime/shared imports from `shared/js/gametypes-esm` to `shared/js/gametypes`.
  - Removed wrapper-only protocol/gametypes compatibility modules and parity checks no longer needed in runtime.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Completed.

### 2026-02-10 13:34 CET — Review Docs Retirement

- Status: `done`
- Key actions:
  - Re-audited `review-*.md` findings against ticket coverage.
  - Completed Ticket 3 wrapper/protocol legacy cleanup lane and verified full modern gate on Node 22.
  - Deleted `review-granit.md`, `review-jade.md`, `review-sun.md`, `review-sugar.md`, and `review-xilit.md`.
- Evidence:
  - `bun run verify:modern:node22` passed.
  - `bun run check:package-mode-boundaries` passed.
- Next action:
  - Continue Ticket 5 strict-zone migration.

### 2026-02-10 13:40 CET — Ticket 4 Phase B Execution TODO

- Status: `done`
- TODO list:
  - `done` Add shared protocol schema module for client/server opcode validation.
  - `done` Rewire `server/js/format.ts` to consume shared schema/constants.
  - `done` Rewire `client/js-esm/protocol-payload.ts` to consume shared schema/constants.
  - `done` Run `bun run typecheck`, `bun run test`, and `bun run verify:modern:node22`.
- Evidence:
  - Scope re-audit complete for duplicate opcode validation paths in server/client validators.
  - `bun run typecheck` passed.
  - `bun run test` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 strict-zone migration.

### 2026-02-10 13:56 CET — Ticket 5 Baseline Execution TODO

- Status: `done`
- TODO list:
  - `done` Align `ServerConfig` type with config preflight requirements.
  - `done` Fix compile/test fixtures impacted by stricter `ServerConfig` requirements.
  - `done` Run `bun run typecheck` and `bun run verify:modern:node22`.
- Evidence:
  - Preflight validator requires boolean `metrics_enabled` and constrained `debug_level`.
  - `bun run typecheck` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 strict-zone work on targeted `any`/index-signature reductions.

### 2026-02-10 14:05 CET — Ticket 5 Strict-Zone Slice TODO

- Status: `done`
- TODO list:
  - `done` Add strict TS config for server config/runtime typing slice.
  - `done` Add package script for strict-slice verification.
  - `done` Run strict-slice typecheck and full `verify:modern:node22`.
- Evidence:
  - Ticket 5 requires strict-zone migration in incremental slices.
  - Added `tsconfig.strict.server-config.json`.
  - Added `typecheck:strict:server-config` package script.
  - `bun run typecheck:strict:server-config` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 strict-zone expansion and targeted `any`/index-signature removal.

### 2026-02-10 14:14 CET — Ticket 5 Targeted Any/Index-Signature Reduction

- Status: `done`
- Key actions:
  - Removed `[key: string]: any` from `client/js-esm/compat/log.ts` by introducing explicit logger field and method typings.
  - Removed `[key: string]: any` from `client/js-esm/updater.ts` by introducing explicit class fields.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 by reducing index signatures in next low-risk client/runtime modules.

### 2026-02-10 14:28 CET — Ticket 5 Index-Signature Reduction Slice 2

- Status: `done`
- Key actions:
  - Removed `[key: string]: any` from `client/js-esm/map.ts` and introduced explicit class fields.
  - Removed `[key: string]: any` from `client/js-esm/app.ts` and introduced explicit class fields/types.
  - Resolved resulting typing conflicts (DOM field types and method-name collisions).
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with next low-risk index-signature target (`client/js-esm/gameclient.ts`).

### 2026-02-10 14:36 CET — Ticket 5 Index-Signature Reduction Slice 3

- Status: `done`
- Key actions:
  - Removed `[key: string]: any` from `client/js-esm/gameclient.ts`.
  - Introduced explicit class fields for connection state, handler table, and callback hooks.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with remaining high-value index-signature removals (`client/js-esm/renderer.ts`, `client/js-esm/game.ts`, `server/js/player.ts`) in incremental slices.

### 2026-02-10 14:45 CET — Ticket 5 Index-Signature Reduction Slice 4

- Status: `done`
- Key actions:
  - Removed `[key: string]: any` from `client/js-esm/renderer.ts` and added explicit runtime fields.
  - Removed `[key: string]: any` from `server/js/player.ts` and added explicit runtime fields/callback signatures.
  - Added targeted field typings for player equipment/position callbacks uncovered by removal.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with the next high-value remaining index signature in `client/js-esm/game.ts`.

### 2026-02-10 14:55 CET — Ticket 5 Index-Signature Reduction Slice 5

- Status: `done`
- Key actions:
  - Removed `[key: string]: any` from `client/js-esm/game.ts` and added explicit runtime field declarations.
  - Added follow-up compatibility field typing in `client/js-esm/renderer.ts` (`targetRect`) and made `getTargetBoundingRect` parameters optional.
  - Made `client/js-esm/gameclient.ts#connect` dispatcher argument optional to match existing callsites.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 by replacing broad `any` declarations in newly explicit classes with narrower interfaces in focused follow-up slices.

### 2026-02-10 15:05 CET — Ticket 5 Narrowing Follow-up (Game/Renderer)

- Status: `done`
- Key actions:
  - Narrowed `client/js-esm/renderer.ts` 2D contexts using a typed legacy-compatible context alias with optional `mozImageSmoothingEnabled`.
  - Narrowed select `client/js-esm/game.ts` fields (`chatinput`, `storage`, cursor orientation, zoning queue, previous click position, nullable zoning orientation).
  - Applied scoped rollback for over-tightened legacy entity/sprite surfaces to preserve behavior and keep incremental migration safe.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with targeted interface extraction for `Game` entity/sprite collections before re-tightening those currently broad fields.

### 2026-02-10 15:14 CET — Ticket 5 Interface Extraction (Game Collections)

- Status: `done`
- Key actions:
  - Added explicit collection-level types in `client/js-esm/game.ts` for grid/queue/position structures:
    - `GridPosition`, `EntityGridCell`, `EntityGrid`.
  - Applied these types to `deathpositions`, `entityGrid`, `pathingGrid`, `renderingGrid`, `itemGrid`, `animatedTiles`, `spritesets`, and `obsoleteEntities`.
  - Kept polymorphic entity internals broad while narrowing structural containers.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 by introducing lightweight entity capability interfaces (e.g. `HasPosition`, `HasId`, `HasSprite`) and narrowing hotspot method signatures without broad behavioral refactors.

### 2026-02-10 15:23 CET — Ticket 5 Capability Interfaces (Game Hotspots)

- Status: `done`
- Key actions:
  - Added lightweight capability aliases in `client/js-esm/game.ts`:
    - `EntityId`, `GameEntity`, `HighlightableEntity`.
  - Switched core collection fields to capability-backed types:
    - `entities`, `entityGrid` cells, `obsoleteEntities`, and `lastHovered`.
  - Narrowed hotspot method signatures:
    - `getEntityById`, `forEachEntity`, `forEachVisibleEntityByDepth`, `getEntityAt`, `forEachEntityAround`.
  - Added runtime-safe highlight guard before assigning hovered entity as `HighlightableEntity`.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with callback/callsite capability typing in `connect` event handlers and entity interaction helpers.

### 2026-02-10 15:31 CET — Ticket 5 Capability Typing (Connect/Helpers)

- Status: `done`
- Key actions:
  - Tightened `client/js-esm/game.ts` callsite/callback typing for capability-safe usage:
    - `connect(started_callback: () => void)`
    - `addEntity(entity: GameEntity)`
    - `removeEntity(entity: GameEntity)`
    - typed `onEntityList` maps/filters to `GameEntity` without `any` callback annotations.
  - Strengthened `removeObsoleteEntities` local collection typing to `GameEntity[]`.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 by typing selected callback registration methods (`onGameStart`, `onDisconnect`, `onPlayer*`) and reducing remaining `(...args: any[])` callback surfaces.

### 2026-02-10 15:39 CET — Ticket 5 Callback Surface Tightening

- Status: `done`
- Key actions:
  - Replaced broad callback field types in `client/js-esm/game.ts` with concrete signatures for:
    - game-start/disconnect/player-health/player-hurt/equipment/population/notification/invincible/achievement-unlock callbacks.
  - Typed callback registration methods (`onGameStart`, `onDisconnect`, `onPlayerDeath`, `onPlayerHealthChange`, `onPlayerHurt`, `onPlayerEquipmentChange`, `onNbPlayersChange`, `onNotification`, `onPlayerInvincible`).
  - Added null-guards at unconditional callback invocation sites discovered during narrowing.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 by tightening remaining broad class fields in `game.ts` (`app`, `player`, cursor/sprite registries) with minimal capability aliases.

### 2026-02-10 14:42 CET — Ticket 5 App/Sprite Registry Narrowing Slice

- Status: `done`
- Key actions:
  - Added lightweight `AppLike` and `RuntimeServerConfig` aliases in `client/js-esm/game.ts` and narrowed `app` to that contract.
  - Narrowed sprite-related `Game` fields:
    - `currentCursor: Sprite | null`
    - `cursors`, `sprites`, `shadows` as `Record<string, Sprite>`.
  - Added null-safe fallback assignment when selecting sprite scales from `spritesets`.
  - Applied one scoped callsite cast at mob death sprite swap to bridge existing `Sprite` vs `Entity.SpriteLike` structural mismatch while preserving behavior.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 by introducing a shared sprite capability type to eliminate remaining `as unknown as` bridges in `game.ts`/entity surfaces.

### 2026-02-10 14:44 CET — Ticket 5 Player/Achievement Narrowing Slice

- Status: `done`
- Key actions:
  - Narrowed `client/js-esm/game.ts` player field from `any` to `Warrior`.
  - Introduced explicit `AchievementDefinition` type and applied it to:
    - `achievements` field in `Game`
    - `AppLike.initAchievementList` contract.
  - Added scoped compatibility casts at `player.setSprite(...)` callsites where current `Entity.SpriteLike` typing is stricter than runtime `Sprite` shape.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with a dedicated sprite-capability reconciliation slice so `Entity.SpriteLike` matches runtime `Sprite` behavior and cast bridges can be retired safely.

### 2026-02-10 14:45 CET — Ticket 5 Sprite-Capability Reconciliation Slice

- Status: `done`
- Key actions:
  - Updated `client/js-esm/entity.ts` sprite typing to match runtime behavior:
    - added `SpriteRenderLike`
    - widened `SpriteLike` hurt/silhouette return compatibility
    - introduced `ActiveSpriteLike` for runtime `sprite`/`normalSprite`/`hurtSprite` fields.
  - Added structural guards where runtime sprite may be render-data only:
    - name-check guard in `setSprite`
    - silhouette guard in `setHighlight`.
  - Removed temporary `as unknown as never` sprite casts from `client/js-esm/game.ts` setSprite callsites now that entity sprite contracts align.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with the next low-risk narrowing target (`camera`/app-facing capability surfaces in `game.ts`) while keeping behavior parity.

### 2026-02-10 14:47 CET — Ticket 5 Camera Surface Narrowing Slice

- Status: `done`
- Key actions:
  - Narrowed `camera` field in `client/js-esm/game.ts` from `any` to `Camera`.
  - Added type-only camera import and explicit constructor initialization cast.
  - Fixed a strictness-revealed local shadowing conflict in `startZoningFrom` (`x`/`y` -> `nextX`/`nextY`) to satisfy TS variable declaration rules under tightened typing.
- Evidence:
  - `bun run typecheck` initially failed with `TS2403` at `client/js-esm/game.ts:2301` and `client/js-esm/game.ts:2302`; passed after rename fix.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 by narrowing remaining broad capability edges in `game.ts` (`GameEntity`/achievement app boundary) without changing runtime behavior.

### 2026-02-10 14:48 CET — Ticket 5 App Achievement Boundary Tightening Slice

- Status: `done`
- Key actions:
  - Tightened `AppLike.initUnlockedAchievements` in `client/js-esm/game.ts` from `unknown` to `AchievementId[]`.
  - Added explicit achievement API typing in `client/js-esm/app.ts`:
    - introduced `AchievementView` type
    - typed `initAchievementList(achievements: Record<string, AchievementView>)`
    - typed `initUnlockedAchievements(ids: AchievementId[])`.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with the next low-risk broad surface in `game.ts` (`GameEntity` capability narrowing at selected hotspots) while preserving runtime parity.

### 2026-02-10 14:48 CET — Ticket 5 Game Setup/Setter Signature Tightening Slice

- Status: `done`
- Key actions:
  - Added explicit parameter typing in `client/js-esm/game.ts` for setup and setter boundaries:
    - `setup(...)` now typed for bubble container + canvases + chat input
    - `setStorage`, `setRenderer`, `setUpdater`, `setPathfinder`, `setChatInput`, `setBubbleManager` now use concrete class/DOM types.
  - Kept behavior unchanged while reducing untyped method boundaries.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with selected `GameEntity` capability narrowing at hotspot methods to reduce remaining `Record<string, any>` usage incrementally.

### 2026-02-10 14:51 CET — Ticket 5 GameEntity Hotspot Narrowing Slice

- Status: `done`
- Key actions:
  - Added focused entity/grid helper aliases in `client/js-esm/game.ts`:
    - `GridIndexedEntity`
    - `DirtyAnimatedTile`
    - `GridPath`.
  - Tightened hotspot method signatures without behavior changes:
    - grid registration/removal helpers (`addToRenderingGrid`, `removeFromRenderingGrid`, `removeFromEntityGrid`, `removeFromItemGrid`, `removeFromPathingGrid`, `registerEntityDualPosition`, `unregisterEntityPosition`, `registerEntityPosition`)
    - item helpers (`addItem`, `removeItem`)
    - pathing helper (`findPath`) and cursor/server option signatures
    - visibility/tile iteration callback signatures (`forEachMob`, `forEachVisibleTileIndex`, `forEachVisibleTile`, `forEachAnimatedTile`).
  - Aligned entity collection typing to narrowed shape:
    - `entities: Record<string, GridIndexedEntity>`
    - `obsoleteEntities: GridIndexedEntity[] | null`
    - `getEntityById` return type updated accordingly.
  - Added optional guard for `nextGridX/nextGridY` checks in dual-position helpers.
- Evidence:
  - `bun run typecheck` initially failed with `TS2345`/`TS2339` at `client/js-esm/game.ts:585`, `client/js-esm/game.ts:608`, `client/js-esm/game.ts:1174`, `client/js-esm/game.ts:1320`, `client/js-esm/game.ts:2629`, `client/js-esm/game.ts:2632`; passed after entity collection and path/tile typing alignment.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with targeted narrowing of remaining broad `GameEntity`/`Record<string, any>` surfaces, starting with callback/method params that still rely on implicit dynamic shapes.

### 2026-02-10 14:53 CET — Ticket 5 Interaction/Query Signature Tightening Slice

- Status: `done`
- Key actions:
  - Tightened interaction/query signatures in `client/js-esm/game.ts` for:
    - attack/link and movement helpers
    - entity lookup predicates (`getMobAt`, `getNpcAt`, `getChestAt`, `getItemAt`, `is*At`)
    - cursor/grid helpers (`getMouseGridPosition`, `isMobOnSameTile`, `getFreeAdjacentNonDiagonalPosition`, `tryMovingToADifferentTile`).
  - Kept runtime behavior stable by applying scoped compatibility bridges in legacy polymorphic paths:
    - attack link callsites sourced from `getEntityById`
    - chest follow callsite
    - dropped-item `playersInvolved` optional shape access
    - highlight cast bridge via `unknown`.
  - Aligned `EntityGridCell` typing with narrowed entity collection (`GridIndexedEntity`).
- Evidence:
  - `bun run typecheck` initially failed with `TS2339`/`TS2345`/`TS2403` at `client/js-esm/game.ts:1099`, `client/js-esm/game.ts:1394`, `client/js-esm/game.ts:1495`, `client/js-esm/game.ts:1498`, `client/js-esm/game.ts:1770`, `client/js-esm/game.ts:1844`, `client/js-esm/game.ts:2072`, `client/js-esm/game.ts:2189`, `client/js-esm/game.ts:2190`; passed after targeted compatibility fixes.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with the next incremental narrowing slice on remaining broad method params/collections while limiting new cast bridges.

### 2026-02-10 14:55 CET — Ticket 5 Utility/Dirty-Rect Signature Tightening Slice

- Status: `done`
- Key actions:
  - Tightened lower-surface utility signatures in `client/js-esm/game.ts`:
    - zoning helpers (`isZoningTile`, `getZoningOrientation`, `startZoningFrom`, `enqueueZoningFrom`, `isZoning`)
    - chat/bubble helpers (`say`, `createBubble`, `destroyBubble`, `assignBubbleTo`)
    - neighborhood/dirty-rect helpers (`forEachEntityAround`, `checkOtherDirtyRects`)
    - notification/checkpoint helpers (`showNotification`, `getDeadMobPosition`).
  - Added small supporting aliases:
    - `DirtyRect`
    - `BubbleAnchor`.
  - Aligned `GridIndexedEntity` to include runtime `x/y` fields used by bubble positioning.
  - Normalized bubble manager calls to string IDs via `String(id)` for compatibility with `BubbleManager` string-key API.
- Evidence:
  - `bun run typecheck` initially failed with `TS2345` at `client/js-esm/game.ts:1637`, `client/js-esm/game.ts:2383`, `client/js-esm/game.ts:2387`, `client/js-esm/game.ts:2391`; passed after `GridIndexedEntity` and bubble-ID normalization fixes.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with a focused cast-reduction cleanup pass in `game.ts` (remove/contain recently added compatibility casts where a safer capability type can replace them).

### 2026-02-10 14:57 CET — Ticket 5 Cast-Reduction Cleanup Slice

- Status: `done`
- Key actions:
  - Removed cast-heavy attack-link callsites in `client/js-esm/game.ts` by adding runtime `instanceof Character` narrowing and stable closure locals for delayed callbacks.
  - Replaced highlight cast bridge with a local type guard:
    - added `isHighlightableEntity` and used it in hover/highlight flow.
  - Removed chest-follow cast by tightening shared `CharacterLike` contract in `client/js-esm/character.ts` to the fields actually required by `follow/getOrientationTo`.
  - Preserved only one constructor-initialization cast for `camera` (`null` bootstrap state before renderer wiring), which is expected at current class lifecycle.
- Evidence:
  - `bun run typecheck` initially failed with `TS2677` and `TS2345` in `client/js-esm/game.ts` after first-pass guard extraction; passed after aligning `HighlightableEntity` with `GridIndexedEntity` and narrowing delayed attack closure vars.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with incremental reduction of remaining broad `GameEntity = Record<string, any>` usage (target: replace high-traffic `Record<string, any>` with capability unions/interfaces without behavior drift).

### 2026-02-10 15:15 CET — Ticket 5 Helper Signature/Annotation Cleanup Slice

- Status: `done`
- Key actions:
  - Tightened remaining untyped helper signatures in `client/js-esm/game.ts`:
    - `entityIdExists(id: EntityId): boolean`
    - `getAchievementById(id: string | number): AchievementDefinition | null`
    - `loadSpriteForScale(name: SpriteKey, scale: number)`
    - `loadSpriteScale(scale: number)`
    - `setSpriteScale(scale: number)`.
  - Updated stale broad callback annotations in `onEntityList` from `GameEntity` to `GridIndexedEntity`.
  - Made numeric parsing explicit in achievement lookup (`parseInt(String(id), 10)`).
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with the next low-risk pass on remaining broad dynamic surface (`GameEntity` base alias / `Record<string, any>`) via capability extraction where callsite-safe.

### 2026-02-10 15:18 CET — Ticket 5 Character Any-Surface Reduction Slice

- Status: `done`
- Key actions:
  - Tightened `client/js-esm/character.ts` attacker/aggro/target-adjacent surfaces:
    - `unconfirmedTarget: CharacterLike | null`
    - `attackers: Record<string, Character>`
    - `aggro_callback` and related methods (`onAggro`, `aggro`) now use `CharacterLike`
    - narrowed `engage`, `addAttacker`, `removeAttacker`, `forEachAttacker`, `setTarget`, `waitToAttack`, `isWaitingToAttack`.
  - Extended `CharacterLike` with optional aggro capability methods:
    - `isWaitingToAttack?`
    - `waitToAttack?`
  - Updated `client/js-esm/game.ts` aggro handler to guard optional aggro capabilities before invocation.
- Evidence:
  - `bun run typecheck` initially failed with `TS2339` in `client/js-esm/game.ts:1007` and `client/js-esm/game.ts:1010`; passed after optional-capability guard update.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with another low-risk capability extraction pass in client runtime classes (`game.ts`/`character.ts`) targeting remaining `any` fields while preserving behavior.

### 2026-02-10 15:22 CET — Ticket 5 Character Target-Capability Tightening Slice

- Status: `done`
- Key actions:
  - Added explicit combat-target capability typing in `client/js-esm/character.ts`:
    - `CombatTarget` alias (`CharacterLike` + optional `removeAttacker`)
    - `target: CombatTarget | null`
    - `previousTarget: CharacterLike | null`
    - `setTarget(character: CombatTarget)`.
  - Preserved path-ignore behavior in `client/js-esm/game.ts` by narrowing to `Character` before adding target to ignore lists.
  - Added runtime narrowing for `previousTarget` reuse before re-linking attacks (`instanceof Character` guard).
- Evidence:
  - `bun run typecheck` initially failed with `TS2345` at `client/js-esm/game.ts:1186` and `client/js-esm/game.ts:2233`; passed after character-target narrowing guards.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 by reducing remaining broad `any` fields in `character.ts` (target-adjacent surfaces that can be safely expressed as capability unions) while keeping gameplay parity.

### 2026-02-10 15:55 CET — Ticket 5 Constructor Seam Any-Removal Slice

- Status: `done`
- Key actions:
  - Removed remaining `this as any` constructor seams in `client/js-esm/game.ts`:
    - `new InfoManager(this)`
    - `new AudioManager(this)`
  - Tightened `client/js-esm/audio.ts` game/entity capability typing:
    - added `AudioEntity` (`gridX/gridY`)
    - `AudioGame.player` now typed to `AudioEntity`
    - `getSurroundingMusic(entity)` now typed `AudioEntity | null`.
  - Continued target-capability hardening with runtime-safe narrowing in `client/js-esm/game.ts`:
    - path ignore list now only includes target when `instanceof Character`
    - re-link attack from `previousTarget` gated with `instanceof Character`.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
  - `rg -n "as any" client/js-esm/game.ts client/js-esm/audio.ts client/js-esm/infomanager.ts` returned no matches.
- Next action:
  - Continue Ticket 5 with remaining broad alias cleanup (`GameEntity = Record<string, any>`) by extracting minimal shared entity capabilities and replacing that base alias where safe.

### 2026-02-10 16:19 CET — Ticket 5 Legacy Class Signature Tightening Slice

- Status: `done`
- Key actions:
  - Tightened legacy untyped class signatures without behavior changes:
    - `client/js-esm/area.ts`: typed constructor args and `contains(entity)` argument/return.
    - `client/js-esm/chest.ts`: typed constructor args, return types for `getSpriteName`/`isMoving`/`open`, and `onOpen` callback signature.
  - Preserved runtime compatibility by keeping unused chest constructor arg as `_kind?: unknown`.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with remaining broad alias cleanup and capability extraction (`GameEntity`/entity-surface typing), focusing on incremental safe reductions.

### 2026-02-10 16:22 CET — Ticket 5 GameEntity Alias Retirement Slice

- Status: `done`
- Key actions:
  - Removed broad alias `GameEntity = { id } & Record<string, any>` from `client/js-esm/game.ts`.
  - Promoted `GridIndexedEntity` to the explicit base entity capability contract used by game runtime collections.
  - Added explicit shared capability fields/methods required by current callsites (movement/render hooks, dirty-state, sprite updates, highlight, optional weapon switch).
  - Aligned entity kind typing to runtime domain (`EntityKind`) and adjusted dirty-rect callsite flow to pass typed local rects.
  - Kept `dirtyRect` broad as `unknown` on the entity contract to stay compatible with existing subclass typing variance.
- Evidence:
  - `bun run typecheck` initially failed with multiple `TS2339/TS2345` contract mismatches after alias removal; passed after capability contract alignment and dirty-rect callsite narrowing.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with incremental capability extraction in remaining dynamic surfaces (especially where `unknown`/optional method bridges still exist) while preserving behavior parity.

### 2026-02-10 16:23 CET — Ticket 5 Entity Capability Hardening Follow-up

- Status: `done`
- Key actions:
  - Continued post-alias hardening in `client/js-esm/game.ts`:
    - tightened `GridIndexedEntity.kind` to `EntityKind`
    - kept `dirtyRect` as `unknown` for cross-entity compatibility
    - added explicit typed local `dirtyRect` handoff in `onDirty` callback before `checkOtherDirtyRects`.
  - Reduced remaining cast/dynamic bridges:
    - switched `camera` to definite assignment (`camera!`) and removed constructor bootstrap cast
    - replaced dropped-item `playersInvolved` cast with runtime-safe property/array check.
- Evidence:
  - `bun run typecheck` initially failed with contract mismatches after capability hardening (`TS2339/TS2345` on entity fields and dirty-rect handoff); passed after capability alignment and typed local rect handoff.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 by tightening remaining optional/unknown bridges in entity capability surfaces (while preserving subclass variance and gameplay behavior).

### 2026-02-10 16:27 CET — Ticket 5 Pathfinder Contract Tightening Slice

- Status: `done`
- Key actions:
  - Hardened pathfinding capability typing in `client/js-esm/pathfinder.ts`:
    - introduced explicit tuple/path aliases (`GridPoint`, `GridPath`)
    - typed pathfinder constructor fields and method signatures
    - widened movement-related capability fields to optional for ignore-list compatibility (`isMoving?`, `nextGridX?`, `nextGridY?`).
  - Removed path cast bridge in `client/js-esm/game.ts` by keeping `findPath` flow on typed `GridPath` return values.
  - Replaced dropped-item ownership cast in `client/js-esm/game.ts` with runtime-safe `playerId !== null` guard and direct `includes(playerId)` check.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with the next low-risk strictness slice targeting remaining `unknown`/optional bridges in entity dirty-rect and capability call paths.

### 2026-02-10 16:28 CET — Ticket 5 Cast-Bridge Reduction Slice

- Status: `done`
- Key actions:
  - Replaced `as unknown as GridPath` bridges in `client/js-esm/pathfinder.ts` with a runtime-validated adapter:
    - added `isGridPoint` tuple guard
    - added `toGridPath` conversion helper
    - routed all A* results through `toGridPath`.
  - Hardened pathfinder ignore-list application with null-grid guard and optional-movement fallback (`nextGridX/nextGridY` fallback to current tile).
  - Removed low-value casts in `client/js-esm/game.ts`:
    - narrowed dropped-item `playersInvolved` via type-guarded filter instead of cast.
    - typed hit/kill sound randomization without assertion casts.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 by targeting the next safe dynamic seam in client runtime entity surfaces (`entity.ts` idle callback cast and remaining dirty-rect bridge).

### 2026-02-10 16:30 CET — Ticket 5 Entity Idle-Cast Removal Slice

- Status: `done`
- Key actions:
  - Removed `this as unknown as { idle?: () => void }` bridge in `client/js-esm/entity.ts`.
  - Added override-safe base capability method `idle(): void {}` on `Entity` and switched animation end callback to direct cast-free invocation.
  - Resolved resulting class-shape mismatch (`TS2425`) by using method form (not property) so `Character.idle()` remains compatible.
- Evidence:
  - `bun run typecheck` initially failed with `TS2425` at `client/js-esm/character.ts:177`; passed after method-shape correction.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 by tightening remaining dirty-rect typing bridges between `game.ts` and `renderer.ts` with minimal runtime risk.

### 2026-02-10 16:31 CET — Ticket 5 Residual Cast Cleanup Slice

- Status: `done`
- Key actions:
  - Removed remaining explicit cast assertions in `client/js-esm/game.ts`:
    - `this.spriteNames` now initialized directly from `SPRITE_KEYS` without assertion.
    - mobile dirty-rect callback now uses typed local annotation (`const dirtyRect: DirtyRect = ...`) instead of assertion cast.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 by evaluating whether dirty-rect contracts can be typed end-to-end (`renderer.ts` rect helpers + entity dirtyRect surface) without widening runtime risk.

### 2026-02-10 16:33 CET — Ticket 5 Dirty-Rect Surface Typing Slice

- Status: `done`
- Key actions:
  - Typed entity dirty-rect fields in `client/js-esm/entity.ts` (`dirtyRect`, `oldDirtyRect`) as `Record<string, number> | null` and initialized both in constructor.
  - Tightened `client/js-esm/game.ts` entity capability surface to match dirty-rect lifecycle (`dirtyRect?: DirtyRect | null`, `oldDirtyRect?: DirtyRect | null`).
  - Aligned `client/js-esm/player.ts` override typing with base entity contract via `declare dirtyRect: Record<string, number> | null`.
- Evidence:
  - `bun run typecheck` initially failed with hierarchy/shape errors (`TS2345`, `TS2416`, `TS2612`) after an over-strict rect shape; passed after compatibility normalization to `Record<string, number> | null` and player override alignment.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with next safe strictness target outside current dirty-rect inheritance seam (client runtime callback/capability narrowing).

### 2026-02-10 16:35 CET — Ticket 5 Player Sprite-Cast Removal Slice

- Status: `done`
- Key actions:
  - Exported `SpriteLike` from `client/js-esm/entity.ts` for shared client runtime sprite typing.
  - Reworked player armor sprite typing in `client/js-esm/player.ts`:
    - `PlayerSprite` now extends shared `SpriteLike` with `id`.
    - added `isPlayerSprite` type guard.
    - removed all `as unknown as` bridges in armor/invincibility sprite flows.
  - Kept invincibility behavior stable when sprite shape is temporarily unavailable by preserving the control path with `currentArmorSprite = null` fallback.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 by scanning remaining client runtime cast/unknown seams and taking the next low-risk compatibility-aligned reduction slice.

### 2026-02-10 16:38 CET — Ticket 5 Updater Game-Any Removal Slice

- Status: `done`
- Key actions:
  - Replaced `game: any` in `client/js-esm/updater.ts` with explicit runtime capability contracts:
    - `UpdaterGame`, `StepTransition`, `UpdaterEntity`, and `AnimatedTileLike`.
  - Added method parameter/return annotations across updater lifecycle methods.
  - Aligned mixed runtime union behavior with explicit guards:
    - direct `instanceof Character` narrowing in entity loop
    - guarded animation updater path (`'update' in anim`)
    - guarded fading alpha writes (`'fadingAlpha' in entity`).
  - Imported real `AnimatedTile` shape for tile dirty-rect/update compatibility.
- Evidence:
  - `bun run typecheck` initially failed with `TS2345/TS2339` contract mismatches after first capability pass; passed after interface alignment and runtime-guarded narrowing.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with next low-risk `any` reduction in client runtime (`entityfactory.ts` constructor/return typing) before higher-risk monolith files.

### 2026-02-10 16:40 CET — Ticket 5 EntityFactory Any-Return Removal Slice

- Status: `done`
- Key actions:
  - Replaced `any`-typed factory contract in `client/js-esm/entityfactory.ts` with explicit entity capability types.
  - Introduced typed factory return contract (`EntityFactoryEntity | undefined`) while preserving runtime behavior (`undefined` on invalid kind).
  - Kept downstream compatibility by extending base entity return shape with optional capability fields used in `gameclient.ts` (`weaponName`, `spriteName`, `wasDropped`, `playersInvolved`).
- Evidence:
  - `bun run typecheck` initially failed with `TS2339/TS2551` in `client/js-esm/gameclient.ts` after narrowing to plain `Entity`; passed after capability-compatible return typing.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with the next smallest-blast-radius `any` reduction in client runtime module surfaces.

### 2026-02-10 16:43 CET — Ticket 5 Map Any-Surface Reduction Slice

- Status: `done`
- Key actions:
  - Removed broad `any` map runtime surfaces in `client/js-esm/map.ts`:
    - typed `game` constructor dependency as `MapGameLike`
    - typed `musicAreas`, `animated`, `doors`, `checkpoints`, and map payload lifecycle.
  - Added explicit runtime normalization for loose map-source records:
    - door/checkpoint parsing now converts unknown record fields into typed runtime shapes.
  - Aligned map/audio typing bridge by tightening music area id to `MusicKey` in `client/js-esm/map.ts` and `client/js-esm/map-source.ts`.
  - Added method-level parameter/return annotations across map helpers and query methods.
- Evidence:
  - `bun run typecheck` initially failed with `TS2345` shape mismatches (`musicAreas.id`, `data`, `doors`) after first tightening pass; passed after compatibility-aligned payload typing + normalization.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with next low-risk client runtime seam (`app.ts` `game: any` boundary typing).

### 2026-02-10 16:46 CET — Ticket 5 Main Runtime Any-Boundary Reduction Slice

- Status: `done`
- Key actions:
  - Removed `main.ts` top-level `any` globals by typing runtime handles:
    - `app: App | null`
    - `game: Game | null` (typed against actual game class contract).
  - Removed dynamic import `as any` bridge in game bootstrap path (`mod.default` direct usage).
  - Tightened test-entity iteration typing in `getTestEntities` with explicit `TestEntity` shape.
  - Added concrete DOM element typing for `setup` bootstrap nodes (`HTMLCanvasElement`/`HTMLInputElement` casts).
  - Updated start trigger call to satisfy typed app signature (`tryStartingGame(name, undefined)`).
- Evidence:
  - `bun run typecheck` initially failed with broad runtime surface mismatches after an over-narrow local game interface; passed after switching to concrete `Game` class typing and DOM-arg alignment.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with callback-handler `any[]` reduction in `client/js-esm/gameclient.ts` (incremental, compatibility-first).

### 2026-02-10 16:48 CET — Ticket 5 GameClient Callback Any-Reduction Slice

- Status: `done`
- Key actions:
  - Replaced `any` callback/handler surfaces in `client/js-esm/gameclient.ts` with explicit unknown-based aliases:
    - `GameClientCallback = (...args: unknown[]) => void`
    - `GameClientActionHandler = (data: unknown[]) => void`.
  - Updated class fields (`spawn/move/.../blink` callbacks and `handlers`) to use these aliases while preserving runtime behavior.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with remaining low-risk renderer strictness seams (`rect: any` locals and camera cast bridge).

### 2026-02-10 16:49 CET — Ticket 5 Renderer Cast/Any Cleanup Slice

- Status: `done`
- Key actions:
  - Removed renderer camera cast bridge in `client/js-esm/renderer.ts` (`new Camera(this)` instead of `this as any`).
  - Replaced `rect: any` locals in renderer bounding-rect helpers with explicit typed rect objects (`BoundingRect` record).
  - Added method-level type annotations for rect helpers/intersection checks.
- Evidence:
  - `bun run typecheck` initially failed due strict rect-shape mismatch against game dirty-rect alias; passed after compatibility alignment (`BoundingRect` as numeric record).
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with remaining high-value `any` surfaces (renderer/game boundary typing and selected server runtime seams).

### 2026-02-10 16:52 CET — Ticket 5 Renderer Game-Boundary Typing Slice

- Status: `done`
- Key actions:
  - Replaced `game: any` in `client/js-esm/renderer.ts` with an explicit `RendererGameLike` contract.
  - Added renderer-local typed runtime models (`RenderSprite`, `RenderAnimation`, `RenderEntity`, `RenderAnimatedTile`, `RenderInfo`) and typed constructor args.
  - Preserved compatibility by keeping capability fields optional where runtime variance exists and guarding optional calls (`isVisible?.()`, `hasShadow?.()`).
  - Resolved intra-function var collision and nullable sparks animation path during draw pass.
  - Aligned player sprite typing for animation metadata in `client/js-esm/player.ts` to match renderer usage.
- Evidence:
  - `bun run typecheck` initially failed with `RendererGameLike` assignability errors from `Game` (`getEntityAt`, entity callback variance, info value shape); passed after compatibility-aligned contract adjustments.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with remaining high-value dynamic seams in server runtime (`server/js/player.ts` and related callback/collection typings).

### 2026-02-10 16:52 CET — Ticket 5 Server Player Any-Surface Reduction Slice

- Status: `done`
- Key actions:
  - Replaced remaining broad `any` surfaces in `server/js/player.ts` with explicit local capability interfaces:
    - `PlayerConnectionLike`, `PlayerServerLike`, `HaterMob`, `MobLike`, `LootEntity`, `CheckpointLike`.
  - Tightened callback payload typing for broadcast hooks from `any` to `unknown`.
  - Aligned server-player domain typing with runtime contracts:
    - IDs narrowed to numeric in attacker/hater/mob paths.
    - equipment kinds aligned to `EntityKind`.
  - Resolved legacy function-scope `var` collisions in protocol branch handlers by renaming branch-local mob/item variables.
- Evidence:
  - `bun run typecheck` initially failed with id/kind contract mismatches and var redeclaration conflicts (`TS2345/TS2403`); passed after numeric id alignment and branch-local variable separation.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 with next low-risk dynamic seam after re-scan (`client/js-esm/main.ts`/`renderer.ts` are now tightened; prioritize smallest remaining non-test `any` surfaces).

### 2026-02-10 16:55 CET — Ticket 5 WorldServer Spawn-Cast Removal Slice

- Status: `done`
- Key actions:
  - Removed `as any` spawn-message bridges in `server/js/worldserver.ts` by introducing a runtime spawnability guard (`isSpawnableEntity`) and gating `Messages.Spawn` construction on that guard.
  - Replaced properties drop-table `Record<string, any>` cast with typed lookup (`Record<string, { drops?: Record<string, number> }>`).
  - Kept world map area config typing stable to avoid unrelated breakage while retaining cast-removal improvements.
- Evidence:
  - `bun run typecheck` initially failed after over-tightening map area arrays and spawn-kind shape; passed after compatibility correction (restored map area array looseness and aligned spawn-kind guard to numeric `EntityKind`).
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 5 by chipping away at remaining `any` aliases in `server/js/worldserver.ts` with small capability slices to avoid monolithic breakage.

### 2026-02-10 17:00 CET — Ticket 5 WorldServer Any-Alias Removal Compatibility Slice

- Status: `done`
- Key actions:
  - Removed remaining worldserver `any` aliases in `server/js/worldserver.ts`:
    - `WorldEntity/Player/Mob/Npc/Item/Chest` now use concrete runtime classes.
    - `WorldMessage` now uses `{ serialize(): unknown }` instead of `Record<string, any>`.
  - Replaced map payload `any[]` usage with `unknown[]` on the `WorldMapLike` seam and added runtime shape guards:
    - `isMapMobAreaConfig`, `isMapChestAreaConfig`, `isMapChestConfig`.
    - Area/chest initialization now filters by guard before reading fields.
  - Tightened aggro/hate paths to class-safe narrowing:
    - `clearMobAggroLink`, `clearMobHateLinks`, `handleMobHate`, `chooseMobTarget` now narrow with `instanceof Player/Mob` where required.
    - Guarded `increaseHateFor` call behind numeric-id check to preserve runtime contract expectations.
- Evidence:
  - `bun run typecheck` initially failed after naive alias conversion; passed after map-shape guards and `Player`/`Mob` narrowing.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Re-scan repo for remaining non-test runtime `any` surfaces and continue Ticket 5 in smallest safe slices.

### 2026-02-10 17:01 CET — Ticket 5 Closure Verification

- Status: `done`
- Key actions:
  - Re-scanned runtime TypeScript source (`client/js-esm`, `server/js`, `shared/js`) for type-level `any` usage and confirmed no remaining runtime `any` declarations/casts (string/comment matches only).
  - Re-ran strict-zone verification command to confirm strict slice remains healthy after latest changes.
  - Marked Ticket 5 top-level status to `done` after criteria and verification alignment.
- Evidence:
  - `rg -n "\\bany\\b|Record<string, any>|:\\s*any\\b|as any" client/js-esm server/js shared/js --glob '!**/*.test.ts'` returned only non-type text matches.
  - `bun run typecheck:strict:server-config` passed.
  - `bun run typecheck` passed.
  - `bun run lint` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Move to next baseline-priority ticket (Ticket 6: server runtime performance hotspots) with incremental, test-guarded slices.

### 2026-02-10 17:01 CET — Ticket 6 Baseline Performance Slice TODO

- Status: `done`
- TODO checklist:
  - `done` Implement serialize-once fanout in world broadcast/group push paths (no behavior changes).
  - `done` Verify no protocol behavior regressions via parity + full verify lane.
  - `done` Re-scan world hot loops for next low-risk allocation reduction candidate.
- Scope:
  - Included: `server/js/worldserver.ts` queue fanout serialization behavior.
  - Out of scope: protocol payload schema changes, gameplay behavior changes.
- Acceptance criteria:
  - Group/broadcast fanout paths avoid repeated `message.serialize()` per recipient for identical payloads.
  - `bun run test:modern-parity` and `bun run verify:modern:node22` pass.
- Verification plan:
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; subsequent Ticket 6 slices continue below.

### 2026-02-10 17:02 CET — Ticket 6 Serialize-Once Fanout Slice

- Status: `done`
- Key actions:
  - Added serialized-payload fanout helpers in `server/js/worldserver.ts`:
    - `pushSerializedToPlayer`
    - `pushSerializedToGroup`
  - Updated high-fanout paths to serialize once per payload instead of per recipient:
    - `pushToGroup`
    - `pushToAdjacentGroups`
    - `pushBroadcast`
  - Preserved queue protocol shape and message ordering semantics.
- Evidence:
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 6 with next low-risk hot-loop allocation path in `server/js/worldserver.ts` (`Object.values(...).includes(...)` membership check) and verify parity.

### 2026-02-10 17:03 CET — Ticket 6 Incoming-Group Membership Allocation Slice

- Status: `done`
- Key actions:
  - Removed per-call array allocation in `server/js/worldserver.ts` incoming-group membership check:
    - Replaced `Object.values(group.entities).includes(entity.id)` with direct key lookup `entity.id in group.entities`.
  - This keeps semantics aligned with entity-id keyed storage and avoids creating a temporary array in this hot path.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 6 by identifying the next high-frequency allocation/copy hotspot in world loop paths (`processGroups`, queue fanout, or group membership churn) and apply a similarly small, parity-guarded optimization.

### 2026-02-10 17:04 CET — Ticket 6 Queue Reuse (Per-Tick Allocation) Slice

- Status: `done`
- Key actions:
  - Reduced per-tick array reallocation in `server/js/worldserver.ts`:
    - `processQueues` now reuses each outgoing queue array (`queue.length = 0`) after send instead of replacing with a new array.
    - `processGroups` now reuses each group incoming queue (`incoming.length = 0`) after processing instead of assigning a new array.
  - Kept ordering and fanout semantics unchanged.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 6 with the next low-risk performance hotspot in world loop/membership paths, with parity-first verification.

### 2026-02-10 17:05 CET — Ticket 6 Relevant-Entity List Allocation Slice

- Status: `done`
- Key actions:
  - Optimized `pushRelevantEntityListTo` in `server/js/worldserver.ts`:
    - Replaced `Object.keys(...).filter(...).map(...)` chain with a single loop over group entities.
    - Preserved existing id parsing semantics (`Number.parseInt(id, 10)`).
  - Reduced transient array/callback allocations in a path triggered on player enter/group refresh.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 6 with another low-risk world loop allocation reduction (group processing iteration path), keeping parity verification as gate.

### 2026-02-10 17:06 CET — Ticket 6 Loop Callback Overhead Reduction Slice

- Status: `done`
- Key actions:
  - Reduced callback overhead in `server/js/worldserver.ts` by converting to indexed loops:
    - `pushSpawnsToPlayer`: replaced `(ids || []).forEach(...)` with direct indexed iteration.
    - `processGroups`: replaced `incoming.forEach(...)` with indexed iteration over `incoming`.
  - Preserved spawn fanout and message ordering behavior.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 6 with the next low-risk hot-path optimization (targeting redundant parsing/object churn in group/entity fanout paths) and keep parity as hard gate.

### 2026-02-10 17:07 CET — Ticket 6 Previous-Group Fanout Loop Slice

- Status: `done`
- Key actions:
  - Optimized `pushToPreviousGroups` in `server/js/worldserver.ts`:
    - Replaced `(player.recentlyLeftGroups || []).forEach(...)` callback fanout with indexed loop iteration.
  - Preserved message order and queueing behavior.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 6 with another low-risk group-membership path optimization (reducing temporary array churn in membership-diff computation).

### 2026-02-10 17:08 CET — Ticket 6 Group-Diff Temporary Array Reduction Slice

- Status: `done`
- Key actions:
  - Optimized group-diff computation in `handleEntityGroupMembership` (`server/js/worldserver.ts`):
    - Replaced `oldGroups.filter(...newGroups.includes...)` callback chain with direct indexed loop building `remaining`.
  - Preserved group-transition semantics and `recentlyLeftGroups` behavior.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 6 with next hotspot outside `worldserver` if beneficial (UTF-8/log helper low-risk modernization), or keep iterating world-loop micro-optimizations.

### 2026-02-10 17:10 CET — Ticket 6 UTF-8 Helper Allocation Reduction Slice

- Status: `done`
- Key actions:
  - Optimized server utility truncation helpers in `server/js/utils.ts`:
    - `limitUtf8Bytes`: replaced repeated string concatenation with chunk array accumulation + `join('')`.
    - `limitCodePoints`: replaced repeated string concatenation with chunk array accumulation + `join('')`.
  - Preserved exact truncation semantics and code-point iteration behavior.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 6 with the next low-risk server runtime hotspot, prioritizing measurable allocation-reduction candidates.

### 2026-02-10 17:11 CET — Ticket 6 Message Serialization Allocation/Mutation Slice

- Status: `done`
- Key actions:
  - Optimized message serialization in `server/js/message.ts`:
    - `Drop.serialize`: replaced callback-based `map` with indexed loop to build hater-id list.
    - `List.serialize`: removed mutating `unshift` on caller-provided ids; now returns non-mutating serialized array `[LIST, ...ids]`.
  - Reduced callback overhead and removed an avoidable side-effect in serialization path.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 6 with the next low-risk runtime hotspot (server logging/format utility path or additional world fanout micro-optimizations).

### 2026-02-10 17:12 CET — Ticket 6 In-Place Group Player Removal Slice

- Status: `done`
- Key actions:
  - Optimized `removeFromGroups` in `server/js/worldserver.ts`:
    - Replaced `group.players = group.players.filter(...)` allocation path with in-place reverse scan + `splice` removal.
  - Preserved player-group membership semantics and ordering for remaining entries.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 6 with the next low-risk runtime hotspot while maintaining parity-first verification.

### 2026-02-10 17:13 CET — Ticket 6 Spawn Serialization Concat-Removal Slice

- Status: `done`
- Key actions:
  - Optimized `Spawn.serialize` in `server/js/message.ts`:
    - Replaced `concat`-based serialization with preallocated array fill using indexed copy from `entity.getState()`.
  - Preserved serialized payload shape/order.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 6 with next low-risk runtime optimization slice, then reassess whether Ticket 6 acceptance criteria are met enough to close or should remain in-progress.

### 2026-02-10 17:14 CET — Ticket 6 List Serialization Spread-Removal Slice

- Status: `done`
- Key actions:
  - Optimized `List.serialize` in `server/js/message.ts`:
    - Replaced spread-based array creation (`[LIST, ...ids]`) with preallocated array + indexed copy.
  - Preserved message format and ordering semantics.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 6 with next low-risk runtime allocation/callback reduction slice.

### 2026-02-10 17:17 CET — Backlog Organization Cleanup (Outstanding Workability)

- Status: `done`
- Key actions:
  - Added `Outstanding Workboard (Actionable Order)` section to front-load only remaining tickets (6, 9, 10, 7, 8, 11, 12) with immediate executable next slices.
  - Updated Ticket 6 acceptance criteria to include closure requirements still missing from execution logs:
    - before/after profiling notes,
    - explicit `Map`/`Set` substitution decision (implement or reject with rationale).
  - Normalized stale Ticket 6 baseline TODO block to `done` so checklist state matches executed slices.
- Evidence:
  - `TODO.md` now has a single ordered outstanding workboard and no stale in-progress checklist under completed Ticket 6 baseline slice.
- Next action:
  - Continue Ticket 6 and close it using the newly explicit acceptance gaps (profiling note + `Map`/`Set` decision), then proceed to Ticket 9.

### 2026-02-10 17:55 CET — Ticket 9 Baseline CI Path-Filter TODO

- Status: `done`
- TODO checklist:
  - `done` Audit workflow path filters against real repo paths/extensions.
  - `done` Fix one concrete trigger mismatch so workflow fires on actual changed files.
  - `done` Verify workflow references now match existing files and document evidence.
- Scope:
  - Included: `.github/workflows/verify-ws-boundary-drill.yml` trigger path filters.
  - Out of scope: broader CI caching/dev-loop changes in this slice.
- Acceptance criteria:
  - Workflow `paths` list references only existing relevant files/patterns for the drill.
  - At least one prior non-matching trigger path is corrected to real runtime source paths.
- Verification plan:
  - `rg --files` evidence for targeted runtime/test/tool paths.
  - `rg -n "paths:" .github/workflows/verify-ws-boundary-drill.yml` review after patch.
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue Ticket 9 with next workflow-trigger mismatch candidate.

### 2026-02-10 17:57 CET — Ticket 6 Closure (Profiling Notes + Map/Set Decision)

- Status: `done`
- Key actions:
  - Evaluated `Map`/`Set` substitution candidate on world group player collection in `server/js/worldserver.ts`.
  - Implemented `Set` variant, profiled hot-path simulation, then reverted after evidence showed no win in this workload.
  - Kept array-based player collection with previously applied in-place removal and other allocation reductions.
- Profiling notes (session microbench):
  - `spawn-old-concat: 27.33ms`
  - `spawn-new-prealloc: 18.66ms`
  - `list-old-spread: 33.07ms`
  - `list-new-prealloc: 31.64ms`
  - `group-array-add-remove-iterate: 6.09ms`
  - `group-set-add-remove-iterate: 9.19ms`
- Decision:
  - `Map/Set` substitution for `group.players` is `rejected for now` (measured slower in current simulated churn path).
- Evidence:
  - `bun run test:modern-parity` passed after final array-based state.
  - `bun run typecheck` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Proceed to Ticket 9 execution slices.

### 2026-02-10 17:57 CET — Ticket 9 Workflow Trigger Path-Fix Slice 1

- Status: `done`
- Key actions:
  - Updated `.github/workflows/verify-ws-boundary-drill.yml` path filters to match current source layout:
    - replaced stale `.mjs` runtime paths with `.ts` (`server/js/ws-runtime-esm.ts`, `server/js/ws-runtime-class-factory.ts`).
    - added current related seam files (`server/js/ws-runtime-class-factory-types.ts`, `shared/js/ws-close-codes.ts`).
    - removed non-existent docs path pattern and added `bun.lock` to trigger list.
  - Verified all referenced literal files exist in repository.
- Evidence:
  - `rg -n` review of workflow now shows `.ts` runtime paths and no stale `.mjs` entries.
  - file existence checks returned `ok` for referenced runtime/test/tool files.
  - `bun run test:ws:runtime:drill` passed.
- Next action:
  - Continue Ticket 9 with next trigger mismatch audit/fix candidate in remaining workflows.

### 2026-02-10 17:58 CET — Ticket 9 Dev Loop Server Auto-Restart TODO

- Status: `done`
- TODO checklist:
  - `done` Enable server watch/restart behavior in full-stack dev runner (`tools/dev-vite.ts`).
  - `done` Keep client Vite process behavior unchanged.
  - `done` Verify project checks still pass after dev-runner change.
- Scope:
  - Included: full-stack dev runner process command wiring.
  - Out of scope: adding a new external process manager.
- Acceptance criteria:
  - `bun run dev` full-stack lane starts server with watch-based restart semantics.
  - Vite client startup behavior remains unchanged.
- Verification plan:
  - Static command-path inspection in `tools/dev-vite.ts`.
  - `bun run typecheck`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue with next Ticket 9 slice.

### 2026-02-10 17:59 CET — Ticket 9 Dev Loop Server Auto-Restart Slice

- Status: `done`
- Key actions:
  - Enabled watch-based server restart behavior in full-stack dev runner:
    - updated `tools/dev-vite.ts` server process command from `bun server/js/main-esm.ts` to `bun --watch server/js/main-esm.ts`.
  - Kept client Vite process wiring unchanged.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 9 with CI speed/caching slice (Bun cache + Playwright browser cache in workflows).

### 2026-02-10 18:00 CET — Ticket 9 CI Cache Optimization TODO

- Status: `done`
- TODO checklist:
  - `done` Add Bun dependency cache step to browser CI workflows.
  - `done` Add Playwright browser binary cache step to browser CI workflows.
  - `done` Verify workflow syntax and keep install steps functional.
- Scope:
  - Included: `.github/workflows/verify-modern-browser.yml`, `.github/workflows/verify-protocol-invariant.yml`.
  - Out of scope: adding cache to every non-browser workflow in this slice.
- Acceptance criteria:
  - Browser workflows include cache restore/save for Bun install artifacts and Playwright browser cache.
  - Existing install/test steps remain in place and unbroken.
- Verification plan:
  - `rg -n "actions/cache@v4|ms-playwright|\.bun/install/cache" .github/workflows/verify-modern-browser.yml .github/workflows/verify-protocol-invariant.yml`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue Ticket 9 with next CI correctness slice.

### 2026-02-10 18:01 CET — Ticket 9 CI Cache Optimization Slice

- Status: `done`
- Key actions:
  - Added Bun install cache restore/save to browser workflows:
    - `.github/workflows/verify-modern-browser.yml`
    - `.github/workflows/verify-protocol-invariant.yml`
    - cache path: `~/.bun/install/cache`
  - Added Playwright browser binary cache restore/save to same workflows:
    - cache path: `~/.cache/ms-playwright`
  - Used deterministic cache keys scoped by runner OS + `bun.lock` hash with restore prefixes.
- Evidence:
  - `rg -n` confirms `actions/cache@v4` and both cache paths in both workflows.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 9 by tackling browser-runtime command/config drift guardrails (ensure workflow commands stay aligned with package scripts/config).

### 2026-02-10 18:01 CET — Ticket 9 Browser Runtime Drift Guard TODO

- Status: `done`
- TODO checklist:
  - `done` Add a repo check that validates browser workflow run commands against package scripts.
  - `done` Validate required Playwright config/test entrypoints referenced by browser scripts exist.
  - `done` Run the new drift check + full verification.
- Scope:
  - Included: drift guard tooling under `tools/` and package script wiring.
  - Out of scope: rewriting browser tests.
- Acceptance criteria:
  - Drift checker fails when workflow run commands no longer map to existing package scripts or missing browser config/test entrypoints.
  - Checker passes on current repo state.
- Verification plan:
  - `bun run check:browser:workflow-drift`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue Ticket 9 with remaining CI/dev-loop/lint coverage work.

### 2026-02-10 18:02 CET — Ticket 9 Browser Runtime Drift Guard Slice

- Status: `done`
- Key actions:
  - Added new drift checker: `tools/check-browser-workflow-drift.ts`.
    - Validates browser workflow run commands map to expected package scripts.
    - Validates required browser scripts exist in `package.json`.
    - Validates referenced Playwright config/test entrypoints exist.
  - Added package script: `check:browser:workflow-drift`.
- Evidence:
  - `bun run check:browser:workflow-drift` passed (`ok (3 scripts, 2 browser tests, workflows aligned)`).
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 9 with lint/format coverage decision slice (expand coverage or codify explicit exclusions).

### 2026-02-10 18:03 CET — Ticket 9 Lint/Format Scope Codification TODO

- Status: `done`
- TODO checklist:
  - `done` Document explicit lint/format scope and known exclusions in project docs.
  - `done` Include browser-workflow drift guard script in active script list.
  - `done` Verify docs update does not regress verification lane.
- Scope:
  - Included: `README.md` quality/check script documentation.
  - Out of scope: large lint expansion over all legacy server/client modules.
- Acceptance criteria:
  - Lint/format inclusion/exclusion scope is explicitly documented.
  - New drift guard command is discoverable in documented active scripts.
- Verification plan:
  - `rg -n "check:browser:workflow-drift|Lint/Format Scope|lint scope|format scope" README.md`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue Ticket 9 completion audit.

### 2026-02-10 18:04 CET — Ticket 9 Lint/Format Scope Codification Slice

- Status: `done`
- Key actions:
  - Updated `README.md` to codify current lint/format scope and explicit temporary exclusions under new `Lint/Format Scope` section.
  - Added `check:browser:workflow-drift` to documented active scripts for discoverability.
- Evidence:
  - `rg -n` confirms `Lint/Format Scope` and drift-check script documentation in `README.md`.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Re-audit Ticket 9 acceptance criteria and close ticket if all scoped items are addressed.

### 2026-02-10 18:04 CET — Ticket 9 Closure Verification

- Status: `done`
- Key actions:
  - Completed CI trigger correctness slice (`verify-ws-boundary-drill.yml` stale path fix).
  - Completed full-stack dev loop improvement (`tools/dev-vite.ts` server `--watch` restart behavior).
  - Completed CI speed slice (Bun + Playwright caching in browser workflows).
  - Added browser workflow drift guard (`tools/check-browser-workflow-drift.ts` + package script).
  - Codified lint/format scope + temporary exclusions in `README.md`.
- Evidence:
  - `bun run test:ws:runtime:drill` passed.
  - `bun run check:browser:workflow-drift` passed.
  - `bun run verify:modern:node22` passed after each slice and final closure pass.
- Next action:
  - Start Ticket 10 baseline slice (metrics dependency reproducibility + CI install policy).

### 2026-02-10 18:05 CET — Ticket 10 Baseline Metrics Reproducibility TODO

- Status: `done`
- TODO checklist:
  - `done` Move metrics dependency to lockfile-managed package dependency surface.
  - `done` Remove ad-hoc optional install step from metrics CI workflow.
  - `done` Update prerequisites/docs wording to reflect lockfile-managed install policy.
  - `done` Verify metrics checks and full verify lane pass.
- Scope:
  - Included: `package.json` dependency policy, `.github/workflows/verify-metrics-healthy.yml`, metrics prerequisite guidance.
  - Out of scope: external metrics platform migration.
- Acceptance criteria:
  - CI no longer installs `memcache` ad-hoc with `--no-save`.
  - Metrics-enabled test path uses lockfile-resolved dependencies only.
- Verification plan:
  - `bun run check:metrics:healthy-prereqs`
  - `bun run test:metrics:healthy` (when memcached reachable)
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - memcached service availability for healthy metrics test.
- Next action:
  - Completed; run closure verification and move to Ticket 7 baseline decomposition slice.

### 2026-02-10 18:12 CET — Ticket 10 Metrics Verification + Determinism Fix

- Status: `done`
- Key actions:
  - Validated lockfile-managed metrics dependency and CI workflow policy changes:
    - `memcache` dependency in `package.json`/`bun.lock`
    - removed ad-hoc workflow install behavior from `.github/workflows/verify-metrics-healthy.yml`
    - standardized metrics workflow env overrides (`BQ_TEST_METRICS_HOST`, `BQ_TEST_METRICS_PORT`).
  - Hardened structured lifecycle smoke against ambient local memcached state:
    - updated unreachable-backend test in `tests/smoke/server-structured-logs.lifecycle.test.ts` to use explicit closed loopback port `65534`.
- Evidence:
  - `bun run check:metrics:healthy-prereqs` failed as expected with no memcached (`ECONNREFUSED`).
  - Started temporary memcached container and confirmed:
    - `bun run check:metrics:healthy-prereqs` passed.
    - `bun run test:metrics:healthy` passed.
  - `bun run test:logs:lifecycle` passed after deterministic port fix.
  - `bun run verify:modern:node22` passed after container cleanup.
- Next action:
  - Mark Ticket 10 closed and continue with Ticket 7 first extraction seam planning/execution.

### 2026-02-10 18:13 CET — Ticket 10 Closure Verification

- Status: `done`
- Key actions:
  - Re-audited Ticket 10 acceptance criteria against repository state and verification outputs.
  - Confirmed metrics reproducibility now depends on committed lockfile/install flow only.
  - Confirmed CI metrics workflow no longer performs ad-hoc runtime dependency installs.
- Evidence:
  - `rg -n "memcache|--no-save|check:metrics:healthy-prereqs|BQ_TEST_METRICS_HOST|BQ_TEST_METRICS_PORT" package.json bun.lock .github/workflows/verify-metrics-healthy.yml tools/check-metrics-healthy-prereqs.ts server/README.md` confirms policy/runtime wiring.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Start Ticket 7 baseline TODO with explicit first seam and acceptance criteria.

### 2026-02-10 18:16 CET — Ticket 7 Baseline Player Session-Seam TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `Player` connection/protocol message handling from constructor into a dedicated session module.
  - `done` Keep external `Player` behavior and callback wiring unchanged.
  - `done` Verify handshake/smoke behavior and full modern verification lane.
- Scope:
  - Included: first decomposition seam for server-side `Player` protocol/session wiring only.
  - Out of scope: full `WorldServer` subsystem split and client `Game` decomposition.
- Acceptance criteria:
  - `server/js/player.ts` constructor delegates protocol/session wiring to an extracted module.
  - Existing handshake and gameplay protocol tests remain green.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue Ticket 7 with next incremental seam extraction on `WorldServer` orchestration boundaries.

### 2026-02-10 18:27 CET — Ticket 7 Player Session Seam Extraction Slice

- Status: `done`
- Key actions:
  - Added dedicated session module `server/js/player-session.ts` for player connection/protocol handling.
  - Refactored `server/js/player.ts` constructor to delegate protocol/session wiring to `attachPlayerSession(this)`.
  - Added `server/js/player-session.ts` to explicit typecheck project include lists:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Start next Ticket 7 slice by extracting one coarse `WorldServer` subsystem seam (group/broadcast transport facade) without changing protocol behavior.

### 2026-02-10 18:28 CET — Ticket 7 WorldServer Transport-Seam TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `WorldServer` message fanout/transport helpers into a dedicated module.
  - `done` Keep queue ordering and serialization behavior unchanged.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `pushToPlayer`, `pushToGroup`, `pushToAdjacentGroups`, `pushBroadcast` and shared fanout helpers.
  - Out of scope: game logic, spawning, hate/aggro, pathfinding, and protocol schema changes.
- Acceptance criteria:
  - `server/js/worldserver.ts` delegates transport fanout to an extracted module.
  - Existing fanout behavior remains parity-safe.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue Ticket 7 with the next coarse subsystem extraction seam.

### 2026-02-10 18:40 CET — Ticket 7 WorldServer Transport-Seam Slice

- Status: `done`
- Key actions:
  - Added `server/js/worldserver-transport.ts` to own queue fanout transport helpers:
    - `pushSerializedToPlayerQueue`
    - `pushSerializedToGroupQueue`
    - `pushSerializedToAdjacentGroupsQueue`
    - `pushSerializedBroadcastQueue`
  - Refactored `server/js/worldserver.ts` transport methods to delegate to extracted helpers:
    - `pushSerializedToPlayer`
    - `pushSerializedToGroup`
    - `pushToAdjacentGroups`
    - `pushBroadcast`
  - Updated worldserver boundary inventory contract to include new dependency seam:
    - `server/js/worldserver-types.ts`
    - `tests/unit/worldserver-shadow-source-pre-slice.test.ts`.
  - Added new module to explicit typecheck project include lists.
- Evidence:
  - `bun run typecheck` passed.
  - `bun test tests/unit/worldserver-shadow-source-pre-slice.test.ts --timeout 20000` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Start next Ticket 7 seam by extracting player lifecycle wiring from `WorldServer` constructor into a dedicated lifecycle module.

### 2026-02-10 18:41 CET — Ticket 7 WorldServer Player-Lifecycle Seam TODO

- Status: `done`
- TODO checklist:
  - `done` Extract player connect/enter callback wiring from `WorldServer` constructor into a lifecycle helper module.
  - `done` Keep join/leave logging, movement/zone/broadcast hooks, and callback side effects behaviorally identical.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: callback wiring currently registered inside constructor `onPlayerConnect` and `onPlayerEnter`.
  - Out of scope: broader game-loop logic and mob/combat orchestration.
- Acceptance criteria:
  - `WorldServer` constructor delegates player lifecycle callback wiring to an extracted module.
  - Existing connect/enter/exit behaviors and protocol flow remain unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue Ticket 7 by extracting another coarse seam from `WorldServer`/client `Game` orchestrators.

### 2026-02-10 18:51 CET — Ticket 7 WorldServer Player-Lifecycle Seam Slice

- Status: `done`
- Key actions:
  - Added `server/js/worldserver-player-lifecycle.ts` to own player connect/enter callback wiring previously embedded in `WorldServer` constructor.
  - Refactored `server/js/worldserver.ts` constructor to delegate lifecycle hook registration via `installWorldPlayerLifecycle(this)`.
  - Updated worldserver boundary inventory contracts and explicit typecheck include lists for new lifecycle seam module.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next decomposition seam (candidate: client `Game` subsystem boundary extraction for network/session wiring).

### 2026-02-10 18:53 CET — Ticket 7 WorldServer Queue-Flush Transport TODO

- Status: `done`
- TODO checklist:
  - `done` Move `WorldServer.processQueues` queue-drain behavior into `worldserver-transport` helper module.
  - `done` Preserve queue send ordering and queue-reset semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: queue flush/send behavior only.
  - Out of scope: websocket transport contract changes and gameplay loop behavior.
- Acceptance criteria:
  - `WorldServer.processQueues` delegates queue flush logic to an extracted transport helper.
  - Queue payload ordering and reset behavior remain unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue next Ticket 7 subsystem slice.

### 2026-02-10 18:56 CET — Ticket 7 WorldServer Queue-Flush Transport Slice

- Status: `done`
- Key actions:
  - Added `flushOutgoingQueues` helper to `server/js/worldserver-transport.ts`.
  - Refactored `server/js/worldserver.ts#processQueues` to delegate queue drain/send behavior to transport helper.
  - Preserved queue order and queue-reset semantics (`connection.send(queue)` then `queue.length = 0`).
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next decomposition seam (client `Game` network/session extraction) in incremental slices.

### 2026-02-10 18:59 CET — Ticket 7 Client Game Session-Bootstrap TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `Game.connect` bootstrap handler wiring (`onDispatched`, `onConnected`, `onEntityList`) into dedicated helper module.
  - `done` Preserve handshake bootstrap and entity-list reconciliation behavior exactly.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: initial network/session bootstrap callbacks inside `Game.connect`.
  - Out of scope: `onWelcome` downstream gameplay callback graph.
- Acceptance criteria:
  - `client/js-esm/game.ts` delegates initial session bootstrap handlers to an extracted helper module.
  - Handshake and entity-list behavior remain unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue Ticket 7 client decomposition with next network callback extraction slice.

### 2026-02-10 19:01 CET — Ticket 7 Client Game Session-Bootstrap Slice

- Status: `done`
- Key actions:
  - Added `client/js-esm/game-session-bootstrap.ts` to own initial `GameClient` session/bootstrap callback wiring:
    - `onDispatched`
    - `onConnected`
    - `onEntityList`
  - Refactored `client/js-esm/game.ts#connect` to delegate those callbacks via `installGameSessionBootstrapHandlers(...)`.
  - Preserved downstream `onWelcome` callback graph unchanged.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with the next incremental client network/session extraction slice from `Game.connect` (`onWelcome` subgraph partitioning).

### 2026-02-10 19:07 CET — Ticket 7 Client Welcome-Bootstrap Subgraph TODO

- Status: `done`
- TODO checklist:
  - `done` Extract the first `Game.connect` `onWelcome` bootstrap subgraph (player identity/state init + welcome notification/storage branch) into a dedicated helper module.
  - `done` Keep runtime behavior and side-effect ordering identical.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: initial `onWelcome` state setup before `player.onStartPathing` registration.
  - Out of scope: remaining `onWelcome` callback graph registrations.
- Acceptance criteria:
  - `Game.connect` delegates initial `onWelcome` bootstrap to extracted helper module.
  - Welcome handshake/state-init behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue with the next `onWelcome` callback partition.

### 2026-02-10 19:10 CET — Ticket 7 Client Welcome-Bootstrap Subgraph Slice

- Status: `done`
- Key actions:
  - Added `client/js-esm/game-session-welcome.ts` with `applyWelcomeBootstrap(...)` to own initial welcome-state bootstrap logic.
  - Refactored `client/js-esm/game.ts#connect` `onWelcome` handler to delegate bootstrap logic through helper adapter wiring.
  - Preserved existing callback graph after bootstrap (`player.onStartPathing` onward) unchanged.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 by extracting the next `onWelcome` callback cluster (player movement/pathing registration block) into a dedicated helper.

### 2026-02-10 19:14 CET — Ticket 7 Client Start-Pathing Callback TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `player.onStartPathing` registration from `onWelcome` into dedicated helper module.
  - `done` Keep move-dispatch and target-cell/dirty-rect behavior identical.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onStartPathing` callback logic only.
  - Out of scope: other `onWelcome` player/client callback registrations.
- Acceptance criteria:
  - `Game.connect` `onWelcome` delegates `onStartPathing` registration to helper module.
  - Pathing and mobile target-cell behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue with next callback cluster extraction.

### 2026-02-10 19:17 CET — Ticket 7 Client Start-Pathing Callback Slice

- Status: `done`
- Key actions:
  - Added `client/js-esm/game-session-player-pathing.ts` with `installPlayerStartPathingHandler(...)`.
  - Refactored `client/js-esm/game.ts` `onWelcome` flow to delegate `player.onStartPathing` registration through helper adapter wiring.
  - Preserved callback semantics for:
    - loot-move state reset
    - server `sendMove` dispatch
    - target-cell selection state
    - mobile/tablet target dirty-rect path.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 by extracting the next `onWelcome` callback cluster (`onCheckAggro`/`onAggro`) into a helper module.

### 2026-02-10 19:20 CET — Ticket 7 Client Aggro Callback Cluster TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `onWelcome` aggro-related callback registrations (`player.onCheckAggro`, `player.onAggro`) into dedicated helper module.
  - `done` Keep aggro trigger/guard/send semantics identical.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: aggro callback cluster only.
  - Out of scope: other movement/combat callback registrations.
- Acceptance criteria:
  - `Game.connect` `onWelcome` delegates aggro callback cluster to helper module.
  - Aggro behavior and outbound `sendAggro` flow remain unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue with next `onWelcome` callback cluster extraction.

### 2026-02-10 19:23 CET — Ticket 7 Client Aggro Callback Cluster Slice

- Status: `done`
- Key actions:
  - Added `client/js-esm/game-session-player-aggro.ts` with `installPlayerAggroHandlers(...)`.
  - Refactored `client/js-esm/game.ts` `onWelcome` flow to delegate `player.onCheckAggro` and `player.onAggro` callback setup through helper adapter wiring.
  - Preserved guard conditions for queued mob-attack state and existing `sendAggro` dispatch behavior.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 by extracting the next `onWelcome` callback cluster (`onBeforeStep`/`onStep`) into a helper module.

### 2026-02-10 19:27 CET — Ticket 7 Client Before-Step Callback TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `player.onBeforeStep` registration from `onWelcome` into dedicated helper module.
  - `done` Preserve block-detection logging and unregister behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onBeforeStep` callback logic only.
  - Out of scope: `onStep` and other callback registrations.
- Acceptance criteria:
  - `Game.connect` `onWelcome` delegates `player.onBeforeStep` to helper module.
  - Blocking-entity debug logging and unregister flow remain unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue with the next callback cluster extraction.

### 2026-02-10 19:30 CET — Ticket 7 Client Before-Step Callback Slice

- Status: `done`
- Key actions:
  - Added `client/js-esm/game-session-player-before-step.ts` with `installPlayerBeforeStepHandler(...)`.
  - Refactored `client/js-esm/game.ts` `onWelcome` flow to delegate `player.onBeforeStep` registration via helper adapter wiring.
  - Kept existing behavior:
    - `getEntityAt(nextGridX, nextGridY)` block detection.
    - debug logging for non-self blocking entities.
    - player unregister before step transition.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk `onWelcome` callback cluster extraction.

### 2026-02-10 19:34 CET — Ticket 7 Client Cosmetic Callback Cluster TODO

- Status: `done`
- TODO checklist:
  - `done` Extract player cosmetic callback registrations (`onHasMoved`, `onArmorLoot`, `onSwitchItem`, `onInvincible`) from `onWelcome` into helper module.
  - `done` Preserve bubble assignment, sprite switching, player-save snapshot, and callback notifications.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: cosmetic/player-state callback cluster only.
  - Out of scope: combat/spawn/pathing callback registration paths.
- Acceptance criteria:
  - `Game.connect` `onWelcome` delegates the cosmetic callback cluster to a helper module.
  - Existing equipment/invincibility callback and storage side effects remain unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue with next low-risk callback cluster extraction.

### 2026-02-10 19:37 CET — Ticket 7 Client Cosmetic Callback Cluster Slice

- Status: `done`
- Key actions:
  - Added `client/js-esm/game-session-player-cosmetics.ts` with `installPlayerCosmeticHandlers(...)`.
  - Refactored `client/js-esm/game.ts` `onWelcome` flow to delegate:
    - `player.onHasMoved`
    - `player.onArmorLoot`
    - `player.onSwitchItem`
    - `player.onInvincible`
    registrations through helper adapter wiring.
  - Preserved callback side effects for bubble placement, equipment snapshot persistence, equipment callback dispatch, invincibility callback dispatch, and Firefox armor switch.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 by extracting the next `onWelcome` cluster (entity/chest spawn callback registration) in incremental slices.

### 2026-02-10 19:41 CET — Ticket 7 Client Spawn Item/Chest Callback TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `onSpawnItem` and `onSpawnChest` callback registrations from `onWelcome` into dedicated helper module.
  - `done` Preserve spawn logging, sprite wiring, chest-open removal animation, and previous-click reset behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: item/chest spawn callback cluster only.
  - Out of scope: `onSpawnCharacter` callback graph.
- Acceptance criteria:
  - `Game.connect` `onWelcome` delegates item/chest spawn callback registrations to helper module.
  - Runtime spawn behavior and side effects remain unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue with next `onSpawnCharacter` callback subcluster extraction.

### 2026-02-10 19:46 CET — Ticket 7 Spawned Character Motion Callback TODO

- Status: `done`
- TODO checklist:
  - `done` Extract spawned-character motion callback registrations (`entity.onBeforeStep`, `entity.onStep`) from `onSpawnCharacter` into helper module.
  - `done` Preserve dual-position registration and attacker-follow/look behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onSpawnCharacter` motion callback subcluster only.
  - Out of scope: `onStopPathing`/`onRequestPath`/`onDeath` and other spawn-character callback logic.
- Acceptance criteria:
  - `onSpawnCharacter` delegates `entity.onBeforeStep` and `entity.onStep` wiring to helper module.
  - Existing movement/combat-follow behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue with next `onSpawnCharacter` callback subcluster extraction.

### 2026-02-10 19:50 CET — Ticket 7 Spawn Item/Chest Callback Slice

- Status: `done`
- Key actions:
  - Added `client/js-esm/game-session-spawn-primitives.ts` with `installSpawnPrimitiveHandlers(...)`.
  - Refactored `client/js-esm/game.ts` `onWelcome` flow to delegate:
    - `client.onSpawnItem`
    - `client.onSpawnChest`
    callback registrations via helper adapter wiring.
  - Preserved spawn logging, chest sprite wiring, chest-open death animation flow, removal/render-grid cleanup, and previous-click reset side effects.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next `onSpawnCharacter` callback subcluster extraction.

### 2026-02-10 19:52 CET — Ticket 7 Spawned Character Motion Callback Slice

- Status: `done`
- Key actions:
  - Added `client/js-esm/game-session-spawn-character-motion.ts` with `installSpawnedCharacterMotionHandlers(...)`.
  - Refactored `client/js-esm/game.ts` `onSpawnCharacter` flow to delegate:
    - `entity.onBeforeStep`
    - `entity.onStep`
    callback registrations via helper adapter wiring.
  - Kept dual-position registration and attacker-follow/look-at behavior unchanged.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next `onSpawnCharacter` callback cluster extraction (`onStopPathing`).

### 2026-02-10 19:56 CET — Ticket 7 Spawned Character Path-Request Callback TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `entity.onRequestPath` registration from `onSpawnCharacter` into helper module.
  - `done` Preserve ignore-self and ignore-target(+attackers) pathing behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: spawned-character path-request callback only.
  - Out of scope: `onStopPathing` and `onDeath` spawned-character callback logic.
- Acceptance criteria:
  - `onSpawnCharacter` delegates `entity.onRequestPath` setup to helper module.
  - Pathfinding ignore-list behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue with next `onSpawnCharacter` callback subcluster extraction.

### 2026-02-10 20:00 CET — Ticket 7 Spawned Character Path-Request Callback Slice

- Status: `done`
- Key actions:
  - Added `client/js-esm/game-session-spawn-character-path-request.ts` with `installSpawnedCharacterPathRequestHandler(...)`.
  - Refactored `client/js-esm/game.ts` `onSpawnCharacter` flow to delegate `entity.onRequestPath` callback registration via helper adapter wiring.
  - Kept ignore-list semantics:
    - always ignore self
    - ignore current target when present
    - otherwise ignore previous target
    - include target attackers when available.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next `onSpawnCharacter` callback cluster extraction (`onDeath`).

### 2026-02-10 20:04 CET — Ticket 7 Spawned Character Death Callback TODO

- Status: `done`
- TODO checklist:
  - `done` Extract spawned-character `entity.onDeath` callback registration from `onSpawnCharacter` into helper module.
  - `done` Preserve death-position capture, death animation/removal flow, attacker disengage, cursor/sound side effects.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: spawned-character `onDeath` callback only.
  - Out of scope: `onStopPathing` and other spawned-character callback registrations.
- Acceptance criteria:
  - `onSpawnCharacter` delegates `entity.onDeath` setup to helper module.
  - Existing death/removal behavior and side effects remain unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue with next `onSpawnCharacter` callback subcluster extraction.

### 2026-02-10 20:09 CET — Ticket 7 Spawned Character Death Callback Slice

- Status: `done`
- Key actions:
  - Added `client/js-esm/game-session-spawn-character-death.ts` with `installSpawnedCharacterDeathHandler(...)`.
  - Refactored `client/js-esm/game.ts` `onSpawnCharacter` flow to delegate `entity.onDeath` registration through helper adapter wiring.
  - Preserved death behavior and side effects:
    - death-position capture for mobs
    - death sprite/animation/removal sequence
    - attacker disengage
    - player target disengage
    - entity/pathing grid removal for interaction unblocking
    - visible kill sound selection
    - cursor refresh.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk spawned-character callback extraction.

### 2026-02-10 20:12 CET — Ticket 7 Spawned Character Move-Bubble Callback TODO

- Status: `done`
- TODO checklist:
  - `done` Extract spawned-character `entity.onHasMoved` registration from `onSpawnCharacter` into helper module.
  - `done` Preserve moving-entity bubble follow behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: spawned-character `onHasMoved` callback only.
  - Out of scope: other spawned-character callback registrations.
- Acceptance criteria:
  - `onSpawnCharacter` delegates `entity.onHasMoved` setup to helper module.
  - Bubble-follow behavior for moving entities remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Next action:
  - Completed; continue with next spawned-character callback extraction.

### 2026-02-10 20:15 CET — Ticket 7 Spawned Character Move-Bubble Callback Slice

- Status: `done`
- Key actions:
  - Added `client/js-esm/game-session-spawn-character-bubble.ts` with `installSpawnedCharacterBubbleHandler(...)`.
  - Refactored `client/js-esm/game.ts` `onSpawnCharacter` flow to delegate `entity.onHasMoved` callback registration via helper adapter wiring.
  - Preserved moving-entity chat bubble follow behavior.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next `onSpawnCharacter` callback cluster extraction (`onStopPathing`).

### 2026-02-10 20:19 CET — Ticket 7 Spawned Character Stop-Pathing Callback TODO

- Status: `done`
- TODO checklist:
  - `done` Extract spawned-character `entity.onStopPathing` registration from `onSpawnCharacter` into helper module.
  - `done` Preserve target orientation, player-door warp behavior, attacker follow logic, and position re-registration.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: spawned-character `onStopPathing` callback only.
  - Out of scope: remaining spawned-character callback registrations.
- Acceptance criteria:
  - `onSpawnCharacter` delegates `entity.onStopPathing` setup to helper module.
  - Existing stop-pathing side effects remain unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-spawn-character-stop-pathing.ts` with `installSpawnedCharacterStopPathingHandler(...)`.
  - Refactored `client/js-esm/game.ts` `onSpawnCharacter` flow to delegate `entity.onStopPathing` registration through helper adapters.
  - Preserved existing stop-pathing behavior, including door destination handling and attacker follow updates.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk `onSpawnCharacter` extraction slice.

### 2026-02-10 19:27 CET — Ticket 7 Spawned Character Mob Target-Link TODO

- Status: `done`
- TODO checklist:
  - `done` Extract mob target-link setup in `onSpawnCharacter` (when `targetId` exists) into a helper module.
  - `done` Preserve attack-link creation behavior and target guard checks.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: mob target-link initialization in spawned-character flow.
  - Out of scope: other spawned-character callback registrations.
- Acceptance criteria:
  - `onSpawnCharacter` delegates mob target-link setup to helper module.
  - Existing target-link behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-spawn-character-mob-target-link.ts` with `installSpawnedMobTargetLink(...)`.
  - Refactored `client/js-esm/game.ts` to delegate mob target-link setup from `onSpawnCharacter` via helper adapter wiring.
  - Preserved existing target resolution guard (`targetId` truthiness + target character check).
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with the next low-risk spawned-character initialization extraction.

### 2026-02-10 19:29 CET — Ticket 7 Spawned Character Bootstrap Setup TODO

- Status: `done`
- TODO checklist:
  - `done` Extract non-player spawn bootstrap setup (`setSprite`, position/orientation, idle, addEntity, spawn log) into helper module.
  - `done` Preserve spawn state initialization behavior and debug log output.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: initial non-player spawn bootstrap setup in `onSpawnCharacter`.
  - Out of scope: spawned-character callback registrations and combat link setup.
- Acceptance criteria:
  - `onSpawnCharacter` delegates bootstrap setup to helper module.
  - Existing non-player spawn state initialization remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-spawn-character-bootstrap.ts` with `applySpawnedCharacterBootstrap(...)`.
  - Refactored `client/js-esm/game.ts` to delegate non-player spawn setup from `onSpawnCharacter` through helper adapters.
  - Preserved spawn debug logging content and initialization order.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next `Game.connect` callback extraction slice.

### 2026-02-10 19:31 CET — Ticket 7 Client Despawn Callback Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `client.onDespawnEntity` handling from `Game.connect` into a helper module.
  - `done` Preserve item removal, character death/disengage behavior, chest open behavior, and click-position clearing behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onDespawnEntity` callback flow only.
  - Out of scope: other client callback registrations.
- Acceptance criteria:
  - `Game.connect` delegates despawn callback body to helper module.
  - Existing despawn behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-despawn.ts` with `handleEntityDespawn(...)`.
  - Refactored `client/js-esm/game.ts` `onDespawnEntity` callback to delegate through helper adapters.
  - Fixed helper typing to use shared `EntityKind` contract after initial typecheck mismatch.
- Evidence:
  - `bun run typecheck` failed initially (`kind` type mismatch), then passed after type fix.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next `Game.connect` callback extraction slice.

### 2026-02-10 19:33 CET — Ticket 7 Client Entity-Move Callback Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `client.onEntityMove` handling from `Game.connect` into a helper module.
  - `done` Preserve player-exclusion guard, coward achievement trigger, disengage/idle behavior, and pathing command behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onEntityMove` callback flow only.
  - Out of scope: other client callback registrations.
- Acceptance criteria:
  - `Game.connect` delegates entity-move callback body to helper module.
  - Existing entity-move behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-entity-move.ts` with `handleEntityMove(...)`.
  - Refactored `client/js-esm/game.ts` `onEntityMove` callback to delegate through helper adapters.
  - Fixed type inference by binding helper usage to `Character` at call-site.
- Evidence:
  - `bun run typecheck` failed initially (entity type inference mismatch), then passed after call-site generic binding.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next `Game.connect` callback extraction slice.

### 2026-02-10 19:36 CET — Ticket 7 Client Entity-Destroy Callback Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `client.onEntityDestroy` handling from `Game.connect` into a helper module.
  - `done` Preserve item removal vs generic entity removal behavior and destruction debug logging behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onEntityDestroy` callback flow only.
  - Out of scope: other client callback registrations.
- Acceptance criteria:
  - `Game.connect` delegates entity-destroy callback body to helper module.
  - Existing destroy behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-entity-destroy.ts` with `handleEntityDestroy(...)`.
  - Refactored `client/js-esm/game.ts` `onEntityDestroy` callback to delegate through helper adapters.
  - Preserved item-first removal branching and destruction log message shape.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next `Game.connect` callback extraction slice.

### 2026-02-10 19:40 CET — Ticket 7 Client Player-Move-To-Item Callback Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `client.onPlayerMoveToItem` handling from `Game.connect` into a helper module.
  - `done` Preserve mob-retarget handling, target follow behavior, and player move-to callback behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onPlayerMoveToItem` callback flow only.
  - Out of scope: other client callback registrations.
- Acceptance criteria:
  - `Game.connect` delegates player-move-to-item callback body to helper module.
  - Existing callback behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-player-move-to-item.ts` with `handlePlayerMoveToItem(...)`.
  - Refactored `client/js-esm/game.ts` `onPlayerMoveToItem` callback to delegate through helper adapters.
  - Bound helper usage to `Character` and `GridIndexedEntity` at call-site to preserve movement behavior.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk `Game.connect` callback extraction slice.

### 2026-02-10 19:44 CET — Ticket 7 Client Item-Blink Callback Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `client.onItemBlink` handling from `Game.connect` into a helper module.
  - `done` Preserve blink-speed and entity-existence guard behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onItemBlink` callback flow only.
  - Out of scope: other client callback registrations.
- Acceptance criteria:
  - `Game.connect` delegates item-blink callback body to helper module.
  - Existing item blink behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-item-blink.ts` with `handleItemBlink(...)`.
  - Refactored `client/js-esm/game.ts` `onItemBlink` callback to delegate via helper call.
  - Preserved blink speed (`150`) and null-guard semantics.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next `Game.connect` callback extraction slice.

### 2026-02-10 19:47 CET — Ticket 7 Client Entity-Attack Callback Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `client.onEntityAttack` handling from `Game.connect` into a helper module.
  - `done` Preserve attacker/target guards, delayed retaliatory link branch, and standard attack-link branch behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onEntityAttack` callback flow only.
  - Out of scope: other combat-related callbacks.
- Acceptance criteria:
  - `Game.connect` delegates entity-attack callback body to helper module.
  - Existing combat link behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-entity-attack.ts` with `handleEntityAttack(...)`.
  - Refactored `client/js-esm/game.ts` `onEntityAttack` callback to delegate through helper adapters.
  - Preserved delayed retaliatory link condition and `200ms` scheduling behavior.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next `Game.connect` callback extraction slice.

### 2026-02-10 19:50 CET — Ticket 7 Client Player-Damage-Mob Callback Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `client.onPlayerDamageMob` handling from `Game.connect` into a helper module.
  - `done` Preserve mob existence + points guard behavior and damage info rendering call behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onPlayerDamageMob` callback flow only.
  - Out of scope: other combat callbacks.
- Acceptance criteria:
  - `Game.connect` delegates player-damage-mob callback body to helper module.
  - Existing damage info behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-player-damage-mob.ts` with `handlePlayerDamageMob(...)`.
  - Refactored `client/js-esm/game.ts` `onPlayerDamageMob` callback to delegate via helper adapters.
  - Fixed helper damage-kind typing to match `InfoManager` (`'inflicted'` literal).
- Evidence:
  - `bun run typecheck` failed initially (`DamageInfoType` mismatch), then passed after helper type narrowing.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next combat callback extraction slice.

### 2026-02-10 19:54 CET — Ticket 7 Client Player-Kill-Mob Callback Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `client.onPlayerKillMob` handling from `Game.connect` into a helper module.
  - `done` Preserve mob-name normalization and notification phrasing behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onPlayerKillMob` callback flow only.
  - Out of scope: other combat callbacks.
- Acceptance criteria:
  - `Game.connect` delegates player-kill-mob callback body to helper module.
  - Existing notification behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-player-kill-mob.ts` with `handlePlayerKillMob(...)`.
  - Refactored `client/js-esm/game.ts` `onPlayerKillMob` callback to delegate through helper adapters.
  - Fixed helper `kind` typing to the shared `EntityKind` contract after initial type mismatch.
- Evidence:
  - `bun run typecheck` failed initially (`EntityKind` mismatch), then passed after helper type fix.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next `Game.connect` callback extraction slice.

### 2026-02-10 20:00 CET — Ticket 7 Client Player-Change-Health Callback Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `client.onPlayerChangeHealth` handling from `Game.connect` into a helper module.
  - `done` Preserve hurt/heal branch behavior, sound/effects side effects, and death/update-bars behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onPlayerChangeHealth` callback flow only.
  - Out of scope: other health/equipment callbacks.
- Acceptance criteria:
  - `Game.connect` delegates player-change-health callback body to helper module.
  - Existing health mutation and side effects remain unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-player-change-health.ts` with `handlePlayerChangeHealth(...)`.
  - Refactored `client/js-esm/game.ts` `onPlayerChangeHealth` callback to delegate through helper adapters.
  - Preserved received/healed damage info branches, hurt-side effects, and post-update bars refresh.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next player-state callback extraction slice.

### 2026-02-10 20:03 CET — Ticket 7 Client Player-Max-HP Callback Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `client.onPlayerChangeMaxHitPoints` handling from `Game.connect` into a helper module.
  - `done` Preserve max HP + current HP sync behavior and bar refresh behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onPlayerChangeMaxHitPoints` callback flow only.
  - Out of scope: other player callbacks.
- Acceptance criteria:
  - `Game.connect` delegates max-HP callback body to helper module.
  - Existing max-HP update behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-player-max-hit-points.ts` with `handlePlayerMaxHitPoints(...)`.
  - Refactored `client/js-esm/game.ts` `onPlayerChangeMaxHitPoints` callback to delegate through helper adapters.
  - Preserved max/current hitpoint synchronization and immediate bar refresh.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next player callback extraction slice.

### 2026-02-10 20:07 CET — Ticket 7 Client Player-Equip-Item Callback Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `client.onPlayerEquipItem` handling from `Game.connect` into a helper module.
  - `done` Preserve armor/weapon branching, sprite update behavior, and weapon-name update behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onPlayerEquipItem` callback flow only.
  - Out of scope: teleport/drop/chat/population callbacks.
- Acceptance criteria:
  - `Game.connect` delegates player-equip callback body to helper module.
  - Existing equip visual/state behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-player-equip-item.ts` with `handlePlayerEquipItem(...)`.
  - Refactored `client/js-esm/game.ts` `onPlayerEquipItem` callback to delegate through helper adapters.
  - Preserved item-name resolution via gametypes and armor/weapon branch behavior.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next player callback extraction slice.

### 2026-02-10 20:11 CET — Ticket 7 Client Player-Teleport Callback Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `client.onPlayerTeleport` handling from `Game.connect` into a helper module.
  - `done` Preserve local-player exclusion guard, teleport-orientation behavior, and attacker disengage/stop behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onPlayerTeleport` callback flow only.
  - Out of scope: drop/chat/population callbacks.
- Acceptance criteria:
  - `Game.connect` delegates player-teleport callback body to helper module.
  - Existing teleport side effects remain unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-player-teleport.ts` with `handlePlayerTeleport(...)`.
  - Refactored `client/js-esm/game.ts` `onPlayerTeleport` callback to delegate through helper adapters.
  - Preserved teleport orientation restoration and attacker disengage/idle/stop reset sequence.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next callback extraction slice.

### 2026-02-10 20:15 CET — Ticket 7 Client Drop-Item Callback Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `client.onDropItem` handling from `Game.connect` into a helper module.
  - `done` Preserve dead-mob-position guard, item placement behavior, and cursor refresh behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onDropItem` callback flow only.
  - Out of scope: chat/population/disconnect callbacks.
- Acceptance criteria:
  - `Game.connect` delegates drop-item callback body to helper module.
  - Existing item drop placement behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-drop-item.ts` with `handleDropItem(...)`.
  - Refactored `client/js-esm/game.ts` `onDropItem` callback to delegate through helper adapters.
  - Preserved dead-mob position guard and cursor refresh behavior.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next callback extraction slice.

### 2026-02-10 20:20 CET — Ticket 7 Client Chat-Message Callback Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `client.onChatMessage` handling from `Game.connect` into a helper module.
  - `done` Preserve bubble creation, bubble attachment, and chat sound behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onChatMessage` callback flow only.
  - Out of scope: population/disconnect callbacks.
- Acceptance criteria:
  - `Game.connect` delegates chat-message callback body to helper module.
  - Existing chat presentation/audio behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-chat-message.ts` with `handleChatMessage(...)`.
  - Refactored `client/js-esm/game.ts` `onChatMessage` callback to delegate through helper adapters.
  - Preserved bubble creation/attachment flow and chat sound trigger behavior.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next callback extraction slice.

### 2026-02-10 20:25 CET — Ticket 7 Client Population-Change Callback Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `client.onPopulationChange` handling from `Game.connect` into a helper module.
  - `done` Preserve callback-existence guard and callback invocation arguments.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onPopulationChange` callback flow only.
  - Out of scope: disconnect callback and startup tail logic.
- Acceptance criteria:
  - `Game.connect` delegates population-change callback body to helper module.
  - Existing callback behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-population-change.ts` with `handlePopulationChange(...)`.
  - Refactored `client/js-esm/game.ts` `onPopulationChange` callback to delegate through helper adapters.
  - Preserved optional-callback invocation guard and argument order.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next callback extraction slice.

### 2026-02-10 20:29 CET — Ticket 7 Client Disconnected Callback Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `client.onDisconnected` handling from `Game.connect` into a helper module.
  - `done` Preserve player-death side effect and disconnect-callback invocation behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onDisconnected` callback flow only.
  - Out of scope: startup tail behavior after callback registrations.
- Acceptance criteria:
  - `Game.connect` delegates disconnected callback body to helper module.
  - Existing disconnect behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-disconnected.ts` with `handleDisconnected(...)`.
  - Refactored `client/js-esm/game.ts` `onDisconnected` callback to delegate through helper adapters.
  - Preserved player death side effect and optional disconnect callback invocation semantics.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next `Game.connect` tail extraction slice.

### 2026-02-10 20:34 CET — Ticket 7 Client Connect Tail Startup Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract post-registration startup tail in `Game.connect` (`gamestart_callback`, `hasNeverStarted`, `start`, `started_callback`) into a helper module.
  - `done` Preserve startup callback invocation order and guard behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: startup tail after client callback registration in `Game.connect`.
  - Out of scope: existing callback registration bodies.
- Acceptance criteria:
  - `Game.connect` delegates startup tail flow to helper module.
  - Existing startup behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-connect-tail.ts` with `handleConnectStartupTail(...)`.
  - Refactored `client/js-esm/game.ts` post-registration startup tail in `Game.connect` to delegate through helper adapters.
  - Preserved callback order (`gamestart_callback` first, then conditional first-start block).
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with residual inline-callback audit and next extraction slice selection.

### 2026-02-10 20:39 CET — Ticket 7 Residual Game.connect Inline Callback Audit TODO

- Status: `done`
- TODO checklist:
  - `done` Audit remaining inline callback bodies in `Game.connect` after current extraction wave.
  - `done` Select next highest-value extraction slice with low behavior-change risk.
  - `done` Verify parity and full modern verification lane after selected slice.
- Scope:
  - Included: inline callback audit + next-slice selection in `Game.connect`.
  - Out of scope: non-`Game.connect` decomposition work.
- Acceptance criteria:
  - Remaining inline callback hotspots are identified and prioritized.
  - Next extraction slice is documented and implemented.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Audited remaining inline callback hotspots in `Game.connect` and identified `onSpawnCharacter` outer flow as next low-risk/high-value seam.
  - Added `client/js-esm/game-session-spawn-character-entry.ts` with `handleSpawnCharacterEntry(...)`.
  - Refactored `client/js-esm/game.ts` `onSpawnCharacter` outer guard/duplicate/error flow to delegate through helper adapters while leaving inner spawn behavior intact.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with the next `onSpawnCharacter` inner orchestration extraction slice.

### 2026-02-10 20:45 CET — Ticket 7 Spawn Character Inner Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract the remaining inline `entity instanceof Character` orchestration block inside `onSpawnCharacter` into a dedicated helper coordinator.
  - `done` Preserve motion/stop-pathing/path-request/death/bubble/mob-target-link registration behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onSpawnCharacter` inner character orchestration wrapper only.
  - Out of scope: already extracted callback helper implementations.
- Acceptance criteria:
  - `onSpawnCharacter` delegates character orchestration wiring to a dedicated helper coordinator.
  - Existing registration behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-spawn-character-orchestration.ts` with `orchestrateSpawnedCharacter(...)`.
  - Refactored `client/js-esm/game.ts` `onSpawnCharacter` to delegate inner `Character` orchestration wiring through the new coordinator.
  - Preserved all existing registration adapters (motion, stop-pathing, path-request, death, bubble, mob target link) and callback behavior.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 by extracting spawn-registration adapter construction from `Game.connect` into a dedicated builder helper.

### 2026-02-10 20:51 CET — Ticket 7 Spawn Registration Builder Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract spawn callback registration adapter construction in `Game.connect` into a dedicated builder helper module.
  - `done` Preserve adapter wiring inputs and behavior for spawn primitives/character orchestration.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: spawn registration builder extraction only.
  - Out of scope: behavior changes in spawn handler internals.
- Acceptance criteria:
  - `Game.connect` delegates spawn adapter construction to helper module(s).
  - Existing spawn flow behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-spawn-character-orchestration-builder.ts` with `installSpawnedCharacterOrchestration(...)`.
  - Refactored `client/js-esm/game.ts` to replace large inline spawn-character orchestration adapter construction with builder-host delegation.
  - Fixed builder bubble-assignment host contract type after initial typecheck mismatch.
- Evidence:
  - `bun run typecheck` failed initially (`BubbleCharacter` vs `Character` mismatch), then passed after contract widening.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with remaining spawn-bootstrap adapter construction extraction.

### 2026-02-10 20:58 CET — Ticket 7 Spawn Bootstrap Adapter Builder Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract spawned-character bootstrap adapter object construction in `Game.connect` into a dedicated helper builder.
  - `done` Preserve bootstrap order (`setSprite`, grid/orientation, idle, addEntity, spawn log).
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: spawn bootstrap adapter builder extraction only.
  - Out of scope: spawn orchestration internals already extracted.
- Acceptance criteria:
  - `Game.connect` delegates spawn bootstrap adapter construction to helper module.
  - Existing spawn bootstrap behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-spawn-character-bootstrap-builder.ts` with `applySpawnedCharacterBootstrapFromHost(...)`.
  - Refactored `client/js-esm/game.ts` to delegate spawned-character bootstrap adapter construction to the new builder.
  - Aligned bootstrap helper kind typing with shared `EntityKind` contract and fixed add-entity type bridging at call-site.
- Evidence:
  - `bun run typecheck` failed initially (bootstrap builder type contract mismatch), then passed after type alignment.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with full spawn-character callback registrar extraction.

### 2026-02-10 21:04 CET — Ticket 7 Spawn Character Registrar Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `client.onSpawnCharacter` registration body from `Game.connect` into a dedicated registrar helper module.
  - `done` Preserve entry-guard, bootstrap, and orchestration wiring behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onSpawnCharacter` callback registration extraction only.
  - Out of scope: already extracted spawn entry/bootstrap/orchestration helper internals.
- Acceptance criteria:
  - `Game.connect` delegates spawn-character callback registration to a helper module.
  - Existing spawn-character behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-spawn-character-registrar.ts` with `registerSpawnCharacterHandler(...)`.
  - Refactored `client/js-esm/game.ts` to delegate full `onSpawnCharacter` registration through the new registrar.
  - Preserved existing spawn flow by composing existing entry/bootstrap/orchestration helpers in registrar order.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with spawn-primitive registrar extraction.

### 2026-02-10 21:11 CET — Ticket 7 Spawn Primitive Builder Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract spawn-primitive callback adapter object construction in `Game.connect` into a dedicated helper builder module.
  - `done` Preserve item/chest spawn logs, entity add/remove behavior, and previous-click reset behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: spawn-primitive adapter builder extraction only.
  - Out of scope: spawn-primitive handler internals.
- Acceptance criteria:
  - `Game.connect` delegates spawn-primitive adapter construction to helper module.
  - Existing spawn-primitive behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-spawn-primitives-builder.ts` with `installSpawnPrimitiveHandlersFromHost(...)`.
  - Refactored `client/js-esm/game.ts` to replace inline spawn-primitive adapter literal with builder-host delegation.
  - Kept existing spawn logs and chest cleanup flow semantics unchanged.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with `Game.connect` registration-bundle extraction (group remaining callback registrations into registrar helper modules).

### 2026-02-10 21:16 CET — Ticket 7 Game.connect Registration Bundle Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract remaining direct callback registrations in `Game.connect` into one or more registrar helper modules.
  - `done` Preserve callback registration order and behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: registration-bundle extraction of existing helper-backed callbacks.
  - Out of scope: non-`Game.connect` refactors.
- Acceptance criteria:
  - `Game.connect` callback registration block is reduced to grouped registrar-helper calls.
  - Existing callback behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-connect-registrations.ts` with `registerConnectSessionHandlers(...)` to centralize `onDespawnEntity` through `onDisconnected` registrations.
  - Refactored `client/js-esm/game.ts` to replace direct callback registration block with a single registrar-host delegation call.
  - Preserved callback ordering and existing helper semantics by registering handlers in the same sequence as before.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 by extracting the `registerConnectSessionHandlers(...)` host adapter object construction from `Game.connect` into a dedicated builder helper.

### 2026-02-10 20:12 CET — Ticket 7 Connect Session Registrar Builder Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `registerConnectSessionHandlers(...)` host adapter object construction into a dedicated builder helper module.
  - `done` Preserve callback behavior and adapter wiring semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: connect session registrar-host builder extraction only.
  - Out of scope: non-`Game.connect` runtime behavior changes.
- Acceptance criteria:
  - `Game.connect` no longer contains a large inline host object for connect-session callback registration.
  - Existing callback behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-connect-registrations-builder.ts` with `installConnectSessionHandlersFromGame(...)`.
  - Refactored `client/js-esm/game.ts` to pass `self` plus minimal bridge wrappers (`clearPreviousClickPosition`, `removeEntity`, `addItem`, `assignBubbleTo`) instead of an inline registrar host object.
  - Resolved callback contract typing in builder by aligning client callback kinds with `EntityKind`.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with spawn-character registrar host-builder extraction to reduce the remaining large inline adapter in `Game.connect`.

### 2026-02-10 20:18 CET — Ticket 7 Spawn Character Registrar Host Builder Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `registerSpawnCharacterHandler(...)` host adapter object construction from `Game.connect` into a dedicated builder helper module.
  - `done` Preserve spawn lifecycle callback wiring semantics (motion/pathing/death/bubble/target-link).
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: spawn-character registrar host adapter builder extraction only.
  - Out of scope: spawn-character orchestration behavior changes.
- Acceptance criteria:
  - `Game.connect` no longer contains the large inline spawn-character registrar host object.
  - Existing spawn-character flow remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-spawn-character-registrar-builder.ts` with `installSpawnCharacterHandlerFromGame(...)`.
  - Refactored `client/js-esm/game.ts` to replace the large inline spawn-character registrar host object with a builder call and three minimal bridge wrappers.
  - Preserved existing spawn wiring by delegating to the existing `registerSpawnCharacterHandler(...)` flow without changing callback registration order.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 by extracting spawn-primitive host adapter construction from `Game.connect` into a dedicated builder helper.

### 2026-02-10 20:17 CET — Ticket 7 Spawn Primitive Host Builder Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `installSpawnPrimitiveHandlersFromHost(...)` host adapter construction from `Game.connect` into a dedicated builder helper module.
  - `done` Preserve spawn item/chest callback behavior and previous-click reset behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: spawn-primitive host builder extraction only.
  - Out of scope: spawn-primitive callback behavior changes.
- Acceptance criteria:
  - `Game.connect` no longer contains the inline spawn-primitive host adapter object.
  - Existing spawn item/chest behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-spawn-primitives-host-builder.ts` with `installSpawnPrimitiveHandlersFromGame(...)`.
  - Refactored `client/js-esm/game.ts` to replace inline spawn-primitive host adapter construction with a direct builder call.
  - Kept existing spawn item/chest behavior and previous-click clearing semantics unchanged through existing primitive handler flow.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with wrapper collapse: reduce remaining `Game.connect` builder bridge wrappers for spawn-character/connect-session registrars.

### 2026-02-10 20:19 CET — Ticket 7 Game.connect Builder Bridge Wrapper Collapse TODO

- Status: `done`
- TODO checklist:
  - `done` Reduce remaining builder bridge wrappers in `Game.connect` for connect-session and spawn-character registrar builders.
  - `done` Preserve callback wiring and runtime behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: wrapper-collapsing refactor in `Game.connect` builder call sites only.
  - Out of scope: new runtime behavior or protocol changes.
- Acceptance criteria:
  - `Game.connect` builder calls use fewer inline bridge wrappers while preserving behavior.
  - Typecheck and verification gates remain green.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Reduced `Game.connect` inline bridges for `installSpawnCharacterHandlerFromGame(...)` by removing the now-unneeded `removeEntity` wrapper.
  - Reduced `Game.connect` inline bridges for `installConnectSessionHandlersFromGame(...)` by inlining previous-click reset and `addItem` bridging in builder internals.
  - Updated builder contracts to keep type safety while shrinking call-site wrapper surface.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 by extracting the inline player-cosmetics host adapter in `Game.connect` into a builder helper.

### 2026-02-10 20:22 CET — Ticket 7 Player Cosmetics Host Builder Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `installPlayerCosmeticHandlers(...)` host adapter object construction from `Game.connect` into a dedicated builder helper module.
  - `done` Preserve equipment/invincibility callback behavior and stored player image persistence semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: player-cosmetics host builder extraction only.
  - Out of scope: player cosmetic runtime behavior changes.
- Acceptance criteria:
  - `Game.connect` no longer contains the inline player-cosmetics host adapter object.
  - Existing cosmetic/equipment behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-player-cosmetics-builder.ts` with `installPlayerCosmeticHandlersFromGame(...)`.
  - Refactored `client/js-esm/game.ts` to replace the inline cosmetics host adapter with a builder call.
  - Preserved callback flow for equipment changes, invincibility skin switch, and saved player image updates.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with the next `Game.connect` orchestration seam extraction (`onWelcome` registrar extraction).

### 2026-02-10 20:23 CET — Ticket 7 Game.connect OnWelcome Registrar Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `client.onWelcome(...)` registration/orchestration from `Game.connect` into a dedicated registrar helper module.
  - `done` Extract inline `player.onStep(...)` logic from `onWelcome` into a dedicated helper module.
  - `done` Extract inline `player.onStopPathing(...)` logic from `onWelcome` into a dedicated helper module.
  - `done` Extract inline `player.onRequestPath(...)` logic from `onWelcome` into a dedicated helper module.
  - `done` Extract inline `player.onDeath(...)` logic from `onWelcome` into a dedicated helper module.
  - `done` Preserve player bootstrap and callback registration order/behavior during remaining `onWelcome` extraction slices.
  - `done` Keep verification lane green after incremental `onWelcome` sub-slices.
- Scope:
  - Included: onWelcome registrar extraction and host bridging only.
  - Out of scope: non-`onWelcome` runtime behavior changes.
- Acceptance criteria:
  - `Game.connect` reduces the inline `client.onWelcome(...)` orchestration block to a registrar helper call.
  - Existing gameplay bootstrap behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `client/js-esm/game-session-player-step.ts` with `installPlayerStepHandler(...)`.
  - Refactored `client/js-esm/game.ts` to replace the inline `player.onStep(...)` block in `onWelcome` with the new helper.
  - Maintained achievement, zoning, attacker-follow, checkpoint, and music-update logic unchanged in extracted flow.
  - Added `client/js-esm/game-session-player-stop-pathing.ts` with `installPlayerStopPathingHandler(...)`.
  - Refactored `client/js-esm/game.ts` to replace the inline `player.onStopPathing(...)` block in `onWelcome` with the new helper.
  - Preserved item loot, door traversal, NPC/chest interaction, attacker retargeting, and position-grid refresh behavior.
  - Added `client/js-esm/game-session-player-request-path.ts` and `client/js-esm/game-session-player-death.ts`.
  - Refactored `client/js-esm/game.ts` to replace inline `player.onRequestPath(...)` and `player.onDeath(...)` handlers with dedicated helpers.
  - Preserved path request ignore-list behavior and local-player death cleanup/music/callback sequencing.
  - Added `client/js-esm/game-session-welcome-registrar.ts` to own full `client.onWelcome(...)` orchestration registration.
  - Refactored `client/js-esm/game.ts` to delegate `onWelcome` wiring to the registrar and extracted connect setup into `client/js-esm/game-session-connect-initializer.ts`.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with a server-side `WorldServer` orchestration seam extraction.

### 2026-02-10 20:31 CET — Ticket 7 WorldServer Population/Broadcast Registrar Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract one `WorldServer` broadcast/population callback orchestration cluster into a dedicated helper module.
  - `done` Preserve world/player count update semantics and notify ordering.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: one server-side extraction seam in `server/js/worldserver.ts` for group-incoming spawn broadcast orchestration logic.
  - Out of scope: protocol or gameplay behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates the selected group/broadcast orchestration cluster to a helper module.
  - Existing runtime behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-process-groups.ts` with `processWorldGroups(...)` to own incoming-group spawn fanout orchestration.
  - Refactored `server/js/worldserver.ts` `processGroups()` to delegate to the new helper while preserving spawn message semantics and incoming queue clearing behavior.
  - Updated explicit TS project include lists to register the new server module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk `WorldServer` seam extraction (`updatePopulation`/population notify wrapper extraction).

### 2026-02-10 20:39 CET — Ticket 7 WorldServer Population Notify Helper Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `updatePopulation(...)` notify wrapper from `worldserver.ts` into a dedicated helper module.
  - `done` Preserve total-player fallback semantics and broadcast payload shape.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: population notify helper extraction only.
  - Out of scope: player lifecycle logic changes.
- Acceptance criteria:
  - `worldserver.ts` delegates `updatePopulation(...)` payload construction/broadcast wrapper to helper.
  - Existing population messages remain behaviorally identical.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-population-notify.ts` with `notifyWorldPopulation(...)`.
  - Refactored `server/js/worldserver.ts` `updatePopulation(...)` to delegate message creation/broadcast to the helper.
  - Registered new server helper files in explicit TS project include lists (`tsconfig.typecheck.json`, `tsconfig.typecheck-runtime.json`, `tsconfig.typecheck-server-esm.json`).
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (item/chest area empty-handler orchestration extraction).

### 2026-02-10 20:46 CET — Ticket 7 WorldServer Chest Area Empty-Handler Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `handleEmptyChestArea(...)` orchestration wrapper from `worldserver.ts` into a helper module.
  - `done` Preserve chest spawn + despawn scheduling semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `handleEmptyChestArea(...)` helper extraction only.
  - Out of scope: chest/item gameplay behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates empty chest-area refill orchestration to a helper.
  - Existing chest refill behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-chest-area.ts` with `handleEmptyChestAreaRefill(...)`.
  - Refactored `server/js/worldserver.ts` `handleEmptyChestArea(...)` to delegate chest refill/despawn orchestration to helper.
  - Updated explicit runtime/server TS include lists for the new helper file:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`handleOpenedChest(...)` orchestration helper extraction).

### 2026-02-10 20:53 CET — Ticket 7 WorldServer Opened-Chest Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `handleOpenedChest(...)` orchestration from `worldserver.ts` into a helper module.
  - `done` Preserve chest despawn broadcast + loot spawn semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: opened-chest orchestration helper extraction only.
  - Out of scope: loot tables or gameplay balance changes.
- Acceptance criteria:
  - `worldserver.ts` delegates opened-chest orchestration to helper.
  - Existing chest-open behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-opened-chest.ts` with `handleOpenedChestOrchestration(...)`.
  - Refactored `server/js/worldserver.ts` `handleOpenedChest(...)` to delegate despawn + loot spawn orchestration.
  - Updated explicit TS include lists to register the helper file:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`handleItemDespawn(...)` callback orchestration extraction).

### 2026-02-10 20:41 CET — Ticket 7 WorldServer Item-Despawn Callback Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `handleItemDespawn(...)` callback orchestration from `worldserver.ts` into a helper module.
  - `done` Preserve blink/destroy broadcast timing and entity removal semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: item-despawn callback orchestration helper extraction only.
  - Out of scope: item despawn timings/values changes.
- Acceptance criteria:
  - `worldserver.ts` delegates `handleItemDespawn(...)` orchestration callback construction to helper.
  - Existing item despawn behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-item-despawn.ts` with `scheduleWorldItemDespawn(...)`.
  - Refactored `server/js/worldserver.ts` `handleItemDespawn(...)` to delegate blink/destroy callback orchestration to helper.
  - Updated explicit TS include lists for new server helper modules.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`tryAddingMobToChestArea(...)` helper extraction).

### 2026-02-10 20:45 CET — Ticket 7 WorldServer Chest-Area Membership Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `tryAddingMobToChestArea(...)` orchestration from `worldserver.ts` into a helper module.
  - `done` Preserve chest-area membership checks and insertion semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: chest-area membership helper extraction only.
  - Out of scope: mob AI or area shape behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates chest-area membership iteration to helper.
  - Existing chest-area inclusion behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-chest-area-membership.ts` with `addMobToContainingChestAreas(...)`.
  - Refactored `server/js/worldserver.ts` `tryAddingMobToChestArea(...)` to delegate membership iteration to helper.
  - Updated explicit TS include lists for the new helper file.
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`pushRelevantEntityListTo(...)` helper extraction).

### 2026-02-10 20:48 CET — Ticket 7 WorldServer Relevant-Entity List Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `pushRelevantEntityListTo(...)` entity-id collection orchestration from `worldserver.ts` into helper module.
  - `done` Preserve excluded-self semantics and push behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: relevant-entity list collection helper extraction only.
  - Out of scope: entity visibility/group membership behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates relevant entity-id list collection to helper.
  - Existing list push behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-relevant-entities.ts` with `collectRelevantEntityIds(...)`.
  - Refactored `server/js/worldserver.ts` `pushRelevantEntityListTo(...)` to delegate entity-id collection to helper.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`pushSpawnsToPlayer(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Spawn-Push Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `pushSpawnsToPlayer(...)` spawn-loop orchestration from `worldserver.ts` into a helper module.
  - `done` Preserve spawn filtering and push ordering semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `pushSpawnsToPlayer(...)` helper extraction only.
  - Out of scope: spawn eligibility logic and message payload shape changes.
- Acceptance criteria:
  - `worldserver.ts` delegates spawn-loop iteration to a helper module.
  - Existing spawn push behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-spawn-push.ts` with `pushSpawnEntitiesToPlayer(...)`.
  - Refactored `server/js/worldserver.ts` `pushSpawnsToPlayer(...)` to delegate spawn-loop iteration and filtering.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`pushToPreviousGroups(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Previous-Group Push Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `pushToPreviousGroups(...)` adjacent-group push orchestration from `worldserver.ts` into a helper module.
  - `done` Preserve adjacent-group routing and ignored-player semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `pushToPreviousGroups(...)` helper extraction only.
  - Out of scope: group topology or message routing behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates previous-group push orchestration to helper module.
  - Existing previous-group push behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-previous-groups.ts` with `pushMessageToPreviouslyLeftGroups(...)`.
  - Refactored `server/js/worldserver.ts` `pushToPreviousGroups(...)` to delegate previous-group push iteration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`broadcastAttacker(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Broadcast-Attacker Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `broadcastAttacker(...)` adjacent-group fanout orchestration from `worldserver.ts` into a helper module.
  - `done` Preserve attack message fanout and callback ordering semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `broadcastAttacker(...)` helper extraction only.
  - Out of scope: combat damage/aggro/gameplay behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates attacker broadcast orchestration to helper module.
  - Existing attacker fanout + callback behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-broadcast-attacker.ts` with `broadcastWorldAttacker(...)`.
  - Refactored `server/js/worldserver.ts` `broadcastAttacker(...)` to delegate fanout/callback orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`despawn(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Despawn Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `despawn(...)` remove-or-despawn orchestration from `worldserver.ts` into a helper module.
  - `done` Preserve despawn broadcast ordering and conditional entity-removal semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `despawn(...)` helper extraction only.
  - Out of scope: respawn logic or entity lifecycle policy changes.
- Acceptance criteria:
  - `worldserver.ts` delegates despawn orchestration to helper module.
  - Existing despawn/removal behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-despawn.ts` with `despawnWorldEntity(...)`.
  - Refactored `server/js/worldserver.ts` `despawn(...)` to delegate despawn/removal orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`getPlayerCount(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Player-Count Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `getPlayerCount(...)` counting loop orchestration from `worldserver.ts` into a helper module.
  - `done` Preserve own-property filtering and returned count semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `getPlayerCount(...)` helper extraction only.
  - Out of scope: player lifecycle or population reporting behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates player-count loop to helper module.
  - Existing player-count behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-player-count.ts` with `countPlayersInWorld(...)`.
  - Refactored `server/js/worldserver.ts` `getPlayerCount(...)` to delegate counting.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`setPlayerCount`/`incrementPlayerCount`/`decrementPlayerCount` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Player-Count Mutator Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract player-count mutator methods (`setPlayerCount`, `incrementPlayerCount`, `decrementPlayerCount`) from `worldserver.ts` into helper module.
  - `done` Preserve callback emission conditions and counter update semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: player-count mutator helper extraction only.
  - Out of scope: population callback policy changes.
- Acceptance criteria:
  - `worldserver.ts` delegates player-count mutations to helper module.
  - Existing callback emission and count semantics remain unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-player-count-mutators.ts` with player-count mutator helpers.
  - Refactored `server/js/worldserver.ts` player-count mutator methods to delegate into helper functions.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`isValidPosition(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Position-Validation Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `isValidPosition(...)` map/coordinate validation orchestration from `worldserver.ts` into helper module.
  - `done` Preserve numeric guard and collision/out-of-bounds validation semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `isValidPosition(...)` helper extraction only.
  - Out of scope: pathfinding or collision model changes.
- Acceptance criteria:
  - `worldserver.ts` delegates position-validation checks to helper module.
  - Existing position validity behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-position-validation.ts` with `isWorldPositionValid(...)`.
  - Refactored `server/js/worldserver.ts` `isValidPosition(...)` to delegate validation checks.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`findPositionNextTo(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Position-Next-To Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `findPositionNextTo(...)` retry-loop orchestration from `worldserver.ts` into helper module.
  - `done` Preserve retry-until-valid behavior and returned position semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `findPositionNextTo(...)` helper extraction only.
  - Out of scope: spawn/path position strategy changes.
- Acceptance criteria:
  - `worldserver.ts` delegates position-next-to retry loop to helper module.
  - Existing retry-loop behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-position-next-to.ts` with `findWorldPositionNextTo(...)`.
  - Refactored `server/js/worldserver.ts` `findPositionNextTo(...)` to delegate retry-loop logic.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`onMobMoveCallback(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Mob-Move Callback Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `onMobMoveCallback(...)` push/group-membership orchestration from `worldserver.ts` into helper module.
  - `done` Preserve move-broadcast and group-membership update ordering semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `onMobMoveCallback(...)` helper extraction only.
  - Out of scope: mob movement behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates mob-move callback orchestration to helper module.
  - Existing move callback behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-mob-move-callback.ts` with `handleWorldMobMoveCallback(...)`.
  - Refactored `server/js/worldserver.ts` `onMobMoveCallback(...)` to delegate move-callback orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`initZoneGroups(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Zone-Group Init Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `initZoneGroups(...)` map-group initialization orchestration from `worldserver.ts` into helper module.
  - `done` Preserve group structure initialization and zone-ready flag semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `initZoneGroups(...)` helper extraction only.
  - Out of scope: map grouping policy changes.
- Acceptance criteria:
  - `worldserver.ts` delegates zone-group initialization loop to helper module.
  - Existing zone-group initialization behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-zone-groups.ts` with `initializeWorldZoneGroups(...)`.
  - Refactored `server/js/worldserver.ts` `initZoneGroups(...)` to delegate zone-group initialization loop.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`removeFromGroups(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Remove-From-Groups Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `removeFromGroups(...)` group-removal orchestration from `worldserver.ts` into helper module.
  - `done` Preserve player list removal, adjacent group cleanup, and old-group collection semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `removeFromGroups(...)` helper extraction only.
  - Out of scope: group membership policy changes.
- Acceptance criteria:
  - `worldserver.ts` delegates group-removal orchestration to helper module.
  - Existing group cleanup behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-remove-from-groups.ts` with `removeEntityFromWorldGroups(...)`.
  - Refactored `server/js/worldserver.ts` `removeFromGroups(...)` to delegate group-removal orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`addAsIncomingToGroup(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Incoming-Group Registration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `addAsIncomingToGroup(...)` incoming-registration orchestration from `worldserver.ts` into helper module.
  - `done` Preserve dropped-item filtering and existing-entity guard semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `addAsIncomingToGroup(...)` helper extraction only.
  - Out of scope: drop-message or spawn policy changes.
- Acceptance criteria:
  - `worldserver.ts` delegates incoming-group registration orchestration to helper module.
  - Existing incoming registration behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-incoming-group.ts` with `addEntityAsIncomingToGroups(...)`.
  - Refactored `server/js/worldserver.ts` `addAsIncomingToGroup(...)` to delegate incoming-registration orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` first run failed due to transient timeout in `tests/smoke/server-payload-guards.test.ts` (`Timed out waiting for /status`).
  - `bun run verify:modern:node22` rerun passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`addToGroup(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Add-To-Group Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `addToGroup(...)` group-registration orchestration from `worldserver.ts` into helper module.
  - `done` Preserve adjacent-group entity registration and player list append semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `addToGroup(...)` helper extraction only.
  - Out of scope: group assignment policy changes.
- Acceptance criteria:
  - `worldserver.ts` delegates group-add orchestration to helper module.
  - Existing group-add behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-add-to-group.ts` with `addEntityToWorldGroup(...)`.
  - Refactored `server/js/worldserver.ts` `addToGroup(...)` to delegate group-registration orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`logGroupPlayers(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Group-Player Log Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `logGroupPlayers(...)` group-player logging loop from `worldserver.ts` into helper module.
  - `done` Preserve log message ordering and payload semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `logGroupPlayers(...)` helper extraction only.
  - Out of scope: logging level/config policy changes.
- Acceptance criteria:
  - `worldserver.ts` delegates group-player logging loop to helper module.
  - Existing logging behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-group-player-log.ts` with `logWorldGroupPlayers(...)`.
  - Refactored `server/js/worldserver.ts` `logGroupPlayers(...)` to delegate group-player logging loop.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (mob link cleanup helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Mob-Link Cleanup Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `clearMobAggroLink(...)` and `clearMobHateLinks(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve player-link removal semantics for both attacker and hater paths.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: mob-link cleanup helper extraction only.
  - Out of scope: combat targeting/hate ranking behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates mob-link cleanup orchestration to helper module.
  - Existing mob-link removal behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-mob-links.ts` with `clearWorldMobAggroLink(...)` and `clearWorldMobHateLinks(...)`.
  - Refactored `server/js/worldserver.ts` mob-link cleanup methods to delegate into helper functions.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` initially failed due over-constrained helper typing; updated helper contract and reran.
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (entity iteration helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Entity Iteration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `forEachEntity(...)`, `forEachPlayer(...)`, `forEachMob(...)`, and `forEachCharacter(...)` iteration orchestration from `worldserver.ts` into helper module.
  - `done` Preserve callback invocation coverage and order semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: entity iteration helper extraction only.
  - Out of scope: entity storage/model changes.
- Acceptance criteria:
  - `worldserver.ts` delegates entity iteration methods to helper module.
  - Existing iteration behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-entity-iteration.ts` with `forEachEntityInWorldMap(...)` and `forEachWorldCharacter(...)`.
  - Refactored `server/js/worldserver.ts` entity iteration methods to delegate to helper functions.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`handleEntityGroupMembership(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Group-Membership Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `handleEntityGroupMembership(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve group-change detection and recent-left-groups diff semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `handleEntityGroupMembership(...)` helper extraction only.
  - Out of scope: map grouping policy changes.
- Acceptance criteria:
  - `worldserver.ts` delegates group-membership orchestration to helper module.
  - Existing group-membership behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-group-membership.ts` with `handleWorldEntityGroupMembership(...)`.
  - Refactored `server/js/worldserver.ts` `handleEntityGroupMembership(...)` to delegate orchestration into helper.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`moveEntity(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Move-Entity Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `moveEntity(...)` position-update orchestration from `worldserver.ts` into helper module.
  - `done` Preserve set-position then group-membership-update ordering semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `moveEntity(...)` helper extraction only.
  - Out of scope: movement/pathing behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates move-entity orchestration to helper module.
  - Existing move behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-move-entity.ts` with `moveWorldEntity(...)`.
  - Refactored `server/js/worldserver.ts` `moveEntity(...)` to delegate movement orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`handlePlayerVanish(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Player-Vanish Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `handlePlayerVanish(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve attacker retargeting, hate cleanup, and group-sync semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `handlePlayerVanish(...)` helper extraction only.
  - Out of scope: combat targeting policy changes.
- Acceptance criteria:
  - `worldserver.ts` delegates player-vanish orchestration to helper module.
  - Existing player-vanish behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-player-vanish.ts` with `handleWorldPlayerVanish(...)`.
  - Refactored `server/js/worldserver.ts` `handlePlayerVanish(...)` to delegate vanish orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`getDroppedItem(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Dropped-Item Selection Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `getDroppedItem(...)` drop-selection orchestration from `worldserver.ts` into helper module.
  - `done` Preserve drop-table probability walk and item creation/addition semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `getDroppedItem(...)` helper extraction only.
  - Out of scope: drop balance/probability changes.
- Acceptance criteria:
  - `worldserver.ts` delegates dropped-item selection orchestration to helper module.
  - Existing drop-selection behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-dropped-item.ts` with `selectDroppedItemForMob(...)`.
  - Refactored `server/js/worldserver.ts` `getDroppedItem(...)` to delegate drop-selection orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`chooseMobTarget(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Mob-Target Selection Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `chooseMobTarget(...)` target-selection orchestration from `worldserver.ts` into helper module.
  - `done` Preserve target-link guard, aggro-link cleanup, and attack-broadcast semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `chooseMobTarget(...)` helper extraction only.
  - Out of scope: hate ranking/target selection policy changes.
- Acceptance criteria:
  - `worldserver.ts` delegates mob-target selection orchestration to helper module.
  - Existing target-selection behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-mob-target.ts` with `chooseWorldMobTarget(...)`.
  - Refactored `server/js/worldserver.ts` `chooseMobTarget(...)` to delegate target-selection orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` initially failed due strict helper typing and was corrected.
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`handleMobHate(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Mob-Hate Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `handleMobHate(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve hate increment, hater-link registration, and alive-only target-selection semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `handleMobHate(...)` helper extraction only.
  - Out of scope: hate scoring or combat policy changes.
- Acceptance criteria:
  - `worldserver.ts` delegates mob-hate orchestration to helper module.
  - Existing mob-hate behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-mob-hate.ts` with `handleWorldMobHate(...)`.
  - Refactored `server/js/worldserver.ts` `handleMobHate(...)` to delegate orchestration into helper.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` initially failed due strict helper typing and was corrected.
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`handleHurtEntity(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Hurt-Entity Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `handleHurtEntity(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve player/mob damage notifications, kill/drop ordering, and entity-removal semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `handleHurtEntity(...)` helper extraction only.
  - Out of scope: combat formulas/balance changes.
- Acceptance criteria:
  - `worldserver.ts` delegates hurt-entity orchestration to helper module.
  - Existing hurt/kill/drop behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-hurt-entity.ts` with `handleWorldHurtEntity(...)`.
  - Refactored `server/js/worldserver.ts` `handleHurtEntity(...)` to delegate hurt/kill/drop orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` initially failed due helper type strictness and was corrected.
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next low-risk server seam extraction (`getEntityById(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Entity-Lookup Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `getEntityById(...)` lookup/error orchestration from `worldserver.ts` into helper module.
  - `done` Preserve unknown-entity error logging semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `getEntityById(...)` helper extraction only.
  - Out of scope: entity storage/indexing model changes.
- Acceptance criteria:
  - `worldserver.ts` delegates entity lookup/error handling to helper module.
  - Existing lookup behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-entity-lookup.ts` with `getWorldEntityById(...)`.
  - Refactored `server/js/worldserver.ts` `getEntityById(...)` to delegate entity lookup/error handling.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`spawnStaticEntities(...)` helper extraction).

### 2026-02-10 20:47 CET — Ticket 7 WorldServer Static-Spawn Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `spawnStaticEntities(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve static NPC/mob/item spawn behavior and mob respawn wiring semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `spawnStaticEntities(...)` helper extraction only.
  - Out of scope: map content or spawn balance changes.
- Acceptance criteria:
  - `worldserver.ts` delegates static-spawn orchestration to helper module.
  - Existing static spawn behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-static-spawn.ts` with `spawnStaticEntitiesForWorld(...)`.
  - Refactored `server/js/worldserver.ts` `spawnStaticEntities(...)` to delegate static spawn orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` initially failed due helper typing mismatch and was corrected.
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`removeEntity(...)` helper extraction).

### 2026-02-10 21:37 CET — Ticket 7 WorldServer Remove-Entity Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `removeEntity(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve entity-map cleanup, mob aggro/hate cleanup, destroy/group-removal ordering, and logging semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `removeEntity(...)` helper extraction only.
  - Out of scope: entity lifecycle policy or combat behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates remove-entity orchestration to helper module.
  - Existing remove-entity behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-remove-entity.ts` with `removeWorldEntity(...)`.
  - Refactored `server/js/worldserver.ts` `removeEntity(...)` to delegate removal orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`addEntity(...)` helper extraction).

### 2026-02-10 21:40 CET — Ticket 7 WorldServer Add-Entity Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `addEntity(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve entity-map insert + group-membership registration ordering.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `addEntity(...)` helper extraction only.
  - Out of scope: entity admission rules or map/group semantics changes.
- Acceptance criteria:
  - `worldserver.ts` delegates add-entity orchestration to helper module.
  - Existing add-entity behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-add-entity.ts` with `addWorldEntity(...)`.
  - Refactored `server/js/worldserver.ts` `addEntity(...)` to delegate insertion/group-membership orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`addPlayer(...)` helper extraction).

### 2026-02-10 21:41 CET — Ticket 7 WorldServer Add-Player Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `addPlayer(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve add-entity delegation, player registry insertion, and outgoing queue initialization semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `addPlayer(...)` helper extraction only.
  - Out of scope: player admission policy, auth, or queue transport behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates add-player orchestration to helper module.
  - Existing add-player behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-add-player.ts` with `addWorldPlayer(...)`.
  - Refactored `server/js/worldserver.ts` `addPlayer(...)` to delegate add-player orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`removePlayer(...)` helper extraction).

### 2026-02-10 21:42 CET — Ticket 7 WorldServer Remove-Player Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `removePlayer(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve broadcast-despawn ordering, entity removal, player map cleanup, and outgoing queue cleanup semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `removePlayer(...)` helper extraction only.
  - Out of scope: disconnection policy or protocol message changes.
- Acceptance criteria:
  - `worldserver.ts` delegates remove-player orchestration to helper module.
  - Existing remove-player behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-remove-player.ts` with `removeWorldPlayer(...)`.
  - Refactored `server/js/worldserver.ts` `removePlayer(...)` to delegate remove-player orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`addMob(...)` helper extraction).

### 2026-02-10 21:43 CET — Ticket 7 WorldServer Add-Mob Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `addMob(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve add-entity delegation and mob registry insertion semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `addMob(...)` helper extraction only.
  - Out of scope: mob spawn/AI behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates add-mob orchestration to helper module.
  - Existing add-mob behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-add-mob.ts` with `addWorldMob(...)`.
  - Refactored `server/js/worldserver.ts` `addMob(...)` to delegate add-mob orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`addNpc(...)` helper extraction).

### 2026-02-10 21:45 CET — Ticket 7 WorldServer Add-Npc Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `addNpc(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve NPC id construction, add-entity delegation, npc registry insertion, and return-value semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `addNpc(...)` helper extraction only.
  - Out of scope: NPC identity rules or spawn layout changes.
- Acceptance criteria:
  - `worldserver.ts` delegates add-npc orchestration to helper module.
  - Existing add-npc behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-add-npc.ts` with generic `addWorldNpc(...)`.
  - Refactored `server/js/worldserver.ts` `addNpc(...)` to delegate add-npc orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` initially failed due `EntityKind` typing mismatch and was corrected.
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`addItem(...)` helper extraction).

### 2026-02-10 21:46 CET — Ticket 7 WorldServer Add-Item Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `addItem(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve add-entity delegation, item registry insertion, and return-value semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `addItem(...)` helper extraction only.
  - Out of scope: item creation/despawn rules changes.
- Acceptance criteria:
  - `worldserver.ts` delegates add-item orchestration to helper module.
  - Existing add-item behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-add-item.ts` with generic `addWorldItem(...)`.
  - Refactored `server/js/worldserver.ts` `addItem(...)` to delegate add-item orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`createItem(...)` helper extraction).

### 2026-02-10 21:48 CET — Ticket 7 WorldServer Create-Item Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `createItem(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve item-id generation and chest-vs-item constructor selection semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `createItem(...)` helper extraction only.
  - Out of scope: item identity format changes or item/chest class behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates create-item orchestration to helper module.
  - Existing create-item behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-create-item.ts` with `createWorldItem(...)`.
  - Refactored `server/js/worldserver.ts` `createItem(...)` to delegate item construction orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
  - Restored missing `isInt` export implementation in `client/js-esm/compat/util.ts` to clear unrelated compile regression surfaced during verification.
- Evidence:
  - `bun run typecheck` initially failed due missing `isInt` symbol in existing code and was corrected.
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`createChest(...)` helper extraction).

### 2026-02-10 21:50 CET — Ticket 7 WorldServer Create-Chest Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `createChest(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve create-item delegation, chest-instance guard, and chest item payload attachment semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `createChest(...)` helper extraction only.
  - Out of scope: chest item-drop policy or serialization changes.
- Acceptance criteria:
  - `worldserver.ts` delegates create-chest orchestration to helper module.
  - Existing create-chest behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-create-chest.ts` with `createWorldChest(...)`.
  - Refactored `server/js/worldserver.ts` `createChest(...)` to delegate chest creation orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` initially failed on transient `/status` timeout in `server-structured-logs.lifecycle` and passed on immediate rerun.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`addStaticItem(...)` helper extraction).

### 2026-02-10 21:52 CET — Ticket 7 WorldServer Add-Static-Item Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `addStaticItem(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve static flag assignment, respawn hook registration, and add-item delegation semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `addStaticItem(...)` helper extraction only.
  - Out of scope: respawn timing behavior or item drop policy changes.
- Acceptance criteria:
  - `worldserver.ts` delegates add-static-item orchestration to helper module.
  - Existing add-static-item behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-add-static-item.ts` with `addWorldStaticItem(...)`.
  - Refactored `server/js/worldserver.ts` `addStaticItem(...)` to delegate static-item orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`addItemFromChest(...)` helper extraction).

### 2026-02-10 21:54 CET — Ticket 7 WorldServer Add-Item-From-Chest Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `addItemFromChest(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve create-item delegation, chest-origin flag assignment, and add-item delegation semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `addItemFromChest(...)` helper extraction only.
  - Out of scope: chest loot policy or timing behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates add-item-from-chest orchestration to helper module.
  - Existing add-item-from-chest behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-add-item-from-chest.ts` with `addWorldItemFromChest(...)`.
  - Refactored `server/js/worldserver.ts` `addItemFromChest(...)` to delegate chest-item orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`pushRelevantEntityListTo(...)` helper extraction).

### 2026-02-10 21:55 CET — Ticket 7 WorldServer Relevant-List Push Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `pushRelevantEntityListTo(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve group guard behavior, self-id exclusion, and list message push semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `pushRelevantEntityListTo(...)` helper extraction only.
  - Out of scope: group relevance policy changes.
- Acceptance criteria:
  - `worldserver.ts` delegates relevant-list push orchestration to helper module.
  - Existing relevant-list push behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-relevant-list-push.ts` with `pushRelevantEntityListToPlayer(...)`.
  - Refactored `server/js/worldserver.ts` `pushRelevantEntityListTo(...)` to delegate relevant-list orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` initially failed due helper entity-id type mismatch and was corrected.
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`pushSpawnsToPlayer(...)` helper extraction).

### 2026-02-10 21:58 CET — Ticket 7 WorldServer Spawn-List Push Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `pushSpawnsToPlayer(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve spawn-id fallback, spawn message push semantics, and debug logging behavior.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `pushSpawnsToPlayer(...)` helper extraction only.
  - Out of scope: spawn filtering or message schema changes.
- Acceptance criteria:
  - `worldserver.ts` delegates spawn-list push orchestration to helper module.
  - Existing spawn-list push behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-spawn-list-push.ts` with `pushWorldSpawnsToPlayer(...)`.
  - Refactored `server/js/worldserver.ts` `pushSpawnsToPlayer(...)` to delegate spawn-list push orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`pushToPlayer(...)` helper extraction).

### 2026-02-10 22:00 CET — Ticket 7 WorldServer Push-To-Player Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `pushToPlayer(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve message serialization and serialized-player-queue delegation semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `pushToPlayer(...)` helper extraction only.
  - Out of scope: queueing transport behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates push-to-player orchestration to helper module.
  - Existing push-to-player behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-push-to-player.ts` with `pushWorldMessageToPlayer(...)`.
  - Refactored `server/js/worldserver.ts` `pushToPlayer(...)` to delegate push-to-player orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`pushToGroup(...)` helper extraction).

### 2026-02-10 22:01 CET — Ticket 7 WorldServer Push-To-Group Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `pushToGroup(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve message serialization and group-queue delegation semantics including optional ignored player.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `pushToGroup(...)` helper extraction only.
  - Out of scope: queue transport behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates push-to-group orchestration to helper module.
  - Existing push-to-group behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-push-to-group.ts` with `pushWorldMessageToGroup(...)`.
  - Refactored `server/js/worldserver.ts` `pushToGroup(...)` to delegate push-to-group orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`pushToAdjacentGroups(...)` helper extraction).

### 2026-02-10 22:03 CET — Ticket 7 WorldServer Push-To-Adjacent-Groups Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `pushToAdjacentGroups(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve adjacent-group iteration, ignored-player forwarding, and serialized-group queue semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `pushToAdjacentGroups(...)` helper extraction only.
  - Out of scope: adjacency/group topology behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates push-to-adjacent-groups orchestration to helper module.
  - Existing push-to-adjacent-groups behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-push-to-adjacent-groups.ts` with `pushWorldMessageToAdjacentGroups(...)`.
  - Refactored `server/js/worldserver.ts` `pushToAdjacentGroups(...)` to delegate adjacent-group push orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`pushBroadcast(...)` helper extraction).

### 2026-02-10 22:06 CET — Ticket 7 WorldServer Push-Broadcast Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `pushBroadcast(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve message serialization and broadcast queue behavior with optional ignored player.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `pushBroadcast(...)` helper extraction only.
  - Out of scope: broadcast queueing behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates push-broadcast orchestration to helper module.
  - Existing push-broadcast behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-push-broadcast.ts` with `pushWorldBroadcastMessage(...)`.
  - Refactored `server/js/worldserver.ts` `pushBroadcast(...)` to delegate broadcast push orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`processQueues(...)` helper extraction).

### 2026-02-10 22:07 CET — Ticket 7 WorldServer Process-Queues Orchestration Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `processQueues(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve outgoing queue flush behavior and websocket connection lookup semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `processQueues(...)` helper extraction only.
  - Out of scope: transport queue implementation changes.
- Acceptance criteria:
  - `worldserver.ts` delegates process-queues orchestration to helper module.
  - Existing process-queues behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-process-queues.ts` with `processWorldOutgoingQueues(...)`.
  - Refactored `server/js/worldserver.ts` `processQueues(...)` to delegate queue-flush orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`pushSerializedToPlayer(...)` helper extraction).

### 2026-02-10 22:09 CET — Ticket 7 WorldServer Push-Serialized-To-Player Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `pushSerializedToPlayer(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve outgoing queue push behavior and structured error logging semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `pushSerializedToPlayer(...)` helper extraction only.
  - Out of scope: queue transport behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates push-serialized-to-player orchestration to helper module.
  - Existing push-serialized-to-player behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-push-serialized-player.ts` with `pushSerializedToWorldPlayerQueue(...)`.
  - Refactored `server/js/worldserver.ts` `pushSerializedToPlayer(...)` to delegate player-queue push orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` initially failed due helper player typing mismatch and was corrected.
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`pushSerializedToGroup(...)` helper extraction).

### 2026-02-10 22:11 CET — Ticket 7 WorldServer Push-Serialized-To-Group Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `pushSerializedToGroup(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve group-queue push behavior and structured error logging semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `pushSerializedToGroup(...)` helper extraction only.
  - Out of scope: group-queue transport behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates push-serialized-to-group orchestration to helper module.
  - Existing push-serialized-to-group behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-push-serialized-group.ts` with `pushSerializedToWorldGroupQueue(...)`.
  - Refactored `server/js/worldserver.ts` `pushSerializedToGroup(...)` to delegate group-queue push orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`pushSerializedToAdjacentGroups(...)` helper extraction).

### 2026-02-10 22:13 CET — Ticket 7 WorldServer Push-Serialized-To-Adjacent-Groups Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `pushSerializedToAdjacentGroups(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve adjacent-group queue push behavior and structured error logging semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `pushSerializedToAdjacentGroups(...)` helper extraction only.
  - Out of scope: map/group traversal behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates serialized-adjacent-group push orchestration to helper module.
  - Existing serialized-adjacent-group push behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-push-serialized-adjacent-groups.ts` with `pushSerializedToWorldAdjacentGroupsQueue(...)`.
  - Refactored `server/js/worldserver.ts` `pushToAdjacentGroups(...)` callback path to delegate serialized adjacent-group queue orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` initially failed due transient smoke timeout and passed on immediate rerun.
- Next action:
  - Continue Ticket 7 with next server seam extraction (`pushToPreviousGroups(...)` helper extraction).

### 2026-02-10 22:16 CET — Ticket 7 WorldServer Push-To-Previous-Groups Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract `pushToPreviousGroups(...)` orchestration from `worldserver.ts` into helper module.
  - `done` Preserve previous-group iteration and group message push semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: `pushToPreviousGroups(...)` helper extraction only.
  - Out of scope: previous-group membership policy changes.
- Acceptance criteria:
  - `worldserver.ts` delegates previous-group push orchestration to helper module.
  - Existing previous-group push behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-push-to-previous-groups.ts` with `pushWorldMessageToPreviousGroups(...)`.
  - Refactored `server/js/worldserver.ts` `pushToPreviousGroups(...)` to delegate previous-group push orchestration.
  - Updated explicit TS include lists for the helper module:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 with next transport seam extraction (`pushSerializedBroadcast(...)` helper extraction).

### 2026-02-10 22:18 CET — Ticket 7 WorldServer Push-Serialized-Broadcast Extraction TODO

- Status: `done`
- TODO checklist:
  - `done` Extract serialized broadcast queue push from `pushBroadcast(...)` callback path into helper module.
  - `done` Preserve broadcast queue behavior and optional ignored-player semantics.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: serialized broadcast queue helper extraction only.
  - Out of scope: broadcast transport behavior changes.
- Acceptance criteria:
  - `worldserver.ts` delegates serialized broadcast queue push to helper module.
  - Existing broadcast behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Consolidated duplicated transport/message push wrappers into a single module:
    - Added `server/js/worldserver-push.ts`.
    - Removed duplicate wrapper modules:
      - `server/js/worldserver-push-broadcast.ts`
      - `server/js/worldserver-push-serialized-adjacent-groups.ts`
      - `server/js/worldserver-push-serialized-group.ts`
      - `server/js/worldserver-push-serialized-player.ts`
      - `server/js/worldserver-push-to-adjacent-groups.ts`
      - `server/js/worldserver-push-to-group.ts`
      - `server/js/worldserver-push-to-player.ts`
      - `server/js/worldserver-push-to-previous-groups.ts`
  - Centralized repeated world-message contract:
    - Added `server/js/worldserver-message-contract.ts`.
    - Reused this type in:
      - `server/js/worldserver.ts`
      - `server/js/worldserver-push.ts`
      - `server/js/worldserver-broadcast-attacker.ts`
      - `server/js/worldserver-despawn.ts`
      - `server/js/worldserver-mob-move-callback.ts`
      - `server/js/worldserver-hurt-entity.ts`
  - Reduced repeated inline error logger callbacks by introducing shared `logWorldQueueError` in `server/js/worldserver.ts`.
  - Updated explicit TS include lists to reflect consolidation:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue duplication audit for additional low-risk consolidation candidates outside the worldserver push seam.

### 2026-02-10 23:55 CET — Ticket 7 WorldServer Shared Queue-Contract Consolidation TODO

- Status: `done`
- TODO checklist:
  - `done` Consolidate duplicated queue/transport type contracts into a shared worldserver contract module.
  - `done` Rewire worldserver queue helper modules to consume shared contracts.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: shared queue contract extraction and import rewiring only.
  - Out of scope: queue algorithm/transport behavior changes.
- Acceptance criteria:
  - Queue-related type contracts are defined once and reused across worldserver transport/push/process helpers.
  - Runtime behavior remains unchanged.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-queue-contract.ts` with shared queue/transport contracts:
    - `WorldEntityId`, `IgnoredPlayer`, `QueuePlayer`, `QueueGroup`, `AdjacentGroupMap`
    - `OutgoingQueues`, `TransportErrorLogger`, `GetEntityById`, `WorldConnection`
  - Updated modules to import shared queue contracts:
    - `server/js/worldserver-transport.ts`
    - `server/js/worldserver-push.ts`
    - `server/js/worldserver-process-queues.ts`
    - `server/js/worldserver-add-player.ts`
    - `server/js/worldserver-remove-player.ts`
  - Added `server/js/worldserver-queue-contract.ts` to explicit TS include lists:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue duplication audit with next low-risk consolidation candidate (worldserver entity mutation helper cluster).

### 2026-02-10 23:55 CET — Ticket 7 WorldServer Entity-Mutation Helper Consolidation TODO

- Status: `done`
- TODO checklist:
  - `done` Audit and consolidate duplicate helper patterns in entity mutation modules (`add*`/`remove*` family) where behavior is unchanged.
  - `done` Keep external worldserver method behavior and ordering identical.
  - `done` Verify parity and full modern verification lane.
- Scope:
  - Included: low-risk consolidation of repetitive helper implementations only.
  - Out of scope: entity lifecycle policy changes.
- Acceptance criteria:
  - Helper duplication is reduced while preserving worldserver method semantics.
  - Verification passes.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Consolidated nine entity-mutation helper modules into one:
    - Added `server/js/worldserver-entity-mutations.ts` containing:
      - `addWorldEntity(...)`
      - `addWorldPlayer(...)`
      - `removeWorldPlayer(...)`
      - `addWorldMob(...)`
      - `addWorldItem(...)`
      - `addWorldItemFromChest(...)`
      - `addWorldStaticItem(...)`
      - `addWorldNpc(...)`
      - `removeWorldEntity(...)`
    - Removed replaced modules:
      - `server/js/worldserver-add-entity.ts`
      - `server/js/worldserver-add-item.ts`
      - `server/js/worldserver-add-item-from-chest.ts`
      - `server/js/worldserver-add-mob.ts`
      - `server/js/worldserver-add-npc.ts`
      - `server/js/worldserver-add-player.ts`
      - `server/js/worldserver-add-static-item.ts`
      - `server/js/worldserver-remove-entity.ts`
      - `server/js/worldserver-remove-player.ts`
  - Rewired `server/js/worldserver.ts` imports to consume `server/js/worldserver-entity-mutations.ts`.
  - Updated explicit TS include lists to reflect consolidation:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
  - Fixed a surfaced typed callback narrowing issue in `server/js/worldserver.ts` `entityAttack` listener by narrowing to `Mob` before reading `target`.
- Evidence:
  - `bun run typecheck` initially failed due `attacker.target` on base `Entity` and was corrected.
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue duplication audit for additional low-risk contract/shape consolidations in remaining worldserver helper modules.

### 2026-02-10 21:58 CET — Ticket 8 Typed Event Emitter Foundation TODO

- Status: `done`
- TODO checklist:
  - `done` Add a shared typed event emitter utility with `on`, `once`, `off`, and `emit`.
  - `done` Ensure listener registration returns an unsubscriber.
  - `done` Add focused unit tests covering subscription, unsubscription, and once semantics.
  - `done` Run targeted verification for the new utility and tests.
- Scope:
  - Included: generic typed emitter foundation only.
  - Out of scope: migrating existing callback-based classes in this ticket.
- Acceptance criteria:
  - A reusable typed emitter utility exists and supports `on`, `once`, `off`, `emit`.
  - `on` and `once` return unsubscribe functions.
  - Unit tests validate the expected behavior.
- Verification plan:
  - `bun test tests/unit/typed-event-emitter.test.ts`
  - `bun run typecheck`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `shared/js/typed-event-emitter.ts` with:
    - `TypedEventMap` event-map constraint.
    - `TypedEventBus<TEvents>` interface.
    - `TypedEventEmitter<TEvents>` implementation (`on`, `once`, `off`, `emit`).
  - Added `tests/unit/typed-event-emitter.test.ts` with behavioral coverage:
    - base listener invocation via `on`.
    - unsubscribe behavior from `on`.
    - single-fire behavior for `once`.
    - listener removal via `off`.
  - Updated `tsconfig.typecheck.json` explicit include list to add:
    - `shared/js/typed-event-emitter.ts`
- Evidence:
  - `bun test tests/unit/typed-event-emitter.test.ts --timeout 20000` passed (4/4).
  - `bun run typecheck` passed.
- Next action:
  - Start Ticket 9 by migrating one callback-heavy class (recommended: `client/js-esm/gameclient.ts`) to the typed emitter API end-to-end with no legacy callback wrappers.

### 2026-02-10 22:02 CET — Ticket 9 GameClient Typed-Event Migration TODO

- Status: `done`
- TODO checklist:
  - `done` Replace `GameClient` callback fields and `onX` registration methods with typed `on/once/off/emit`.
  - `done` Define and export `GameClientEvents` event map for all current client-side protocol and lifecycle events.
  - `done` Update game-session registration modules to consume `client.on('<event>', handler)` instead of `onX(...)`.
  - `done` Run targeted tests and full typecheck.
- Scope:
  - Included: full event wiring migration for `client/js-esm/gameclient.ts` and its direct registration call sites.
  - Out of scope: migrating other callback-based classes (`Player`, `Character`, `Game`, server classes) in this ticket.
- Acceptance criteria:
  - `GameClient` exposes typed event emitter API and no `onX` callback setter methods remain.
  - Existing event behavior remains functionally equivalent at call sites.
  - Verification commands pass.
- Verification plan:
  - `bun test tests/unit/typed-event-emitter.test.ts`
  - `bun run typecheck`
- Dependencies/blockers:
  - None.
- Key actions:
  - Refactored `client/js-esm/gameclient.ts`:
    - Added typed event map export `GameClientEvents`.
    - Added event-source export `GameClientEventSource`.
    - Replaced callback field storage with `TypedEventEmitter<GameClientEvents>`.
    - Replaced legacy callback dispatch points with `emit(...)`.
    - Replaced many `onX(...)` methods with generic `on/once/off/emit` API.
  - Migrated registration call sites to named events:
    - `client/js-esm/game-session-bootstrap.ts`
    - `client/js-esm/game-session-connect-registrations.ts`
    - `client/js-esm/game-session-spawn-primitives-builder.ts`
    - `client/js-esm/game-session-spawn-character-registrar.ts`
    - `client/js-esm/game-session-welcome-registrar.ts`
  - Updated builder-side client contracts to event-source shape:
    - `client/js-esm/game-session-connect-registrations-builder.ts`
    - `client/js-esm/game-session-spawn-primitives-host-builder.ts`
    - `client/js-esm/game-session-spawn-character-registrar-builder.ts`
  - Added `shared/js/typed-event-emitter.ts` to `tsconfig.typecheck-client-runtime.json` explicit includes.
- Evidence:
  - `bun test tests/unit/typed-event-emitter.test.ts --timeout 20000` passed (4/4).
  - `bun run typecheck` passed.
- Next action:
  - Continue migration by selecting the next callback-heavy class (`client/js-esm/character.ts` or `client/js-esm/player.ts`) for the same typed event API pattern.

### 2026-02-10 22:12 CET — Ticket 10 Character/Player Typed-Event Migration TODO

- Status: `done`
- TODO checklist:
  - `done` Migrate `client/js-esm/character.ts` callback fields and `onX` methods to typed event API.
  - `done` Replace `Character` request-path callback with explicit resolver setter suitable for request/response semantics.
  - `done` Migrate `client/js-esm/player.ts` callback fields and `onX` methods to typed event API.
  - `done` Update all direct registration call sites for `Character` and `Player`.
  - `done` Run targeted tests and full typecheck.
- Scope:
  - Included: `Character`/`Player` event migration and direct usage rewiring in client session modules.
  - Out of scope: `Game` class callback/event migration.
- Acceptance criteria:
  - `Character` and `Player` expose typed event APIs with no legacy `onX` callback setter methods.
  - Path request behavior remains equivalent through explicit resolver API.
  - Verification commands pass.
- Verification plan:
  - `bun test tests/unit/typed-event-emitter.test.ts`
  - `bun run typecheck`
- Dependencies/blockers:
  - None.
- Key actions:
  - Refactored `client/js-esm/character.ts`:
    - Added `CharacterEvents` and `CharacterEventSource`.
    - Replaced callback fields with `TypedEventEmitter<CharacterEvents>`.
    - Added generic `on/once/off/emit` API.
    - Replaced request callback with explicit `setPathRequestResolver(...)`.
    - Rewired movement/combat/death hooks to emit named events.
  - Refactored `client/js-esm/player.ts`:
    - Added `PlayerEvents` and `PlayerEventSource`.
    - Replaced callback fields with typed event emission on inherited generic event bus.
    - Simplified design to avoid forwarding boilerplate by using `Player extends Character<CharacterEvents & PlayerEvents>`.
    - Added `emitArmorLoot(...)` and rewired invincibility/switch notifications to event emission.
  - Updated armor-loot invocation contract:
    - `client/js-esm/item.ts` now calls `player.emitArmorLoot(...)`.
  - Updated registration/callsite modules to named events/resolver API:
    - `client/js-esm/game-session-player-before-step.ts`
    - `client/js-esm/game-session-player-step.ts`
    - `client/js-esm/game-session-player-pathing.ts`
    - `client/js-esm/game-session-player-aggro.ts`
    - `client/js-esm/game-session-player-death.ts`
    - `client/js-esm/game-session-player-request-path.ts`
    - `client/js-esm/game-session-spawn-character-motion.ts`
    - `client/js-esm/game-session-spawn-character-bubble.ts`
    - `client/js-esm/game-session-spawn-character-death.ts`
    - `client/js-esm/game-session-spawn-character-stop-pathing.ts`
    - `client/js-esm/game-session-spawn-character-path-request.ts`
    - `client/js-esm/game-session-player-cosmetics.ts`
    - `client/js-esm/game-session-player-cosmetics-builder.ts`
    - `client/js-esm/game-session-welcome-registrar.ts`
- Evidence:
  - `bun run typecheck` passed.
  - `bun test tests/unit/typed-event-emitter.test.ts --timeout 20000` passed (4/4).
- Next action:
  - Continue with next callback-heavy class migration (`client/js-esm/game.ts`) to further reduce callback boilerplate.

### 2026-02-10 22:24 CET — Ticket 11 Emitter Streamlining Review TODO

- Status: `done`
- TODO checklist:
  - `done` Remove remaining emitter boilerplate/casts in core migrated classes.
  - `done` Standardize event-source typing shape across modules for consistency.
  - `done` Run typecheck and targeted tests after streamlining.
- Scope:
  - Included: structural cleanup of typed emitter usage introduced in Tickets 8-10.
  - Out of scope: migrating additional non-emitter classes.
- Acceptance criteria:
  - Event-emitter usage in core migrated classes is simpler and less repetitive than current state.
  - Event-source typing follows one consistent pattern.
  - Verification passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test tests/unit/typed-event-emitter.test.ts --timeout 20000`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added reusable mixin `shared/js/with-events.ts` (named `withEvents`) to compose typed emitter behavior into classes.
  - Migrated `client/js-esm/gameclient.ts` to `withEvents<GameClientEvents>(Object)`:
    - Removed per-class emitter field and duplicated `on/once/off/emit` plumbing.
    - Kept behavior/call sites unchanged.
  - Migrated `client/js-esm/character.ts` to `withEvents<CharacterEvents>(Entity)`:
    - Removed end-of-file emitter boilerplate (`on/once/off/emit` wrappers and helper emitter method).
    - Kept typed event emission calls directly in behavior methods.
  - Migrated `client/js-esm/player.ts` to `withEvents<CharacterEvents & PlayerEvents>(Character)`:
    - Removed manual `on(...)` overload forwarding boilerplate.
    - Preserved both character and player event subscriptions through composed event map.
  - Standardized shared typing surface:
    - Added `TypedEventSource<TEvents>` and exported callback utility in `shared/js/typed-event-emitter.ts`.
    - Switched `GameClientEventSource` to `TypedEventSource<GameClientEvents>`.
  - Updated explicit include lists for the new helper:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-client-runtime.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun test tests/unit/typed-event-emitter.test.ts --timeout 20000` passed (4/4).
- Next action:
  - Optionally migrate `Character` to `withEvents` too, if we want identical class construction style across client classes.

### 2026-02-10 22:38 CET — Ticket 12 Entity-Root Event Generic Refactor TODO

- Status: `done`
- TODO checklist:
  - `done` Move event emitter composition to `Entity` root type.
  - `done` Make `Entity` generic over event map and flow typed events down inheritance.
  - `done` Simplify `Character` and `Player` to inherit event API from `Entity`.
  - `done` Verify project typecheck and emitter tests.
- Scope:
  - Included: `Entity`/`Character`/`Player` event inheritance architecture.
  - Out of scope: migrating remaining non-entity classes.
- Acceptance criteria:
  - `Entity` exposes typed event API through generic parameter.
  - `Character` and `Player` no longer need direct mixin composition for events.
  - Existing typed subscriptions continue to compile.
  - Verification passes.
- Verification plan:
  - `bun run typecheck`
  - `bun test tests/unit/typed-event-emitter.test.ts --timeout 20000`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `shared/js/evented.ts` with `Evented<TEvents>` base class (non-mixin inheritance path).
  - Refactored `client/js-esm/entity.ts`:
    - `Entity<TEvents>` now directly extends `Evented<TEvents>`.
    - Default entity event map includes `'dirty'`.
    - `setDirty()` now emits `'dirty'` instead of storing a dedicated callback slot.
  - Updated `client/js-esm/character.ts`:
    - Switched to `class Character<TEvents extends CharacterEvents = any> extends Entity<TEvents>`.
    - Event typing now inherits from `Entity` root event base.
  - Updated `client/js-esm/player.ts`:
    - Switched to `class Player extends Character<CharacterEvents & PlayerEvents>`.
    - Inherits event typing pipeline from `Entity -> Character -> Player`.
  - Updated `client/js-esm/game.ts` entity dirty subscription to use event API:
    - `entity.on('dirty', handler)` instead of `entity.onDirty(handler)`.
  - Preserved runtime behavior and existing event-name call sites.
- Evidence:
  - `bun run typecheck` passed.
  - `bun test tests/unit/typed-event-emitter.test.ts --timeout 20000` passed (4/4).
- Next action:
  - Optional follow-up: remove any now-redundant `CharacterEventSource` aliases if not consumed.

### 2026-02-10 22:48 CET — Ticket 13 Evented Consolidation TODO

- Status: `done`
- TODO checklist:
  - `done` Remove `withEvents` usage and standardize on `Evented<TEvents>` everywhere.
  - `done` Add shared event utility types (`NoEvents`, `MergeEvents`) and apply them in class signatures.
  - `done` Add compile-time type tests locking event API shape and preventing widening regressions.
  - `done` Run full typecheck and targeted tests.
- Scope:
  - Included: event architecture consistency and typing hardening.
  - Out of scope: unrelated gameplay/runtime behavior changes.
- Acceptance criteria:
  - No `withEvents` usage remains in client/shared code.
  - Shared event utility types are used by entity/evented classes.
  - Compile-time tests validate typed emitter contracts.
  - Verification commands pass.
- Verification plan:
  - `bun run typecheck`
  - `bun test tests/unit/typed-event-emitter.test.ts --timeout 20000`
- Dependencies/blockers:
  - None.
- Key actions:
  - Removed mixin path and deleted `shared/js/with-events.ts`.
  - Migrated event inheritance to direct base-class model:
    - `shared/js/evented.ts` now owns reusable event behavior.
    - `client/js-esm/gameclient.ts` now extends `Evented<GameClientEvents>`.
    - `client/js-esm/entity.ts` now extends `Evented<TEvents>`.
    - `client/js-esm/character.ts` and `client/js-esm/player.ts` inherit typed event flow from `Entity`.
  - Added shared utility event types in `shared/js/typed-event-emitter.ts`:
    - `NoEvents`
    - `MergeEvents<TLeft, TRight>`
  - Replaced legacy `onDirty(...)` callback plumbing with normal event usage:
    - `client/js-esm/entity.ts` `setDirty()` now emits `'dirty'`.
    - `client/js-esm/game.ts` listens with `entity.on('dirty', ...)`.
  - Added compile-time contract tests:
    - `tests/unit/typed-event-emitter-types.test.ts`
  - Updated TS explicit include lists for new/removed shared modules:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-client-runtime.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun test tests/unit/typed-event-emitter.test.ts tests/unit/typed-event-emitter-types.test.ts --timeout 20000` passed (5/5).
- Next action:
  - Optional: tighten remaining `any` casts around `'dirty'` emission in `Entity.setDirty()` if we want to enforce a strict `dirty` presence contract on all entity event maps.

### 2026-02-11 00:05 CET — Ticket 7 WorldServer Chest/Population Helper Consolidation TODO

- Status: `done`
- TODO checklist:
  - `done` Consolidate chest/item lifecycle helper micro-modules into one shared WorldServer module.
  - `done` Consolidate population/player-count helper micro-modules into one shared WorldServer module.
  - `done` Rewire `server/js/worldserver.ts` imports and remove superseded helper files.
  - `done` Update explicit typecheck project include lists for renamed/merged modules.
  - `done` Run full verification suite for behavior parity.
- Scope:
  - Included: dedupe/verbosity reduction for worldserver chest-item lifecycle and population helper seams.
  - Out of scope: gameplay logic changes and protocol changes.
- Acceptance criteria:
  - No behavior change in chest spawn/open/despawn or population broadcast paths.
  - Consolidated helpers compile and legacy micro-module files are removed.
  - Typecheck/parity/verify commands pass.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-chest-item-lifecycle.ts` containing:
    - `createWorldItem`
    - `createWorldChest`
    - `scheduleWorldItemDespawn`
    - `handleEmptyChestAreaRefill`
    - `handleOpenedChestOrchestration`
    - `addMobToContainingChestAreas`
  - Added `server/js/worldserver-population.ts` containing:
    - `countPlayersInWorld`
    - `setWorldPlayerCount`
    - `incrementWorldPlayerCount`
    - `decrementWorldPlayerCount`
    - `notifyWorldPopulation`
  - Updated `server/js/worldserver.ts` to import from the new consolidated modules.
  - Removed superseded micro-files:
    - `server/js/worldserver-chest-area.ts`
    - `server/js/worldserver-chest-area-membership.ts`
    - `server/js/worldserver-create-chest.ts`
    - `server/js/worldserver-create-item.ts`
    - `server/js/worldserver-item-despawn.ts`
    - `server/js/worldserver-opened-chest.ts`
    - `server/js/worldserver-player-count.ts`
    - `server/js/worldserver-player-count-mutators.ts`
    - `server/js/worldserver-population-notify.ts`
  - Updated explicit include lists to remove deleted files and include consolidated modules:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 dedupe with the next low-risk consolidation cluster (`mob-*` helpers or group-membership helpers) while keeping verify parity green.

### 2026-02-11 00:07 CET — Ticket 7 WorldServer Mob Helper Consolidation TODO

- Status: `done`
- TODO checklist:
  - `done` Consolidate `worldserver-mob-*` helper micro-modules into one shared orchestration module.
  - `done` Rewire `server/js/worldserver.ts` imports to the consolidated module.
  - `done` Remove superseded mob helper files.
  - `done` Update explicit TS include lists.
  - `done` Run full verification suite.
- Scope:
  - Included: dedupe/verbosity reduction for mob hate/target/link/move helper seams.
  - Out of scope: combat behavior/protocol changes.
- Acceptance criteria:
  - Mob hate/aggro/move behavior remains unchanged.
  - Consolidated module compiles and legacy micro-modules are removed.
  - Typecheck/parity/verify commands pass.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-mob-orchestration.ts` containing:
    - `handleWorldMobHate`
    - `clearWorldMobAggroLink`
    - `clearWorldMobHateLinks`
    - `chooseWorldMobTarget`
    - `handleWorldMobMoveCallback`
  - Updated `server/js/worldserver.ts` to import mob helpers from `worldserver-mob-orchestration.ts`.
  - Removed superseded files:
    - `server/js/worldserver-mob-hate.ts`
    - `server/js/worldserver-mob-links.ts`
    - `server/js/worldserver-mob-move-callback.ts`
    - `server/js/worldserver-mob-target.ts`
  - Updated explicit include lists:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 dedupe with next low-risk cluster (group/process helper consolidation).

### 2026-02-11 00:10 CET — Ticket 7 WorldServer Group/Spawn Flow Consolidation TODO

- Status: `done`
- TODO checklist:
  - `done` Consolidate group/process/relevance/spawn-flow helper micro-modules into one shared module.
  - `done` Rewire `worldserver.ts` and `worldserver-push.ts` imports to the consolidated module.
  - `done` Remove superseded helper files.
  - `done` Update explicit TS include lists.
  - `done` Run full verification suite.
- Scope:
  - Included: dedupe/verbosity reduction for group processing, relevant list, spawn push, previous-group fanout, and queue-process wrapper seams.
  - Out of scope: gameplay behavior/protocol changes.
- Acceptance criteria:
  - Group processing, spawn fanout, and relevant-list behavior remains unchanged.
  - Consolidated helper module compiles and legacy micro-modules are removed.
  - Typecheck/parity/verify commands pass.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-group-flow.ts` containing:
    - `collectRelevantEntityIds`
    - `pushRelevantEntityListToPlayer`
    - `pushSpawnEntitiesToPlayer`
    - `pushWorldSpawnsToPlayer`
    - `pushMessageToPreviouslyLeftGroups`
    - `processWorldGroups`
    - `processWorldOutgoingQueues`
  - Updated imports:
    - `server/js/worldserver.ts`
    - `server/js/worldserver-push.ts`
  - Removed superseded files:
    - `server/js/worldserver-process-groups.ts`
    - `server/js/worldserver-process-queues.ts`
    - `server/js/worldserver-previous-groups.ts`
    - `server/js/worldserver-relevant-entities.ts`
    - `server/js/worldserver-relevant-list-push.ts`
    - `server/js/worldserver-spawn-list-push.ts`
    - `server/js/worldserver-spawn-push.ts`
  - Updated explicit include lists:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 dedupe by collapsing remaining tiny group/player utility modules where behavior can be proven unchanged.

### 2026-02-11 00:12 CET — Ticket 7 WorldServer Group Membership Helper Consolidation TODO

- Status: `done`
- TODO checklist:
  - `done` Consolidate group membership helper micro-modules into one shared orchestration module.
  - `done` Rewire `worldserver.ts` imports to the consolidated module.
  - `done` Remove superseded helper files.
  - `done` Update explicit TS include lists.
  - `done` Run full verification suite.
- Scope:
  - Included: dedupe/verbosity reduction for add-to-group, incoming-group, remove-from-groups, group-membership, and group-player-log seams.
  - Out of scope: gameplay behavior/protocol changes.
- Acceptance criteria:
  - Group membership transitions and logs remain behaviorally unchanged.
  - Consolidated module compiles and legacy helper files are removed.
  - Typecheck/parity/verify commands pass.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-group-membership-orchestration.ts` containing:
    - `addEntityToWorldGroup`
    - `addEntityAsIncomingToGroups`
    - `removeEntityFromWorldGroups`
    - `handleWorldEntityGroupMembership`
    - `logWorldGroupPlayers`
  - Updated imports in `server/js/worldserver.ts`.
  - Removed superseded files:
    - `server/js/worldserver-add-to-group.ts`
    - `server/js/worldserver-incoming-group.ts`
    - `server/js/worldserver-remove-from-groups.ts`
    - `server/js/worldserver-group-membership.ts`
    - `server/js/worldserver-group-player-log.ts`
  - Updated explicit include lists:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 dedupe on the remaining tiny worldserver utility seams where consolidation still reduces import/file churn without behavior risk.

### 2026-02-11 00:23 CET — Ticket 7 WorldServer Entity Utility Consolidation TODO

- Status: `done`
- TODO checklist:
  - `done` Consolidate remaining tiny worldserver entity utility seams into one module.
  - `done` Rewire `worldserver.ts` imports to consolidated module.
  - `done` Remove superseded helper files and update explicit TS include lists.
  - `done` Run full verification suite (`typecheck`, parity smoke, full verify).
- Scope:
  - Included: `broadcast-attacker`, `dropped-item`, `despawn`, `player-vanish`, `entity-lookup`, `position-validation`, `position-next-to`, `move-entity`.
  - Out of scope: behavior changes in combat/drop/position/grouping semantics.
- Acceptance criteria:
  - No behavior/protocol change in affected flows.
  - Consolidated module compiles and deleted modules are no longer referenced.
  - Verification commands pass.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added `server/js/worldserver-entity-utilities.ts` containing:
    - `broadcastWorldAttacker`
    - `selectDroppedItemForMob`
    - `despawnWorldEntity`
    - `handleWorldPlayerVanish`
    - `getWorldEntityById`
    - `isWorldPositionValid`
    - `findWorldPositionNextTo`
    - `moveWorldEntity`
  - Rewired `server/js/worldserver.ts` imports to use the consolidated utility module.
  - Removed superseded files:
    - `server/js/worldserver-broadcast-attacker.ts`
    - `server/js/worldserver-dropped-item.ts`
    - `server/js/worldserver-despawn.ts`
    - `server/js/worldserver-player-vanish.ts`
    - `server/js/worldserver-entity-lookup.ts`
    - `server/js/worldserver-position-validation.ts`
    - `server/js/worldserver-position-next-to.ts`
    - `server/js/worldserver-move-entity.ts`
  - Updated explicit include lists:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 dedupe in order by collapsing remaining tiny worldserver utility seams that still duplicate helper scaffolding.

### 2026-02-11 00:26 CET — Ticket 7 WorldServer Iteration/Zone Helper Consolidation TODO

- Status: `done`
- TODO checklist:
  - `done` Fold `worldserver-entity-iteration.ts` and `worldserver-zone-groups.ts` into `worldserver-group-flow.ts`.
  - `done` Rewire `worldserver.ts` imports.
  - `done` Remove superseded files and update explicit TS include lists.
  - `done` Run full verification suite (`typecheck`, parity smoke, full verify).
- Scope:
  - Included: pure helper consolidation for iteration/group initialization seams.
  - Out of scope: any runtime behavior changes.
- Acceptance criteria:
  - Iteration and zone-group initialization behavior is unchanged.
  - No stale imports to deleted helper files remain.
  - Verification commands pass.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Expanded `server/js/worldserver-group-flow.ts` with:
    - `forEachEntityInWorldMap`
    - `forEachWorldCharacter`
    - `initializeWorldZoneGroups`
  - Rewired imports in `server/js/worldserver.ts` to consume these helpers from `worldserver-group-flow.ts`.
  - Removed superseded files:
    - `server/js/worldserver-entity-iteration.ts`
    - `server/js/worldserver-zone-groups.ts`
  - Updated explicit include lists:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 dedupe in order by reducing remaining file/typing boilerplate in worldserver helper seams without behavior change.

### 2026-02-11 00:28 CET — Ticket 7 WorldServer Contract-Type Consolidation TODO

- Status: `done`
- TODO checklist:
  - `done` Merge message and queue worldserver contract files into one canonical contract module.
  - `done` Rewire all imports to consolidated contract module.
  - `done` Remove superseded contract files and update explicit TS include lists.
  - `done` Run full verification suite.
- Scope:
  - Included: type-only consolidation of `worldserver-message-contract.ts` and `worldserver-queue-contract.ts`.
  - Out of scope: runtime protocol/queue behavior changes.
- Acceptance criteria:
  - All affected modules compile with identical runtime behavior.
  - No stale imports to old contract files remain.
  - Verification commands pass.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Added consolidated contract file:
    - `server/js/worldserver-contracts.ts`
      - `WorldMessage`
      - queue and transport contract types (`WorldEntityId`, `IgnoredPlayer`, `QueuePlayer`, `QueueGroup`, `AdjacentGroupMap`, `OutgoingQueues`, `TransportErrorLogger`, `GetEntityById`, `WorldConnection`)
  - Rewired imports in:
    - `server/js/worldserver.ts`
    - `server/js/worldserver-hurt-entity.ts`
    - `server/js/worldserver-push.ts`
    - `server/js/worldserver-entity-mutations.ts`
    - `server/js/worldserver-mob-orchestration.ts`
    - `server/js/worldserver-transport.ts`
    - `server/js/worldserver-entity-utilities.ts`
    - `server/js/worldserver-group-flow.ts`
  - Removed superseded files:
    - `server/js/worldserver-message-contract.ts`
    - `server/js/worldserver-queue-contract.ts`
  - Updated explicit include lists:
    - `tsconfig.typecheck.json`
    - `tsconfig.typecheck-runtime.json`
    - `tsconfig.typecheck-server-esm.json`
- Evidence:
  - `bun run typecheck` passed.
  - `bun run test:modern-parity` passed.
  - `bun run verify:modern:node22` passed.
- Next action:
  - Continue Ticket 7 in order with the next dedupe slice focused on reducing boilerplate in remaining worldserver helper boundaries and then reassess Ticket 7 closure readiness.

### 2026-02-11 00:35 CET — Ticket 7 Static-Spawn Domain Consolidation TODO

- Status: `in_progress`
- TODO checklist:
  - `in_progress` Merge `worldserver-static-spawn.ts` into `worldserver-chest-item-lifecycle.ts`.
  - `todo` Rewire imports and remove superseded file.
  - `todo` Update explicit TS include lists.
  - `todo` Run full verification suite.
- Scope:
  - Included: static-entity spawn helper consolidation into existing chest/item lifecycle module.
  - Out of scope: spawn behavior changes.
- Acceptance criteria:
  - Static NPC/mob/item spawn behavior stays identical.
  - No references to `worldserver-static-spawn.ts` remain.
  - Verification commands pass.
- Verification plan:
  - `bun run typecheck`
  - `bun run test:modern-parity`
  - `bun run verify:modern:node22`
- Dependencies/blockers:
  - None.
- Key actions:
  - Ticketized this slice before edits.
- Evidence:
  - TODO entry created and marked `in_progress`.
- Next action:
  - Implement static-spawn merge and import rewiring.
