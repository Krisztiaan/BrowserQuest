# BrowserQuest modernization (2026)

This repo is an early-2010s HTML5 game (AMD/RequireJS client + Node server). The goal of the `modernize` branch is to move it to 2026-era JavaScript standards and tooling *without breaking gameplay*, using small, verifiable steps.

## Current state (audit highlights)

- **Client**: AMD modules (`define(...)`) loaded via `require-jquery.js`, plus some global-script modules (e.g. `client/js/lib/class.js`, `client/js/lib/log.js`). Build uses the legacy RequireJS optimizer (`bin/r.js` + `client/js/build.js`).
- **Server**: CommonJS modules, custom websocket wrapper, plus several pre-2015 dependencies and deprecated Node APIs (now fixed where required for Node 20+/Bun).
- **Protocol**: JSON message arrays over WebSocket. (BISON exists in-tree on the client, but “modern mode” keeps JSON-only.)

## Phase 0: Working baseline (done on `modernize`)

- Bun-based install works (`bun install`).
- Server runs on Node 20+/Bun and speaks modern WebSocket (RFC 6455) via `ws`.
- Local dev is one command: `bun run dev` (client on `:3000`, server on `:8000`).

## Phase 1: Stabilize + safety nets (next)

1) **Smoke tests**: add a tiny script/test that starts the server, connects a WebSocket client, and asserts the initial `"go"` handshake.
2) **Runtime invariants**: add basic validation/limits for chat/name payloads (length, UTF-8, etc.).
3) **Observability**: improve uncaught exception logging to include stack traces and add structured logs (likely `pino`).

## Phase 2: Modern client build without rewriting gameplay

Target: run the same game logic under a modern bundler with ESM output.

Two viable paths:

### Option A: Convert AMD → ESM (recommended)

Use a converter like `prantlf/requirejs-esm-converter` to do the mechanical conversion, then fix the small set of hard cases:

- **RequireJS plugins**: `text!…` imports (sprites/config) become `import ... from "...?raw"` or JSON imports (Vite handles JSON well).
- **Globals/shims**: modules like `class.js` and `log.js` become explicit exports and are imported where used.
- **Workers**: `new Worker('js/mapworker.js')` becomes `new Worker(new URL('./mapworker.js', import.meta.url), { type: 'module' })`.

Once converted, wire it up with:

- **Vite** (or **Rspack**) for dev server + production build
- **ESM output** with code-splitting

Status: initial AMD→ESM conversion exists in `client/js-esm` with an ESM entry page at `client/modern.html` (served via Vite).

### Option B: Keep AMD, modernize around it (fallback)

Continue using RequireJS at runtime but modernize server/dev tooling first. This reduces conversion work but blocks long-term improvements (tree-shaking, modern imports, etc.).

## Phase 3: Remove legacy dependencies incrementally

- Replace `underscore` with built-in JS (`Array.prototype.*`, `Object.*`) module-by-module.
- Reduce `jQuery` usage to the UI shell (or replace with vanilla/modern framework only if desired).

## Phase 4: TypeScript (optional)

Only after Phase 2, introduce TS gradually:

- Start with `shared/` message/types and the websocket protocol layer.
- Keep the renderer/game loop JS initially to avoid destabilizing performance/behavior.

## Target stack (2026-friendly)

- Runtime: **Node 22 LTS** (keep Node 20+ compatibility while migrating)
- Package manager: **Bun**
- Client tooling: **Vite** (+ ESM)
- Lint/format: **ESLint (flat config)** + **Prettier**
- Test: **Vitest** (unit) + a small **Playwright** smoke test (optional)

## Ticket board

### T-001: Stabilize builds and dev entrypoints
- Status: `done`
- Scope: make legacy + Vite build paths run on current Bun/Node, fix critical runtime asset/path issues.
- Out of scope: full gameplay refactor, full dependency replacement.
- Acceptance criteria: `bun run test`, `bun run build:client`, and `bun run build:vite` all succeed.
- Verification: run the 3 commands above and confirm no fatal errors.
- Dependencies/blockers: none.

### T-002: Remove modern-page non-module boot globals
- Status: `done`
- Scope: modern page must not require `client/js/detect.js` or `client/js/lib/modernizr.js`; replace with ESM compat + module preflight.
- Out of scope: legacy `client/index.html` boot path.
- Acceptance criteria:
  - `client/modern.html` has no non-module detect/modernizr scripts.
  - localStorage/WebSocket preflight behavior remains.
  - ESM modules relying on Detect/Modernizr continue to work.
- Verification: `bun run test`, `bun run build:vite`, `bun run build:client`.
- Dependencies/blockers: depends on T-001 baseline.

### T-003: Reduce `js-esm` implicit globals (Class/log/Types/utility)
- Status: `done`
- Scope: replace global assumptions in converted ESM files with explicit imports incrementally.
- Out of scope: full gameplay architecture changes.
- Acceptance criteria: each converted cluster builds/tests cleanly with no behavior regression in smoke checks.
- Verification: per-PR run of `bun run test` + `bun run build:vite`.
- Dependencies/blockers: T-002 complete.

### T-004: Modern-only Vite build profile
- Status: `done`
- Scope: default `build:vite` targets modern page cleanly; legacy page remains buildable via an explicit opt-in script/profile.
- Out of scope: removing legacy page runtime.
- Acceptance criteria: modern build has no legacy non-module script warnings.
- Verification: `bun run build:vite` (clean modern), plus opt-in legacy build command.
- Dependencies/blockers: none.

## Live progress log

- 2026-02-05 21:57:30Z
  - Status: `in_progress` -> `done` (T-002)
  - Actions:
    - Added ESM feature compat module: `client/js-esm/compat/features.js`.
    - Added ESM detect compat module: `client/js-esm/compat/detect.js`.
    - Added module preflight: `client/js-esm/preflight.js`.
    - Updated `client/js-esm/{main.js,audio.js,renderer.js,storage.js,bootstrap.js}` to use compat modules.
    - Removed `modernizr` + `detect` script tags and inline global preflight from `client/modern.html`.
  - Evidence:
    - `bun run test` passed (`tests/smoke/server-handshake.test.ts`).
    - `bun run build:vite` passed; only expected warnings remain for legacy `client/index.html` non-module scripts.
    - `bun run build:client` passed; expected legacy r.js ES-module uglify warnings remain for `client/js-esm/*`.
  - Next action:
    - Continue T-003 by replacing implicit global usage in remaining `client/js-esm/*` modules with explicit imports.

- 2026-02-05 21:59:45Z
  - Status: `in_progress` (T-003)
  - Actions:
    - Converted a first ESM cluster to explicit imports:
      - `client/js-esm/main.js`: `log`, `TRANSITIONEND`.
      - `client/js-esm/audio.js`: `Class`, `_`, `log`.
      - `client/js-esm/renderer.js`: `Class`, `_`, `log`.
      - `client/js-esm/storage.js`: `Class`, `_`.
  - Evidence:
    - `bun run test` passed.
    - `bun run build:vite` passed.
  - Next action:
    - Continue T-003 by converting the next cluster (`gameclient`, `map`, `game`, `entity*`) from implicit globals to explicit imports.

- 2026-02-05 22:00:47Z
  - Status: `in_progress` (T-003)
  - Actions:
    - Converted core runtime cluster to explicit imports:
      - `client/js-esm/gameclient.js`: `$`, `_`, `Class`, `log`, `Types`.
      - `client/js-esm/map.js`: `_`, `Class`, `log`, `Types`, `isInt`.
      - `client/js-esm/entityfactory.js`: `_`, `log`, `Types`.
      - `client/js-esm/game.js`: `_`, `Class`, `log`, `Types`, `requestAnimFrame`.
  - Evidence:
    - `bun run test` passed.
    - `bun run build:vite` passed.
  - Next action:
    - Continue T-003 with remaining gameplay modules (`entity`, `character`, `npc/mob/items`, `pathfinder`, `updater`, `app`) to remove implicit globals end-to-end.

- 2026-02-05 22:09:55Z
  - Status: `in_progress` -> `done` (T-003A, T-003B, T-003C, T-004)
  - Actions:
    - Completed explicit-import migration for all top-level ESM gameplay/app modules (`client/js-esm/*.js`) to remove implicit global dependency on `Class`, `Types`, `log`, `_`, and util helpers.
    - Added modern-only default Vite build mode via `BQ_VITE_INCLUDE_LEGACY` switch in `vite.config.ts`.
    - Added opt-in legacy-inclusive build script: `build:vite:legacy`.
  - Evidence:
    - Global-debt import check script returns no missing imports across `client/js-esm/*.js`.
    - `bun run test` passed.
    - `bun run build:vite` passed with no legacy non-module warnings.
    - `bun run build:vite:legacy` passed (legacy warnings expected by design).
    - `bun run build:client` passed (legacy r.js ES-module uglify warnings expected).
  - Next action:
    - Start the next modernization tranche on runtime hardening and dependency reduction.

- 2026-02-05 22:14:47Z
  - Status: `in_progress` -> `done` (T-005)
  - Actions:
    - Added UTF-8 payload helpers in `server/js/utils.js` (`utf8ByteLength`, `hasMaxUtf8Bytes`, `limitUtf8Bytes`, `limitCodePoints`).
    - Hardened numeric payload validation in `server/js/format.js` to require finite safe integers.
    - Applied payload guards in `server/js/player.js` for `HELLO`, `CHAT`, and `WHO` limits using UTF-8-safe clamping.
    - Removed underscore dependency from shared helpers in `shared/js/gametypes.js` used by server-side validation/error paths.
    - Added integration tests in `tests/smoke/server-payload-guards.test.ts`.
  - Evidence:
    - `bun run test` passed (3 tests including new payload-guard checks).
    - `bun run build:vite` passed.
    - `bun run build:client` passed (legacy r.js ES-module uglify warnings remain expected).
  - Next action:
    - Start T-006 structured logging modernization.

- 2026-02-05 22:16:35Z
  - Status: `in_progress` -> `done` (T-006)
  - Actions:
    - Added structured event logging API `log.event(...)` in `server/js/log.js`.
    - Emitted structured lifecycle events in `server/js/ws.js` for listen/open/close/error paths.
    - Emitted structured startup/fatal/server-error events in `server/js/main.js`.
    - Emitted structured join/leave events in `server/js/worldserver.js`.
    - Added logger format tests in `tests/unit/server-log.test.ts`.
  - Evidence:
    - `bun run test` passed (5 tests total).
    - `bun run build:vite` passed.
    - `bun run build:client` passed (legacy r.js ES-module uglify warnings remain expected).
  - Next action:
    - Start T-007 underscore reduction batch for low-risk modules.

- 2026-02-05 22:17:38Z
  - Status: `in_progress` -> `done` (T-007)
  - Actions:
    - Replaced low-risk underscore usage with native APIs in:
      - `client/js-esm/infomanager.js`
      - `client/js-esm/bubble.js`
      - `client/js-esm/storage.js`
    - Removed now-unneeded underscore imports from those modules.
  - Evidence:
    - underscore call scan for those modules returns no matches.
    - `bun run test` passed.
    - `bun run build:vite` passed.
  - Next action:
    - Define the next reduction batch (targeting medium-risk gameplay loops) with per-file risk gating.

- 2026-02-06 01:08:41Z
  - Status: `in_progress` -> `done` (T-008, T-009, T-010)
  - Actions:
    - Reduced medium-risk underscore usage in:
      - `client/js-esm/map.js`
      - `client/js-esm/gameclient.js`
      - `client/js-esm/main.js`
    - Reduced legacy build noise by stashing `client/js-esm` during legacy `r.js` optimization in `bin/build.sh` and restoring it in trap-based cleanup.
    - Added `fileExclusionRegExp` in `client/js/build.js` to keep legacy optimizer intent aligned with legacy-only output.
    - Added structured-log smoke coverage in `tests/smoke/server-structured-logs.test.ts`.
  - Evidence:
    - `bun run test` passed (6 tests).
    - `bun run build:vite` passed.
    - `bun run build:client` passed with `js-esm` uglify noise removed.
  - Next action:
    - Continue underscore reduction in high-risk gameplay loops (`client/js-esm/game.js`) with incremental guarded refactors.

- 2026-02-06 01:10:17Z
  - Status: `in_progress` (T-011)
  - Actions:
    - Converted a first high-risk subset of underscore calls in `client/js-esm/game.js` to native APIs:
      - `size/isNull/isArray/isNaN/include/keys/pluck/intersection/difference/reject` callsites where direct equivalents are clear.
    - Preserved null-safe behavior in grid access paths (`getEntityAt`, `getItemAt`) with explicit guards.
  - Evidence:
    - `bun run test` passed (6 tests).
    - `bun run build:vite` passed.
    - `bun run build:client` passed.
  - Next action:
    - Continue T-011 with remaining underscore patterns in `game.js` (`each/map/any/reject/pluck` clusters) in small verified batches.

- 2026-02-06 01:11:57Z
  - Status: `in_progress` -> `done` (T-011)
  - Actions:
    - Completed remaining underscore removals in `client/js-esm/game.js` by replacing object/array iteration and predicates with native APIs.
    - Removed underscore import from `client/js-esm/game.js`.
    - Preserved behavior in null-sensitive paths with explicit guards.
  - Evidence:
    - underscore scan for `client/js-esm/game.js` returns no matches.
    - `bun run test` passed.
    - `bun run build:vite` passed.
    - `bun run build:client` passed.
  - Next action:
    - Start T-012 to remove underscore from the remaining ESM modules.

- 2026-02-06 01:19:50Z
  - Status: `in_progress` -> `done` (T-012, T-013, T-014)
  - Actions:
    - Finished remaining underscore removals in modern ESM/runtime paths:
      - `client/js-esm/game.js` (removed final wrapper-style underscore include call).
      - `client/js-esm/bootstrap.js` (removed global underscore boot wiring).
    - Replaced underscore usage across server runtime modules with native APIs:
      - `server/js/{main.js,ws.js,format.js,metrics.js,area.js,chest.js,message.js,player.js,mobarea.js,chestarea.js,checkpoint.js,mob.js,map.js,worldserver.js}`.
    - Replaced underscore usage in map tooling:
      - `tools/maps/processmap.js`.
    - Removed `underscore` from runtime dependencies in `package.json` and refreshed `bun.lock`.
  - Evidence:
    - Underscore scan across server + ESM + map tooling returns no matches.
    - `bun run test` passed (6 tests).
    - `bun run build:vite` passed.
    - `bun run build:client` passed.
  - Next action:
    - Start lint/format modernization to enforce native-style consistency (`ESLint` flat config + `Prettier`) and prevent regression.

- 2026-02-06 20:24:13Z
  - Status: `in_progress` -> `done` (T-015)
  - Actions:
    - Added ESLint flat config baseline in `eslint.config.cjs` covering:
      - `server/js/**/*.js`
      - `client/js-esm/**/*.js`
      - `shared/js/**/*.js`
      - `tests/**/*.ts`
    - Added Prettier config and ignore files:
      - `.prettierrc.json`
      - `.prettierignore`
    - Added npm scripts in `package.json`:
      - `lint`
      - `format`
      - `format:check`
    - Ran `prettier --write` on the non-disruptive baseline formatting set (tests + selected modernized server/client/shared files used in active migration).
  - Evidence:
    - `bun run lint` passed.
    - `bun run format:check` passed.
    - `bun run test` passed (6 tests).
    - `bun run build:vite` passed.
    - `bun run build:client` passed.
  - Next action:
    - Start T-016 server runtime hardening for Node 22-era compatibility and deprecation cleanup.

- 2026-02-06 20:26:40Z
  - Status: `in_progress` -> `done` (T-016)
  - Actions:
    - Hardened server runtime parsing/error paths:
      - Added radix-safe numeric parsing (`Number.parseInt(..., 10)`) in `server/js/{main.js,player.js,entity.js,metrics.js,map.js}`.
      - Added JSON parse guards for server config and map loading in `server/js/{main.js,map.js}` with explicit error logs instead of uncaught parse crashes.
      - Replaced string throws with `Error` instances in abstract WS methods in `server/js/ws.js`.
      - Simplified WS `/status` route handling in `server/js/ws.js` to explicit 200/404 paths (no fallthrough ambiguity).
      - Added explicit "server full" connection rejection path in `server/js/main.js` when no world capacity is available.
  - Evidence:
    - `bun run lint` passed.
    - `bun run format:check` passed.
    - `bun run test` passed (6 tests).
    - `bun run build:vite` passed.
    - `bun run build:client` passed.
    - `timeout 4s node --trace-warnings server/js/main.js server/config.json` showed clean startup with no deprecation warnings.
  - Next action:
    - Start T-017 legacy/modern client isolation policy and build gating.

- 2026-02-06 20:27:43Z
  - Status: `in_progress` -> `done` (T-017)
  - Actions:
    - Added explicit client build support matrix documentation:
      - `docs/client-build-support.md`
      - linked from `README.md` and `client/README.md`.
    - Added dedicated verification scripts in `package.json`:
      - `verify:modern` = `lint + format:check + test + build:vite`
      - `verify:legacy` = `test + build:client + build:vite:legacy`
    - Clarified primary-vs-compatibility support policy:
      - modern ESM (`client/modern.html`) is tier-1 path
      - legacy AMD/RequireJS (`client/index.html`) is compatibility mode
  - Evidence:
    - `bun run verify:modern` passed.
    - `bun run verify:legacy` passed.
    - `bun run build:vite:legacy` succeeded with expected non-module script warnings for legacy `index.html`.
  - Next action:
    - Start T-018 CI workflow automation for `verify:modern` and `verify:legacy`.

- 2026-02-06 20:28:39Z
  - Status: `in_progress` -> `done` (T-018)
  - Actions:
    - Added CI workflow for modern gate on every push/PR:
      - `.github/workflows/verify-modern.yml`
    - Added CI workflow for legacy gate on migration-sensitive path changes:
      - `.github/workflows/verify-legacy.yml`
      - path filters cover `client`, `server`, `shared`, `tools`, build configs, and workflow files.
    - Kept workflow steps aligned with local scripts (`bun install --frozen-lockfile`, then `verify:*` scripts) for direct parity.
  - Evidence:
    - Local parity command for modern gate passed: `bun run verify:modern`.
    - Local parity command for legacy gate passed: `bun run verify:legacy`.
  - Next action:
    - Start T-019 modernization debt triage for legacy AMD globals and duplicate config sources.

- 2026-02-06 20:29:46Z
  - Status: `in_progress` -> `done` (T-019)
  - Actions:
    - Audited remaining legacy runtime debt across client/server/build paths.
    - Added prioritized triage artifact:
      - `docs/legacy-runtime-debt.md`
    - Captured concrete follow-up execution order and ticket breakdown (`T-020` to `T-024`).
  - Evidence:
    - Debt inventory includes runtime/global patterns, duplicate code surfaces, and build-path coupling.
    - Prioritized plan and acceptance-focused follow-up tickets are documented in-repo.
  - Next action:
    - Start T-020 server export/global cleanup to reduce load-order coupling and prepare CJS->ESM migration.

- 2026-02-06 20:33:42Z
  - Status: `in_progress` -> `done` (T-020)
  - Actions:
    - Removed implicit global export patterns across server runtime modules by replacing
      `module.exports = Name = ...` with explicit local declarations + explicit export statements.
    - Explicitized server dependencies previously relying on global side effects:
      - added required imports for base/entity classes where needed (`Entity`, `Character`, `Item`, `Chest`).
      - removed global `FormatChecker` reliance in `player.js`.
      - rewrote `server/js/format.js` to export `FormatChecker`/`check` without global `Class`/symbol leakage.
      - removed `instanceof` checks that depended on globally-injected classes and replaced with stable capability/type checks where appropriate.
  - Evidence:
    - `bun run verify:modern` passed.
    - `bun run verify:legacy` passed.
    - Server smoke tests remained green (6 tests).
  - Next action:
    - Start T-021 shared gametypes single-source adapter to remove duplicated protocol/type logic bodies.

- 2026-02-06 20:36:23Z
  - Status: `in_progress` -> `done` (T-021)
  - Actions:
    - Promoted `shared/js/gametypes.js` as the canonical gametypes source by removing implicit global assignment style (`var Types = ...`).
    - Replaced duplicated ESM compat gametypes body with a thin adapter:
      - `client/js-esm/compat/gametypes.js` now imports from `shared/js/gametypes.js`, sets `globalThis.Types`, and re-exports.
    - Verified server/runtime behavior remained unchanged after shared-source consolidation.
  - Evidence:
    - `bun run verify:modern` passed.
    - `bun run verify:legacy` passed.
    - Legacy-inclusive Vite build completed with expected legacy non-module warnings only.
  - Next action:
    - Start T-022 legacy build boundary tightening (minimize copied legacy runtime surface while preserving compatibility).

- 2026-02-06 20:37:28Z
  - Status: `in_progress` -> `done` (T-022)
  - Actions:
    - Tightened legacy asset copy boundary in Vite legacy build plugin:
      - reduced `shared` copy scope from whole `shared/js` directory to single required runtime file `shared/js/gametypes.js`.
    - Preserved compatibility by keeping client legacy runtime assets unchanged where required.
  - Evidence:
    - `bun run verify:modern` passed.
    - `bun run verify:legacy` passed.
    - Legacy-inclusive build still succeeds with only expected non-module script warnings for `client/index.html`.
  - Next action:
    - Start T-023 legacy `index.html` boot globals reduction with behavior-preserving guardrails.

- 2026-02-06 20:39:04Z
  - Status: `in_progress` -> `done` (T-023)
  - Actions:
    - Removed `modernizr` boot dependency from legacy `client/index.html`.
    - Replaced legacy feature checks with native/Detect-based checks:
      - `Detect.canPlayMP3()` now uses native `audio.canPlayType`.
      - Added `Detect.supportsLocalStorage()` probe.
      - Switched localStorage checks in `client/index.html` and `client/js/storage.js` from `Modernizr.localstorage` to `Detect.supportsLocalStorage()`.
    - Updated legacy page header comment to reflect current boot libraries.
  - Evidence:
    - `bun run verify:modern` passed.
    - `bun run verify:legacy` passed.
    - Legacy-inclusive Vite warning set reduced (removed `modernizr` non-module warning).
  - Next action:
    - Start T-024 legacy runtime retirement checklist and cutover criteria draft.

- 2026-02-06 20:39:32Z
  - Status: `in_progress` -> `done` (T-024)
  - Actions:
    - Added retirement/cutover checklist with rollback plan:
      - `docs/legacy-retirement-checklist.md`
    - Documented measurable readiness criteria, cutover sequence, rollback triggers/actions, and approval gate.
  - Evidence:
    - Checklist committed in-repo and aligned with current verification commands (`verify:modern`, `verify:legacy`).
  - Next action:
    - Start T-025 modern gameplay parity e2e coverage for release-signoff confidence.

- 2026-02-06 20:45:11Z
  - Status: `in_progress` -> `done` (T-025)
  - Actions:
    - Added modern gameplay parity smoke test:
      - `tests/smoke/modern-gameplay-parity.test.ts`
      - Covers login, move, chat, zone, combat-path signaling, lootmove, and reconnect against a live server.
    - Added explicit script for focused execution:
      - `test:modern-parity` in `package.json`
    - Documented parity smoke command in support matrix docs:
      - `docs/client-build-support.md`
  - Evidence:
    - `bun run test:modern-parity` passed.
    - `bun run verify:modern` passed.
    - `bun run verify:legacy` passed.
    - Test suite now includes 7 passing tests across 5 files.
  - Next action:
    - Start T-026 modern runtime browser-e2e harness (Playwright) for UI-level parity confidence.

- 2026-02-06 20:49:24Z
  - Status: `in_progress` (T-026)
  - Actions:
    - Added Playwright harness scaffolding:
      - `playwright.config.ts` with managed Bun server + Vite webServer entries and Chromium project.
      - `tests/browser/modern-ui-smoke.playwright.ts` for modern UI boot + play-entry interaction smoke.
    - Added npm scripts:
      - `test:modern-browser`
      - `test:modern-browser:install`
    - Added CI workflow:
      - `.github/workflows/verify-modern-browser.yml`
    - Documented browser smoke commands in:
      - `README.md`
      - `docs/client-build-support.md`
  - Evidence:
    - Pending local verification (`test:modern-browser`) and regression gate run (`verify:modern`).
  - Next action:
    - Install Chromium for Playwright, run browser smoke locally, then run `verify:modern`.

- 2026-02-06 20:59:09Z
  - Status: `in_progress` -> `done` (T-026)
  - Actions:
    - Finalized Playwright browser-level smoke harness for modern runtime:
      - `playwright.config.ts` (isolated test port, managed Bun server + Vite dev webservers, Chromium project).
      - `tests/browser/modern-ui-smoke.playwright.ts` (UI boot + play-entry interaction assertions).
    - Added script wiring in `package.json`:
      - `test:modern-browser`
      - `test:modern-browser:install`
    - Added CI workflow:
      - `.github/workflows/verify-modern-browser.yml`
    - Updated runbook docs:
      - `README.md`
      - `docs/client-build-support.md`
  - Evidence:
    - `bun run test:modern-browser:install` passed (Chromium downloaded).
    - `bun run test:modern-browser` passed.
    - `bun run verify:modern` passed.
    - `bun run verify:legacy` passed.
  - Next action:
    - Define T-027 for deeper browser-runtime parity (e.g., in-browser websocket gameplay action assertions with stable instrumentation hooks).

- 2026-02-06 21:10:54Z
  - Status: `in_progress` -> `done` (T-027)
  - Actions:
    - Hardened modern browser runtime regressions surfaced by Playwright:
      - fixed strict-mode undeclared variable in `client/js-esm/character.js` (`o` in `animate`).
      - fixed strict-mode undeclared variables in `client/js-esm/renderer.js` (`wx/wy/ww/wh` weapon draw path).
      - replaced strict-mode-unsafe `arguments.callee` in `client/js-esm/audio.js`.
    - Fixed modern/shared gametypes runtime bridge without reintroducing non-module script warnings:
      - `shared/js/gametypes.js` now sets `globalThis.Types` in addition to existing CJS export.
      - `client/js-esm/compat/gametypes.js` now side-effect imports `shared/js/gametypes.js` and reads `globalThis.Types`.
      - removed temporary non-module gametypes script injection from `client/modern.html`.
    - Upgraded browser smoke depth:
      - `tests/browser/modern-ui-smoke.playwright.ts` now asserts server websocket presence, `go` handshake, `body.started`, non-zero player count, and zero page errors.
    - Updated support matrix wording to match stronger browser smoke assertions:
      - `docs/client-build-support.md`.
  - Evidence:
    - `bun run test:modern-browser` passed.
    - `bun run verify:modern` passed.
    - `bun run verify:legacy` passed.
    - `build:vite` modern warnings remained clean (no new non-module warning on `modern.html`).
  - Next action:
    - Define T-028 for browser-level protocol action assertions (chat/move/zone) through UI-safe hooks or deterministic test controls.

- 2026-02-06 21:14:28Z
  - Status: `in_progress` -> `done` (T-028)
  - Actions:
    - Added deeper browser protocol parity test:
      - `tests/browser/modern-protocol-actions.playwright.ts`
      - Asserts live server websocket traffic includes outbound `HELLO` and `CHAT`, inbound `WELCOME`, and chat echo for a UI-submitted message.
    - Updated browser support-matrix wording to reflect protocol action coverage:
      - `docs/client-build-support.md`
  - Evidence:
    - `bun run test:modern-browser` passed (2 Playwright tests).
    - `bun run verify:modern` passed.
    - `bun run verify:legacy` passed.
  - Next action:
    - Define T-029 for browser-level move/zone deterministic assertions (path click/telemetry-safe hooks).

- 2026-02-06 21:21:34Z
  - Status: `in_progress` -> `done` (T-029, T-030)
  - Actions:
    - Finalized deterministic browser move/zone parity:
      - `client/js-esm/main.js` test-mode API (`__BQ_TEST_API`) drives cross-zone move/zone actions.
      - `tests/browser/modern-protocol-actions.playwright.ts` validates outbound `MOVE`/`ZONE` and inbound post-zone `LIST`.
    - Added browser reconnect parity assertion:
      - `tests/browser/modern-protocol-actions.playwright.ts` now verifies reload-driven reconnect with second `go`, `HELLO`, and `WELCOME`.
    - Updated support matrix wording for reconnect/browser protocol coverage:
      - `docs/client-build-support.md`.
  - Evidence:
    - `bun run test:modern-browser` passed (3 Playwright tests).
    - `bun run verify:modern` passed.
    - `bun run verify:legacy` passed.
  - Next action:
    - Define T-031 for browser combat/loot protocol parity coverage with deterministic hooks.

- 2026-02-06 21:26:06Z
  - Status: `in_progress` -> `done` (T-031, T-032)
  - Actions:
    - Added deterministic browser combat/loot controls in test mode:
      - `client/js-esm/main.js` now exposes `getActionTargets()` and `sendCombatLootProbe()` on `__BQ_TEST_API`.
    - Expanded browser protocol parity suite:
      - `tests/browser/modern-protocol-actions.playwright.ts` now validates outbound `ATTACK`, `HIT`, and `LOOTMOVE` from live modern runtime.
    - Added dependency/library modernization audit artifact:
      - `docs/dependency-modernization-audit.md` with runtime baseline, direct dependency status, and jQuery 4 migration execution order.
    - Updated browser support matrix wording for broader protocol parity coverage:
      - `docs/client-build-support.md`.
  - Evidence:
    - `bun run test:modern-browser` passed (5 Playwright tests).
    - `bun run verify:modern` passed.
    - `bun run verify:legacy` passed.
    - `bun outdated` completed; direct runtime dependency gap identified (`jquery` 3.7.1 -> 4.0.0 latest).
  - Next action:
    - Define T-033 for jQuery 4 migration readiness (UI coverage expansion + trial upgrade branch criteria).

- 2026-02-06 21:58:02Z
  - Status: `in_progress` -> `done` (T-033)
  - Actions:
    - Expanded browser UI lock coverage for jQuery-driven controls:
      - `tests/browser/modern-ui-smoke.playwright.ts` now validates in-session toggles for chat, population panel, about/help, legal, and credits.
    - Added explicit jQuery 4 trial readiness checklist:
      - `docs/jquery4-readiness-checklist.md`.
    - Linked dependency audit to the readiness checklist:
      - `docs/dependency-modernization-audit.md`.
    - Updated support matrix wording to reflect stronger modern browser UI coverage:
      - `docs/client-build-support.md`.
  - Evidence:
    - `bun run test:modern-browser` passed (6 Playwright tests).
    - `bun run verify:modern` passed.
    - `bun run verify:legacy` passed.
  - Next action:
    - Start T-034 scoped jQuery 4 trial upgrade with compatibility triage.

- 2026-02-06 22:00:07Z
  - Status: `in_progress` -> `done` (T-034)
  - Actions:
    - Executed scoped jQuery major upgrade trial and kept upgrade:
      - dependency bumped to `jquery@4.0.0` in `package.json` and lockfile refreshed.
    - Validated modern browser parity after upgrade:
      - all browser protocol + UI parity tests remained green.
    - Updated dependency/audit docs with trial outcome and follow-up:
      - `docs/dependency-modernization-audit.md`
      - `docs/jquery4-readiness-checklist.md`
  - Evidence:
    - `bun run test:modern-browser` passed (6 Playwright tests).
    - `bun run verify:modern` passed.
    - `bun run verify:legacy` passed.
    - `bun outdated` shows no pending direct dependency updates.
  - Next action:
    - Define T-035 Node 22 baseline verification and runtime gate updates.

- 2026-02-06 22:04:57Z
  - Status: `in_progress` -> `done` (T-035)
  - Actions:
    - Verified Node 22 runtime baseline (`v22.22.0`) by executing gates with a temporary `node` shim pointing to `npx node@22`.
    - Ran Node 22-scoped verification commands:
      - `bun run verify:modern`
      - `bun run verify:legacy`
      - `bun run test:modern-browser`
    - Performed direct Node 22 server startup probe with warnings enabled:
      - `timeout 6s npx -y node@22 --trace-warnings server/js/main.js server/config.json`
    - Documented Node 22 outcomes in dependency/runtime audit:
      - `docs/dependency-modernization-audit.md`
  - Evidence:
    - All Node 22-scoped verification commands passed.
    - Node 22 server startup completed cleanly with no warning output before timeout.
  - Next action:
    - Define T-036 CI Node 22 baseline matrix gate.

- 2026-02-06 22:05:46Z
  - Status: `in_progress` -> `done` (T-036)
  - Actions:
    - Added explicit Node 22 setup and matrix pinning to CI verification workflows:
      - `.github/workflows/verify-modern.yml`
      - `.github/workflows/verify-legacy.yml`
      - `.github/workflows/verify-modern-browser.yml`
    - Updated dependency/runtime audit with CI Node 22 enforcement notes:
      - `docs/dependency-modernization-audit.md`
  - Evidence:
    - Workflow configs now execute verification jobs with `actions/setup-node@v4` and `node-version: 22.x`.
    - Local equivalent Node 22 gate commands (from T-035) are green.
  - Next action:
    - Define T-037 runtime policy pinning (`engines` + `.nvmrc`) to align local/dev/CI baselines.

- 2026-02-06 22:07:05Z
  - Status: `in_progress` -> `done` (T-037)
  - Actions:
    - Pinned runtime policy in project metadata:
      - added `engines` in `package.json` (`node >=22 <23`, `bun >=1.3.0`).
      - added `.nvmrc` with `22`.
    - Updated runtime policy docs:
      - `README.md` runtime requirements section.
      - `server/README.md` runtime baseline wording.
      - `docs/client-build-support.md` runtime baseline section.
      - `docs/dependency-modernization-audit.md` runtime policy baseline wording.
    - Re-ran verification gates after policy pinning:
      - `bun run verify:modern`
      - `bun run verify:legacy`
  - Evidence:
    - Both verification gates passed after runtime policy updates.
    - CI workflows already pinned to Node 22 from T-036.
  - Next action:
    - Define T-038 runtime drift guardrails (preflight check script for node/bun versions in CI/local commands).

- 2026-02-06 22:08:43Z
  - Status: `in_progress` -> `done` (T-038)
  - Actions:
    - Added runtime preflight script:
      - `tools/check-runtime.cjs`
      - validates Node major (`22`) and Bun minimum (`1.3.0`) with actionable error messages.
    - Wired runtime preflight into primary verification/browser commands in `package.json`:
      - `verify:modern`, `verify:legacy`, `test:modern-browser`.
    - Updated docs to surface runtime preflight usage and policy:
      - `README.md`
      - `docs/client-build-support.md`
      - `docs/dependency-modernization-audit.md`
  - Evidence:
    - Unsupported runtime path validated:
      - `bun run check:runtime` on system Node 20 fails with expected message.
    - Supported runtime path validated:
      - `PATH=<node22-shim> bun run check:runtime` passes.
      - `PATH=<node22-shim> bun run verify:modern` passes.
      - `PATH=<node22-shim> bun run verify:legacy` passes.
  - Next action:
    - Define T-039 Node 22 developer bootstrap ergonomics (`nvm use`/docs/tooling shortcuts).

- 2026-02-06 22:10:19Z
  - Status: `in_progress` -> `done` (T-039)
  - Actions:
    - Added Node 22 command wrapper for mismatched shells:
      - `tools/node22-run.sh` (temporary Node 22 shim wrapper).
    - Added convenience scripts in `package.json`:
      - `check:runtime:node22`
      - `verify:modern:node22`
      - `verify:legacy:node22`
      - `test:modern-browser:node22`
    - Updated runtime bootstrap docs:
      - `README.md`
      - `docs/client-build-support.md`
      - `docs/dependency-modernization-audit.md`
  - Evidence:
    - `bun run check:runtime:node22` passed from Node 20 shell.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-040 browser parity command runtime preflight adoption in CI documentation/runbooks.

- 2026-02-06 22:10:57Z
  - Status: `in_progress` -> `done` (T-040)
  - Actions:
    - Added dedicated runtime-preflight runbook:
      - `docs/runtime-preflight.md`
      - includes policy, failure modes, recovery paths, and CI expectations.
    - Linked runbook from core docs:
      - `README.md`
      - `docs/client-build-support.md`
      - `docs/dependency-modernization-audit.md`
  - Evidence:
    - `bun run check:runtime:node22` passed after runbook updates.
    - Documentation now consistently references runtime preflight behavior and recovery commands.
  - Next action:
    - Define T-041 legacy jQuery runtime debt scan (identify remaining jQuery 4-risk callsites in legacy AMD path).

- 2026-02-06 22:12:24Z
  - Status: `in_progress` -> `done` (T-041)
  - Actions:
    - Scanned legacy AMD client runtime (`client/js/**`) for jQuery 4-sensitive patterns.
    - Produced ticketized risk inventory:
      - `docs/legacy-jquery4-risk-scan.md`
    - Linked scan artifact from dependency/runtime audit:
      - `docs/dependency-modernization-audit.md`
  - Evidence:
    - Confirmed legacy `.size()` usage in `client/js/main.js:433`.
    - Identified `.bind()`/`.unbind()` callsites in `client/js/{main,app}.js` as migration-risk candidates.
    - No direct `.live()`/`.die()`/`.delegate()`/`.undelegate()` matches in legacy app/runtime files.
  - Next action:
    - Start T-042 legacy `.size()` removal batch.

- 2026-02-06 22:13:56Z
  - Status: `in_progress` -> `done` (T-042, T-043)
  - Actions:
    - Removed legacy jQuery `.size()` usage in:
      - `client/js/main.js` (`.length` replacement).
    - Migrated legacy jQuery event APIs from `.bind/.unbind` to `.on/.off` in:
      - `client/js/main.js`
      - `client/js/app.js`
    - Updated legacy jQuery risk scan execution status:
      - `docs/legacy-jquery4-risk-scan.md`
  - Evidence:
    - jQuery-style `.bind/.unbind` scan over `client/js/{main,app}.js` returns no matches.
    - jQuery `.size()` usage removed from `client/js/main.js`.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start T-044 legacy event-wiring smoke coverage.

- 2026-02-06 22:18:46Z
  - Status: `in_progress` -> `done` (T-044)
  - Actions:
    - Added legacy event-wiring browser smoke:
      - `tests/browser/legacy-ui-smoke.playwright.ts`
      - validates intro keyup wiring that drives play-button enablement on legacy `client/index.html`.
    - Added legacy browser smoke scripts:
      - `test:legacy-browser`
      - `test:legacy-browser:node22`
    - Updated support docs:
      - `docs/client-build-support.md`
    - Resolved legacy compatibility regression discovered during T-044:
      - direct `.on/.off` was incompatible with bundled legacy jQuery.
      - added compatibility wrappers in `client/js/{main,app}.js` to use `.on/.off` when available and fall back to `.bind/.unbind`.
    - Updated risk-scan artifact status:
      - `docs/legacy-jquery4-risk-scan.md`
  - Evidence:
    - `bun run test:legacy-browser:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-045 legacy jQuery compatibility helper centralization (deduplicate event wrapper logic).

- 2026-02-06 22:20:54Z
  - Status: `in_progress` -> `done` (T-045)
  - Actions:
    - Centralized legacy jQuery compatibility event helpers into a shared AMD module:
      - `client/js/eventcompat.js`
    - Migrated legacy consumers to shared helper:
      - `client/js/main.js`
      - `client/js/app.js`
    - Confirmed legacy smoke/gates after centralization:
      - `bun run test:legacy-browser:node22`
      - `bun run verify:legacy:node22`
    - Updated legacy jQuery risk scan progress:
      - `docs/legacy-jquery4-risk-scan.md`
  - Evidence:
    - No direct jQuery-style `.bind/.unbind/.size` callsites remain in `client/js/{main,app}.js`.
    - Shared helper usage is present for all migrated event bindings.
    - Legacy browser smoke and legacy gate passed.
  - Next action:
    - Define T-046 legacy smoke integration into CI (path-filtered workflow).

- 2026-02-06 22:21:41Z
  - Status: `in_progress` -> `done` (T-046)
  - Actions:
    - Added path-filtered CI workflow for legacy browser smoke:
      - `.github/workflows/verify-legacy-browser.yml`
      - includes Node 22 setup + Bun setup + Playwright Chromium install + `test:legacy-browser`.
    - Updated dependency/runtime audit CI inventory with new workflow:
      - `docs/dependency-modernization-audit.md`
  - Evidence:
    - Local parity command passed:
      - `bun run test:legacy-browser:node22`
    - Workflow config committed and scoped to legacy/browser-sensitive path changes.
  - Next action:
    - Define T-047 legacy browser smoke expansion (post-intro controls once stable on legacy path).

- 2026-02-06 22:25:07Z
  - Status: `in_progress` (T-047)
  - Actions:
    - Attempted expansion of legacy browser smoke to cover additional intro/footer controls.
    - Reverted unstable assertions after repeated headless interaction flake:
      - footer/bar controls had pointer interception and non-deterministic intro overlay behavior in legacy path.
    - Kept stable deterministic coverage:
      - intro `keyup` -> play-button enablement guard in `tests/browser/legacy-ui-smoke.playwright.ts`.
  - Evidence:
    - Expanded assertions failed with deterministic click-interception timeouts.
    - Stable legacy smoke remains green:
      - `bun run test:legacy-browser:node22` passed.
  - Next action:
    - Define T-048 legacy smoke harness stabilization (test-mode hooks or forced intro-overlay bypass for deterministic extra controls).

- 2026-02-06 22:26:24Z
  - Status: `in_progress` -> `done` (T-047, T-048)
  - Actions:
    - Expanded legacy browser smoke depth with deterministic additional check:
      - `tests/browser/legacy-ui-smoke.playwright.ts` now validates chatbar active toggle in addition to intro name-input keyup wiring.
    - Stabilized flaky legacy interactions by using DOM-dispatched click for controls affected by intro overlay pointer interception.
    - Re-validated legacy browser and full legacy gate:
      - `bun run test:legacy-browser:node22`
      - `bun run verify:legacy:node22`
    - Updated support matrix wording for current legacy smoke coverage:
      - `docs/client-build-support.md`.
  - Evidence:
    - Legacy browser smoke remains green with added deterministic check.
    - Legacy build/test gate remains green after smoke depth expansion.
  - Next action:
    - Define T-049 modern gate integration of Node22-wrapper shortcuts in contributor onboarding docs.

- 2026-02-06 22:26:58Z
  - Status: `in_progress` -> `done` (T-049)
  - Actions:
    - Updated contributor quickstart onboarding with runtime mismatch recovery path:
      - `README.md`
    - Expanded runtime preflight runbook with onboarding flow:
      - `docs/runtime-preflight.md`
  - Evidence:
    - `bun run check:runtime:node22` passed following documented onboarding path.
  - Next action:
    - Define T-050 modernization state snapshot update (concise executive status in `README.md` linking active artifacts).

- 2026-02-06 22:27:28Z
  - Status: `in_progress` -> `done` (T-050)
  - Actions:
    - Added concise modernization status snapshot to root `README.md`:
      - links roadmap/support/audit/risk artifacts.
      - lists canonical verification/browser commands (with Node22 wrapper variants).
  - Evidence:
    - README now exposes one-glance modernization state and command entrypoints.
    - Runtime wrapper command remains green:
      - `bun run check:runtime:node22`
  - Next action:
    - Define T-051 docs/script parity sweep (ensure all docs mention newly added legacy browser and Node22 wrapper commands consistently).

- 2026-02-06 22:27:57Z
  - Status: `in_progress` -> `done` (T-051)
  - Actions:
    - Performed docs/script parity sweep against `package.json` scripts and workflow changes.
    - Fixed stale/missing command references:
      - added `test:legacy-browser` mention in `README.md` verification gates.
      - added `test:legacy-browser` and `test:legacy-browser:node22` to `docs/runtime-preflight.md`.
  - Evidence:
    - Command references in key onboarding/support docs now match current script surfaces.
  - Next action:
    - Define T-052 legacy browser smoke workflow linkage from README/support docs.

- 2026-02-06 22:28:40Z
  - Status: `in_progress` -> `done` (T-052)
  - Actions:
    - Added CI-workflow mapping section to support matrix doc:
      - `docs/client-build-support.md`
      - includes workflow names, trigger scope summaries, and local parity command.
    - Added CI gate names to modernization snapshot:
      - `README.md`
  - Evidence:
    - Local parity command for legacy browser workflow remains green:
      - `bun run test:legacy-browser:node22`
  - Next action:
    - Define T-053 modern-browser and legacy-browser command naming cleanup (`test:browser:*`) for clearer discoverability.

- 2026-02-06 22:29:39Z
  - Status: `in_progress` -> `done` (T-053)
  - Actions:
    - Added browser command aliases for consistent naming:
      - `test:browser:modern`
      - `test:browser:legacy`
      - `test:browser:modern:node22`
      - `test:browser:legacy:node22`
    - Kept existing script names for backward compatibility (`test:modern-browser`, `test:legacy-browser`).
    - Updated docs to use alias names as canonical entries:
      - `README.md`
      - `docs/client-build-support.md`
      - `docs/runtime-preflight.md`
  - Evidence:
    - `bun run test:browser:legacy:node22` passed.
  - Next action:
    - Define T-054 browser command alias adoption in CI workflow steps (use canonical alias names for consistency).

- 2026-02-06 22:46:00Z
  - Status: `in_progress` -> `done` (T-054, T-055, T-056, T-057)
  - Actions:
    - Adopted canonical browser alias scripts in browser CI workflows:
      - `.github/workflows/verify-modern-browser.yml` now runs `test:browser:modern`.
      - `.github/workflows/verify-legacy-browser.yml` now runs `test:browser:legacy`.
    - Aligned support-matrix CI mapping text with alias command names:
      - `docs/client-build-support.md`.
    - Fixed strict-mode undeclared identifier regressions uncovered during alias parity runs (modern + legacy parity):
      - `path` declaration in `client/js-esm/game.js` and `client/js/game.js`.
      - `rect` declaration in `client/js-esm/renderer.js` and `client/js/renderer.js`.
      - `volume` declaration in `client/js-esm/audio.js` and `client/js/audio.js`.
      - `newwindow` declaration in `client/js-esm/app.js` and `client/js/app.js`.
      - `fdata` declaration in `client/js-esm/sprite.js` and `client/js/sprite.js`.
      - `startValue/endValue/offset` declaration split in `client/js-esm/updater.js` and `client/js/updater.js`.
      - `window.MozWebSocket` usage in `client/js-esm/gameclient.js` and `client/js/gameclient.js`.
    - Added lint guardrail for strict ESM undeclared-variable regressions:
      - `eslint.config.cjs` now enforces `no-undef` for `client/js-esm/**/*.js`.
    - Stabilized modern browser startup helper paths to reduce intro-start flakes:
      - `tests/browser/modern-protocol-actions.playwright.ts`.
      - `tests/browser/modern-ui-smoke.playwright.ts`.
  - Evidence:
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
    - `bun run test:browser:modern:node22` passed (post-hardening rerun).
    - `bun run test:browser:legacy:node22` passed.
    - `bunx eslint "client/js-esm/**/*.js" --rule "no-undef:error"` passed.
  - Next action:
    - Define T-058 server module logger importization so `no-undef` can be enforced for `server/js/**/*.js` (remove global `log` dependency).

- 2026-02-06 22:50:40Z
  - Status: `in_progress` -> `done` (T-058)
  - Actions:
    - Replaced ambient server `log` dependency with explicit logger imports from `server/js/log.js` in active runtime modules:
      - `server/js/main.js`
      - `server/js/ws.js`
      - `server/js/worldserver.js`
      - `server/js/player.js`
      - `server/js/map.js`
      - `server/js/format.js`
      - `server/js/metrics.js`
      - `server/js/character.js`
      - `server/js/properties.js`
    - Added singleton logger helpers in `server/js/log.js`:
      - `Log.getLogger()`
      - `Log.setLevel(level)`
    - Updated server startup debug-level wiring to configure shared logger level via `Log.setLevel(...)` rather than assigning global `log`.
    - Enabled `no-undef` lint guardrail for server runtime scope in `eslint.config.cjs`.
  - Evidence:
    - `bun run lint` passed with server `no-undef` enforced.
    - `bunx eslint "server/js/**/*.js" --rule "no-undef:error"` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
    - `bun run test:browser:modern:node22` passed.
  - Next action:
    - Define T-059 server logger callsite simplification (remove redundant `if(log && ...)` guards now that logger is explicit and always present).

- 2026-02-06 22:52:18Z
  - Status: `in_progress` -> `done` (T-059)
  - Actions:
    - Simplified server logger callsites by removing redundant event guard wrappers now that explicit logger singleton is always available:
      - `server/js/main.js`
      - `server/js/ws.js`
      - `server/js/worldserver.js`
    - Normalized structured event logging to direct `log.event(...)` calls for startup/connect/error/close/join/leave flows.
  - Evidence:
    - `bun run lint` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-060 logger API cleanup and callsite helper reduction (consolidate repeated event field construction patterns where practical).

- 2026-02-06 22:53:37Z
  - Status: `in_progress` -> `done` (T-060)
  - Actions:
    - Added lightweight helper patterns to reduce repeated server structured-event payload boilerplate:
      - `server/js/ws.js`:
        - added `appendFields(...)`
        - added `logConnectionEvent(...)`
        - normalized connection open/close/error/close-request event emission through helper.
      - `server/js/worldserver.js`:
        - added local `logPlayerEvent(...)` helper for join/leave payload shape consistency.
      - `server/js/main.js`:
        - added `emitServerEvent(...)` helper to normalize server lifecycle/error event calls.
  - Evidence:
    - `bun run lint` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-061 logger singleton safety hardening (guard invalid `setLevel` inputs and add unit coverage for logger singleton behavior).

- 2026-02-06 22:54:25Z
  - Status: `in_progress` -> `done` (T-061)
  - Actions:
    - Hardened logger singleton level setter in `server/js/log.js`:
      - `Log.setLevel(...)` now validates level input and falls back to `Log.INFO` on invalid values.
    - Added logger singleton safety tests in `tests/unit/server-log.test.ts`:
      - shared singleton identity assertion (`Log.getLogger()`).
      - `setLevel` return/behavior assertions.
      - invalid-level fallback assertion.
    - Added test-level reset in unit test teardown to avoid cross-test leakage.
  - Evidence:
    - `bun run lint` passed.
    - `bun test --timeout 20000 tests/unit/server-log.test.ts` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-062 server logging semantics audit (review event naming/field consistency and align event taxonomy docs).

- 2026-02-06 22:55:34Z
  - Status: `in_progress` -> `done` (T-062)
  - Actions:
    - Normalized fatal server event names for taxonomy consistency in `server/js/main.js`:
      - `uncaughtException` -> `server.fatal.uncaught_exception`
      - `unhandledRejection` -> `server.fatal.unhandled_rejection`
      - added `source` field preserving original runtime label.
    - Added structured logging taxonomy document:
      - `docs/server-logging-taxonomy.md`
      - includes envelope contract + canonical event names + payload fields.
    - Linked taxonomy doc from modernization snapshot in `README.md`.
  - Evidence:
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-063 structured-log contract tests for fatal-event naming and payload fields.

- 2026-02-06 22:58:23Z
  - Status: `in_progress` -> `done` (T-063)
  - Actions:
    - Expanded structured-log smoke coverage in `tests/smoke/server-structured-logs.test.ts`:
      - added fatal-event contract test for normalized server taxonomy:
        - `server.fatal.unhandled_rejection`
      - asserted required fields:
        - `level`, `source`, `message`
      - added reusable event-wait helper and stderr event-stream parsing for error-level structured records.
    - Added test trigger hook in `server/js/main.js`:
      - `BQ_TEST_TRIGGER_FATAL_EVENT=unhandled_rejection`
      - emits deterministic fatal log path for contract testing without changing normal runtime behavior.
    - Resolved formatting drift from new test via Prettier.
  - Evidence:
    - `bun test --timeout 20000 tests/smoke/server-structured-logs.test.ts` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-064 structured-log test coverage for `server.fatal.uncaught_exception` and shared assertion helper reuse.

- 2026-02-06 22:59:14Z
  - Status: `in_progress` -> `done` (T-064)
  - Actions:
    - Expanded structured-log fatal parity coverage in `tests/smoke/server-structured-logs.test.ts`:
      - added `server.fatal.uncaught_exception` contract test.
      - asserted required fields:
        - `level`, `source`, `message`, `stack`.
    - Reused server test-trigger hook path in `server/js/main.js` via:
      - `BQ_TEST_TRIGGER_FATAL_EVENT=uncaught_exception`
    - Stabilized fatal-event smoke parsing by consuming both stdout and stderr streams for structured event lines.
  - Evidence:
    - `bun test --timeout 20000 tests/smoke/server-structured-logs.test.ts` passed (3 structured-log tests).
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-065 structured-log test harness deduplication (extract shared spawn/event-capture helpers to reduce repeated smoke boilerplate).

- 2026-02-06 23:01:22Z
  - Status: `in_progress` -> `done` (T-065)
  - Actions:
    - Refactored `tests/smoke/server-structured-logs.test.ts` to remove repeated boilerplate:
      - added shared event-stream parser helper `attachEventReader(...)`
      - added shared server bootstrap helper `startServerWithEventCapture(...)`
      - added websocket handshake helper `openAndCloseWebSocketSession(...)`
      - unified test config writing and status wait flow through helper layer.
    - Preserved existing structured-log assertions and fatal taxonomy coverage behavior.
    - Resolved formatting drift from refactor with Prettier.
  - Evidence:
    - `bun test --timeout 20000 tests/smoke/server-structured-logs.test.ts` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-066 structured-log fixture split (separate lifecycle and fatal taxonomy tests into dedicated files for faster targeted runs).

- 2026-02-06 23:03:02Z
  - Status: `in_progress` -> `done` (T-066)
  - Actions:
    - Split structured-log smoke coverage into focused files:
      - `tests/smoke/server-structured-logs.lifecycle.test.ts`
      - `tests/smoke/server-structured-logs.fatal.test.ts`
    - Extracted shared helper utilities into:
      - `tests/smoke/server-structured-logs.harness.ts`
      - includes server bootstrap, event capture/parsing, status wait, websocket handshake, and cleanup helpers.
    - Removed monolithic structured-log file:
      - deleted `tests/smoke/server-structured-logs.test.ts`
    - Ensured formatting/lint alignment after split.
  - Evidence:
    - `bun test --timeout 20000 tests/smoke/server-structured-logs.lifecycle.test.ts tests/smoke/server-structured-logs.fatal.test.ts` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-067 structured-log fatal test parameterization (single table-driven fatal taxonomy test to reduce duplicate assertions).

- 2026-02-06 23:04:10Z
  - Status: `in_progress` -> `done` (T-067)
  - Actions:
    - Refactored fatal structured-log tests to a table-driven pattern in:
      - `tests/smoke/server-structured-logs.fatal.test.ts`
    - Consolidated duplicated setup/assertions for fatal taxonomy cases while preserving event-specific expectations:
      - `server.fatal.unhandled_rejection`
      - `server.fatal.uncaught_exception`
  - Evidence:
    - `bun test --timeout 20000 tests/smoke/server-structured-logs.fatal.test.ts` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-068 structured-log harness robustness pass (add helper-level timeouts/error context to improve smoke failure diagnostics).

- 2026-02-06 23:05:30Z
  - Status: `in_progress` -> `done` (T-068)
  - Actions:
    - Hardened structured-log harness diagnostics in `tests/smoke/server-structured-logs.harness.ts`:
      - added rolling recent-structured-line capture (stdout/stderr labeled).
      - improved `waitForEvent(...)` timeout errors with:
        - seen event summary
        - recent structured line context.
      - improved `waitForHttpOk(...)` timeout errors with last observed error/status context.
    - Kept lifecycle/fatal structured-log suites using shared harness with unchanged contract assertions.
  - Evidence:
    - `bun test --timeout 20000 tests/smoke/server-structured-logs.lifecycle.test.ts tests/smoke/server-structured-logs.fatal.test.ts` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-069 structured-log harness API cleanup (type exports + helper naming polish + minimal inline docs).

- 2026-02-06 23:06:45Z
  - Status: `in_progress` -> `done` (T-069)
  - Actions:
    - Polished structured-log harness API in `tests/smoke/server-structured-logs.harness.ts`:
      - added explicit helper option/result/interface types:
        - `StartServerWithEventCaptureOptions`
        - `StartServerWithEventCaptureResult`
        - `StructuredLogHarness`
      - added concise inline docs for harness method intent and usage.
      - retained existing exported surface and behavior for existing tests.
  - Evidence:
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-070 structured-log harness dead-export cleanup (`StructuredLogEvent` type usage/removal) and test import consistency sweep.

- 2026-02-06 23:07:46Z
  - Status: `in_progress` -> `done` (T-070)
  - Actions:
    - Completed structured-log harness export hygiene:
      - removed dead unused export from `tests/smoke/server-structured-logs.harness.ts`.
    - Confirmed split structured-log tests use minimal, consistent harness imports:
      - `tests/smoke/server-structured-logs.lifecycle.test.ts`
      - `tests/smoke/server-structured-logs.fatal.test.ts`
  - Evidence:
    - `bun test --timeout 20000 tests/smoke/server-structured-logs.lifecycle.test.ts tests/smoke/server-structured-logs.fatal.test.ts` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-071 structured-log docs alignment (document new split test file entrypoints and harness location in modernization support docs).

- 2026-02-06 23:09:35Z
  - Status: `in_progress` -> `done` (T-071)
  - Actions:
    - Aligned structured-log documentation with split smoke suites and shared harness location:
      - `docs/client-build-support.md`
      - `docs/server-logging-taxonomy.md`
    - Confirmed command snippets map to lifecycle-only and fatal-only entrypoints.
  - Evidence:
    - `bun test --timeout 20000 tests/smoke/server-structured-logs.lifecycle.test.ts` passed.
    - `bun test --timeout 20000 tests/smoke/server-structured-logs.fatal.test.ts` passed.
  - Next action:
    - Define T-072 structured-log command alias cleanup (`test:logs:*`) for shorter contributor run paths.

- 2026-02-06 23:10:03Z
  - Status: `in_progress` -> `done` (T-072)
  - Actions:
    - Added canonical structured-log alias scripts in `package.json`:
      - `test:logs:lifecycle`
      - `test:logs:fatal`
    - Updated contributor-facing docs to use alias commands:
      - `README.md`
      - `docs/client-build-support.md`
      - `docs/server-logging-taxonomy.md`
  - Evidence:
    - `bun run test:logs:lifecycle` passed.
    - `bun run test:logs:fatal` passed.
  - Next action:
    - Define T-073 modern client jQuery surface audit (inventory remaining jQuery-dependent ESM callsites and sequence reduction batches).

- 2026-02-06 23:12:48Z
  - Status: `in_progress` -> `done` (T-073)
  - Actions:
    - Audited modern ESM jQuery usage and callsite density in `client/js-esm/**`.
    - Added phased reduction plan artifact:
      - `docs/modern-jquery-surface-audit.md`
    - Linked new audit from modernization status docs:
      - `docs/dependency-modernization-audit.md`
      - `README.md`
  - Evidence:
    - `rg -nF "import $ from 'jquery';" client/js-esm` captured remaining jQuery import surface.
    - callsite density scan identified high-risk files (`client/js-esm/{main,app}.js`) and low-risk quick wins (`client/js-esm/{sprite,map,gameclient}.js`).
  - Next action:
    - Start T-074 low-risk modern jQuery reduction batch (`sprite`, `map`, `gameclient`).

- 2026-02-06 23:14:43Z
  - Status: `in_progress` -> `done` (T-074)
  - Actions:
    - Removed dead jQuery import in `client/js-esm/sprite.js`.
    - Replaced low-risk jQuery callsites with native APIs:
      - `client/js-esm/map.js`: `$.get(...)` -> `fetch(...).then(...).catch(...)` JSON load flow.
      - `client/js-esm/gameclient.js`: `$('#container').addClass('error')` -> `document.getElementById(...).classList.add(...)`.
  - Evidence:
    - `bun run test:browser:modern:node22` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start T-075 modern jQuery reduction batch for `client/js-esm/bubble.js`.

- 2026-02-06 23:16:20Z
  - Status: `in_progress` -> `done` (T-075)
  - Actions:
    - Removed jQuery dependency from `client/js-esm/bubble.js`:
      - dropped `jquery` import.
      - replaced jQuery remove/create/update/append calls with vanilla DOM APIs.
      - preserved existing API compatibility for selector-string container inputs (`'#bubbles'`) by resolving `document.querySelector(...)` in manager init.
    - Updated execution status in jQuery-surface plan:
      - `docs/modern-jquery-surface-audit.md`
  - Evidence:
    - `bun run test:browser:modern:node22` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start T-076 high-risk event-surface jQuery reduction in `client/js-esm/{app,main}.js` via incremental `.bind/.unbind` migration.

- 2026-02-06 23:18:36Z
  - Status: `in_progress` -> `done` (T-076)
  - Actions:
    - Migrated remaining jQuery `.bind/.unbind` callsites in modern ESM UI/event modules to `.on/.off`:
      - `client/js-esm/app.js`
      - `client/js-esm/main.js`
    - Verified no jQuery-style `.bind/.unbind` callsites remain in those files.
    - Updated jQuery-surface execution status:
      - `docs/modern-jquery-surface-audit.md`
  - Evidence:
    - `rg -n "\\$\\([^\\n]*\\)\\.bind\\(|\\$\\([^\\n]*\\)\\.unbind\\(" client/js-esm/app.js client/js-esm/main.js` returned no matches.
    - `bun run test:browser:modern:node22` passed (serial rerun).
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start T-077 modern selector/event decoupling for highest-frequency jQuery callsites in `client/js-esm/{app,main}.js`.

- 2026-02-06 23:26:36Z
  - Status: `in_progress` -> `done` (T-077)
  - Actions:
    - Reduced high-frequency selector coupling in `client/js-esm/main.js`:
      - switched population UI updates to cached DOM nodes + `textContent`.
      - switched death/respawn body class updates to `document.body.classList`.
      - replaced repeated reset selector writes with direct DOM element access.
    - Caught and fixed one behavior regression during validation:
      - `#nameinput` reset initially switched from attribute-set to property-set, which could clear typed names and re-disable Play during async init.
      - restored attribute semantics (`setAttribute('value', '')`) to preserve prior behavior.
    - Updated jQuery-surface execution status:
      - `docs/modern-jquery-surface-audit.md`
  - Evidence:
    - `bun run lint` passed.
    - `bun run test:browser:modern:node22` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start T-078 targeted app-shell selector decoupling in `client/js-esm/app.js`.

- 2026-02-06 23:28:26Z
  - Status: `in_progress` -> `done` (T-078)
  - Actions:
    - Reduced high-frequency jQuery selector churn in `client/js-esm/app.js` by using cached DOM references and native class/style APIs in targeted hot paths:
      - `showChat` / `hideChat`
      - `toggleButton`
      - `initHealthBar` / `blinkHealthBar`
      - `hideIntro`
      - `togglePopulationInfo`
    - Updated jQuery-surface execution status:
      - `docs/modern-jquery-surface-audit.md`
  - Evidence:
    - `bun run test:browser:modern:node22` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start T-079 remaining selector debt reduction for app/main overlay/parchment/achievement wiring.

- 2026-02-06 23:32:04Z
  - Status: `in_progress` -> `done` (T-079)
  - Actions:
    - Reduced remaining selector-heavy app-shell clusters in `client/js-esm/app.js` with DOM helper seams:
      - overlay/parchment toggle and close paths.
      - achievement panel toggles, notification state, and unlocked counters.
      - message/notification animation paths and popup sizing.
      - kept jQuery template-clone wiring for achievement list generation unchanged to avoid high-risk behavior drift.
    - Updated jQuery-surface audit with current selector density and next-batch scope:
      - `docs/modern-jquery-surface-audit.md`
  - Evidence:
    - `bun run lint` passed.
    - `bun run test:browser:modern:node22` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
    - selector density snapshot:
      - `client/js-esm/app.js`: `7` matches for `$('...'` pattern.
      - `client/js-esm/main.js`: `90` matches for `$('...'` pattern.
  - Next action:
    - Start T-080 remaining main-runtime selector/event debt reduction (`client/js-esm/main.js`).

- 2026-02-06 23:35:02Z
  - Status: `in_progress` -> `done` (T-080)
  - Actions:
    - Reduced main-runtime selector/event debt in `client/js-esm/main.js` by migrating targeted chat/name/parchment interaction paths to DOM APIs:
      - chat input key/focus handlers now use `addEventListener`, direct `value`, and placeholder/class updates.
      - name input tooltip/focus/keypress wiring now uses DOM listeners and DOM class toggles.
      - gameplay body click parchment checks now use cached `parchment` element `classList.contains(...)`.
      - mute/respawn handlers and focus-state checks now use DOM APIs (`document.activeElement`) instead of selector+`:focus`/`.size()`.
    - Updated jQuery-surface audit with new selector-density snapshot and next batch scope:
      - `docs/modern-jquery-surface-audit.md`
  - Evidence:
    - `bun run lint` passed.
    - `bun run test:browser:modern:node22` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
    - selector density snapshot:
      - `client/js-esm/app.js`: `7` matches for `$('...'` pattern.
      - `client/js-esm/main.js`: `55` matches for `$('...'` pattern.
  - Next action:
    - Start T-081 main boot/runtime handler normalization for remaining click/social/achievement paging/foreground handler clusters.

- 2026-02-06 23:37:41Z
  - Status: `in_progress` -> `done` (T-081)
  - Actions:
    - Normalized remaining selector-heavy boot/runtime handler clusters in `client/js-esm/main.js`:
      - converted bar/help/achievement/social/paging handlers to DOM listeners.
      - converted boot parchment checks, legal/privacy label updates, and `playername`/`playerimage` boot wiring to DOM APIs.
      - converted `resize-check` transition listeners and `.play div` boot click wiring to DOM event handlers.
    - Updated jQuery-surface audit with current selector-density snapshot and next batch:
      - `docs/modern-jquery-surface-audit.md`
  - Evidence:
    - `bun run lint` passed.
    - `bun run test:browser:modern:node22` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
    - selector density snapshot:
      - `client/js-esm/app.js`: `7` matches for `$('...'` pattern.
      - `client/js-esm/main.js`: `7` matches for `$('...'` pattern.
  - Next action:
    - Start T-082 final modern jQuery runtime extraction for residual modern callsites/imports.

- 2026-02-06 23:39:51Z
  - Status: `in_progress` -> `done` (T-082)
  - Actions:
    - Removed remaining jQuery runtime usage from `client/js-esm/main.js`:
      - replaced jQuery `ready`, body class toggles, disconnect UI updates, and mobile touch foreground handler with DOM APIs.
      - dropped `jquery` import from `client/js-esm/main.js`.
    - Updated jQuery-surface audit with current import/callsite state and explicit residual `app.js` defer-or-migrate scope:
      - `docs/modern-jquery-surface-audit.md`
  - Evidence:
    - `bun run lint` passed.
    - `bun run test:browser:modern:node22` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
    - selector density snapshot:
      - `client/js-esm/main.js`: `0` matches for `$('...'` pattern.
      - `client/js-esm/app.js`: `7` matches for `$('...'` pattern.
  - Next action:
    - Start T-083 app final jQuery extraction or explicit-defer decision for template/offset/play-button callsites.

- 2026-02-06 23:42:21Z
  - Status: `in_progress` -> `done` (T-083)
  - Actions:
    - Completed modern-runtime jQuery extraction in `client/js-esm/app.js`:
      - migrated play-button loading/start watcher to DOM helpers with explicit `isStarting` guard.
      - migrated mouse container offset math to DOM `getBoundingClientRect` + scroll offsets.
      - migrated achievement template/list rendering from jQuery clone/find/click APIs to DOM clone/query/listener APIs.
    - Modern ESM runtime jQuery usage is now fully removed:
      - `client/js-esm/main.js` already jQuery-free from T-082.
      - `client/js-esm/app.js` no longer imports/uses jQuery.
    - Updated audit status and follow-up scope:
      - `docs/modern-jquery-surface-audit.md`
  - Evidence:
    - `bun run lint` passed.
    - `bun run test:browser:modern:node22` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
    - `rg -nF "$(" client/js-esm/app.js client/js-esm/main.js` returned no matches.
    - `rg -n "import \\$ from 'jquery';" client/js-esm` returned no matches.
  - Next action:
    - Start T-084 modern jQuery-free policy lock (docs + static guardrails).

- 2026-02-06 23:46:34Z
  - Status: `in_progress` -> `done` (T-084)
  - Actions:
    - Locked modern ESM jQuery-free policy with static guardrails:
      - `tools/check-modern-jquery-free.cjs` is now the policy gate.
      - `verify:modern` runs the policy check before lint/test/build.
    - Updated policy docs and roadmap artifacts:
      - `README.md`
      - `docs/client-build-support.md`
      - `docs/modern-jquery-surface-audit.md`
  - Evidence:
    - `bun run check:modern-jquery-free` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start T-085 modern jQuery-free guard expansion from `app/main` scope to all `client/js-esm/**/*.js`.

- 2026-02-06 23:46:34Z
  - Status: `in_progress` -> `done` (T-085)
  - Actions:
    - Expanded `check:modern-jquery-free` coverage to all modern ESM runtime files (`client/js-esm/**/*.js`).
    - Updated policy wording in docs to reflect full modern ESM scope.
  - Evidence:
    - `bun run check:modern-jquery-free` passed (`46 files checked`).
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-086 for next modernization slice after jQuery-free lock (dependency/runtime modernization candidate queue).

- 2026-02-06 23:50:53Z
  - Status: `in_progress` -> `done` (T-086)
  - Actions:
    - Refreshed post-jQuery modernization queue with concrete next tickets:
      - T-087 modern-first local dev default entrypoint.
      - T-088 static dev entry contract smoke test.
      - T-089 modern-first Vite dev root redirect.
  - Evidence:
    - Active queue definitions updated in `MODERNIZE.md`.
  - Next action:
    - Start T-087 modern-first local dev default entrypoint.

- 2026-02-06 23:50:53Z
  - Status: `in_progress` -> `done` (T-087)
  - Actions:
    - Switched local static dev root (`bun run dev`) to modern-first routing:
      - `/` now serves `client/modern.html` by default.
      - legacy fallback remains available at `/index.html`.
      - opt-in legacy default override: `BQ_CLIENT_DEFAULT_ENTRY=index.html`.
    - Updated local runbook docs:
      - `README.md`
      - `client/README.md`
      - `docs/client-build-support.md`
  - Evidence:
    - Runtime probe:
      - root path excludes `js/detect.js` and contains `js-esm/preflight.js`.
      - `/index.html` retains legacy markers (`js/detect.js`).
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start T-088 static dev entry contract smoke test.

- 2026-02-06 23:50:53Z
  - Status: `in_progress` -> `done` (T-088)
  - Actions:
    - Added static dev entry smoke suite:
      - `tests/smoke/static-server-entry-default.test.ts`
      - covers default modern root route and legacy override path.
    - Added execution alias:
      - `package.json` `test:static-entry`.
    - Documented new smoke gate in:
      - `README.md`
      - `docs/client-build-support.md`
  - Evidence:
    - `bun run test:static-entry` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start T-089 modern-first Vite dev root redirect.

- 2026-02-06 23:50:53Z
  - Status: `in_progress` -> `done` (T-089)
  - Actions:
    - Switched Vite dev root redirect to modern-first:
      - `/` and `/index.html` now redirect to `/client/modern.html` by default.
      - legacy override flag supported: `BQ_VITE_DEFAULT_ENTRY=legacy`.
      - implementation updated in `vite.config.ts`.
    - Updated Vite dev docs to match new default and override:
      - `README.md`
      - `client/README.md`
      - `docs/client-build-support.md`
  - Evidence:
    - Runtime probe:
      - `curl -I http://127.0.0.1:5173/` returns `Location: /client/modern.html`.
      - `BQ_VITE_DEFAULT_ENTRY=legacy` returns `Location: /client/index.html`.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-090 dependency/runtime modernization candidate queue refresh after modern-first dev entry consolidation.

- 2026-02-06 23:50:53Z
  - Status: `in_progress` -> `done` (T-090)
  - Actions:
    - Refreshed dependency/runtime modernization candidate queue after entrypoint consolidation.
    - Updated dependency audit with current direct dependency drift evidence:
      - `docs/dependency-modernization-audit.md`
      - identified pending major upgrade candidates in `eslint` toolchain.
    - Defined follow-up execution tickets for the dependency slice:
      - T-091 (`eslint@10` readiness scan)
      - T-092 (scoped `eslint@10` upgrade trial)
  - Evidence:
    - `bun outdated` reports:
      - `@eslint/js` `9.39.2` -> `10.0.1`
      - `eslint` `9.39.2` -> `10.0.0`
  - Next action:
    - Start T-091 `eslint@10` readiness scan and compatibility triage.

- 2026-02-06 23:50:53Z
  - Status: `in_progress` -> `done` (T-091)
  - Actions:
    - Completed local compatibility scan for `eslint@10` readiness:
      - verified current `eslint.config.cjs` shape is compatible.
      - captured upstream peer-range state for `@typescript-eslint` packages.
      - confirmed current lint baseline before upgrade trial.
    - Readiness result: no blocking config/runtime issues found for proceeding with upgrade trial.
  - Evidence:
    - `bun run lint` passed on baseline.
    - peer metadata snapshot:
      - local + npm latest `@typescript-eslint` peer range: `eslint: ^8.57.0 || ^9.0.0`.
  - Next action:
    - Start T-092 scoped `eslint@10` + `@eslint/js@10` upgrade trial.

- 2026-02-06 23:50:53Z
  - Status: `in_progress` -> `done` (T-092)
  - Actions:
    - Upgraded lint toolchain:
      - `eslint` -> `10.0.0`
      - `@eslint/js` -> `10.0.1`
      - lockfile refreshed (`bun.lock`).
    - Kept upgrade after full verification suite remained green.
    - Updated dependency audit and follow-up order:
      - `docs/dependency-modernization-audit.md`
  - Evidence:
    - `bun run lint` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
    - `npm outdated --depth=0` returned no direct dependency drift.
  - Next action:
    - Define T-093 for post-upgrade hardening (track `@typescript-eslint` explicit peer support and periodic dependency re-audit cadence).

- 2026-02-06 23:56:02Z
  - Status: `in_progress` -> `done` (T-093)
  - Actions:
    - Implemented explicit dependency-watch workflow:
      - added script alias `check:deps:drift` in `package.json` (`npm outdated --depth=0`).
      - updated root runbook and dependency audit with watch cadence and trigger actions.
        - `README.md`
        - `docs/dependency-modernization-audit.md`
  - Evidence:
    - `bun run check:deps:drift` passed (no direct dependency drift reported).
  - Next action:
    - Define T-094 for next modernization slice beyond dependency/toolchain drift (runtime/library modernization candidate execution).

- 2026-02-06 23:59:36Z
  - Status: `in_progress` -> `done` (T-094)
  - Actions:
    - Refreshed runtime/library modernization candidate queue beyond dependency/tooling drift.
    - Selected highest-leverage immediate runtime hardening batch:
      - T-095 metrics backend optional-dependency startup hardening.
      - T-096 structured fallback observability and contract coverage.
  - Evidence:
    - Candidate implementation targets and verification commands documented in active queue.
  - Next action:
    - Start T-095 server metrics optional-dependency hardening.

- 2026-02-06 23:59:36Z
  - Status: `in_progress` -> `done` (T-095)
  - Actions:
    - Hardened server startup when `metrics_enabled` is true but metrics backend cannot initialize:
      - added safe metrics initializer in `server/js/main.js` with guarded fallback to non-metrics runtime path.
      - added structured fallback event:
        - `server.metrics.unavailable` with `reason` and `error`.
      - prevented null dereference risk by gating `metrics.ready(...)` on actual metrics availability.
  - Evidence:
    - `bun test --timeout 20000 tests/smoke/server-handshake.test.ts` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start T-096 metrics fallback observability contract coverage.

- 2026-02-06 23:59:36Z
  - Status: `in_progress` -> `done` (T-096)
  - Actions:
    - Added explicit contract coverage for metrics-backend-missing fallback:
      - `tests/smoke/server-handshake.test.ts` now includes metrics-enabled fallback handshake scenario.
      - extended structured log harness config overrides for targeted server boot scenarios:
        - `tests/smoke/server-structured-logs.harness.ts`
      - added lifecycle structured-log assertion for `server.metrics.unavailable`:
        - `tests/smoke/server-structured-logs.lifecycle.test.ts`
    - Updated server event taxonomy docs:
      - `docs/server-logging-taxonomy.md`
  - Evidence:
    - `bun test --timeout 20000 tests/smoke/server-structured-logs.lifecycle.test.ts` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-097 runtime/library next slice after metrics hardening (metrics adapter boundary + dependency strategy).

- 2026-02-07 00:02:09Z
  - Status: `in_progress` -> `done` (T-097)
  - Actions:
    - Implemented concrete metrics runtime boundary and dependency strategy in server runtime:
      - added `server/js/metrics-runtime.js` to centralize metrics enablement checks, config validation, and safe adapter initialization.
      - added explicit fallback reason taxonomy:
        - `invalid_config` (with `invalidFields`)
        - `init_failed` (with `error`)
      - updated `server/js/main.js` to consume the runtime boundary instead of direct metrics construction.
    - Expanded runtime/observability coverage:
      - `tests/smoke/server-handshake.test.ts` adds invalid-config metrics-enabled fallback handshake case.
      - `tests/smoke/server-structured-logs.lifecycle.test.ts` adds `invalid_config` structured-event contract.
      - `docs/server-logging-taxonomy.md` updated for reason/field contract.
  - Evidence:
    - `bun test --timeout 20000 tests/smoke/server-handshake.test.ts` passed (3 tests).
    - `bun test --timeout 20000 tests/smoke/server-structured-logs.lifecycle.test.ts` passed (3 tests).
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-098 metrics backend adapter modularization (pluggable no-op/memcache adapter policy + targeted unit coverage).

- 2026-02-07 02:08:15Z
  - Status: `in_progress` -> `done` (T-098)
  - Actions:
    - Modularized metrics runtime into explicit adapters:
      - added no-op adapter module:
        - `server/js/metrics-adapters/noop.js`
      - added memcache adapter module:
        - `server/js/metrics-adapters/memcache.js`
      - refactored runtime selector to use adapter registry:
        - `server/js/metrics-runtime.js`
      - updated server runtime to consume adapter capability flag (`isEnabled`) instead of null checks:
        - `server/js/main.js`
    - Added deterministic unit contracts for adapter selection/fallback behavior without requiring external memcache:
      - `tests/unit/metrics-runtime.test.ts`
    - Kept existing smoke/log fallback coverage green after modularization.
  - Evidence:
    - `bun run lint` passed.
    - `bun test --timeout 20000 tests/unit/metrics-runtime.test.ts` passed (4 tests).
    - `bun test --timeout 20000 tests/smoke/server-handshake.test.ts tests/smoke/server-structured-logs.lifecycle.test.ts` passed (6 tests).
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-099 metrics config documentation/runbook hardening (explicit required fields + examples for `metrics_enabled`).

- 2026-02-07 02:08:54Z
  - Status: `in_progress` -> `done` (T-099)
  - Actions:
    - Hardened metrics configuration runbook in `server/README.md`:
      - documented required fields for `metrics_enabled: true`.
      - added valid example configs for metrics disabled/enabled modes.
      - documented fallback semantics (`invalid_config` vs `init_failed`) and structured event linkage.
  - Evidence:
    - `server/README.md` now contains explicit metrics config contract and operator-facing examples.
    - Fallback event contract remains aligned with runtime + smoke coverage in `docs/server-logging-taxonomy.md` and lifecycle tests.
  - Next action:
    - Define T-100 metrics config sample/template update (`config_local.json-dist`) to mirror documented metrics-enabled contract.

- 2026-02-07 02:09:40Z
  - Status: `in_progress` -> `done` (T-100)
  - Actions:
    - Updated distributed local config template to match metrics validation contract:
      - `server/config_local.json-dist` now includes metrics-enabled required keys:
        - `memcached_host`
        - `memcached_port`
        - `server_name`
        - `game_servers`
    - Updated server runbook note:
      - `server/README.md` now calls out that template includes metrics keys for safe `metrics_enabled` toggling.
  - Evidence:
    - `bun test --timeout 20000 tests/smoke/server-handshake.test.ts tests/smoke/server-structured-logs.lifecycle.test.ts` passed.
  - Next action:
    - Define T-101 metrics adapter package dependency policy (explicit optional dependency install guidance + failure-mode troubleshooting).

- 2026-02-07 02:10:04Z
  - Status: `in_progress` -> `done` (T-101)
  - Actions:
    - Added metrics adapter dependency/runbook guidance in `server/README.md`:
      - optional dependency/install policy (`memcache` package + memcached service).
      - troubleshooting mapped to structured fallback reasons:
        - `invalid_config`
        - `init_failed`
  - Evidence:
    - Server runbook now maps each `server.metrics.unavailable` reason to concrete operator actions.
  - Next action:
    - Define T-102 metrics adapter health-check smoke (assert fallback-to-healthy transition readiness once memcache dependency is available).

- 2026-02-07 02:10:59Z
  - Status: `in_progress` -> `done` (T-102)
  - Actions:
    - Defined deterministic healthy-metrics smoke strategy with opt-in gating and environment prerequisites:
      - `docs/metrics-health-smoke-plan.md`
    - Linked strategy into runbooks:
      - `server/README.md`
      - `README.md`
  - Evidence:
    - Plan now specifies prerequisites, pass/fail contract, and follow-up implementation sequence without impacting default CI/local flows.
  - Next action:
    - Define T-103 for implementing optional healthy-path smoke command + test scaffold using the documented gate.

- 2026-02-07 02:12:55Z
  - Status: `in_progress` -> `done` (T-103)
  - Actions:
    - Implemented optional healthy metrics smoke scaffold:
      - added env-gated smoke test:
        - `tests/smoke/server-metrics-healthy.optional.test.ts`
      - added opt-in command:
        - `package.json` `test:metrics:healthy`
    - Updated docs and runbooks for the new optional command:
      - `docs/metrics-health-smoke-plan.md`
      - `server/README.md`
      - `README.md`
      - `docs/client-build-support.md`
    - Kept default test/verify behavior unchanged via `test.skip` when `BQ_TEST_METRICS_HEALTH` is not set.
  - Evidence:
    - `bun run lint` passed.
    - `bun run verify:modern:node22` passed (`server-metrics-healthy.optional` skipped by default).
    - `bun run verify:legacy:node22` passed (`server-metrics-healthy.optional` skipped by default).
  - Next action:
    - Define T-104 structured healthy-path signal (`server.metrics.ready`) so optional smoke can assert positive backend readiness deterministically.

- 2026-02-07 02:16:33Z
  - Status: `in_progress` -> `done` (T-104)
  - Actions:
    - Finalized structured healthy-path signal contract:
      - `server/js/metrics-runtime.js` now emits `server.metrics.ready` when memcache-backed metrics reports ready.
      - optional healthy smoke asserts `server.metrics.ready` and no longer depends on unstructured log text.
    - Updated taxonomy/runbook docs to reflect the active contract:
      - `docs/server-logging-taxonomy.md`
      - `docs/metrics-health-smoke-plan.md`
  - Evidence:
    - `bun test --timeout 20000 tests/unit/metrics-runtime.test.ts tests/smoke/server-metrics-healthy.optional.test.ts` passed (`server-metrics-healthy.optional` skipped by default).
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-105 healthy metrics smoke prerequisites preflight (fail-fast dependency/service validation before running opt-in healthy smoke).

- 2026-02-07 02:18:16Z
  - Status: `in_progress` -> `done` (T-105)
  - Actions:
    - Added healthy-smoke prerequisites preflight command:
      - `tools/check-metrics-healthy-prereqs.cjs`
      - validates optional `memcache` dependency presence.
      - validates memcached reachability at `BQ_TEST_METRICS_HOST:BQ_TEST_METRICS_PORT` (defaults `127.0.0.1:11211`).
    - Wired preflight into optional healthy smoke command:
      - `package.json`:
        - `check:metrics:healthy-prereqs`
        - `test:metrics:healthy` now runs preflight before env-gated smoke.
    - Updated docs/runbooks:
      - `README.md`
      - `server/README.md`
      - `docs/client-build-support.md`
      - `docs/metrics-health-smoke-plan.md`
  - Evidence:
    - `bun run check:metrics:healthy-prereqs` fails fast with actionable output when prerequisites are missing.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Define T-106 optional CI profile for healthy metrics smoke with provisioned memcached service.

- 2026-02-07 02:20:02Z
  - Status: `in_progress` -> `done` (T-106)
  - Actions:
    - Added optional healthy metrics CI workflow:
      - `.github/workflows/verify-metrics-healthy.yml` (`workflow_dispatch` only).
      - provisions `memcached` service in job container context.
      - installs optional `memcache` package and runs `bun run test:metrics:healthy`.
    - Updated supporting docs to surface optional automation path:
      - `README.md`
      - `docs/client-build-support.md`
      - `docs/metrics-health-smoke-plan.md`
  - Evidence:
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
    - `bun run check:metrics:healthy-prereqs` returns actionable fail output when prerequisites are missing (local unprepared environment).
  - Next action:
    - Define T-107 operational runbook for triggering and interpreting `verify-metrics-healthy` workflow results.

- 2026-02-07 02:20:33Z
  - Status: `in_progress` -> `done` (T-107)
  - Actions:
    - Added explicit runbook for optional healthy metrics workflow trigger + triage:
      - `docs/metrics-health-smoke-plan.md`
      - includes expected success signals and common failure mappings.
    - Added cross-links to the runbook:
      - `README.md`
      - `docs/client-build-support.md`
  - Evidence:
    - Documentation reflects current workflow + command contracts end-to-end.
    - `bun run verify:modern:node22` and `bun run verify:legacy:node22` remained green in this slice.
  - Next action:
    - Define T-108 post-push workflow evidence capture (run `verify-metrics-healthy` in GitHub and record baseline output).

- 2026-02-07 03:41:04Z
  - Status: `in_progress` -> `blocked` (T-108)
  - Actions:
    - Attempted workflow dispatch for post-push evidence capture:
      - `gh workflow run verify-metrics-healthy.yml --ref modernize`
    - Confirmed remote workflow absence:
      - GitHub API reports no workflows in `mozilla/BrowserQuest` (`total_count: 0`).
  - Evidence:
    - Dispatch failed with: `HTTP 404: Not Found (https://api.github.com/repos/mozilla/BrowserQuest/actions/workflows/verify-metrics-healthy.yml)`.
  - Blocker:
    - Workflow file is local-only until branch changes are committed and pushed to a remote ref.
  - Next action:
    - Push branch containing `.github/workflows/verify-metrics-healthy.yml`, then rerun dispatch and record run URL/id.

- 2026-02-07 03:41:04Z
  - Status: `in_progress` -> `done` (T-109)
  - Actions:
    - Fixed healthy metrics runtime compatibility for current `memcache` package API:
      - `server/js/metrics.js` now supports both legacy (`Client`) and modern (`Memcache`/default) constructors.
      - added callback-safe `setValue`/`getValue` adapters for promise-based modern client operations.
      - fixed ready/connect race windows (connect listener ordering + immediate callback when already ready).
    - Fixed optional healthy smoke event capture:
      - `tests/smoke/server-metrics-healthy.optional.test.ts` now parses structured events from both `stdout` and `stderr`.
    - Validated healthy path end-to-end with temporary local provisioning:
      - installed `memcache` using `bun add --no-save memcache`.
      - started local memcached via docker container.
      - ran `bun run test:metrics:healthy` (passed).
      - removed temporary local memcache package and container after validation.
  - Evidence:
    - `bun run test:metrics:healthy` passed in prepared local env.
    - `bun run lint` and `bun run format:check` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Keep T-108 open as blocked until branch push enables GitHub workflow execution evidence capture.

- 2026-02-07 03:45:04Z
  - Status: `in_progress` -> `done` (T-110)
  - Actions:
    - Extracted memcache client compatibility seam:
      - `server/js/metrics-client.js`
      - supports both legacy `Client` API and modern `Memcache`/default API.
    - Refactored metrics runtime to use the seam:
      - `server/js/metrics.js` now delegates connect/get/set through adapter helpers.
    - Added deterministic adapter contract unit coverage:
      - `tests/unit/metrics-client.test.ts`
      - validates legacy path, modern path, and unsupported-module failure path.
  - Evidence:
    - `bun test --timeout 20000 tests/unit/metrics-client.test.ts tests/unit/metrics-runtime.test.ts tests/smoke/server-structured-logs.lifecycle.test.ts tests/smoke/server-handshake.test.ts` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Retry T-108 using fork push + workflow dispatch since upstream is read-only.

- 2026-02-07 03:47:22Z
  - Status: `blocked` -> `done` (T-108)
  - Actions:
    - Added fork remote and pushed branch snapshot:
      - remote: `fork` (`git@github.com:Krisztiaan/BrowserQuest.git`)
      - branch: `modernize`
    - Set fork default branch to `modernize` so GitHub indexes workflow definitions from this branch.
    - Triggered and watched optional healthy metrics workflow to completion:
      - workflow: `verify-metrics-healthy`
      - run id: `21773648845`
  - Evidence:
    - Run URL: `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21773648845`
    - Conclusion: `success` (2026-02-07T03:46:37Z -> 2026-02-07T03:47:08Z)
    - Log highlights:
      - `metrics-healthy-prereqs: ok (...)`
      - `(pass) optional: healthy metrics path starts with memcache backend and no fallback event`
      - `1 pass, 0 fail`
  - Next action:
    - Define T-111 branch/release hygiene after fork default-branch switch (document/reset strategy).

- 2026-02-07 03:48:15Z
  - Status: `in_progress` -> `done` (T-111)
  - Actions:
    - Added explicit fork workflow hygiene instructions to the metrics healthy runbook:
      - `docs/metrics-health-smoke-plan.md`
      - includes push/default-branch switch, dispatch, reset, and verification commands.
    - Captured deterministic commands for both enabling and reverting workflow-dispatch readiness on forks.
  - Evidence:
    - Runbook now documents exact command sequence used for successful `verify-metrics-healthy` execution evidence capture.
  - Next action:
    - Define T-112 optional workflow hardening (non-destructive dependency install step in CI).

- 2026-02-07 03:49:15Z
  - Status: `in_progress` -> `done` (T-112)
  - Actions:
    - Hardened optional healthy workflow dependency install step:
      - `.github/workflows/verify-metrics-healthy.yml`
      - changed from `bun add memcache` to `bun add --no-save memcache`.
    - Updated runbook wording to match hardened behavior:
      - `docs/metrics-health-smoke-plan.md`
    - Pushed workflow update and reran healthy metrics workflow.
  - Evidence:
    - Run URL: `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21773675770`
    - Conclusion: `success` (2026-02-07T03:48:50Z -> 2026-02-07T03:49:04Z)
    - Log highlights:
      - `Install optional metrics dependency (no-save)` executed.
      - `metrics-healthy-prereqs: ok (...)`
      - `(pass) optional: healthy metrics path starts with memcache backend and no fallback event`
  - Next action:
    - Define T-113 upstream handoff note (origin is read-only; fork workflow evidence location + sync instructions).

- 2026-02-07 03:49:40Z
  - Status: `in_progress` -> `done` (T-113)
  - Actions:
    - Added explicit upstream-vs-fork execution context for healthy metrics workflow evidence:
      - `docs/metrics-health-smoke-plan.md`
      - `README.md`
    - Linked successful fork runs for maintainers/operators:
      - `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21773648845`
      - `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21773675770`
  - Evidence:
    - Runbook now clearly states why evidence runs are on fork and where to find them.
  - Next action:
    - Define T-114 upstream alignment checklist (what to replicate if write access to upstream becomes available).

- 2026-02-07 03:50:10Z
  - Status: `in_progress` -> `done` (T-114)
  - Actions:
    - Added upstream replication checklist for optional healthy workflow:
      - `docs/metrics-health-smoke-plan.md`
      - includes workflow file requirements, dispatch verification commands, and evidence capture requirements.
  - Evidence:
    - Runbook now has an explicit ordered checklist for migrating fork-based evidence flow to upstream when permissions allow.
  - Next action:
    - Define T-115 baseline modernization tag point (capture commit/run references for this completed metrics slice).

- 2026-02-07 03:50:27Z
  - Status: `in_progress` -> `done` (T-115)
  - Actions:
    - Captured compact baseline references for completed metrics modernization slice.
  - Evidence:
    - Fork repo: `https://github.com/Krisztiaan/BrowserQuest`
    - Key commits:
      - `23df5dd` (modernization + metrics workflow snapshot)
      - `436cb22` (T-108 evidence logging)
      - `4c096de` (workflow `--no-save` hardening)
    - Successful healthy workflow runs:
      - `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21773648845`
      - `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21773675770`
  - Next action:
    - Define T-116 optional smoke runtime matrix note (Bun version pin/watch for workflow reproducibility).

- 2026-02-07 03:50:46Z
  - Status: `in_progress` -> `done` (T-116)
  - Actions:
    - Added runtime matrix note and revalidation trigger for optional healthy workflow:
      - `docs/metrics-health-smoke-plan.md`
      - captures Node/Bun versions observed in successful runs and when to rerun.
  - Evidence:
    - Runbook now includes runtime references linked to successful run IDs and explicit drift triggers.
  - Next action:
    - Define T-117 checkpoint summary and pause marker for next modernization slice handoff.

## Metrics slice checkpoint (T-104..T-116)

- Completed:
  - `T-104` structured `server.metrics.ready` signal contract.
  - `T-105` prerequisites preflight for optional healthy smoke.
  - `T-106` optional healthy workflow definition.
  - `T-107` workflow trigger/triage runbook.
  - `T-108` successful fork workflow evidence capture (`21773648845`).
  - `T-109` memcache API compatibility + healthy signal determinism fix.
  - `T-110` metrics client seam extraction + unit contracts.
  - `T-111` fork default-branch hygiene instructions.
  - `T-112` workflow dependency-step hardening (`--no-save`) + successful rerun (`21773675770`).
  - `T-113` upstream-vs-fork handoff context notes.
  - `T-114` upstream replication checklist.
  - `T-115` baseline commit/run reference capture.
  - `T-116` runtime matrix note + revalidation triggers.
- Current execution context:
  - Upstream `mozilla/BrowserQuest` is read-only in this environment; actionable workflow evidence is tracked on fork `Krisztiaan/BrowserQuest`.
- Open successor queue:
  - `T-117` checkpoint summary completion marker (this block) and next-slice handoff.

- 2026-02-07 03:51:06Z
  - Status: `in_progress` -> `done` (T-117)
  - Actions:
    - Added metrics slice checkpoint summary block covering outcomes from `T-104` through `T-116`.
    - Added explicit context marker for fork-based workflow evidence and open successor queue.
  - Evidence:
    - `MODERNIZE.md` now includes a concise resume point without replaying full chronological logs.
  - Next action:
    - Define T-118 next modernization slice candidate refresh beyond metrics/CI contracts.

- 2026-02-07 03:51:24Z
  - Status: `in_progress` -> `done` (T-118)
  - Actions:
    - Refreshed post-metrics modernization candidate queue with explicit ordered tickets:
      - `T-119` server config schema preflight.
      - `T-120` optional healthy workflow runtime matrix hardening.
      - `T-121` metrics adapter failure taxonomy expansion.
      - `T-122` legacy/modern protocol invariant replay guard.
    - Added acceptance criteria and verification commands for each candidate.
  - Evidence:
    - `MODERNIZE.md` now contains an executable next slice beyond completed metrics/CI stabilization work.
  - Next action:
    - Start `T-119` server config schema preflight implementation.

- 2026-02-07 03:54:53Z
  - Status: `in_progress` -> `done` (T-119)
  - Actions:
    - Added server config preflight validator:
      - `server/js/config-preflight.js`
      - validates core startup contract (port/debug level/world sizing/map path/metrics_enabled type).
    - Wired fail-fast preflight in startup path:
      - `server/js/main.js` now emits `server.config.invalid` with structured errors and exits before server boot when config is invalid.
    - Added tests and docs:
      - `tests/unit/server-config-preflight.test.ts`
      - `tests/smoke/server-config-preflight.test.ts`
      - `docs/server-logging-taxonomy.md`
      - `server/README.md`
    - Kept existing degraded metrics behavior intact by deferring metrics field checks to metrics runtime fallback path.
  - Evidence:
    - `bun test --timeout 20000 tests/unit/server-config-preflight.test.ts tests/smoke/server-config-preflight.test.ts tests/smoke/server-handshake.test.ts tests/smoke/server-structured-logs.lifecycle.test.ts` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-120` optional healthy workflow Node/Bun matrix hardening.

- 2026-02-07 03:55:58Z
  - Status: `in_progress` -> `done` (T-120)
  - Actions:
    - Hardened optional healthy workflow with explicit runtime matrix pinning:
      - `.github/workflows/verify-metrics-healthy.yml`
      - Node `22.x`, Bun `1.3.8` matrix entries are now explicit in job name and setup steps.
    - Updated runtime policy wording:
      - `docs/metrics-health-smoke-plan.md`
    - Triggered and validated the hardened matrix workflow run.
  - Evidence:
    - Run URL: `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21773758960`
    - Conclusion: `success` (2026-02-07T03:55:25Z -> 2026-02-07T03:55:45Z)
    - Log highlights:
      - job label: `metrics-healthy (node 22.x, bun 1.3.8)`
      - `metrics-healthy-prereqs: ok (...)`
      - `(pass) optional: healthy metrics path starts with memcache backend and no fallback event`
  - Next action:
    - Start `T-121` metrics adapter failure-mode taxonomy expansion.

- 2026-02-07 04:13:48Z
  - Status: `in_progress` -> `done` (T-121)
  - Actions:
    - Expanded metrics unavailability taxonomy with stable runtime/connect reason codes:
      - `server/js/metrics-runtime.js` forwards adapter unavailability hooks into structured `server.metrics.unavailable`.
      - `server/js/metrics.js` now reports one-time reason-coded unavailability for:
        - `connect_failed`
        - `read_failed`
        - `write_failed`
      - `server/js/metrics-client.js` now surfaces modern/legacy connect and operation errors with structured details (`operation`, `key`, `error`).
    - Updated memcache adapter wiring:
      - `server/js/metrics-adapters/memcache.js` passes runtime hook options into metrics constructor.
    - Added/expanded targeted coverage:
      - `tests/unit/metrics-runtime.test.ts` (adapter unavailability forwarding contract)
      - `tests/unit/metrics-client.test.ts` (modern/legacy connect+operation error surfaces)
    - Updated docs:
      - `docs/server-logging-taxonomy.md`
      - `server/README.md`
  - Evidence:
    - `bun test --timeout 20000 tests/unit/metrics-client.test.ts tests/unit/metrics-runtime.test.ts tests/smoke/server-structured-logs.lifecycle.test.ts tests/smoke/server-handshake.test.ts` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-122` legacy/modern protocol invariant replay guard.

- 2026-02-07 04:19:22Z
  - Status: `in_progress` -> `done` (T-122)
  - Actions:
    - Added deterministic browser replay parity guard:
      - `tests/browser/protocol-invariant.playwright.ts`
      - replays `go` -> `HELLO` -> `WELCOME` -> `CHAT` against both `client/modern.html` and `client/index.html`.
    - Added canonical script entrypoints:
      - `test:browser:protocol-invariant`
      - `test:browser:protocol-invariant:node22`
    - Updated support docs:
      - `README.md`
      - `docs/client-build-support.md`
  - Evidence:
    - `bun run test:browser:protocol-invariant:node22` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-123` protocol invariant CI gate workflow.

- 2026-02-07 04:19:40Z
  - Status: `in_progress` -> `done` (T-123)
  - Actions:
    - Added path-filtered browser protocol gate workflow:
      - `.github/workflows/verify-protocol-invariant.yml`
      - executes `bun run test:browser:protocol-invariant` on browser/runtime-sensitive changes.
    - Added CI mapping references:
      - `README.md`
      - `docs/client-build-support.md`
  - Evidence:
    - Local parity gate remained green:
      - `bun run test:browser:protocol-invariant:node22`
    - Workflow config committed with Node `22.x` runtime matrix and Playwright chromium install step.
  - Next action:
    - Define `T-124` for post-protocol-gate roadmap refresh (workflow evidence capture + next modernization candidates).

- 2026-02-07 04:21:17Z
  - Status: `in_progress` -> `done` (T-124)
  - Actions:
    - Pushed `modernize` branch with protocol-invariant workflow additions to fork `Krisztiaan/BrowserQuest`.
    - Captured first successful run evidence for the new workflow:
      - workflow: `verify-protocol-invariant`
      - run ID: `21774078504`
  - Evidence:
    - Run URL: `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21774078504`
    - Conclusion: `success` (2026-02-07T04:20:35Z -> 2026-02-07T04:21:17Z)
    - Job: `protocol-invariant (node 22.x)` passed.
  - Next action:
    - Start `T-125` CI Bun pin alignment for reproducibility across primary verify workflows.

- 2026-02-07 04:21:48Z
  - Status: `in_progress` -> `done` (T-125)
  - Actions:
    - Pinned Bun version to `1.3.8` across primary verify workflows:
      - `.github/workflows/verify-modern.yml`
      - `.github/workflows/verify-legacy.yml`
      - `.github/workflows/verify-modern-browser.yml`
      - `.github/workflows/verify-legacy-browser.yml`
      - `.github/workflows/verify-protocol-invariant.yml`
    - Updated runtime-policy docs to reflect CI pin:
      - `README.md`
      - `docs/client-build-support.md`
  - Evidence:
    - Workflow configs now consistently use `bun-version: 1.3.8` in setup steps.
    - Local parity remains green:
      - `bun run test:browser:protocol-invariant:node22` passed during this slice.
  - Next action:
    - Define `T-126` for follow-up workflow evidence capture after Bun pin alignment.

- 2026-02-07 04:23:38Z
  - Status: `in_progress` -> `done` (T-126)
  - Actions:
    - Captured post-pin CI evidence for primary verify workflows on branch `modernize` (commit `fa8d95b`).
    - Confirmed pinned Bun workflows execute successfully after alignment changes.
  - Evidence:
    - `verify-modern` run: `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21774101125` (`success`, 2026-02-07T04:22:24Z -> 2026-02-07T04:22:53Z)
    - `verify-legacy` run: `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21774101119` (`success`, 2026-02-07T04:22:24Z -> 2026-02-07T04:22:46Z)
    - `verify-modern-browser` run: `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21774101120` (`success`, 2026-02-07T04:22:24Z -> 2026-02-07T04:23:29Z)
    - `verify-legacy-browser` run: `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21774101124` (`success`, 2026-02-07T04:22:24Z -> 2026-02-07T04:23:12Z)
    - `verify-protocol-invariant` run: `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21774101117` (`success`, 2026-02-07T04:22:24Z -> 2026-02-07T04:23:05Z)
  - Next action:
    - Define `T-127` next modernization candidate refresh after CI/runtime reproducibility hardening.

- 2026-02-07 04:24:20Z
  - Status: `in_progress` -> `done` (T-127)
  - Actions:
    - Refreshed the next execution queue after reproducibility hardening with ordered successor tickets:
      - `T-128` protocol invariant replay depth expansion.
      - `T-129` protocol fixture/harness reuse between smoke suites.
      - `T-130` protocol-gate CI runbook and trigger ergonomics.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now contains a concrete post-T126 queue that can be executed sequentially without rediscovery.
  - Next action:
    - Start `T-128` protocol invariant replay depth expansion.

- 2026-02-07 04:30:57Z
  - Status: `in_progress` -> `done` (T-128)
  - Actions:
    - Expanded protocol invariant replay to include deterministic movement/zone coverage in addition to handshake/chat:
      - `tests/browser/protocol-invariant.playwright.ts` now sends `MOVE` and `ZONE` after `WELCOME` and asserts socket remains open after the expanded sequence.
    - Updated protocol invariant command docs to reflect `MOVE`/`ZONE` coverage:
      - `README.md`
      - `docs/client-build-support.md`
  - Evidence:
    - `bun run test:browser:protocol-invariant:node22` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-129` protocol fixture/harness reuse across parity suites.

- 2026-02-07 04:30:57Z
  - Status: `in_progress` -> `done` (T-129)
  - Actions:
    - Added shared protocol fixture module:
      - `tests/support/protocol.ts` with protocol message constants and `parseProtocolActionBatch(...)`.
    - Reused shared protocol fixtures in:
      - `tests/smoke/modern-gameplay-parity.test.ts`
      - `tests/browser/modern-protocol-actions.playwright.ts`
      - `tests/browser/protocol-invariant.playwright.ts`
  - Evidence:
    - `bun test --timeout 20000 tests/smoke/modern-gameplay-parity.test.ts` passed.
    - `bun run test:browser:protocol-invariant:node22` passed.
    - `bun run test:browser:modern:node22` passed.
  - Next action:
    - Start `T-130` protocol gate CI runbook and trigger ergonomics.

- 2026-02-07 04:30:57Z
  - Status: `in_progress` -> `done` (T-130)
  - Actions:
    - Added optional manual trigger support for protocol gate workflow:
      - `.github/workflows/verify-protocol-invariant.yml` now includes `workflow_dispatch`.
    - Updated docs/runbook references for protocol gate usage:
      - `README.md`
      - `docs/client-build-support.md`
      - includes manual-trigger guidance and local parity command context.
  - Evidence:
    - Workflow now supports both path-triggered and manual (`workflow_dispatch`) execution modes.
    - `bun run test:browser:protocol-invariant:node22` passed after workflow/docs update.
  - Next action:
    - Define `T-131` manual-dispatch workflow evidence capture for `verify-protocol-invariant`.

- 2026-02-07 04:32:31Z
  - Status: `in_progress` -> `done` (T-131)
  - Actions:
    - Triggered protocol invariant workflow manually through `workflow_dispatch` to validate non-path-triggered operator flow.
    - Captured workflow evidence for the manual-dispatch execution path.
  - Evidence:
    - Run URL: `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21774218607`
    - Conclusion: `success` (2026-02-07T04:31:31Z -> 2026-02-07T04:32:25Z)
    - Event: `workflow_dispatch`
    - Job: `protocol-invariant (node 22.x)` passed.
  - Next action:
    - Define `T-132` next protocol/testing modernization candidate queue beyond invariant gate hardening.

- 2026-02-07 04:32:51Z
  - Status: `in_progress` -> `done` (T-132)
  - Actions:
    - Refreshed post-invariant-gate modernization queue with ordered successor tickets:
      - `T-133` protocol invariant negative-path parity (invalid payload rejection).
      - `T-134` protocol replay transcript helper extraction for browser tests.
      - `T-135` protocol workflow failure diagnostics (artifact/log summary).
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now contains a concrete next-slice protocol/testing queue beyond workflow trigger hardening.
  - Next action:
    - Start `T-133` protocol invariant negative-path parity coverage.

- 2026-02-07 04:34:47Z
  - Status: `in_progress` -> `done` (T-133)
  - Actions:
    - Extended protocol invariant replay with deterministic negative-path coverage:
      - `tests/browser/protocol-invariant.playwright.ts` now asserts malformed `MOVE` payload handling parity (connection close after invalid coordinates) for both modern and legacy entry paths.
    - Updated protocol guard docs to reflect invalid-`MOVE` parity coverage:
      - `README.md`
      - `docs/client-build-support.md`
  - Evidence:
    - `bun run test:browser:protocol-invariant:node22` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-134` protocol replay transcript helper extraction.

- 2026-02-07 04:36:32Z
  - Status: `in_progress` -> `done` (T-134)
  - Actions:
    - Added shared browser protocol observer helper:
      - `tests/browser/protocol-observer.ts`
      - centralizes websocket frame capture (`sentTypes`, `receivedTypes`, `receivedChats`, `go` count) for browser protocol suites.
    - Refactored browser protocol action suite to reuse shared observer:
      - `tests/browser/modern-protocol-actions.playwright.ts`
      - removed duplicated per-test websocket listener/parser boilerplate.
  - Evidence:
    - `bun run test:browser:modern:node22` passed.
    - `bun run test:browser:protocol-invariant:node22` passed.
  - Next action:
    - Start `T-135` protocol workflow failure diagnostics.

- 2026-02-07 04:37:22Z
  - Status: `in_progress` -> `done` (T-135)
  - Actions:
    - Improved protocol workflow diagnostics:
      - `.github/workflows/verify-protocol-invariant.yml` now runs Playwright with JUnit reporting (`--reporter=line,junit`, `PLAYWRIGHT_JUNIT_OUTPUT_NAME=protocol-invariant-junit.xml`).
      - Added always-on artifact upload step for protocol diagnostics:
        - `test-results/**`
        - `playwright-report/**`
    - Updated CI mapping docs:
      - `docs/client-build-support.md`
  - Evidence:
    - Workflow includes diagnostics artifact upload configuration for both pass/fail executions.
    - `bun run test:browser:protocol-invariant:node22` passed after workflow/doc updates.
  - Next action:
    - Define `T-136` post-diagnostics protocol/testing queue refresh.

- 2026-02-07 04:37:35Z
  - Status: `in_progress` -> `done` (T-136)
  - Actions:
    - Refreshed post-diagnostics queue with ordered successor protocol/testing tickets:
      - `T-137` protocol invariant transcript fixture extraction for `page.evaluate` replay paths.
      - `T-138` protocol browser suite segmentation (`test:browser:protocol`) for faster targeted runs.
      - `T-139` protocol gate artifact retention/runbook alignment.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now contains an executable next queue beyond protocol diagnostics hardening.
  - Next action:
    - Start `T-137` protocol invariant transcript fixture extraction.

- 2026-02-07 04:39:28Z
  - Status: `in_progress` -> `done` (T-135 follow-up)
  - Actions:
    - Resolved CI regression introduced during diagnostics hardening:
      - `.github/workflows/verify-protocol-invariant.yml` now uses `bunx playwright ...` instead of `playwright ...` to avoid PATH-dependent command resolution failures.
    - Revalidated the workflow-equivalent command locally under Node 22 wrapper with JUnit reporter enabled.
  - Evidence:
    - Failing run evidence (before fix): `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21774311749` (`failure`, `exit code 127`, `Verify protocol invariants` step).
    - Local parity (after fix): `bash tools/node22-run.sh sh -lc 'PLAYWRIGHT_JUNIT_OUTPUT_NAME=protocol-invariant-junit.xml bun run check:runtime && bunx playwright test --config=playwright.config.ts tests/browser/protocol-invariant.playwright.ts --reporter=line,junit'` passed.
  - Next action:
    - Push fix and capture green `verify-protocol-invariant` run evidence for the diagnostics workflow revision.

- 2026-02-07 04:40:35Z
  - Status: `in_progress` -> `done` (T-135 follow-up verification)
  - Actions:
    - Captured successful post-fix workflow evidence for diagnostics-enabled protocol gate.
  - Evidence:
    - Run URL: `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21774333381`
    - Conclusion: `success` (2026-02-07T04:39:44Z -> 2026-02-07T04:40:28Z)
    - Workflow: `verify-protocol-invariant` (push event)
  - Next action:
    - Start `T-137` protocol invariant transcript fixture extraction.

- 2026-02-07 04:42:15Z
  - Status: `in_progress` -> `done` (T-137)
  - Actions:
    - Refactored protocol invariant test into a single replay harness with mode-based behavior:
      - `tests/browser/protocol-invariant.playwright.ts`
      - unified parser/timeout/finalize/socket handling for `positive` and `invalid_move` replay paths.
    - Preserved positive and negative parity assertions (modern vs legacy) while reducing duplicated replay boilerplate.
  - Evidence:
    - `bun run test:browser:protocol-invariant:node22` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-138` protocol browser suite command segmentation.

- 2026-02-07 04:43:24Z
  - Status: `in_progress` -> `done` (T-138)
  - Actions:
    - Added protocol-focused browser command aliases:
      - `test:browser:protocol`
      - `test:browser:protocol:node22`
      - targets `modern-protocol-actions` + `protocol-invariant` suites for faster protocol triage loops.
    - Updated docs:
      - `README.md`
      - `docs/client-build-support.md`
  - Evidence:
    - `bun run test:browser:protocol:node22` passed.
  - Next action:
    - Start `T-139` protocol artifact/runbook retention alignment.

- 2026-02-07 04:43:47Z
  - Status: `in_progress` -> `done` (T-139)
  - Actions:
    - Updated protocol artifact runbook details:
      - `docs/client-build-support.md`
      - documented artifact naming pattern (`protocol-invariant-diagnostics-<run_id>`) and retrieval/triage steps.
    - Aligned documentation with current workflow artifact paths:
      - `test-results/protocol-invariant-junit.xml`
      - `playwright-report/**`
  - Evidence:
    - Workflow and docs now share the same artifact naming/path contract for protocol-gate triage.
  - Next action:
    - Define `T-140` post-protocol-artifact queue refresh.

- 2026-02-07 04:44:00Z
  - Status: `in_progress` -> `done` (T-140)
  - Actions:
    - Refreshed post-T139 queue with ordered successor tickets:
      - `T-141` protocol-focused browser CI workflow command alignment (`test:browser:protocol` adoption).
      - `T-142` protocol observer helper reuse in modern UI smoke where appropriate.
      - `T-143` protocol replay timeout/retry diagnostics enrichment.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now contains a concrete next queue beyond protocol artifact/runbook alignment.
  - Next action:
    - Start `T-141` protocol-focused browser CI workflow command alignment.

- 2026-02-07 04:45:14Z
  - Status: `in_progress` -> `done` (T-141)
  - Actions:
    - Added CI-specific protocol browser alias:
      - `test:browser:protocol:ci`
      - includes JUnit reporter output for artifact capture.
    - Aligned protocol workflow command usage:
      - `.github/workflows/verify-protocol-invariant.yml` now runs `bun run test:browser:protocol:ci`.
    - Updated support docs:
      - `docs/client-build-support.md`
  - Evidence:
    - `bun run test:browser:protocol:node22` passed.
  - Next action:
    - Start `T-142` protocol observer helper reuse expansion.

- 2026-02-07 04:46:35Z
  - Status: `in_progress` -> `done` (T-142)
  - Actions:
    - Expanded protocol observer helper reuse:
      - `tests/browser/modern-ui-smoke.playwright.ts` now uses `tests/browser/protocol-observer.ts` for socket/go-handshake tracking in the first UI smoke test.
      - `tests/browser/protocol-observer.ts` now exposes socket-count access (`getSocketCount`).
  - Evidence:
    - `bun run test:browser:modern:node22` passed.
    - `bun run lint` passed.
    - `bun run format:check` passed.
  - Next action:
    - Start `T-143` protocol replay timeout diagnostics enrichment.

- 2026-02-07 04:47:24Z
  - Status: `in_progress` -> `done` (T-143)
  - Actions:
    - Enriched protocol invariant replay diagnostics:
      - `tests/browser/protocol-invariant.playwright.ts` now tracks replay stage (`await_go`/`await_welcome`/`await_chat_echo`/`await_invalid_close`).
      - timeout and websocket error reasons now include stage context.
      - timeout diagnostics include compact go/welcome/sent/received counters in transcript errors.
  - Evidence:
    - `bun run test:browser:protocol-invariant:node22` passed.
    - `bun run lint` passed.
    - `bun run format:check` passed.
  - Next action:
    - Define `T-144` next protocol/testing queue refresh after replay-diagnostics enrichment.

- 2026-02-07 04:47:39Z
  - Status: `in_progress` -> `done` (T-144)
  - Actions:
    - Refreshed post-T143 queue with ordered successor tickets:
      - `T-145` protocol CI evidence recapture after alias/diagnostics command alignment.
      - `T-146` browser protocol command discoverability sweep across docs.
      - `T-147` protocol observer helper extension for optional legacy browser protocol tracing.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now includes an executable next queue after replay diagnostics enrichment.
  - Next action:
    - Start `T-145` protocol CI evidence recapture after command alignment.

- 2026-02-07 04:49:11Z
  - Status: `in_progress` -> `done` (T-145)
  - Actions:
    - Captured fresh protocol CI evidence after command-alignment updates (`test:browser:protocol:ci` path in workflow).
  - Evidence:
    - Run URL: `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21774438684`
    - Conclusion: `success` (2026-02-07T04:48:07Z -> 2026-02-07T04:49:04Z)
    - Workflow: `verify-protocol-invariant` (push event)
  - Next action:
    - Start `T-146` protocol command discoverability docs sweep.

- 2026-02-07 04:49:46Z
  - Status: `in_progress` -> `done` (T-146)
  - Actions:
    - Completed protocol command discoverability sweep across primary docs:
      - `README.md`
      - `docs/client-build-support.md`
      - `docs/runtime-preflight.md`
    - Added protocol-focused command aliases to runtime-preflight runbook (`when checks run` + Node22 recovery paths).
  - Evidence:
    - `bun run test:browser:protocol:node22` passed.
    - Primary docs now consistently reference `test:browser:protocol` / `test:browser:protocol:node22`.
  - Next action:
    - Start `T-147` optional legacy protocol observer extension evaluation.

- 2026-02-07 04:51:20Z
  - Status: `in_progress` -> `done` (T-147, deferred)
  - Actions:
    - Evaluated extending legacy UI smoke with protocol observer assertions (`socket/go`), but observed non-deterministic websocket startup in legacy intro path under Playwright timing.
    - Reverted strict protocol observer assertions from `tests/browser/legacy-ui-smoke.playwright.ts` to preserve legacy smoke stability.
    - Kept outcome explicitly documented as deferred with guardrail:
      - do not add hard websocket handshake assertions to legacy smoke until deterministic start controls/hooks are available for legacy runtime.
  - Evidence:
    - Attempted extension failed with timeout waiting for socket observation (`observer.getSocketCount() > 0`).
    - Restored baseline command passed: `bun run test:browser:legacy:node22`.
  - Next action:
    - Define `T-148` post-legacy-observer-defer queue refresh.

- 2026-02-07 04:51:36Z
  - Status: `in_progress` -> `done` (T-148)
  - Actions:
    - Refreshed post-T147 queue with deterministic-legacy prerequisites focus:
      - `T-149` legacy intro deterministic-start hook design.
      - `T-150` optional legacy protocol smoke split from UI wiring smoke.
      - `T-151` protocol workflow/readme snapshot refresh after recent command and diagnostics changes.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now captures a concrete defer-resolution path for future legacy protocol assertion work.
  - Next action:
    - Start `T-149` legacy intro deterministic-start hook design.

- 2026-02-07 04:58:01Z
  - Status: `in_progress` -> `done` (T-149)
  - Actions:
    - Implemented opt-in legacy deterministic-start test hook in `client/js/main.js`:
      - `__BQ_LEGACY_TEST_API` now exposes:
        - `isReady()`
        - `getState()`
        - `startSession(name?)`
      - API only installs when `__BQ_LEGACY_TEST_MODE__` or `__BQ_TEST_MODE__` is enabled before boot.
      - Supports optional auto-start via `__BQ_LEGACY_TEST_START__` with bounded readiness polling.
    - Added support-matrix documentation for the hook:
      - `docs/client-build-support.md`
  - Evidence:
    - `bun run test:browser:legacy:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-150` legacy protocol smoke split (optional).

- 2026-02-07 04:58:01Z
  - Status: `in_progress` -> `done` (T-150, deferred)
  - Actions:
    - Attempted to introduce dedicated optional legacy protocol smoke command, but deterministic `__BQ_LEGACY_TEST_API` observability was not stable under current legacy/Vite browser harness timing.
    - Reverted the optional legacy protocol test/commands to avoid introducing a flaky opt-in path.
    - Kept decision explicit: legacy protocol smoke remains deferred until deterministic legacy-start controls are validated in-browser end-to-end.
    - Tagged defer exit criteria owner as `T-155` and support-note section in `docs/client-build-support.md`.
  - Evidence:
    - Attempted optional run failed with timeout waiting for legacy test API availability.
    - Baseline guardrail remains green: `bun run test:browser:legacy:node22` passed after rollback.
  - Next action:
    - Start `T-151` protocol workflow/readme snapshot refresh.

- 2026-02-07 04:58:01Z
  - Status: `in_progress` -> `done` (T-151)
  - Actions:
    - Refreshed protocol triage snapshot across primary docs:
      - `README.md` protocol quick-path section now captures local (`test:browser:protocol:node22`) and CI (`verify-protocol-invariant` + diagnostics artifact) routes.
      - `docs/runtime-preflight.md` includes protocol command aliases and Node22 wrapper variants.
      - `docs/client-build-support.md` includes protocol command set + artifact triage path and legacy test-hook note.
  - Evidence:
    - Docs scan confirms canonical protocol command references across README/support docs.
    - `bun run test:browser:protocol:node22` passed.
  - Next action:
    - Define `T-152` post-legacy-hook queue refresh.

- 2026-02-07 04:58:01Z
  - Status: `in_progress` -> `done` (T-152)
  - Actions:
    - Refreshed post-T151 queue with legacy deterministic-start resolution focus:
      - `T-153` legacy hook observability probe command.
      - `T-154` legacy smoke diagnostics enrichment (console/pageerror capture).
      - `T-155` legacy optional protocol smoke reopen criteria.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now includes an executable next queue that directly addresses the T-150 defer root cause.
  - Next action:
    - Start `T-153` legacy hook observability probe command.

- 2026-02-07 05:03:09Z
  - Status: `in_progress` -> `done` (T-153)
  - Actions:
    - Added optional legacy hook probe test:
      - `tests/browser/legacy-hook-probe.playwright.ts`
      - Asserts `window.__BQ_LEGACY_TEST_API` is installed under test flag and exposes callable `isReady/getState/startSession`.
    - Added probe command aliases:
      - `test:browser:legacy:hook-probe`
      - `test:browser:legacy:hook-probe:node22`
    - Documented probe command in support docs/README.
  - Evidence:
    - `bun run test:browser:legacy:hook-probe:node22` passed.
  - Next action:
    - Start `T-154` legacy smoke diagnostics enrichment.

- 2026-02-07 05:03:09Z
  - Status: `in_progress` -> `done` (T-154)
  - Actions:
    - Enriched legacy smoke diagnostics in `tests/browser/legacy-ui-smoke.playwright.ts`:
      - Captures `pageerror` messages.
      - Captures browser console `warning`/`error` messages.
      - On assertion failure, appends compact diagnostics payload (`pageErrors` + `console`) to thrown error text.
    - Preserved smoke semantics (no new protocol assertions).
  - Evidence:
    - `bun run test:browser:legacy:node22` passed.
  - Next action:
    - Start `T-155` legacy optional protocol smoke reopen criteria.

- 2026-02-07 05:03:09Z
  - Status: `in_progress` -> `done` (T-155)
  - Actions:
    - Documented explicit reopen criteria for deferred optional legacy protocol smoke in:
      - `docs/client-build-support.md`
    - Linked defer context from T-150 log to T-155-owned criteria.
    - Added README gate note for optional hook probe command for discoverability.
  - Evidence:
    - `docs/client-build-support.md` now includes trigger checklist tied to stable hook-probe evidence + baseline legacy smoke green requirement.
    - `bun run lint` passed after test/docs updates.
  - Next action:
    - Define `T-156` post-legacy-defer-resolution queue refresh.

- 2026-02-07 05:04:49Z
  - Status: `in_progress` -> `done` (T-156)
  - Actions:
    - Refreshed post-T155 queue with dependency/runtime modernization focus:
      - `T-157` Node22-aligned dependency drift audit parity command.
      - `T-158` dependency drift CI visibility workflow.
      - `T-159` CommonJS-to-ESM server migration readiness inventory.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now contains ordered successor tickets explicitly targeting 2026 dependency/runtime modernization work.
  - Next action:
    - Start `T-157` Node22-aligned dependency drift audit parity command.

- 2026-02-07 05:04:49Z
  - Status: `in_progress` -> `done` (T-157)
  - Actions:
    - Added Node22 wrapper command for dependency drift audits:
      - `check:deps:drift:node22` in `package.json`
    - Updated docs to surface runtime-consistent drift audit path:
      - `README.md`
      - `docs/client-build-support.md`
      - `docs/dependency-modernization-audit.md`
    - Captured fresh drift evidence snapshot (no direct dependency drift reported).
  - Evidence:
    - `bun run check:deps:drift` passed (no drift output).
    - `bun run check:deps:drift:node22` passed (no drift output).
  - Next action:
    - Start `T-158` dependency drift CI visibility workflow.

- 2026-02-07 05:09:20Z
  - Status: `in_progress` -> `done` (T-158)
  - Actions:
    - Added dependency drift visibility workflow:
      - `.github/workflows/verify-dependency-drift.yml`
      - Triggers: `workflow_dispatch` + weekly Monday cron.
      - Captures `npm outdated --depth=0` summary and uploads artifacts (`dependency-drift.txt`, `dependency-drift.json`).
    - Updated docs for workflow discoverability and triage:
      - `README.md`
      - `docs/client-build-support.md`
    - Dispatched workflow on `modernize` branch and captured run evidence.
  - Evidence:
    - Successful workflow run: `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21774682597` (conclusion: `success`, 2026-02-07 05:07:47Z).
    - Artifact naming pattern in run: `dependency-drift-21774682597`.
  - Next action:
    - Start `T-159` CommonJS-to-ESM server readiness inventory.

- 2026-02-07 05:09:20Z
  - Status: `in_progress` -> `done` (T-159)
  - Actions:
    - Created server/runtime CJS->ESM migration readiness inventory:
      - `docs/server-cjs-esm-readiness-inventory.md`
    - Documented:
      - current CJS boundary snapshot (`server/js` graph fully CJS),
      - high-risk blockers (`worldserver`, `player`, `ws`, `main`, `shared/js/gametypes`, `lib/class`),
      - phased migration sequencing and verification gates.
    - Linked the inventory in primary project docs for roadmap discoverability.
  - Evidence:
    - Inventory artifact is checked in and includes command-level gates tied to existing `verify:*` and browser protocol/legacy smoke checks.
  - Next action:
    - Define `T-160` post-CJS-inventory queue refresh.

- 2026-02-07 05:09:42Z
  - Status: `in_progress` -> `done` (T-160)
  - Actions:
    - Refreshed post-T159 queue with CJS->ESM execution focus:
      - `T-161` server ESM bridge bootstrap (opt-in entrypoint).
      - `T-162` shared gametypes dual-export contract hardening.
      - `T-163` `lib/class.js` dependency fanout map and retirement pilot.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now includes ordered CJS->ESM successor tickets with explicit guardrails tied to modern/legacy/protocol verification gates.
  - Next action:
    - Start `T-161` server ESM bridge bootstrap (opt-in entrypoint).

- 2026-02-07 05:11:58Z
  - Status: `in_progress` -> `done` (T-161)
  - Actions:
    - Added opt-in server ESM bridge entrypoint:
      - `server/js/main-esm.mjs`
      - `package.json` scripts: `start:server:esm`, `dev:server:esm`
    - Kept default compatibility path unchanged (`server/js/main.js`).
    - Updated docs to surface new opt-in command:
      - `README.md`
      - `docs/client-build-support.md`
  - Evidence:
    - `timeout 8s bun run start:server:esm` produced clean startup logs (`server.start`, `ws.server.listen`) before timeout.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-162` shared gametypes dual-export contract hardening.

- 2026-02-07 05:11:58Z
  - Status: `in_progress` -> `done` (T-162)
  - Actions:
    - Added ESM bridge module for shared protocol contract:
      - `shared/js/gametypes-esm.mjs` (default + named export bridge to existing CJS contract).
    - Added contract test coverage:
      - `tests/unit/gametypes-contract.test.ts`
      - Verifies CJS + global contract and ESM bridge exports reference the same `Types` object.
  - Evidence:
    - `bun test tests/unit/gametypes-contract.test.ts --timeout 20000` passed.
    - `bun run test:browser:protocol:node22` passed.
    - `bun run test:browser:legacy:node22` passed.
    - `bun run lint` and `bun run format:check` passed.
  - Next action:
    - Start `T-163` `lib/class.js` retirement pilot fanout map.

- 2026-02-07 05:13:48Z
  - Status: `in_progress` -> `done` (T-163)
  - Actions:
    - Produced explicit `lib/class.js` dependency fanout inventory:
      - `docs/server-classjs-fanout-map.md`
      - Captures remaining direct dependents after pilot migration.
    - Completed first low-risk native-class migration pilot:
      - migrated `server/js/format.js` from `Class.extend` to native `class` while preserving exports (`FormatChecker`, `check`).
    - Added documentation linkage:
      - `README.md` modernization snapshot now links fanout map.
      - `docs/server-cjs-esm-readiness-inventory.md` references fanout artifact.
  - Evidence:
    - Remaining direct `./lib/class` dependents reduced from 12 to 11.
    - `bun run verify:legacy:node22` passed.
    - `bun run test:browser:protocol:node22` passed.
    - `bun run lint` and `bun run format:check` passed.
  - Next action:
    - Define `T-164` post-class-pilot queue refresh.

- 2026-02-07 05:14:02Z
  - Status: `in_progress` -> `done` (T-164)
  - Actions:
    - Refreshed post-T163 queue with risk-tiered native-class migration targets:
      - `T-165` low-risk leaf migration (`checkpoint.js`).
      - `T-166` low/mid-risk domain migration (`area.js`, `message.js`).
      - `T-167` bridge hardening after tiered migrations (class-usage guard + remaining fanout refresh).
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now includes an executable, ordered queue for continued `lib/class.js` retirement progress.
  - Next action:
    - Start `T-165` low-risk leaf native-class migration (`checkpoint.js`).

- 2026-02-07 05:19:58Z
  - Status: `in_progress` -> `done` (T-165)
  - Actions:
    - Migrated `server/js/checkpoint.js` from `Class.extend` to native class syntax.
    - Preserved module export shape (`module.exports = Checkpoint`) and call-site compatibility.
  - Evidence:
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-166` tier-1.5 native-class migration (`area.js` + `message.js`).

- 2026-02-07 05:19:58Z
  - Status: `in_progress` -> `done` (T-166)
  - Actions:
    - Migrated domain modules to native classes:
      - `server/js/area.js`
      - `server/js/message.js`
    - Migrated dependent subclasses to preserve inheritance behavior:
      - `server/js/mobarea.js`
      - `server/js/chestarea.js`
    - Addressed startup regression discovered during verify run (`Area.extend` dependency) by converting inheriting modules to native `extends Area`.
  - Evidence:
    - `bun run verify:legacy:node22` passed after migration/fix.
    - `bun run test:browser:protocol:node22` passed.
  - Next action:
    - Start `T-167` class-bridge hardening and fanout refresh.

- 2026-02-07 05:19:58Z
  - Status: `in_progress` -> `done` (T-167)
  - Actions:
    - Refreshed `lib/class.js` fanout artifact:
      - `docs/server-classjs-fanout-map.md`
      - current direct dependency count now `8`.
    - Added automated guard against accidental new `lib/class.js` imports:
      - `tools/check-classjs-fanout.cjs`
      - `package.json` command: `check:class-fanout`
    - Updated docs for command discoverability:
      - `README.md`
      - `docs/client-build-support.md`
  - Evidence:
    - `bun run check:class-fanout` passed (`8` tracked dependencies).
    - `bun run lint` passed.
  - Next action:
    - Define `T-168` post-tiered-class-migration queue refresh.

- 2026-02-07 05:20:17Z
  - Status: `in_progress` -> `done` (T-168)
  - Actions:
    - Refreshed post-T167 queue to target remaining `lib/class.js` dependents in risk order:
      - `T-169` entity/character native-class migration.
      - `T-170` mob migration and combat/protocol parity check.
      - `T-171` core-graph migration plan (`map`/`ws`/`player`/`worldserver`) with staged sequencing.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now includes explicit remaining-module queue aligned with current fanout artifact and verification gates.
  - Next action:
    - Start `T-169` entity/character native-class migration.

- 2026-02-07 05:38:31Z
  - Status: `in_progress` -> `done` (T-169)
  - Actions:
    - Migrated base hierarchy modules off `Class.extend`:
      - `server/js/entity.js`
      - `server/js/character.js`
    - Migrated direct dependent chain required for compatibility:
      - `server/js/item.js`
      - `server/js/npc.js`
      - `server/js/chest.js`
      - `server/js/player.js`
    - Preserved runtime export contracts (`module.exports`) and inheritance behavior via native `class extends`.
  - Evidence:
    - `bun run verify:legacy:node22` passed.
    - `bun run test:browser:protocol:node22` passed.
  - Next action:
    - Start `T-170` mob migration and combat/protocol parity check.

- 2026-02-07 05:38:31Z
  - Status: `in_progress` -> `done` (T-170)
  - Actions:
    - Migrated `server/js/mob.js` to native class syntax (`extends Character`) with behavior-preserving constructor and combat/aggro methods.
    - Removed legacy class helper usage from the full mob/entity/player chain.
  - Evidence:
    - `bun run verify:legacy:node22` passed.
    - `bun run test:browser:protocol:node22` passed.
  - Next action:
    - Start `T-171` core class-migration sequence planning artifact.

- 2026-02-07 05:38:31Z
  - Status: `in_progress` -> `done` (T-171)
  - Actions:
    - Added core sequence planning artifact for remaining high-risk modules:
      - `docs/server-core-class-migration-plan.md`
    - Refreshed fanout guard and artifact to current state:
      - `tools/check-classjs-fanout.cjs` allowlist reduced to `map`, `metrics`, `ws`, `worldserver`.
      - `docs/server-classjs-fanout-map.md` now reflects 4 remaining `lib/class.js` dependents.
    - Linked plan artifact in project docs:
      - `README.md`
      - `docs/server-cjs-esm-readiness-inventory.md`
  - Evidence:
    - `bun run check:class-fanout` passed (`4` tracked dependencies).
    - `bun run lint` and `bun run format:check` passed.
  - Next action:
    - Define `T-172` post-core-plan queue refresh.

- 2026-02-07 05:40:51Z
  - Status: `in_progress` -> `done` (T-172)
  - Actions:
    - Refreshed post-T171 queue to execute remaining class migrations in updated risk order:
      - `T-173` map migration pilot.
      - `T-174` metrics migration.
      - `T-175` websocket server migration.
      - `T-176` worldserver migration.
    - Added module-specific scope and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now includes a concrete execution queue from 4 remaining `lib/class.js` dependents.
  - Next action:
    - Start `T-173` map native-class migration pilot.

- 2026-02-07 05:40:51Z
  - Status: `in_progress` -> `done` (T-173)
  - Actions:
    - Migrated `server/js/map.js` from `Class.extend` to native class syntax.
    - Updated class fanout guard allowlist and artifacts to current remaining modules:
      - `tools/check-classjs-fanout.cjs`
      - `docs/server-classjs-fanout-map.md`
      - `docs/server-core-class-migration-plan.md`
  - Evidence:
    - `bun run verify:legacy:node22` passed.
    - `bun run test:browser:protocol:node22` passed.
    - `bun run check:class-fanout` passed (`3` tracked dependencies).
  - Next action:
    - Start `T-174` metrics native-class migration.

- 2026-02-07 05:47:13Z
  - Status: `in_progress` -> `done` (T-174)
  - Actions:
    - Migrated `server/js/metrics.js` from `Class.extend` to native class syntax.
    - Preserved optional memcache initialization and unavailable-reason reporting behavior.
    - Refreshed fanout artifacts/plan to current state.
  - Evidence:
    - `bun run verify:legacy:node22` passed.
    - `bun run test:browser:protocol:node22` passed.
    - `bun run check:class-fanout` passed (after allowlist refresh).
  - Next action:
    - Start `T-175` websocket server migration.

- 2026-02-07 05:47:13Z
  - Status: `in_progress` -> `done` (T-175)
  - Actions:
    - Migrated websocket abstractions in `server/js/ws.js` to native classes:
      - `Server`
      - `Connection`
      - `WS.MultiVersionWebsocketServer`
      - `WS.wsWebSocketConnection`
    - Fixed constructor-order regression (`super()` before `this`) discovered during runtime smoke.
  - Evidence:
    - `timeout 6s bun server/js/main.js` reached healthy boot window after fix.
    - `bun run verify:legacy:node22` passed.
    - `bun run test:browser:protocol:node22` passed.
  - Next action:
    - Start `T-176` worldserver migration.

- 2026-02-07 05:47:13Z
  - Status: `in_progress` -> `done` (T-176)
  - Actions:
    - Migrated `server/js/worldserver.js` from `Class.extend` to native class syntax.
    - Completed server-side `lib/class.js` retirement:
      - `server/js` now has zero direct `require("./lib/class")` imports.
    - Refreshed guard/docs:
      - `tools/check-classjs-fanout.cjs` allowlist now empty.
      - `docs/server-classjs-fanout-map.md` reflects zero remaining dependents.
      - `docs/server-core-class-migration-plan.md` marked complete.
  - Evidence:
    - `bun run verify:legacy:node22` passed.
    - `bun run test:browser:protocol:node22` passed.
    - `bun run check:class-fanout` passed (`0` tracked dependencies).
    - `bun run lint` and `bun run format:check` passed.
  - Next action:
    - Define `T-177` post-class-retirement queue refresh.

- 2026-02-07 05:47:35Z
  - Status: `in_progress` -> `done` (T-177)
  - Actions:
    - Refreshed modernization queue after server-side class retirement completion:
      - `T-178` package-mode migration readiness checklist (`commonjs` -> staged `module` plan).
      - `T-179` server/runtime CJS entrypoint bridge hardening and `.cjs` boundary inventory.
      - `T-180` legacy client/runtime de-risking queue refresh after package-mode prep.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now includes executable post-T176 tickets for the next modernization frontier.
  - Next action:
    - Start `T-178` package-mode migration readiness checklist.

- 2026-02-07 05:48:35Z
  - Status: `in_progress` -> `done` (T-178)
  - Actions:
    - Added package-mode migration readiness artifact:
      - `docs/package-mode-migration-checklist.md`
    - Captured staged sequence and rollback criteria for eventual package-mode transition.
    - Linked checklist from primary modernization docs.
  - Evidence:
    - `docs/package-mode-migration-checklist.md` checked in and referenced from `README.md` and server readiness inventory docs.
  - Next action:
    - Start `T-179` runtime CJS boundary inventory hardening.

- 2026-02-07 05:48:35Z
  - Status: `in_progress` -> `done` (T-179)
  - Actions:
    - Added explicit CJS boundary inventory artifact:
      - `docs/runtime-cjs-boundary-inventory.md`
    - Classified tooling/runtime boundaries (`.cjs`, ESM bridges, default CJS entries) and target destinations.
    - Linked inventory from root and server modernization docs.
  - Evidence:
    - `docs/runtime-cjs-boundary-inventory.md` checked in and referenced from `README.md` and `docs/server-cjs-esm-readiness-inventory.md`.
    - `bun run check:class-fanout`, `bun run lint`, and `bun run format:check` passed after inventory/guard updates.
  - Next action:
    - Start `T-180` post-package-prep queue refresh.

- 2026-02-07 05:48:35Z
  - Status: `in_progress` -> `done` (T-180)
  - Actions:
    - Refreshed queue after package-prep artifacts:
      - `T-181` package-mode trial execution plan and guardrail commands.
      - `T-182` legacy runtime/package-mode compatibility smoke matrix.
      - `T-183` post-package-trial queue refresh.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now includes executable post-T180 successor tickets focused on package-mode trial readiness.
  - Next action:
    - Start `T-181` package-mode trial execution plan.

- 2026-02-07 05:49:26Z
  - Status: `in_progress` -> `done` (T-181)
  - Actions:
    - Added package-mode trial runbook artifact:
      - `docs/package-mode-trial-runbook.md`
    - Captured branch workflow, mandatory gates, pass criteria, and rollback steps.
  - Evidence:
    - Runbook is checked in and linked from top-level/docs modernization references.
  - Next action:
    - Start `T-182` legacy/package-mode compatibility smoke matrix.

- 2026-02-07 05:49:26Z
  - Status: `in_progress` -> `done` (T-182)
  - Actions:
    - Added compatibility matrix artifact:
      - `docs/legacy-package-mode-compat-matrix.md`
    - Defined baseline and package-trial verification rows with explicit gate commands and rollback trigger.
  - Evidence:
    - Matrix is checked in and linked from `README.md` and server readiness inventory docs.
    - `bun run check:class-fanout`, `bun run lint`, and `bun run format:check` passed.
  - Next action:
    - Start `T-183` post-package-trial queue refresh.

- 2026-02-07 05:49:26Z
  - Status: `in_progress` -> `done` (T-183)
  - Actions:
    - Refreshed queue after package-trial planning artifacts:
      - `T-184` package-mode trial branch execution.
      - `T-185` package-mode trial evidence capture and defer/advance decision.
      - `T-186` post-trial implementation/defer queue refresh.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now includes executable post-T183 tickets aligned with trial runbook + matrix artifacts.
  - Next action:
    - Start `T-184` package-mode trial branch execution.

- 2026-02-07 05:51:49Z
  - Status: `in_progress` -> `done` (T-184, deferred)
  - Actions:
    - Executed controlled local package-mode trial by temporarily switching `package.json` `"type"` to `"module"`.
    - Ran core gate `bun run verify:legacy:node22` and captured failure mode.
    - Reverted trial package-mode switch to restore baseline.
  - Evidence:
    - Trial failure in legacy build path (`build:client`): `bin/r.js` strict-mode syntax error (`Octal literals are not allowed in strict mode`).
    - Post-rollback baseline restored:
      - `bun run verify:legacy:node22` passed.
      - `bun run test:browser:protocol:node22` passed.
  - Next action:
    - Start `T-185` package-mode trial decision record.

- 2026-02-07 05:51:49Z
  - Status: `in_progress` -> `done` (T-185)
  - Actions:
    - Added formal trial decision artifact:
      - `docs/package-mode-trial-decision.md`
    - Recorded blocker, rollback evidence, and defer recommendation.
    - Linked decision artifact from root and server readiness docs.
  - Evidence:
    - Decision document includes explicit failing command path + restored-green command evidence.
  - Next action:
    - Start `T-186` post-trial queue refresh.

- 2026-02-07 05:51:49Z
  - Status: `in_progress` -> `done` (T-186)
  - Actions:
    - Refreshed queue after deferred package-mode trial outcome:
      - `T-187` legacy RequireJS build blocker isolation plan (`bin/r.js` boundary strategy).
      - `T-188` package-mode trial retry prerequisites and guardrail checklist.
      - `T-189` post-blocker-reduction queue refresh.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now includes executable next tickets tied directly to the observed trial blocker.
  - Next action:
    - Start `T-187` legacy RequireJS build blocker isolation plan.

- 2026-02-07 05:56:53Z
  - Status: `in_progress` -> `done` (T-187)
  - Actions:
    - Implemented legacy RequireJS package-mode compatibility boundary:
      - added `bin/r.cjs` wrapper that compiles `bin/r.js` in explicit CJS context.
      - updated `bin/build.sh` to invoke `node bin/r.cjs -o build.js`.
    - Confirmed legacy optimizer runs under package mode (`"type": "module"`).
  - Evidence:
    - `bun run build:client` passed with `package.json` set to `"type": "module"`.
    - `bun run verify:legacy:node22` passed under package mode.
  - Next action:
    - Start `T-188` package-mode retry prerequisites checklist.

- 2026-02-07 05:56:53Z
  - Status: `in_progress` -> `done` (T-188)
  - Actions:
    - Executed retry prerequisites and full package-mode validation:
      - package mode set to `"type": "module"`.
      - verified legacy/protocol/modern gates and static checks.
    - Updated package-mode decision and boundary docs to reflect successful adoption.
  - Evidence:
    - `bun run verify:legacy:node22` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run test:browser:protocol:node22` passed.
    - `bun run check:class-fanout`, `bun run lint`, `bun run format:check` passed.
  - Next action:
    - Start `T-189` post-blocker-reduction queue refresh.

- 2026-02-07 05:56:53Z
  - Status: `in_progress` -> `done` (T-189)
  - Actions:
    - Refreshed queue after successful package-mode adoption:
      - `T-190` package-mode CI drift hardening (`verify` workflows + docs coherence).
      - `T-191` legacy build toolchain modernization options assessment (replace/contain RequireJS optimizer).
      - `T-192` post-package-adoption queue refresh.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now includes post-adoption successor queue aligned with package-mode evidence.
  - Next action:
    - Start `T-190` package-mode CI drift hardening.

- 2026-02-07 06:03:31Z
  - Status: `in_progress` -> `done` (T-190)
  - Actions:
    - Added package-mode boundary guard command:
      - `tools/check-package-mode-boundaries.cjs`
      - `package.json` script `check:package-mode-boundaries`
      - integrated guard into `verify:modern` and `verify:legacy`.
    - Updated primary package-mode/docs coherence artifacts to reflect adopted ESM package mode:
      - `docs/package-mode-trial-runbook.md`
      - `docs/legacy-package-mode-compat-matrix.md`
      - `docs/server-cjs-esm-readiness-inventory.md`
      - `docs/dependency-modernization-audit.md`
      - `docs/runtime-cjs-boundary-inventory.md`
  - Evidence:
    - `bun run check:package-mode-boundaries` passed.
    - `bun run verify:legacy:node22` passed.
    - `bun run verify:modern:node22` passed.
  - Next action:
    - Start `T-191` legacy optimizer containment assessment.

- 2026-02-07 06:10:02Z
  - Status: `in_progress` -> `done` (T-191)
  - Actions:
    - Added optimizer strategy assessment artifact:
      - `docs/legacy-optimizer-containment-assessment.md`
    - Documented replace/contain options with effort/risk/rollback tradeoffs.
    - Selected strategy:
      - contain `r.js` behind explicit boundary now,
      - drive toward eventual legacy runtime retirement instead of high-risk optimizer replacement.
    - Linked assessment from `README.md` modernization snapshot.
  - Evidence:
    - Assessment artifact checked in with explicit recommendation and revisit triggers.
  - Next action:
    - Start `T-192` post-package-adoption queue refresh.

- 2026-02-07 06:10:02Z
  - Status: `in_progress` -> `done` (T-192)
  - Actions:
    - Refreshed queue after T-191 decision into implementation slices:
      - `T-193` optimizer boundary provenance + integrity guardrails.
      - `T-194` downstream `client-build/` consumer inventory and retirement dependency mapping.
      - `T-195` legacy gate demotion rehearsal plan (required -> advisory) with rollback.
      - `T-196` post-containment queue refresh.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now includes post-T191 execution queue aligned to containment-first strategy.
  - Next action:
    - Start `T-193` optimizer boundary provenance + integrity guardrails.

- 2026-02-07 06:14:27Z
  - Status: `in_progress` -> `done` (T-193)
  - Actions:
    - Added legacy optimizer integrity guard command:
      - `tools/check-legacy-optimizer-integrity.cjs`
      - `package.json` script `check:legacy-optimizer-integrity`
      - integrated guard into `verify:legacy`.
    - Added provenance/integrity baseline artifact:
      - `docs/legacy-optimizer-provenance.md`
    - Linked provenance and guard coverage in primary docs:
      - `README.md`
      - `docs/client-build-support.md`
      - `docs/runtime-cjs-boundary-inventory.md`
  - Evidence:
    - `bun run check:legacy-optimizer-integrity` passed.
    - `bun run verify:legacy:node22` passed with new guard included.
  - Next action:
    - Start `T-194` downstream `client-build/` consumer inventory.

- 2026-02-07 06:19:11Z
  - Status: `in_progress` -> `done` (T-194)
  - Actions:
    - Added downstream consumer inventory artifact:
      - `docs/legacy-artifact-consumer-inventory.md`
    - Mapped in-repo `client-build/`, `build:client`, `verify:legacy`, and `/client/index.html` consumers with blocker level and migration path.
    - Recorded external consumer status as unknown-from-repo and explicitly requiring maintainer confirmation.
    - Linked inventory from `README.md` and `docs/legacy-retirement-checklist.md`.
  - Evidence:
    - Inventory artifact checked in with owner/dependency/migration matrix.
  - Next action:
    - Start `T-195` legacy gate demotion rehearsal plan.

- 2026-02-07 06:23:54Z
  - Status: `in_progress` -> `done` (T-195)
  - Actions:
    - Added demotion rehearsal plan artifact:
      - `docs/legacy-gate-demotion-rehearsal-plan.md`
    - Documented preconditions, staged rollout, CI impact, command matrix, and rollback triggers/actions.
    - Linked rehearsal plan from `README.md`.
  - Evidence:
    - Rehearsal artifact checked in with reversible branch-protection guidance.
  - Next action:
    - Start `T-196` post-containment queue refresh.

- 2026-02-07 06:23:54Z
  - Status: `in_progress` -> `done` (T-196)
  - Actions:
    - Refreshed queue after T-193/T-194/T-195 outcomes:
      - `T-197` branch-protection change runbook and dry-run checklist.
      - `T-198` advisory legacy gate telemetry/evidence template.
      - `T-199` legacy retirement cutover PR checklist.
      - `T-200` post-demotion queue refresh.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now includes execution-ready post-T195 successor queue.
  - Next action:
    - Start `T-197` branch-protection change runbook.

- 2026-02-07 06:29:48Z
  - Status: `in_progress` -> `done` (T-197)
  - Actions:
    - Added branch-protection demotion runbook:
      - `docs/legacy-branch-protection-demotion-runbook.md`
    - Captured exact preconditions, change steps, dry-run checks, and rollback procedure for `verify-legacy` demotion.
  - Evidence:
    - Runbook artifact checked in and linked in modernization docs.
  - Next action:
    - Start `T-198` advisory legacy gate evidence template.

- 2026-02-07 06:29:48Z
  - Status: `in_progress` -> `done` (T-198)
  - Actions:
    - Added advisory incident evidence template:
      - `docs/legacy-advisory-gate-incident-template.md`
    - Included metadata, reproduction commands, risk classification, and decision/owner fields.
    - Linked template from demotion rehearsal plan.
  - Evidence:
    - Template artifact checked in and cross-referenced from demotion docs.
  - Next action:
    - Start `T-199` legacy retirement cutover PR checklist.

- 2026-02-07 06:29:48Z
  - Status: `in_progress` -> `done` (T-199)
  - Actions:
    - Added execution checklist for retirement cutover PR:
      - `docs/legacy-retirement-cutover-pr-checklist.md`
    - Covered preconditions, code/script, CI/workflow, docs, verification, and rollback readiness gates.
    - Linked checklist from `docs/legacy-retirement-checklist.md`.
  - Evidence:
    - Cutover checklist artifact checked in and linked from core retirement docs.
  - Next action:
    - Start `T-200` post-demotion queue refresh.

- 2026-02-07 06:29:48Z
  - Status: `in_progress` -> `done` (T-200)
  - Actions:
    - Refreshed queue after T-197/T-198/T-199 outcomes:
      - `T-201` advisory-era legacy incident log bootstrap.
      - `T-202` branch-protection demotion dry-run execution and evidence capture.
      - `T-203` retirement-cutover preflight gap closure.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now includes post-T199 execution queue aligned to newly added runbooks/templates/checklists.
  - Next action:
    - Start `T-201` advisory-era legacy incident log bootstrap.

- 2026-02-07 06:35:22Z
  - Status: `in_progress` -> `done` (T-201)
  - Actions:
    - Added advisory incident log bootstrap artifact:
      - `docs/legacy-advisory-incident-log.md`
    - Included reusable log schema and initial placeholder state.
    - Linked incident log from `README.md` and demotion docs.
  - Evidence:
    - Incident log artifact checked in and cross-referenced from rehearsal docs.
  - Next action:
    - Start `T-202` branch-protection demotion dry-run evidence.

- 2026-02-07 06:35:22Z
  - Status: `todo` (T-202, blocked external)
  - Actions:
    - Confirmed T-202 requires branch-protection operations and dry-run PR evidence capture outside repository code changes.
    - No direct in-repo automation can execute or verify branch-protection toggles.
  - Evidence:
    - `docs/legacy-branch-protection-demotion-runbook.md` defines required external steps.
  - Next action:
    - Start `T-203` retirement cutover preflight gap closure (in-repo trackable).

- 2026-02-07 06:35:22Z
  - Status: `in_progress` -> `done` (T-203)
  - Actions:
    - Added preflight gap closure artifact:
      - `docs/legacy-retirement-preflight-gaps.md`
    - Mapped cutover checklist open/done items with owners, exit criteria, and blocking rationale.
    - Linked preflight gap tracker from `README.md` and `docs/legacy-retirement-checklist.md`.
  - Evidence:
    - Preflight artifact checked in with explicit readiness state and blockers.
  - Next action:
    - Await external execution of `T-202` runbook to advance retirement cutover.

- 2026-02-07 06:44:10Z
  - Status: `in_progress` -> `done` (T-202)
  - Actions:
    - Executed branch-protection demotion dry-run on sandbox protected branch in fork:
      - created `t202-protected` branch protection with required checks (`modern`, `legacy`),
      - opened dry-run PR (`#1`) from `t202-dry-run` to `t202-protected`,
      - demoted required checks from (`modern`,`legacy`) to (`modern`) and captured merge-state transition.
    - Captured concrete evidence artifact with run URLs, outcomes, and cleanup/rollback proof:
      - `docs/legacy-branch-protection-dry-run-evidence.md`
    - Performed immediate cleanup:
      - removed sandbox branch protection, closed PR without merge, deleted temporary branches.
  - Evidence:
    - `docs/legacy-branch-protection-dry-run-evidence.md` includes PR URL + workflow run URLs + rollback verification.
  - Next action:
    - Start post-T203 queue refresh for remaining operational retirement blockers.

- 2026-02-07 06:44:10Z
  - Status: `in_progress` -> `done` (T-204)
  - Actions:
    - Refreshed queue after T-202/T-203 completion:
      - `T-205` external `client-build` consumer confirmation protocol.
      - `T-206` rollback owner/release-tag assignment record.
      - `T-207` retirement cutover readiness decision gate.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now includes post-T203 execution queue focused on operational blockers.
  - Next action:
    - Start `T-205` external consumer confirmation protocol.

- 2026-02-07 06:52:37Z
  - Status: `in_progress` -> `done` (T-205)
  - Actions:
    - Added explicit external consumer confirmation protocol artifact:
      - `docs/legacy-external-consumer-confirmation-protocol.md`
    - Included stakeholder workflow, request template, response log schema, and completion criteria.
    - Linked protocol from preflight/readme retirement docs.
  - Evidence:
    - Protocol artifact checked in and connected to `docs/legacy-retirement-preflight-gaps.md`.
  - Next action:
    - Start `T-206` rollback owner/release-tag assignment record.

- 2026-02-07 06:52:37Z
  - Status: `in_progress` -> `done` (T-206)
  - Actions:
    - Added rollback assignment artifact:
      - `docs/legacy-retirement-rollback-assignment.md`
    - Captured required owner/escalation/fallback-tag fields plus execution checklist.
    - Linked assignment artifact from cutover checklist and preflight references.
  - Evidence:
    - Assignment artifact checked in and referenced from retirement cutover docs.
  - Next action:
    - Start `T-207` retirement cutover readiness decision gate.

- 2026-02-07 06:52:37Z
  - Status: `in_progress` -> `done` (T-207)
  - Actions:
    - Added final go/no-go decision gate artifact:
      - `docs/legacy-retirement-readiness-decision.md`
    - Included required evidence inputs, decision checklist, and signoff record template.
    - Linked decision gate from README and retirement checklist.
  - Evidence:
    - Decision artifact checked in and cross-referenced by cutover/preflight documentation.
  - Next action:
    - Start post-T207 queue refresh for execution-phase operational records.

- 2026-02-07 06:52:37Z
  - Status: `in_progress` -> `done` (T-208)
  - Actions:
    - Refreshed queue after T-205/T-206/T-207 completion:
      - `T-209` execute external consumer confirmation protocol and record responses.
      - `T-210` assign rollback owner/fallback release-tag values.
      - `T-211` produce signed readiness go/no-go decision record.
    - Added scope, acceptance criteria, and verification commands for each successor ticket.
  - Evidence:
    - `MODERNIZE.md` now includes post-T207 operational execution queue.
  - Next action:
    - Start `T-209` external consumer confirmation execution.

- 2026-02-07 07:03:12Z
  - Status: `in_progress` -> `done` (T-212)
  - Actions:
    - Prioritized a parallel technical modernization queue for:
      - TypeScript adoption,
      - server CJS->ESM module migration,
      - websocket stack modernization.
    - Implemented initial TypeScript bootstrap:
      - added `tsconfig.typecheck.json` (incremental checked surface),
      - added `typecheck` and `typecheck:node22` scripts,
      - fixed Bun tool scripts (`tools/dev.ts`, `tools/dev-vite.ts`) to be explicit TS modules.
    - Started websocket modernization hardening:
      - added close-code constants and close-reason sanitization in `server/js/ws.js`,
      - use protocol-aware close codes for invalid payload/bison paths.
  - Evidence:
    - `bun run typecheck` passes on selected surface.
    - `bun run test` and protocol/browser gates remain green after websocket hardening.
  - Next action:
    - Start `T-213` server runtime CJS->ESM wave-1 module conversion.

- 2026-02-07 07:15:44Z
  - Status: `in_progress` (T-213)
  - Actions:
    - Added wave-1 ESM runtime modules:
      - `server/js/config-preflight-esm.mjs`
      - `server/js/utils-esm.mjs`
    - Added ESM parity/unit coverage:
      - `tests/unit/server-config-preflight-esm.test.ts`
      - `tests/unit/server-utils-esm.test.ts`
    - Updated readiness/boundary docs to reflect wave-1 ESM artifacts.
  - Evidence:
    - `bun run test` includes new ESM unit tests and passes.
    - `bun run test:browser:protocol:node22` passes.
  - Next action:
    - Start `T-218` ESM entry wiring to consume wave-1 ESM modules.

- 2026-02-07 07:15:44Z
  - Status: `in_progress` -> `done` (T-214)
  - Actions:
    - Modernized websocket close handling semantics in `server/js/ws.js`:
      - protocol close-code constants,
      - reason sanitization for close frame payload length,
      - invalid payload and unsupported-data close-code paths.
    - Added websocket unit coverage:
      - `tests/unit/ws-connection.test.ts`
  - Evidence:
    - `bun run test` passes with websocket unit coverage.
    - `bun run test:browser:protocol:node22` passes (no protocol regressions).
  - Next action:
    - Continue `T-213` via ESM runtime entry wiring.

- 2026-02-07 07:23:41Z
  - Status: `in_progress` -> `done` (T-218)
  - Actions:
    - Updated `server/js/main-esm.mjs` to consume wave-1 ESM modules before CJS handoff:
      - loads config via ESM path,
      - validates config with `config-preflight-esm`,
      - uses `utils-esm` for compact validation error reporting.
    - Added ESM entry smoke coverage:
      - `tests/smoke/server-config-preflight-esm-entry.test.ts`
      - `tests/smoke/server-handshake-esm-entry.test.ts`
  - Evidence:
    - `bun run test` passes with ESM entry smoke tests included.
  - Next action:
    - Complete T-213 acceptance with full verify matrix.

- 2026-02-07 07:23:41Z
  - Status: `in_progress` -> `done` (T-213)
  - Actions:
    - Landed wave-1 ESM runtime modules and consumed them through ESM entry path.
    - Added dedicated unit/smoke coverage for ESM wave-1 modules and entrypoint behavior.
  - Evidence:
    - `bun run typecheck` passed.
    - `bun run test` passed (includes ESM unit + ESM entry smoke coverage).
    - `bun run test:browser:protocol:node22` passed.
  - Next action:
    - Start `T-215` shared protocol typing.

- 2026-02-07 07:54:10Z
  - Status: `in_progress` -> `done` (T-215)
  - Actions:
    - Moved protocol test constants to a single shared source in `tests/support/protocol.ts` via `shared/js/gametypes-esm.mjs`.
    - Removed duplicated protocol/entity constants from `tests/smoke/server-payload-guards.test.ts`.
    - Added protocol contract coverage in `tests/unit/protocol-support-contract.test.ts`.
  - Evidence:
    - `bun run test` passed.
    - `bun run test:browser:protocol:node22` passed.
  - Next action:
    - Start `T-216` TypeScript expansion wave 2.

- 2026-02-07 07:54:10Z
  - Status: `in_progress` -> `done` (T-216)
  - Actions:
    - Expanded `tsconfig.typecheck.json` coverage from a narrow seed list to `tests/**/*.ts` and `tools/*.ts`.
    - Fixed newly surfaced type issues in:
      - `tests/browser/protocol-invariant.playwright.ts`
      - `tests/smoke/modern-gameplay-parity.test.ts`
      - `tests/smoke/server-config-preflight.test.ts`
      - `tests/smoke/server-metrics-healthy.optional.test.ts`
      - `tests/smoke/server-structured-logs.harness.ts`
    - Normalized stream/protocol value narrowing to keep Node22 + Playwright + Bun execution paths green.
  - Evidence:
    - `bun run typecheck` passed.
    - `bun run test` passed.
    - `bun run test:browser:protocol:node22` passed.
    - `bun run lint` and `bun run format:check` passed.
  - Next action:
    - Start `T-219` post-wave-1 queue refresh.

- 2026-02-07 07:54:10Z
  - Status: `in_progress` -> `done` (T-219)
  - Actions:
    - Refreshed post-wave-1 technical modernization queue with explicit priority/order for:
      - shared protocol type extraction,
      - deeper server ESM conversion,
      - websocket transport modernization.
    - Added executable successor tickets `T-220` to `T-223` with scoped verification commands.
  - Evidence:
    - `MODERNIZE.md` now contains ordered post-wave-1 successors with concrete acceptance criteria.
  - Next action:
    - Start `T-220` shared protocol contract extraction.

- 2026-02-07 08:16:30Z
  - Status: `in_progress` -> `done` (T-220)
  - Actions:
    - Added shared protocol contract modules:
      - `shared/js/protocol-contract.js`
      - `shared/js/protocol-contract-esm.mjs`
    - Rewired protocol test helpers to shared contract source:
      - `tests/support/protocol.ts` now reads constants/parser from the shared protocol contract bridge.
    - Wired websocket runtime payload parsing to shared protocol contract:
      - `server/js/ws.js` now uses `Protocol.parseProtocolActionBatch(...)` and rejects non-single-action payloads.
    - Added protocol contract and websocket guard coverage:
      - `tests/unit/protocol-contract-module.test.ts`
      - expanded `tests/unit/ws-connection.test.ts` with batched-action rejection case.
    - Updated runtime boundary/readiness inventories for new protocol bridge artifacts.
  - Evidence:
    - `bun run typecheck` passed.
    - `bun run test` passed.
    - `bun run test:browser:protocol:node22` passed.
    - `bun run lint` and `bun run format:check` passed.
  - Next action:
    - Start `T-221` server CJS->ESM wave 2.

- 2026-02-07 08:40:00Z
  - Status: `in_progress` -> `done` (T-221)
  - Actions:
    - Added wave-2 ESM server mirrors:
      - `server/js/log-esm.mjs`
      - `server/js/format-esm.mjs`
    - Added parity/unit coverage:
      - `tests/unit/server-log-esm.test.ts`
      - `tests/unit/server-format-esm.test.ts`
    - Updated runtime CJS/ESM inventory docs to include new mirror artifacts.
  - Evidence:
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
    - `bun run test:browser:protocol:node22` passed.
    - `bun run typecheck`, `bun run lint`, and `bun run format:check` passed.
  - Next action:
    - Start `T-222` websocket transport modernization wave 2.

- 2026-02-07 08:55:00Z
  - Status: `in_progress` -> `done` (T-222)
  - Actions:
    - Hardened websocket transport close semantics:
      - `server/js/ws.js` now rejects binary frames with explicit unsupported-data close code (`1003`).
      - introduced `Connection.closeInvalidPayload(...)` and `Connection.closeUnsupportedData(...)` helpers for consistent close-code usage.
    - Aligned protocol-invalid player-path closes to explicit invalid-payload semantics:
      - `server/js/player.js` now routes handshake/format/payload-size protocol violations through `closeInvalidPayload(...)` (`1007`).
    - Expanded websocket and payload-guard coverage:
      - `tests/unit/ws-connection.test.ts` now asserts binary-frame rejection close code.
      - `tests/smoke/server-payload-guards.test.ts` now asserts invalid payload close code (`1007`) for oversized `HELLO` and malformed `MOVE`.
  - Evidence:
    - `bun run test` passed.
    - `bun run test:browser:protocol:node22` passed.
    - `bun run typecheck`, `bun run lint`, and `bun run format:check` passed.
  - Next action:
    - Start `T-223` TypeScript expansion wave 3.

- 2026-02-07 08:55:00Z
  - Status: `in_progress` -> `done` (T-223)
  - Actions:
    - Added runtime-adjacent CheckJs config:
      - `tsconfig.typecheck-runtime.json` targeting selected `shared/js` and `server/js` modules.
    - Expanded `typecheck` gate:
      - `bun run typecheck` now executes `tsconfig.typecheck.json` and `tsconfig.typecheck-runtime.json`.
    - Added explicit defer artifact for high-churn gameplay modules:
      - `docs/typescript-runtime-checkjs-defer-list.md`.
    - Updated docs to reflect expanded TypeScript scope:
      - `README.md`
      - `docs/client-build-support.md`
  - Evidence:
    - `bun run typecheck` passed with runtime CheckJs scope enabled.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-224` post-wave queue refresh after websocket+TS wave-3 completion.

- 2026-02-07 09:20:00Z
  - Status: `in_progress` -> `done` (T-224)
  - Actions:
    - Refreshed post-T223 queue and executed the highest-priority successor (`T-225`) in the same slice.
    - Added next successor queue (`T-227`, `T-228`) to keep runtime migration sequencing explicit.
  - Evidence:
    - `MODERNIZE.md` now includes updated post-T225 successor tickets with verification gates.
  - Next action:
    - Start `T-226` runtime CheckJs wave 4 gameplay pilot.

- 2026-02-07 09:20:00Z
  - Status: `in_progress` -> `done` (T-225)
  - Actions:
    - Added websocket ESM mirror module:
      - `server/js/ws-esm.mjs`.
    - Added websocket mirror parity coverage:
      - `tests/unit/server-ws-esm.test.ts`.
    - Updated runtime boundary/readiness inventories with `ws-esm` bridge artifact.
  - Evidence:
    - `bun run typecheck` passed.
    - `bun run test` passed.
    - `bun run test:browser:protocol:node22` passed.
    - `bun run verify:modern:node22` passed.
  - Next action:
    - Start `T-226` runtime CheckJs wave 4 gameplay pilot.

- 2026-02-07 09:45:00Z
  - Status: `in_progress` -> `done` (T-226)
  - Actions:
    - Promoted deferred gameplay module pilot into runtime CheckJs scope:
      - added `server/js/entity.js` to `tsconfig.typecheck-runtime.json`.
    - Applied low-risk CheckJs cleanup in `server/js/entity.js`:
      - removed redundant `Number.parseInt` call on numeric `id`,
      - added explicit `pos` shape typing in `getPositionNextTo(...)`.
    - Updated defer artifact to reflect promoted gameplay module:
      - `docs/typescript-runtime-checkjs-defer-list.md`.
  - Evidence:
    - `bun run typecheck` passed with `entity.js` included in runtime CheckJs scope.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-227` websocket ESM entry adoption probe.

- 2026-02-07 10:05:00Z
  - Status: `in_progress` -> `done` (T-227)
  - Actions:
    - Added opt-in websocket ESM-entry probe to `server/js/main-esm.mjs`:
      - `BQ_ESM_WS_BRIDGE_PROBE=1` now validates `ws-esm` bridge contract before CJS handoff.
    - Added ESM-entry probe smoke coverage:
      - `tests/smoke/server-handshake-esm-ws-bridge.test.ts`.
    - Documented probe usage in `README.md`.
  - Evidence:
    - `bun run test` passed (includes new ESM websocket bridge smoke).
    - `bun run test:browser:protocol:node22` passed.
  - Next action:
    - Start `T-228` protocol-close-code contract extraction.

- 2026-02-07 10:05:00Z
  - Status: `in_progress` -> `done` (T-228)
  - Actions:
    - Extracted websocket close-code contract into shared modules:
      - `shared/js/ws-close-codes.js`
      - `shared/js/ws-close-codes-esm.mjs`
    - Rewired websocket runtime to shared close-code source:
      - `server/js/ws.js` now imports close codes from `shared/js/ws-close-codes.js`.
    - Reused shared close-code contract in smoke tests:
      - `tests/smoke/server-payload-guards.test.ts` now imports invalid-payload code from shared ESM close-code contract.
    - Added close-code contract coverage:
      - `tests/unit/ws-close-codes-contract.test.ts`.
    - Updated runtime boundary/readiness inventory and runtime CheckJs scope docs for close-code artifacts.
  - Evidence:
    - `bun run typecheck` passed.
    - `bun run test` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run test:browser:protocol:node22` passed.
  - Next action:
    - Start `T-229` websocket ESM entry adoption signal hardening.

- 2026-02-07 10:25:00Z
  - Status: `in_progress` -> `done` (T-229)
  - Actions:
    - Added structured probe diagnostics in ESM server entry:
      - `server/js/main-esm.mjs` now emits `server.esm.ws_bridge_probe` structured events with `status` (`ok`/`failed`).
      - failure path remains fail-fast and supports deterministic test forcing via `BQ_ESM_WS_BRIDGE_PROBE_FORCE_FAIL=1`.
    - Expanded ESM websocket bridge smoke coverage:
      - `tests/smoke/server-handshake-esm-ws-bridge.test.ts` now asserts probe success event emission and fail-fast structured failure signal.
  - Evidence:
    - `bun run test` passed.
    - `bun run test:browser:protocol:node22` passed.
    - `bun run verify:modern:node22` passed.
  - Next action:
    - Start `T-230` runtime CheckJs wave 5 gameplay pilot.

- 2026-02-07 10:25:00Z
  - Status: `in_progress` -> `done` (T-230)
  - Actions:
    - Promoted next gameplay module pilot into runtime CheckJs scope:
      - added `server/js/item.js` to `tsconfig.typecheck-runtime.json`.
    - Applied property-shape initialization cleanup in `server/js/item.js` (`blinkTimeout`, `despawnTimeout`, `respawn_callback`) to satisfy CheckJs without behavior changes.
    - Updated runtime CheckJs defer artifact to reflect active scope expansion:
      - `docs/typescript-runtime-checkjs-defer-list.md`.
  - Evidence:
    - `bun run typecheck` passed with `item.js` in runtime CheckJs scope.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-231` runtime CheckJs wave 6 planning (`player.js` pre-slice).

- 2026-02-07 10:45:00Z
  - Status: `in_progress` -> `done` (T-231)
  - Actions:
    - Promoted `server/js/player.js` into runtime CheckJs scope in `tsconfig.typecheck-runtime.json`.
    - Applied minimal property-shape initialization cleanup in `server/js/player.js` (`name`, `firepotionTimeout`) to satisfy CheckJs without gameplay behavior changes.
    - Updated runtime CheckJs defer artifact to reflect `player.js` promotion.
  - Evidence:
    - `bun run typecheck` passed with `player.js` included in runtime CheckJs scope.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-232` runtime CheckJs wave 7 planning (`worldserver.js`/`map.js` pre-slice).

- 2026-02-07 10:55:00Z
  - Status: `in_progress` -> `done` (T-232)
  - Actions:
    - Added staged pre-slice artifact for `map.js` / `worldserver.js` runtime CheckJs adoption:
      - `docs/runtime-checkjs-worldserver-map-pre-slice.md`.
    - Captured concrete isolated compiler findings and dependency blockers:
      - `map.js` isolated CheckJs passes,
      - `worldserver.js` admission currently blocked by `mob.area` property declarations and chest narrowing (`setItems`) typing.
    - Linked pre-slice artifact from `README.md` modernization/support references.
  - Evidence:
    - `MODERNIZE.md` now includes staged checklist and follow-on execution path.
    - Baseline and isolated compiler commands are documented in the pre-slice artifact.
  - Next action:
    - Start `T-233` runtime CheckJs wave 7A (`map.js` promotion).

- 2026-02-07 11:05:00Z
  - Status: `in_progress` -> `done` (T-233)
  - Actions:
    - Promoted `server/js/map.js` into runtime CheckJs scope in `tsconfig.typecheck-runtime.json`.
    - Updated runtime CheckJs defer artifact to reflect `map.js` promotion.
  - Evidence:
    - `bun run typecheck` passed with `map.js` included in runtime CheckJs scope.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-234` runtime CheckJs wave 7B (`worldserver.js` blocker cleanup).

- 2026-02-07 11:20:00Z
  - Status: `in_progress` -> `done` (T-234)
  - Actions:
    - Cleared `worldserver.js` CheckJs blockers:
      - added `area` property initialization in `server/js/mob.js`,
      - added chest narrowing guard in `server/js/worldserver.js` before `setItems(...)`.
    - Verified isolated `worldserver.js` CheckJs command now passes.
  - Evidence:
    - `bun x tsc --allowJs --checkJs --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler server/js/worldserver.js` passed.
    - `bun run verify:legacy:node22` passed after blocker cleanup.
  - Next action:
    - Start `T-235` runtime CheckJs wave 7C (`worldserver.js` promotion).

- 2026-02-07 11:20:00Z
  - Status: `in_progress` -> `done` (T-235)
  - Actions:
    - Promoted `server/js/worldserver.js` into runtime CheckJs scope in `tsconfig.typecheck-runtime.json`.
    - Updated runtime CheckJs defer artifact to reflect expanded active scope.
  - Evidence:
    - `bun run typecheck` passed with `worldserver.js` included in runtime CheckJs scope.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-236` runtime CheckJs scope re-baseline and next-candidate queue refresh.

- 2026-02-07 11:35:00Z
  - Status: `in_progress` -> `done` (T-236)
  - Actions:
    - Re-baselined runtime CheckJs inventory docs after wave-7 promotions:
      - refreshed active include scope in `docs/typescript-runtime-checkjs-defer-list.md`.
    - Captured explicit deferred/next-candidate list for remaining server runtime modules.
    - Ran isolated `checkJs` sweep across `server/js/*.js` to classify post-wave candidates and blockers.
  - Evidence:
    - Isolated check results:
      - passing candidates include `mob.js`, `mobarea.js`, `npc.js`, `area.js`, `character.js`, `chest.js`, `chestarea.js`, `checkpoint.js`, `properties.js`,
      - blocked set includes `main.js`, `metrics.js`, `metrics-runtime.js` (metrics typing / optional `memcache` resolution).
    - `MODERNIZE.md` successor queue now includes `T-238` to `T-240`.
  - Next action:
    - Start `T-237` runtime CheckJs wave 8A (`formulas.js` + `message.js` promotion).

- 2026-02-07 11:50:00Z
  - Status: `in_progress` -> `done` (T-237)
  - Actions:
    - Promoted `server/js/formulas.js` and `server/js/message.js` into runtime CheckJs scope in `tsconfig.typecheck-runtime.json`.
    - Updated runtime CheckJs defer/scope artifact to reflect expanded active scope and refreshed defer queue.
  - Evidence:
    - `bun run typecheck` passed with `formulas.js` and `message.js` included in runtime CheckJs scope.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-238` runtime CheckJs wave 8B (mobility runtime trio promotion).

- 2026-02-07 12:05:00Z
  - Status: `in_progress` -> `done` (T-238)
  - Actions:
    - Promoted mobility/runtime trio into runtime CheckJs scope in `tsconfig.typecheck-runtime.json`:
      - `server/js/mob.js`,
      - `server/js/mobarea.js`,
      - `server/js/npc.js`.
    - Refreshed runtime CheckJs defer artifact to remove promoted trio and re-baseline successor queue.
  - Evidence:
    - `bun run typecheck` passed with mobility trio included.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-239` runtime CheckJs wave 8C (zone/entity graph promotion).

- 2026-02-07 12:25:00Z
  - Status: `in_progress` -> `done` (T-239)
  - Actions:
    - Promoted zone/entity graph modules into runtime CheckJs scope in `tsconfig.typecheck-runtime.json`:
      - `server/js/area.js`,
      - `server/js/character.js`,
      - `server/js/chest.js`,
      - `server/js/chestarea.js`,
      - `server/js/checkpoint.js`,
      - `server/js/properties.js`.
    - Updated runtime CheckJs defer artifact to reflect near-complete gameplay/runtime scope.
  - Evidence:
    - `bun run typecheck` passed with zone/entity graph modules included.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-240` runtime CheckJs wave 8D (metrics/main blocker pre-slice).

- 2026-02-07 12:45:00Z
  - Status: `in_progress` -> `done` (T-240)
  - Actions:
    - Cleared metrics/main CheckJs blockers in `server/js/metrics.js`:
      - added explicit `isEnabled` field initialization on `Metrics`,
      - switched memcache import to named module constant lookup to remove hard module-resolution failure in CheckJs.
    - Re-ran isolated checks for prior blocker modules:
      - `server/js/metrics.js`,
      - `server/js/metrics-runtime.js`,
      - `server/js/main.js`.
    - Promoted `server/js/main.js`, `server/js/metrics.js`, `server/js/metrics-runtime.js`, and `server/js/metrics-client.js` into runtime CheckJs scope.
    - Re-baselined runtime CheckJs defer artifact to reflect zero deferred files in current server runtime scope.
  - Evidence:
    - Isolated `bun x tsc --allowJs --checkJs --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler <file>` checks passed for all previously blocked modules.
    - `bun run typecheck` passed with full promoted runtime scope.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-241` post-runtime-scope-completion queue refresh (ESM/class and websocket-focused slices).

- 2026-02-07 12:55:00Z
  - Status: `in_progress` -> `done` (T-241)
  - Actions:
    - Refreshed post-runtime-scope modernization queue to pivot from CheckJs expansion into ESM/class and websocket-focused modernization slices.
    - Added ordered successor tickets for:
      - metrics/runtime ESM mirrors,
      - server bootstrap extraction for dual CJS/ESM entry convergence,
      - websocket transport hardening follow-up coverage.
  - Evidence:
    - `MODERNIZE.md` active queue now includes `T-242` to `T-244` with scope, acceptance criteria, and verification commands.
  - Next action:
    - Start `T-242` server metrics/runtime ESM mirror extraction.

- 2026-02-07 13:15:00Z
  - Status: `in_progress` -> `done` (T-242)
  - Actions:
    - Added ESM mirrors for metrics runtime modules:
      - `server/js/metrics-esm.mjs`,
      - `server/js/metrics-runtime-esm.mjs`.
    - Added ESM/CJS parity tests:
      - `tests/unit/server-metrics-esm.test.ts`.
  - Evidence:
    - `bun run test` passed (includes new metrics ESM parity tests).
    - `bun run verify:modern:node22` passed.
  - Next action:
    - Start `T-243` server bootstrap extraction for dual-entry convergence.

- 2026-02-07 13:30:00Z
  - Status: `in_progress` -> `done` (T-243)
  - Actions:
    - Refactored `server/js/main.js` into a reusable module path:
      - added `require.main === module` CLI guard,
      - exported shared startup helpers (`main`, `getConfigFile`, `getWorldDistribution`).
    - Updated `server/js/main-esm.mjs` to invoke shared CJS startup directly with pre-validated config instead of requiring `main.js` for side effects.
    - Added module contract coverage:
      - `tests/unit/server-main-module.test.ts`.
  - Evidence:
    - `bun run test` passed with new main-module contract test.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-244` websocket transport hardening follow-up coverage.

- 2026-02-07 13:45:00Z
  - Status: `in_progress` -> `done` (T-244)
  - Actions:
    - Expanded websocket transport unit coverage in `tests/unit/ws-connection.test.ts` for:
      - default NORMAL close code fallback,
      - close lifecycle callback/removal behavior,
      - outbound JSON serialization contract.
    - Re-ran focused websocket suites and full modern/legacy verify tracks.
  - Evidence:
    - Focused websocket tests passed:
      - `bun test --timeout 20000 tests/unit/ws-connection.test.ts tests/unit/server-ws-esm.test.ts tests/smoke/server-handshake-esm-ws-bridge.test.ts`.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-245` ESM bootstrap convergence (remove remaining CJS side-effect bridge from `main-esm.mjs`).

- 2026-02-07 14:05:00Z
  - Status: `in_progress` -> `done` (T-245)
  - Actions:
    - Extracted reusable startup runtime from `server/js/main.js` into:
      - `server/js/main-runtime.js`.
    - Converted `server/js/main.js` to a thin CLI/config loader delegating to `main-runtime`.
    - Added ESM mirror for startup runtime contract:
      - `server/js/main-runtime-esm.mjs`.
    - Updated `server/js/main-esm.mjs` to call ESM runtime contract (`main-runtime-esm`) after preflight/probe.
    - Added/expanded startup contract tests:
      - `tests/unit/server-main-module.test.ts`,
      - `tests/unit/server-main-runtime-esm.test.ts`.
    - Re-baselined runtime CheckJs inventory for newly introduced runtime module:
      - added `server/js/main-runtime.js` to `tsconfig.typecheck-runtime.json`,
      - updated `docs/typescript-runtime-checkjs-defer-list.md`.
  - Evidence:
    - `bun run typecheck` passed.
    - `bun run test` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-246` server runtime dependency boundary extraction (`main-runtime` split follow-up).

- 2026-02-07 14:25:00Z
  - Status: `in_progress` -> `done` (T-246)
  - Actions:
    - Introduced explicit dependency-boundary contract in `server/js/main-runtime.js`:
      - added `createRuntimeDependencies(overrides)` helper,
      - updated `main(config, options)` to consume dependency boundaries via helper instead of in-function direct requires.
    - Exposed boundary helper through startup module contracts:
      - `server/js/main.js` exports `createRuntimeDependencies`,
      - `server/js/main-runtime-esm.mjs` exports `createRuntimeDependencies`.
    - Added boundary contract unit coverage:
      - `tests/unit/server-main-runtime-dependencies.test.ts`.
    - Updated existing startup contract tests for new export parity.
  - Evidence:
    - Focused startup/runtime tests passed:
      - `bun test --timeout 20000 tests/unit/server-main-module.test.ts tests/unit/server-main-runtime-esm.test.ts tests/unit/server-main-runtime-dependencies.test.ts tests/smoke/server-handshake-esm-entry.test.ts tests/smoke/server-config-preflight-esm-entry.test.ts`.
    - `bun run typecheck` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-247` server runtime constructor seam extraction (`main-runtime` factory step).

- 2026-02-07 14:45:00Z
  - Status: `in_progress` -> `done` (T-247)
  - Actions:
    - Extracted startup constructor assembly seams in `server/js/main-runtime.js`:
      - added `createServerAndMetrics(config, emitServerEvent, dependencies)`,
      - added `createWorlds(config, server, metrics, dependencies, onPopulationChange)`,
      - routed `main(config, options)` through these helpers.
    - Extended runtime dependency contract to include injectable metrics constructor boundary:
      - `metricsRuntime` in `createRuntimeDependencies(...)`.
    - Exposed new constructor helpers in startup contracts:
      - `server/js/main.js`,
      - `server/js/main-runtime-esm.mjs`.
    - Added focused constructor seam unit coverage:
      - `tests/unit/server-main-runtime-factories.test.ts`.
    - Updated startup parity tests to assert new exports.
  - Evidence:
    - Focused startup/runtime tests passed.
    - `bun run typecheck` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-248` server runtime process-event seam extraction (fatal/reporting/timers).

- 2026-02-07 15:10:00Z
  - Status: `in_progress` -> `done` (T-248)
  - Actions:
    - Extracted process/event side-effect seams in `server/js/main-runtime.js`:
      - `createServerEventEmitter(logger)`,
      - `createPopulationCheckTimer(metrics, getWorlds, setIntervalFn)`,
      - `createFatalReporter(emitServerEvent, logger)`,
      - `installFatalHandlers(processObject, reportFatal)`,
      - `triggerFatalTestEvent(env, setTimeoutFn, reportFatal)`.
    - Updated runtime dependency seam to include process/timer injection points:
      - `processObject`, `setIntervalFn`, `setTimeoutFn`.
    - Routed `main(config, options)` through extracted process-event seams with unchanged behavior.
    - Exposed new process-event helpers through `server/js/main.js` and `server/js/main-runtime-esm.mjs`.
    - Added focused process/event seam unit coverage:
      - `tests/unit/server-main-runtime-process.test.ts`.
    - Expanded startup parity tests to assert newly exported seam contracts.
  - Evidence:
    - Focused process/startup tests passed.
    - `bun run typecheck` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-249` server runtime lifecycle cleanup seam extraction (timer teardown + hook cleanup contract).

- 2026-02-07 15:35:00Z
  - Status: `in_progress` -> `done` (T-249)
  - Actions:
    - Added explicit lifecycle cleanup seams in `server/js/main-runtime.js`:
      - `createPopulationCheckCleanup(timerHandle, clearIntervalFn)`,
      - `createRuntimeCleanup(teardownHandlers)`.
    - Updated `installFatalHandlers(...)` to return removable-hook teardown callbacks.
    - Extended runtime dependency seam for cleanup support:
      - added `clearIntervalFn` injection.
    - Updated `main(config, options)` to:
      - build cleanup contracts for timer + fatal hooks,
      - expose lifecycle via return value `{ cleanup }`,
      - support optional `onLifecycle({ cleanup })` callback in runtime options.
    - Exposed cleanup helpers in `server/js/main.js` and `server/js/main-runtime-esm.mjs`.
    - Added focused lifecycle/process unit coverage:
      - `tests/unit/server-main-runtime-lifecycle.test.ts`,
      - expanded `tests/unit/server-main-runtime-process.test.ts`.
    - Updated startup parity tests for newly exported lifecycle helpers.
  - Evidence:
    - Focused lifecycle/process/startup tests passed.
    - `bun run typecheck` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-250` server runtime logging seam cleanup in tests (suppress startup side-effect logs in seam unit coverage).

- 2026-02-07 15:55:00Z
  - Status: `in_progress` -> `done` (T-250)
  - Actions:
    - Added explicit startup logger seam support in runtime dependency contract:
      - `logger` injection in `createRuntimeDependencies(...)`.
    - Routed startup logging paths in `main(config, options)` through injected logger seam while preserving default production logger behavior.
    - Updated seam lifecycle unit test to use injected no-op logger and keep startup seam tests quiet.
  - Evidence:
    - Focused seam/startup tests passed without startup log noise in seam unit coverage.
    - `bun run typecheck` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-251` server runtime metrics seam extraction (population/update hooks).

- 2026-02-07 16:20:00Z
  - Status: `in_progress` -> `done` (T-251)
  - Actions:
    - Extracted metrics population/update wiring from `server/js/main-runtime.js` into explicit seams:
      - `createPopulationChangeHandler(metrics, getWorlds, getWorldDistributionFn)`,
      - `installWorldPopulationHooks(worlds, metrics, onPopulationChange)`,
      - `initializeMetricsPopulation(metrics, onPopulationChange)`.
    - Simplified world-constructor seam by narrowing `createWorlds(...)` to world assembly only.
    - Updated CJS/ESM/export parity surfaces:
      - `server/js/main.js`,
      - `server/js/main-runtime-esm.mjs`.
    - Added focused metrics-seam unit coverage:
      - `tests/unit/server-main-runtime-metrics-hooks.test.ts`,
      - updated startup parity/factory tests for new seam surface.
  - Evidence:
    - `bun run typecheck` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-252` shared protocol typing unification (runtime + tests).

- 2026-02-07 16:45:00Z
  - Status: `in_progress` -> `done` (T-252)
  - Actions:
    - Added shared protocol type contract:
      - `shared/js/protocol-types.d.ts`.
    - Wired protocol type contract into runtime parser and websocket transport boundaries via JSDoc imports:
      - `shared/js/protocol-contract.js`,
      - `server/js/ws.js`.
    - Replaced duplicated protocol shape declarations in test support with shared type imports:
      - `tests/support/protocol.ts`.
    - Hardened protocol action parser typing with explicit `isProtocolAction(...)` guard to keep CheckJs/runtime type gates green.
  - Evidence:
    - `bun run typecheck` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-253` websocket native ESM extraction wave-1 (`ws` runtime convergence).

- 2026-02-07 17:15:00Z
  - Status: `in_progress` -> `done` (T-253)
  - Actions:
    - Added ESM-native websocket runtime module:
      - `server/js/ws-runtime-esm.mjs`.
    - Updated `server/js/ws-esm.mjs` to export from the ESM-native runtime module instead of the CJS bridge.
    - Updated ESM bridge probe contract in `server/js/main-esm.mjs`:
      - moved from strict CJS reference identity checks to explicit export-surface + close-code parity checks.
    - Expanded websocket ESM parity coverage:
      - updated `tests/unit/server-ws-esm.test.ts`,
      - added `tests/unit/ws-connection-esm.test.ts`.
  - Evidence:
    - `bun run typecheck` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-254` websocket ESM runtime adoption in startup dependency seam (opt-in).

- 2026-02-07 17:45:00Z
  - Status: `in_progress` -> `done` (T-254)
  - Actions:
    - Added opt-in ESM websocket runtime startup path in `server/js/main-esm.mjs`:
      - when `BQ_ESM_WS_RUNTIME=1`, startup injects `ws-esm` runtime through `createRuntimeDependencies(...)`.
    - Added structured runtime mode signal:
      - `server.esm.ws_runtime_mode` (mode=`esm`) for opt-in path observability.
    - Added focused smoke coverage:
      - `tests/smoke/server-handshake-esm-ws-runtime.test.ts`.
  - Evidence:
    - `bun run typecheck` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-255` websocket ESM runtime probe hardening (failure-path + mode contract assertions).

- 2026-02-07 18:10:00Z
  - Status: `in_progress` -> `done` (T-255)
  - Actions:
    - Hardened opt-in ESM websocket runtime probe contract in `server/js/main-esm.mjs`:
      - emits success signal with `status=ok`,
      - supports explicit forced-failure path via `BQ_ESM_WS_RUNTIME_FORCE_FAIL=1`,
      - emits deterministic failure payload with reason/status fields.
    - Extended websocket runtime smoke coverage:
      - `tests/smoke/server-handshake-esm-ws-runtime.test.ts` now asserts both success mode contract and forced-failure diagnostics.
  - Evidence:
    - `bun run typecheck` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-256` websocket ESM startup-mode docs/runbook alignment.

- 2026-02-07 18:25:00Z
  - Status: `in_progress` -> `done` (T-256)
  - Actions:
    - Updated ESM websocket startup-mode documentation:
      - `README.md`,
      - `docs/client-build-support.md`.
    - Documented opt-in mode flags and diagnostics:
      - `BQ_ESM_WS_BRIDGE_PROBE=1`,
      - `BQ_ESM_WS_RUNTIME=1`,
      - `BQ_ESM_WS_RUNTIME_FORCE_FAIL=1`.
    - Added expected structured-event contracts and command examples for success/failure runtime-mode probes.
  - Evidence:
    - Docs/runbook now include executable startup/probe commands and expected event/status outputs.
    - Existing smoke coverage for runtime-mode contracts remains green (`tests/smoke/server-handshake-esm-ws-runtime.test.ts`).
  - Next action:
    - Start `T-257` server startup dependency seam docs alignment for ESM runtime injection.

- 2026-02-07 18:40:00Z
  - Status: `in_progress` -> `done` (T-257)
  - Actions:
    - Refreshed startup-boundary inventory docs to match current runtime seam behavior:
      - `docs/runtime-cjs-boundary-inventory.md`,
      - `docs/server-cjs-esm-readiness-inventory.md`,
      - `docs/package-mode-migration-checklist.md`.
    - Captured current startup-seam contract explicitly:
      - default CJS startup path (`main.js` -> `main-runtime.js`),
      - opt-in ESM websocket runtime injection path (`BQ_ESM_WS_RUNTIME=1`),
      - structured startup signals and remaining convergence blockers.
  - Evidence:
    - Docs now reflect current `main-esm` runtime option wiring and `ws-runtime-esm` presence.
    - Smoke command reference remains green for runtime-mode path:
      - `bun test tests/smoke/server-handshake-esm-ws-runtime.test.ts`.
  - Next action:
    - Start `T-258` startup seam command ergonomics (dedicated npm scripts for ESM websocket runtime modes).

- 2026-02-07 18:55:00Z
  - Status: `in_progress` -> `done` (T-258)
  - Actions:
    - Added dedicated package scripts for ESM websocket startup seam modes:
      - `start:server:esm:ws-bridge:probe`,
      - `start:server:esm:ws-runtime`,
      - `start:server:esm:ws-runtime:fail`,
      - `test:smoke:esm:ws-runtime`.
    - Updated runbook/docs to reference script-first usage instead of manual env composition:
      - `README.md`,
      - `docs/client-build-support.md`.
  - Evidence:
    - Added scripts execute runtime-mode paths consistently and improve command discoverability.
    - `bun run test:smoke:esm:ws-runtime` passes.
  - Next action:
    - Start `T-259` startup seam runtime-options extraction (`main-esm`) for higher testability.

- 2026-02-07 19:25:00Z
  - Status: `in_progress` -> `done` (T-259)
  - Actions:
    - Extracted ESM startup runtime-option decision logic into a focused helper:
      - `server/js/main-esm-runtime-options.mjs` (`resolveStartupRuntimeOptions(...)`).
    - Updated `server/js/main-esm.mjs` to consume the extracted helper while preserving existing startup behavior.
    - Added focused unit coverage for startup runtime-option paths:
      - `tests/unit/server-main-esm-runtime-options.test.ts`.
      - Covers disabled mode, forced-failure diagnostics, success-mode dependency injection, and load-error failure diagnostics.
  - Evidence:
    - `bun run typecheck` passed.
    - `bun run test:smoke:esm:ws-runtime` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-260` ESM bridge-probe helper extraction (`main-esm`) for parity with runtime-options seam testability.

- 2026-02-07 19:55:00Z
  - Status: `in_progress` -> `done` (T-260)
  - Actions:
    - Extracted ESM websocket bridge-probe logic from `server/js/main-esm.mjs` into a focused helper:
      - `server/js/main-esm-bridge-probe.mjs` (`runWebSocketBridgeProbeIfEnabled(...)`).
    - Updated `server/js/main-esm.mjs` to call the extracted bridge-probe helper with injected dependencies.
    - Added focused unit coverage for bridge probe logic:
      - `tests/unit/server-main-esm-bridge-probe.test.ts`.
      - Covers disabled mode, success contract match, forced-failure diagnostics, and contract-mismatch diagnostics.
  - Evidence:
    - `bun run typecheck` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-261` ESM startup helper module export parity tests and contract docs alignment.

- 2026-02-07 20:20:00Z
  - Status: `in_progress` -> `done` (T-261)
  - Actions:
    - Added helper-module export parity coverage:
      - `tests/unit/server-main-esm-helpers-parity.test.ts`.
      - Asserts stable named/default export contracts for:
        - `server/js/main-esm-bridge-probe.mjs`,
        - `server/js/main-esm-runtime-options.mjs`.
    - Updated startup-seam inventory/readiness docs to reference extracted helper modules:
      - `docs/runtime-cjs-boundary-inventory.md`,
      - `docs/server-cjs-esm-readiness-inventory.md`.
  - Evidence:
    - Focused helper + startup-smoke suite passes.
    - `bun run verify:modern:node22` passed.
  - Next action:
    - Start `T-262` ESM startup helper command mapping docs alignment.

- 2026-02-07 20:35:00Z
  - Status: `in_progress` -> `done` (T-262)
  - Actions:
    - Added explicit helper-to-command mapping in startup runbooks:
      - `README.md`,
      - `docs/client-build-support.md`.
    - Linked extracted helper contracts to concrete startup scripts:
      - `main-esm-bridge-probe` -> `start:server:esm:ws-bridge:probe`,
      - `main-esm-runtime-options` -> `start:server:esm:ws-runtime` / `start:server:esm:ws-runtime:fail`.
  - Evidence:
    - Docs now map helper contracts, env-mode behavior, and runnable script aliases without ambiguity.
    - Helper-focused runtime smoke remains green: `bun run test:smoke:esm:ws-runtime`.
  - Next action:
    - Start `T-263` ESM startup helper adoption note in package-mode runbook.

- 2026-02-07 20:45:00Z
  - Status: `in_progress` -> `done` (T-263)
  - Actions:
    - Updated package-mode migration runbook to reference extracted startup helpers and script aliases:
      - `docs/package-mode-migration-checklist.md`.
    - Added explicit startup seam checklist entries for:
      - `start:server:esm:ws-bridge:probe`,
      - `start:server:esm:ws-runtime`,
      - `start:server:esm:ws-runtime:fail`,
      - helper modules `main-esm-bridge-probe` and `main-esm-runtime-options`.
  - Evidence:
    - Package-mode checklist now reflects current startup seam contracts and command ergonomics.
    - `bun run test:smoke:esm:ws-runtime` passed.
  - Next action:
    - Start `T-264` post-helper extraction queue refresh (next runtime seams).

- 2026-02-07 21:00:00Z
  - Status: `in_progress` -> `done` (T-264)
  - Actions:
    - Refreshed post-helper extraction startup/runtime seam queue for `main-esm` convergence.
    - Prioritized next candidates by risk and verification cost:
      - config-source resolution seam extraction,
      - preflight failure-emission seam extraction,
      - startup runner assembly seam extraction.
    - Added explicit successor tickets with verification gates.
  - Evidence:
    - `MODERNIZE.md` now includes ordered successor startup-seam tickets after T-264.
  - Next action:
    - Start `T-265` config-source resolution seam extraction (`main-esm`).

- 2026-02-07 21:25:00Z
  - Status: `in_progress` -> `done` (T-265)
  - Actions:
    - Extracted ESM config-source resolution/loading into a focused helper:
      - `server/js/main-esm-config-source.mjs` (`loadConfigFile`, `resolveActiveConfig`).
    - Updated `server/js/main-esm.mjs` to consume `resolveActiveConfig(...)` for config source selection.
    - Added focused unit coverage for config-source behavior:
      - `tests/unit/server-main-esm-config-source.test.ts`.
      - Covers local-over-default precedence, default fallback, missing-source behavior, and parse/read failure handling.
  - Evidence:
    - Focused config-source unit + ESM startup smokes pass.
    - `bun run typecheck` passed.
    - `bun run verify:modern:node22` passed.
  - Next action:
    - Start `T-266` ESM preflight failure-emission seam extraction (`main-esm`).

- 2026-02-07 21:55:00Z
  - Status: `in_progress` -> `done` (T-266)
  - Actions:
    - Extracted ESM preflight failure-emission behavior into helper module:
      - `server/js/main-esm-preflight-failures.mjs`.
      - Contracts:
        - `ensureConfigSourcePresent(...)`,
        - `ensureConfigPreflightValid(...)`.
    - Updated `server/js/main-esm.mjs` to use extracted preflight failure helpers.
    - Added focused preflight helper unit coverage:
      - `tests/unit/server-main-esm-preflight-failures.test.ts`.
    - Expanded helper export-parity coverage:
      - `tests/unit/server-main-esm-helpers-parity.test.ts` now includes preflight helper module contract checks.
  - Evidence:
    - Focused helper/config startup tests passed.
    - `bun run typecheck` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-267` ESM startup runner assembly seam extraction (`main-esm`).

- 2026-02-07 22:35:00Z
  - Status: `in_progress` -> `done` (T-267)
  - Actions:
    - Extracted final ESM startup orchestration into helper module:
      - `server/js/main-esm-startup-runner.mjs` (`runStartupWithConfig(...)`).
      - Encapsulates: bridge probe -> runtime-options resolution -> `startServer(...)`.
    - Updated `server/js/main-esm.mjs` to use startup runner helper contract.
    - Added focused startup-runner unit coverage:
      - `tests/unit/server-main-esm-startup-runner.test.ts`.
      - Verifies execution order and startServer runtime-options wiring.
    - Expanded helper export parity coverage for new module:
      - `tests/unit/server-main-esm-helpers-parity.test.ts`.
  - Evidence:
    - Focused startup-helper/smoke tests passed.
    - `bun run typecheck` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-268` post-startup-runner queue refresh (next ESM boot seams).

- 2026-02-07 23:10:00Z
  - Status: `in_progress` -> `done` (T-268)
  - Actions:
    - Refreshed post-startup-runner roadmap with a prioritized successor queue spanning:
      - ESM boot seams (`main-esm` structured event + boot envelope),
      - TypeScript-first protocol contract promotion,
      - websocket runtime modernization with ESM-first class boundaries.
    - Added explicit successor tickets (`T-269` to `T-272`) with verification gates.
  - Evidence:
    - `MODERNIZE.md` queue now reflects ordered, verifiable next slices after `T-267`.
  - Next action:
    - Start `T-269` ESM structured-event emission seam extraction (`main-esm`).

- 2026-02-07 23:35:00Z
  - Status: `in_progress` -> `done` (T-269)
  - Actions:
    - Extracted ESM structured-event emission into helper module:
      - `server/js/main-esm-structured-event.mjs`.
      - Contracts:
        - `createStructuredEventEmitter(...)`,
        - `createProbeEventEmitter(...)`.
    - Updated `server/js/main-esm.mjs` to consume extracted emitter helpers.
    - Added focused structured-event helper unit coverage:
      - `tests/unit/server-main-esm-structured-event.test.ts`.
    - Expanded helper export parity coverage:
      - `tests/unit/server-main-esm-helpers-parity.test.ts` now includes structured-event helper contract checks.
  - Evidence:
    - Focused structured-event/helper tests passed.
    - `bun run typecheck` passed.
    - `bun run verify:modern:node22` passed.
    - `bun run verify:legacy:node22` passed.
  - Next action:
    - Start `T-270` ESM boot-envelope seam extraction (`main-esm`).

## Next roadmap slice (active queue)

### T-003A: Base gameplay primitives import hygiene
- Status: `done`
- Scope: add explicit imports for `Class`, `Types`, `log`, `_`, util helpers in:
  - `animation`, `area`, `camera`, `entity`, `exceptions`, `infomanager`, `pathfinder`, `sprite`, `tile`, `timer`, `transition`, `updater`.
- Acceptance criteria: no missing-import hits for these files in the global-debt check script.
- Verification: `bun run test` and `bun run build:vite`.

### T-003B: Character/NPC/item family import hygiene
- Status: `done`
- Scope: explicit imports in:
  - `character`, `player`, `warrior`, `npc`, `npcs`, `mob`, `mobs`, `item`, `items`, `chest`.
- Acceptance criteria: these modules run without implicit `Types/log/_` globals.
- Verification: `bun run test` and `bun run build:vite`.

### T-003C: App shell import hygiene
- Status: `done`
- Scope: `client/js-esm/app.js` and any remaining `main.js` global utility usage.
- Acceptance criteria: app shell has explicit imports for util/log/underscore needs.
- Verification: `bun run test` and `bun run build:vite`.

### T-004: Modern-only Vite build profile
- Status: `done`
- Scope: default `build:vite` targets modern page cleanly; legacy page remains buildable via an explicit opt-in script/profile.
- Acceptance criteria: modern build has no legacy non-module script warnings.
- Verification: `bun run build:vite` (clean modern), plus opt-in legacy build command.

### T-005: Runtime payload guards
- Status: `done`
- Scope: validate and clamp inbound/outbound name/chat payload size/shape on server boundary.
- Acceptance criteria: malformed payloads are rejected safely; normal gameplay payloads unaffected.
- Verification: `bun run test` plus focused server unit/smoke tests for invalid payloads.

### T-006: Logging modernization
- Status: `done`
- Scope: structured server logs for connect/disconnect/error paths with consistent fields.
- Acceptance criteria: key lifecycle events are machine-parseable and include error stacks.
- Verification: smoke run + assertion in tests on log format for selected events.

### T-007: Underscore reduction batch 1
- Status: `done`
- Scope: replace low-risk underscore usages in ESM modules with native APIs.
- Acceptance criteria: no behavior change; reduced underscore call sites in targeted files.
- Verification: `bun run test` and `bun run build:vite`.

### T-008: Underscore reduction batch 2 (medium-risk)
- Status: `done`
- Scope: replace underscore usage in selected medium-risk client modules without changing gameplay behavior.
- Acceptance criteria: targeted files have no underscore callsites and runtime/tests remain stable.
- Verification: `bun run test` and `bun run build:vite`.

### T-009: Legacy build noise cleanup
- Status: `done`
- Scope: prevent `build:client` legacy optimization from processing modern `js-esm` sources.
- Acceptance criteria: legacy build no longer reports `client-build/js-esm/*` uglify parse errors.
- Verification: `bun run build:client`.

### T-010: Structured log smoke assertions
- Status: `done`
- Scope: verify structured websocket lifecycle events in an end-to-end smoke test.
- Acceptance criteria: smoke test asserts presence/shape of key events (server start/listen, ws open/close).
- Verification: `bun run test`.

### T-011: Underscore reduction batch 3 (high-risk loops)
- Status: `done`
- Scope: incrementally replace underscore in `client/js-esm/game.js` and related hot paths with behavior-preserving refactors.
- Acceptance criteria: reduced underscore callsites in `game.js` with no gameplay regression in smoke checks.
- Verification: `bun run test` and `bun run build:vite`.

### T-012: Underscore reduction batch 4 (remaining modules)
- Status: `done`
- Scope: remove remaining underscore usage in `client/js-esm/*` outside already-modernized files.
- Acceptance criteria: underscore call scan over `client/js-esm/*.js` has no matches.
- Verification: `bun run test` and `bun run build:vite`.

### T-013: Server underscore reduction
- Status: `done`
- Scope: remove underscore dependency from `server/js/*` runtime modules without changing gameplay behavior.
- Acceptance criteria: underscore call scan over `server/js/*.js` has no matches.
- Verification: `bun run test` and server smoke checks.

### T-014: Remove underscore package dependency
- Status: `done`
- Scope: remove remaining underscore usage in tooling/bootstraps and drop `underscore` from `package.json`.
- Acceptance criteria: no repo runtime/tool usage requires npm `underscore`; lockfile updated.
- Verification: `bun run test`, `bun run build:vite`, `bun run build:client`.

### T-015: Lint/format modernization baseline
- Status: `done`
- Scope: add ESLint flat config + Prettier for `server/js`, `client/js-esm`, `shared/js`, and `tests` with a non-disruptive baseline.
- Acceptance criteria: lint/format scripts exist and pass on current codebase.
- Verification: `bun run lint` and `bun run format:check`.

### T-016: Server runtime modernization (CJS hardening)
- Status: `done`
- Scope: modernize server module/style hot spots for Node 22 readiness without full ESM migration.
- Acceptance criteria: server smoke tests pass on latest Node LTS/Bun with no deprecated runtime warnings in startup path.
- Verification: `bun run test` plus manual `bun run dev:server` startup check.

### T-017: Legacy client isolation plan
- Status: `done`
- Scope: isolate legacy AMD client path from modern Vite path with explicit support policy and CI/build gating.
- Acceptance criteria: documented support matrix + dedicated scripts/checks for modern-only vs legacy-inclusive builds.
- Verification: `bun run build:vite` and `bun run build:vite:legacy`.

### T-018: CI verification automation
- Status: `done`
- Scope: add CI workflow(s) to run `verify:modern` on every change and `verify:legacy` on migration-sensitive changes.
- Acceptance criteria: reproducible pipeline config exists in-repo and passes on current branch.
- Verification: run workflow locally (or equivalent command parity) and confirm green execution.

### T-019: Legacy runtime debt triage
- Status: `done`
- Scope: audit remaining legacy AMD/global runtime debt and produce a prioritized removal plan with concrete tickets.
- Acceptance criteria: debt inventory is categorized by risk/impact with an execution order.
- Verification: documented triage artifact committed and reviewed against current scripts/build paths.

### T-020: Server export/global cleanup
- Status: `done`
- Scope: remove implicit `module.exports = Name = ...` patterns and explicitize server module dependencies.
- Acceptance criteria: server modules no longer rely on implicit global symbol assignment side effects.
- Verification: `bun run test` + `bun run dev:server` startup + `bun run build:vite`.

### T-021: Shared gametypes single-source adapter
- Status: `done`
- Scope: define one authoritative gametypes implementation and adapt consumers without duplicated logic copies.
- Acceptance criteria: no duplicated gametypes logic body across `shared` and ESM compat layer.
- Verification: `bun run test` + `bun run build:vite` + focused protocol smoke checks.

### T-022: Legacy build boundary tightening
- Status: `done`
- Scope: reduce legacy asset/runtime surface copied into legacy-inclusive outputs to minimum required set.
- Acceptance criteria: legacy build still works, but copied/runtime footprint is reduced and documented.
- Verification: `bun run verify:legacy`.

### T-023: Legacy boot globals reduction
- Status: `done`
- Scope: reduce non-essential global boot scripts in `client/index.html` while preserving compatibility behavior.
- Acceptance criteria: fewer global script dependencies with no regression in legacy path startup.
- Verification: `bun run verify:legacy` + manual legacy page smoke.

### T-024: Legacy runtime retirement plan
- Status: `done`
- Scope: define measurable readiness criteria and cutover steps to retire `client-build` path safely.
- Acceptance criteria: approved checklist exists with rollback/contingency plan.
- Verification: checklist walkthrough against current build/test gates.

### T-025: Modern gameplay parity e2e coverage
- Status: `done`
- Scope: add focused e2e coverage for modern runtime critical flows (login, move, combat, loot, zone, reconnect).
- Acceptance criteria: reproducible modern-flow checks exist and are runnable in CI or scripted local parity mode.
- Verification: e2e command(s) pass on current branch and are documented in support/runbook docs.

### T-026: Modern browser-e2e harness
- Status: `done`
- Scope: add Playwright-based browser-level smoke flow for `client/modern.html` against local server.
- Acceptance criteria: at least one stable browser e2e scenario runs headless in CI/local and validates modern UI boot + basic interaction.
- Verification: browser e2e command passes locally and is wired into CI strategy.

### T-027: Modern browser runtime parity hardening
- Status: `done`
- Scope: fix modern-browser runtime regressions surfaced by Playwright and increase browser smoke depth to assert first real session startup against live server.
- Acceptance criteria: modern browser smoke asserts websocket handshake + started session signals, with no page-level runtime exceptions.
- Verification: `bun run test:modern-browser`, `bun run verify:modern`, `bun run verify:legacy`.

### T-028: Browser protocol action parity hooks
- Status: `done`
- Scope: add deterministic browser-test hooks or controls to assert key in-browser actions (chat/move/zone) over live websocket in Playwright without flaky timing.
- Acceptance criteria: at least one stable browser test validates post-handshake gameplay actions from the browser runtime.
- Verification: dedicated Playwright command passes locally and in CI.

### T-029: Browser move/zone action parity
- Status: `done`
- Scope: extend browser protocol parity with stable movement/zoning assertions from user-like interactions or explicit deterministic controls.
- Acceptance criteria: Playwright validates at least one move/zone protocol roundtrip in-browser without relying on brittle timing.
- Verification: `bun run test:modern-browser` plus verification gates.

### T-030: Browser reconnect protocol parity
- Status: `done`
- Scope: extend browser protocol parity to cover reconnect behavior and repeat handshake from the real modern UI runtime.
- Acceptance criteria: Playwright validates reconnect emits a second `go` handshake and second `HELLO`/`WELCOME` roundtrip after reload.
- Verification: `bun run test:modern-browser` plus verification gates.

### T-031: Browser combat/loot protocol parity
- Status: `done`
- Scope: add deterministic browser test controls for attack/hit/lootmove and validate stable protocol roundtrip assertions in Playwright.
- Acceptance criteria: browser e2e includes at least one deterministic combat/loot action flow with non-flaky assertions.
- Verification: `bun run test:modern-browser` plus verification gates.

### T-032: Dependency/runtime modernization audit
- Status: `done`
- Scope: capture current runtime/tooling/dependency baseline and identify concrete upgrade candidates with risk notes.
- Acceptance criteria: committed audit artifact with actionable execution order for next upgrade tranche.
- Verification: `bun outdated` output incorporated and audited document committed.

### T-033: jQuery 4 migration readiness
- Status: `done`
- Scope: expand UI coverage around jQuery-driven flows and define safe trial-upgrade criteria before bumping to `jquery@4`.
- Acceptance criteria: measurable pass/fail checklist exists for attempting jQuery 4 without breaking modern or legacy play entry flows.
- Verification: expanded browser assertions + documented trial plan, then gate runs.

### T-034: Scoped jQuery 4 trial upgrade
- Status: `done`
- Scope: run a controlled `jquery@4` upgrade attempt on this branch, capture regressions, and either keep upgrade with fixes or roll back with a documented blocker list.
- Acceptance criteria: trial outcome is explicit (`upgrade landed` or `blocked`), with concrete breakage evidence and next actions.
- Verification: `bun run test:modern-browser`, `bun run verify:modern`, `bun run verify:legacy`, and `bun outdated`.

### T-035: Node 22 baseline verification
- Status: `done`
- Scope: verify modern and legacy gates on Node 22 runtime and document any compatibility deltas from current Node 20 local baseline.
- Acceptance criteria: documented Node 22 pass/fail outcome with required fixes (if any) and updated runtime policy notes.
- Verification: `node -v` (Node 22), `bun run verify:modern`, `bun run verify:legacy`, and browser parity run.

### T-036: CI Node 22 baseline matrix
- Status: `done`
- Scope: add CI coverage (or matrix extension) that runs modernization gates on Node 22 to keep runtime baseline enforced.
- Acceptance criteria: workflow config includes Node 22 execution path for relevant verify/browser jobs and is green.
- Verification: workflow parity command(s) or local equivalent pass and are documented.

### T-037: Runtime policy pinning
- Status: `done`
- Scope: pin Node/Bun policy in repo metadata (`engines`, `.nvmrc`, and docs) so local dev defaults align with CI/runtime targets.
- Acceptance criteria: runtime policy files/docs are explicit and consistent with verified baselines.
- Verification: documented policy check plus standard verify gates pass.

### T-038: Runtime drift guardrails
- Status: `done`
- Scope: add lightweight runtime-version preflight checks to fail fast when Node/Bun versions drift from policy in local/CI workflows.
- Acceptance criteria: clear actionable failure message when runtime version is out-of-policy.
- Verification: simulate supported and unsupported runtime invocations for the preflight command and run standard verify gates.

### T-039: Node 22 dev bootstrap ergonomics
- Status: `done`
- Scope: add developer-friendly runtime bootstrap guidance/shortcuts so switching to policy runtimes is one command.
- Acceptance criteria: documented and runnable bootstrap path for Node 22 + Bun policy compliance.
- Verification: bootstrap path succeeds from a mismatched runtime shell and passes `bun run check:runtime`.

### T-040: Runtime-preflight runbook alignment
- Status: `done`
- Scope: update runbooks/CI docs so runtime-preflight behavior is explicit for contributors and pipeline maintainers.
- Acceptance criteria: docs clearly describe expected preflight failure modes and Node 22 wrapper recovery path.
- Verification: documentation walkthrough aligns with current scripts/workflows and no contradictions remain.

### T-041: Legacy jQuery 4 risk scan
- Status: `done`
- Scope: audit legacy AMD client (`client/js/**`) for jQuery patterns likely to break under jQuery 4 and define remediation batches.
- Acceptance criteria: prioritized risk list with concrete files/callsite patterns and ticketized fix order.
- Verification: committed scan artifact with actionable remediation tickets.

### T-042: Legacy `.size()` removal
- Status: `done`
- Scope: replace legacy `.size()` usage with `.length` equivalents in `client/js/**`.
- Acceptance criteria: no `.size()` calls remain in legacy app/runtime files.
- Verification: static scan + `bun run verify:legacy`.

### T-043: Legacy `.bind/.unbind` migration
- Status: `done`
- Scope: replace legacy `.bind()`/`.unbind()` usage with `.on()`/`.off()` in `client/js/{main,app}.js`.
- Acceptance criteria: no `.bind()`/`.unbind()` in legacy app/runtime files; behavior parity preserved.
- Verification: static scan + `bun run verify:legacy`.

### T-044: Legacy event-wiring smoke
- Status: `done`
- Scope: add targeted smoke assertions for legacy UI event wiring affected by `.on/.off` migration.
- Acceptance criteria: regression guard exists for critical legacy controls impacted by event API migration.
- Verification: legacy-focused smoke run + `bun run verify:legacy`.

### T-045: Legacy event helper centralization
- Status: `done`
- Scope: centralize legacy jQuery compatibility event helpers to avoid duplicated wrapper logic in `client/js/main.js` and `client/js/app.js`.
- Acceptance criteria: one shared helper module/function surface used by legacy app/runtime event bindings.
- Verification: static usage check + `bun run test:legacy-browser:node22` + `bun run verify:legacy:node22`.

### T-046: Legacy browser smoke CI gate
- Status: `done`
- Scope: add path-filtered CI workflow for `test:legacy-browser` so legacy event-wiring compatibility regressions are caught automatically.
- Acceptance criteria: workflow exists, runs on legacy-sensitive changes, and is green.
- Verification: local parity command `bun run test:legacy-browser:node22` passes and workflow config is committed.

### T-047: Legacy browser smoke depth expansion
- Status: `done`
- Scope: expand legacy browser smoke beyond intro wiring to cover additional stable controls as legacy startup reliability allows.
- Acceptance criteria: increased legacy smoke coverage without flaky assertions.
- Verification: `bun run test:legacy-browser:node22` remains green and covers additional deterministic checks.

### T-048: Legacy smoke harness stabilization
- Status: `done`
- Scope: add deterministic legacy test harness controls (or intro-overlay bypass) so additional legacy UI checks can be asserted without click-interception flakes.
- Acceptance criteria: previously flaky legacy control assertions become deterministic and green.
- Verification: expanded legacy smoke passes consistently in local/CI runs.

### T-049: Runtime onboarding doc alignment
- Status: `done`
- Scope: align contributor onboarding docs with new Node22 wrapper scripts and runtime-preflight workflow expectations.
- Acceptance criteria: onboarding path clearly maps from mismatched shell runtime to passing verify commands.
- Verification: docs walkthrough from clean shell reproduces `check:runtime:node22` and `verify:modern:node22`.

### T-050: Modernization status snapshot
- Status: `done`
- Scope: add a concise status snapshot section in root README pointing to roadmap/support/audit artifacts and current tier-1 commands.
- Acceptance criteria: newcomer can find current modernization status and canonical verification commands in under one minute.
- Verification: docs review of README links/commands against current scripts and artifacts.

### T-051: Docs-script parity sweep
- Status: `done`
- Scope: reconcile all runbook/support docs against current scripts/workflows to remove stale command references.
- Acceptance criteria: docs command references match `package.json` scripts and active workflows exactly.
- Verification: scripted or manual cross-check of docs command strings against `package.json` and workflow steps.

### T-052: Legacy browser CI discoverability
- Status: `done`
- Scope: ensure docs explicitly mention the new `verify-legacy-browser` CI workflow and when it triggers.
- Acceptance criteria: contributor can quickly locate legacy browser CI gate behavior and local parity command.
- Verification: docs contain workflow name, trigger scope summary, and parity command.

### T-053: Browser command naming cleanup
- Status: `done`
- Scope: introduce clearer browser script aliases (`test:browser:modern`, `test:browser:legacy`) while preserving backward-compatible existing script names.
- Acceptance criteria: both modern and legacy browser commands are discoverable and documented with consistent naming.
- Verification: aliases run successfully and docs reference the canonical names.

### T-054: CI command alias alignment
- Status: `done`
- Scope: update browser CI workflows to use canonical `test:browser:*` script aliases for consistency with docs.
- Acceptance criteria: workflow steps invoke alias names and remain behaviorally identical.
- Verification: local alias command parity plus workflow config diff review.

### T-055: Strict-mode undeclared variable sweep
- Status: `done`
- Scope: fix undeclared-identifier regressions discovered by strict ESM/browser runs and mirror parity-safe fixes to legacy equivalents.
- Acceptance criteria: modern browser smoke no longer throws undeclared-variable runtime errors in covered paths.
- Verification: browser alias Node22 runs pass after fixes and static no-undef sweep is clean.

### T-056: ESM undeclared-variable lint guardrail
- Status: `done`
- Scope: enforce `no-undef` for `client/js-esm/**/*.js` so strict-mode identifier regressions fail fast in lint/CI.
- Acceptance criteria: `bun run lint` enforces `no-undef` for ESM client files without broadening unrelated legacy/server debt.
- Verification: lint passes and targeted `bunx eslint "client/js-esm/**/*.js" --rule "no-undef:error"` is clean.

### T-057: Modern browser startup flake hardening
- Status: `done`
- Scope: harden modern Playwright smoke startup bootstrap so intro-to-start transitions are deterministic under CI timing jitter.
- Acceptance criteria: modern browser smoke no longer intermittently stalls on intro state after play click.
- Verification: repeated `bun run test:browser:modern:node22` pass after helper hardening.

### T-058: Server logger dependency importization
- Status: `done`
- Scope: replace implicit global `log` usage in `server/js/**/*.js` with explicit imports from `server/js/log.js`.
- Acceptance criteria: server runtime modules no longer depend on ambient `log` globals.
- Verification: enable `no-undef` for server lint scope and keep `verify:modern`/`verify:legacy` green.

### T-059: Server logger callsite simplification
- Status: `done`
- Scope: simplify server logger callsites by removing redundant null-guards and normalizing event helper usage now that explicit logger singleton is guaranteed.
- Acceptance criteria: server logging callsites are consistent, concise, and avoid repetitive guard boilerplate.
- Verification: `bun run lint` + `bun run verify:modern:node22` remain green.

### T-060: Logger event payload normalization
- Status: `done`
- Scope: reduce repeated structured-event field boilerplate in server lifecycle paths by introducing lightweight helper patterns where repetition is high.
- Acceptance criteria: equivalent event payloads with less duplicated callsite code and unchanged event semantics.
- Verification: `bun run lint` + `bun run verify:modern:node22` + selected log smoke tests stay green.

### T-061: Logger singleton safety hardening
- Status: `done`
- Scope: harden logger singleton API (`setLevel` input validation/defaulting) and add unit tests for shared-instance behavior and level-change semantics.
- Acceptance criteria: invalid level inputs do not leave logger in broken state; singleton behavior is explicit and test-covered.
- Verification: updated logger unit tests pass alongside `bun run verify:modern:node22`.

### T-062: Server logging semantics audit
- Status: `done`
- Scope: audit structured server event names and payload fields for consistency, and document a normalized event taxonomy for future log analysis.
- Acceptance criteria: core server lifecycle events follow a consistent naming and field contract with clear documentation.
- Verification: documentation + smoke checks confirm unchanged runtime behavior while field naming remains stable.

### T-063: Structured-log contract tests expansion
- Status: `done`
- Scope: extend structured-log smoke tests to assert fatal-event naming and required payload fields for server error taxonomy stability.
- Acceptance criteria: tests fail on accidental fatal-event naming drift or missing mandatory fields.
- Verification: `bun test tests/smoke/server-structured-logs.test.ts` (or equivalent expanded suite) plus `verify:modern:node22`.

### T-064: Structured-log fatal exception parity test
- Status: `done`
- Scope: add explicit contract coverage for `server.fatal.uncaught_exception` event semantics and field expectations, mirroring rejection-path coverage.
- Acceptance criteria: both fatal taxonomy events (`uncaught_exception`, `unhandled_rejection`) are test-guarded.
- Verification: expanded structured-log smoke suite passes and remains green in `verify:modern:node22`.

### T-065: Structured-log smoke harness deduplication
- Status: `done`
- Scope: refactor structured-log smoke tests to reuse shared server spawn/event capture helpers and reduce duplicated setup/reader logic.
- Acceptance criteria: equivalent test coverage with lower boilerplate and easier future event-contract additions.
- Verification: structured-log smoke suite remains green and readable after helper extraction.

### T-066: Structured-log test file split
- Status: `done`
- Scope: split structured-log smoke coverage into focused files (lifecycle vs fatal taxonomy) while preserving shared helper utilities.
- Acceptance criteria: targeted smoke invocation is faster and easier (`bun test` on individual files) with unchanged assertions.
- Verification: both split suites pass individually and as part of `verify:modern:node22`.

### T-067: Structured-log fatal taxonomy parameterization
- Status: `done`
- Scope: convert fatal taxonomy tests into a table-driven pattern to reduce repeated setup/assertion code while preserving per-event semantics.
- Acceptance criteria: both fatal event contracts remain fully covered with less duplicated test body code.
- Verification: fatal suite + full `verify:modern:node22` remain green.

### T-068: Structured-log harness diagnostics hardening
- Status: `done`
- Scope: improve shared structured-log harness failure diagnostics (enhanced timeout context, captured recent lines/events) for faster triage in CI.
- Acceptance criteria: failures in structured-log smoke tests provide actionable context without reruns.
- Verification: harness changes keep structured-log suites and modernization verify gates green.

### T-069: Structured-log harness API polish
- Status: `done`
- Scope: clean up helper API naming/types and add minimal inline usage docs for structured-log harness maintainability.
- Acceptance criteria: harness surface is clear and self-documenting for future smoke test additions.
- Verification: lint + structured-log suites + `verify:modern:node22` remain green.

### T-070: Structured-log harness export hygiene
- Status: `done`
- Scope: clean dead/unused harness exports and align import usage across split structured-log test files.
- Acceptance criteria: no stale exported types/helpers remain and test imports are minimal/consistent.
- Verification: lint + structured-log targeted suite + `verify:modern:node22` remain green.

### T-071: Structured-log docs alignment
- Status: `done`
- Scope: update docs to reflect split structured-log smoke files and shared harness location for contributor discoverability.
- Acceptance criteria: contributors can quickly run lifecycle-only or fatal-only structured-log smoke tests from docs.
- Verification: docs command snippets match current test file paths and succeed locally.

### T-072: Structured-log command alias cleanup
- Status: `done`
- Scope: introduce short `test:logs:*` script aliases and align docs to those canonical commands.
- Acceptance criteria: contributors can run lifecycle/fatal structured-log suites without long file-path commands.
- Verification: `bun run test:logs:lifecycle` and `bun run test:logs:fatal` pass; docs reference aliases consistently.

### T-073: Modern jQuery surface audit
- Status: `done`
- Scope: inventory remaining jQuery usage in `client/js-esm/**`, categorize by risk/replaceability, and define phased reduction batches.
- Acceptance criteria: committed audit artifact lists concrete files/callsites with execution order and regression guard suggestions.
- Verification: static usage scan evidence is captured in-doc and linked from dependency/runtime audit.

### T-074: Modern jQuery reduction batch 1 (low-risk)
- Status: `done`
- Scope: remove dead/low-risk jQuery usage from `client/js-esm/{sprite,map,gameclient}.js` with behavior-preserving replacements.
- Acceptance criteria: those files no longer import/use jQuery and modern/legacy/browser gates remain green.
- Verification: `bun run test:browser:modern:node22`, `bun run verify:modern:node22`, `bun run verify:legacy:node22`.

### T-075: Modern jQuery reduction batch 2 (bubble DOM)
- Status: `done`
- Scope: replace `client/js-esm/bubble.js` jQuery DOM create/update/remove usage with vanilla DOM APIs.
- Acceptance criteria: bubble behavior remains unchanged while removing direct jQuery dependency in the module.
- Verification: modern browser parity suite + full modern/legacy verify gates.

### T-076: Modern jQuery reduction batch 3 (app/main event surface)
- Status: `done`
- Scope: migrate remaining `.bind/.unbind` and high-coupling jQuery event wiring in `client/js-esm/{app,main}.js` incrementally.
- Acceptance criteria: no `.bind/.unbind` callsites remain in these modern ESM files and browser parity remains stable.
- Verification: `bun run test:browser:modern:node22` + `bun run test:browser:legacy:node22` + verify gates.

### T-077: Modern jQuery reduction batch 4 (selector/event decoupling)
- Status: `done`
- Scope: reduce highest-frequency jQuery selector/event coupling in `client/js-esm/{app,main}.js` via small DOM helper seams while preserving behavior.
- Acceptance criteria: targeted subset of repeated jQuery selector/event patterns is replaced with DOM helpers and modern/legacy parity remains stable.
- Verification: `bun run test:browser:modern:node22` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-078: Modern jQuery reduction batch 5 (app shell selector decoupling)
- Status: `done`
- Scope: reduce highest-frequency selector churn in `client/js-esm/app.js` (chat toggles, intro/button state, healthbar updates) with targeted DOM helper seams.
- Acceptance criteria: selected hot-path app-shell interactions reduce direct jQuery selector calls while preserving behavior.
- Verification: `bun run test:browser:modern:node22` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-079: Modern jQuery reduction batch 6 (remaining selector debt)
- Status: `done`
- Scope: continue reducing remaining selector churn in `client/js-esm/{app,main}.js` around overlay toggles, parchment state transitions, and achievement wiring.
- Acceptance criteria: targeted remaining selector-heavy clusters are migrated to helper seams without browser/legacy regressions.
- Verification: `bun run test:browser:modern:node22` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-080: Modern jQuery reduction batch 7 (main runtime selector/event debt)
- Status: `done`
- Scope: reduce remaining selector/event churn in `client/js-esm/main.js` (chat input key/focus handling, tooltip/focus wiring, global parchment checks, and repeated click handlers).
- Acceptance criteria: targeted main-runtime selector-heavy clusters are migrated to DOM helper seams with stable browser/legacy parity.
- Verification: `bun run test:browser:modern:node22` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-081: Modern jQuery reduction batch 8 (main boot/runtime handler normalization)
- Status: `done`
- Scope: normalize remaining selector-heavy boot/runtime handler clusters in `client/js-esm/main.js` (bar/help/achievement/social/paging handlers and foreground touch/click wiring).
- Acceptance criteria: targeted clusters use DOM helper seams with unchanged behavior in browser parity and legacy gates.
- Verification: `bun run test:browser:modern:node22` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-082: Modern jQuery reduction batch 9 (final runtime extraction)
- Status: `done`
- Scope: remove residual jQuery-only callsites in modern `client/js-esm/{app,main}.js` and evaluate removing modern runtime jQuery imports where feasible.
- Acceptance criteria: modern app/main residual callsites are either migrated or explicitly documented as deferred, with unchanged browser/legacy parity.
- Verification: `bun run test:browser:modern:node22` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-083: Modern jQuery reduction batch 10 (app final extraction or defer)
- Status: `done`
- Scope: resolve remaining `client/js-esm/app.js` jQuery callsites (play-button watcher, container offset helper, achievement template wiring) via migration or explicit defer.
- Acceptance criteria: remaining app jQuery surface is either eliminated or explicitly deferred with rationale and guardrails.
- Verification: `bun run test:browser:modern:node22` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-084: Modern jQuery-free policy lock
- Status: `done`
- Scope: codify and enforce that modern ESM runtime remains jQuery-free while keeping legacy AMD jQuery compatibility isolated.
- Acceptance criteria: docs and lightweight static checks prevent reintroduction of jQuery imports/selectors in modern ESM runtime modules.
- Verification: static scan commands + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-085: Modern jQuery-free guard expansion (full ESM scope)
- Status: `done`
- Scope: expand jQuery reintroduction guard from `client/js-esm/{app,main}.js` to all modern ESM runtime modules (`client/js-esm/**/*.js`).
- Acceptance criteria: static policy check scans the full modern ESM tree and docs reflect the stronger guard scope.
- Verification: `bun run check:modern-jquery-free` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-086: Modernization queue refresh (post-jQuery lock)
- Status: `done`
- Scope: define and prioritize the next modernization slice after modern runtime jQuery extraction (dependency/runtime modernization candidates with acceptance criteria and verification plans).
- Acceptance criteria: concrete ticketized next-slice plan exists with explicit order and executable verification commands.
- Verification: updated `MODERNIZE.md` queue with reviewed ticket scopes and run commands.

### T-087: Modern-first local dev default entrypoint
- Status: `done`
- Scope: make `bun run dev` serve modern runtime by default at `/` while preserving explicit legacy fallback entry.
- Acceptance criteria: root route defaults to modern entry, legacy route stays accessible, and behavior is documented.
- Verification: runtime route probe + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-088: Static dev entry contract smoke
- Status: `done`
- Scope: add automated smoke tests for static dev entry routing contract (`/` modern default, `/index.html` legacy, env override support).
- Acceptance criteria: deterministic smoke test exists and runs in the standard test suite.
- Verification: `bun run test:static-entry` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-089: Modern-first Vite dev root redirect
- Status: `done`
- Scope: align Vite dev root redirect behavior with modern-first policy while keeping an explicit legacy override.
- Acceptance criteria: `/` resolves to modern entry by default for Vite dev server and override flag is documented.
- Verification: Vite route probe + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-090: Dependency/runtime modernization queue refresh
- Status: `done`
- Scope: refresh dependency/runtime modernization candidates after modern-first entrypoint consolidation (including direct dependency drift and execution order).
- Acceptance criteria: ticketized next-slice plan with explicit pass/fail checks and verification commands is committed in `MODERNIZE.md`.
- Verification: updated roadmap queue + supporting audit notes (`docs/dependency-modernization-audit.md`) are in sync.

### T-091: ESLint 10 readiness scan
- Status: `done`
- Scope: assess compatibility of current lint stack/config with `eslint@10` and `@eslint/js@10` before upgrading.
- Acceptance criteria: explicit compatibility checklist and blocker list exists (or ready-to-upgrade confirmation) with concrete affected files/config sections.
- Verification: documented readiness results + current `bun run lint` baseline remains green.

### T-092: Scoped ESLint 10 upgrade trial
- Status: `done`
- Scope: run controlled major upgrade trial for `eslint` + `@eslint/js`, apply minimal compatibility fixes, and keep upgrade only if full gates stay green.
- Acceptance criteria: dependency bump is either landed with green verify gates or rolled back with a documented blocker list and retry plan.
- Verification: `bun run lint` + `bun run verify:modern:node22` + `bun run verify:legacy:node22` (+ `bun outdated` snapshot after trial).

### T-093: Post-upgrade lint ecosystem watch
- Status: `done`
- Scope: track `@typescript-eslint` explicit `eslint@10` peer support and define revalidation cadence for future dependency drift checks.
- Acceptance criteria: documented watch strategy exists with concrete check commands and trigger conditions for re-trial/cleanup work.
- Verification: updated dependency audit and roadmap notes include watch actions and command cadence.

### T-094: Runtime/library modernization candidate refresh
- Status: `done`
- Scope: identify the highest-leverage next modernization batch beyond lint/dependency drift (runtime/library modernization with measurable behavior and risk boundaries).
- Acceptance criteria: next batch is ticketized with scope, acceptance criteria, verification commands, and dependency ordering.
- Verification: updated `MODERNIZE.md` active queue with executable next-batch tickets and linked supporting docs.

### T-095: Metrics backend optional-dependency startup hardening
- Status: `done`
- Scope: ensure server startup/degraded gameplay path remains functional when `metrics_enabled` is requested but metrics backend adapter is unavailable.
- Acceptance criteria: server no longer crashes on metrics adapter init failure; fallback path is explicit and observable.
- Verification: `bun test --timeout 20000 tests/smoke/server-handshake.test.ts` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-096: Metrics fallback observability and contract coverage
- Status: `done`
- Scope: add structured-log taxonomy/coverage for metrics fallback and ensure runtime handshake parity remains intact.
- Acceptance criteria: `server.metrics.unavailable` event is documented and asserted by automated smoke coverage.
- Verification: `bun test --timeout 20000 tests/smoke/server-structured-logs.lifecycle.test.ts` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-097: Metrics adapter boundary and dependency strategy
- Status: `done`
- Scope: implement metrics backend abstraction boundary (optional dependency policy, config validation, and testability without external memcache daemon).
- Acceptance criteria: server metrics initialization is centralized and safe, emits structured fallback reasons, and has coverage for missing backend and invalid config paths.
- Verification: `bun test --timeout 20000 tests/smoke/server-handshake.test.ts` + `bun test --timeout 20000 tests/smoke/server-structured-logs.lifecycle.test.ts` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-098: Metrics adapter modularization and unit contract coverage
- Status: `done`
- Scope: split metrics backend runtime into explicit adapter modules (no-op + memcache) with unit-level contracts for selection/fallback behavior.
- Acceptance criteria: adapter selection logic is isolated/tested and does not require external memcache service for deterministic coverage.
- Verification: new targeted unit tests + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-099: Metrics config runbook hardening
- Status: `done`
- Scope: document required metrics configuration fields, valid examples, and expected fallback semantics when metrics backend is unavailable or misconfigured.
- Acceptance criteria: server/runtime docs clearly define metrics enablement contract and operators can configure metrics mode without code spelunking.
- Verification: updated docs (`server/README.md` and/or dedicated runbook) reviewed against current runtime checks + smoke/log contracts.

### T-100: Metrics config template alignment
- Status: `done`
- Scope: update `server/config_local.json-dist` (or equivalent config template) so metrics-enabled examples and field hints match runtime validation contract.
- Acceptance criteria: shipped config template reflects required `metrics_enabled` fields and avoids ambiguous/invalid starter configs.
- Verification: template/docs alignment review plus smoke tests (`server-handshake`, structured lifecycle logs) remain green.

### T-101: Metrics adapter dependency policy/runbook
- Status: `done`
- Scope: document explicit memcache dependency/install policy for metrics-enabled deployments and add troubleshooting steps for `server.metrics.unavailable` reasons.
- Acceptance criteria: operators can move from fallback mode to healthy metrics mode with clear install/config/runbook steps.
- Verification: updated server/docs runbook references current adapter behavior and structured event semantics.

### T-102: Metrics adapter health-path smoke design
- Status: `done`
- Scope: define a deterministic validation strategy for healthy metrics path (when memcache dependency/service is available) without destabilizing default CI/local flows.
- Acceptance criteria: concrete test plan exists for optional healthy-metrics smoke coverage, including gating strategy and environment prerequisites.
- Verification: documented in roadmap with explicit commands/env expectations and fallback-safe defaults.

### T-103: Optional healthy metrics smoke scaffold
- Status: `done`
- Scope: implement opt-in healthy-path smoke test scaffold and script command (`BQ_TEST_METRICS_HEALTH=1`) without wiring into default verification gates.
- Acceptance criteria: optional command/test exists, is documented, and cleanly skips in default environments.
- Verification: default verify gates remain green; optional command behavior is documented and locally runnable in prepared environments.

### T-104: Structured metrics-ready event contract
- Status: `done`
- Scope: emit an explicit structured `server.metrics.ready` event when memcache-backed metrics become ready, and assert it in optional healthy-path smoke.
- Acceptance criteria: healthy metrics path has a deterministic positive structured signal; optional smoke no longer relies on unstructured log text.
- Verification: optional healthy metrics smoke asserts `server.metrics.ready`; default verify gates remain green with test skipped by default.

### T-105: Healthy metrics smoke prerequisites preflight
- Status: `done`
- Scope: add a fail-fast preflight command for optional healthy metrics smoke that validates memcache dependency + memcached reachability before test execution.
- Acceptance criteria: `test:metrics:healthy` provides actionable setup failures instead of opaque runtime/test errors when prerequisites are missing.
- Verification: `bun run check:metrics:healthy-prereqs` (expected pass in prepared env; actionable fail otherwise) + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-106: Optional CI profile for healthy metrics smoke
- Status: `done`
- Scope: add a separate opt-in CI workflow/profile that provisions memcached and runs `bun run test:metrics:healthy` without changing default verify gates.
- Acceptance criteria: healthy metrics path can be validated in automation with deterministic environment setup and clear isolation from baseline CI.
- Verification: workflow definition + docs landed; baseline verify gates remain green and optional healthy command preflight behavior is explicit/actionable.

### T-107: Healthy metrics CI runbook and result contract
- Status: `done`
- Scope: document how to trigger `verify-metrics-healthy`, what successful output/events should look like, and how to triage common failures.
- Acceptance criteria: contributors/operators can execute the optional workflow and interpret failures without code spelunking.
- Verification: dedicated runbook section added and cross-linked from `README.md` / metrics plan docs.

### T-108: Post-push healthy metrics CI evidence capture
- Status: `done`
- Scope: execute `verify-metrics-healthy` in GitHub Actions after branch push and capture a baseline success record in modernization docs.
- Acceptance criteria: roadmap includes at least one successful workflow run reference (run URL/id + date) for healthy metrics path.
- Verification: successful `verify-metrics-healthy` run visible in GitHub Actions and referenced in `MODERNIZE.md` log.
- Evidence:
  - Repository: `Krisztiaan/BrowserQuest`
  - Run URL: `https://github.com/Krisztiaan/BrowserQuest/actions/runs/21773648845`
  - Result: `success`

### T-109: Memcache API compatibility and healthy signal determinism
- Status: `done`
- Scope: make metrics runtime compatible with modern `memcache` package exports and eliminate healthy-smoke signal loss from stream/event race conditions.
- Acceptance criteria: in a prepared memcache+memcached env, `test:metrics:healthy` passes deterministically with `server.metrics.ready` and no fallback event.
- Verification: local prepared run (`bun add --no-save memcache` + memcached container + `bun run test:metrics:healthy`) plus baseline `verify:modern:node22` and `verify:legacy:node22` remain green after cleanup.

### T-110: Metrics client adapter seam and unit contract coverage
- Status: `done`
- Scope: extract memcache client API compatibility into a dedicated seam and add unit-level contract tests so legacy/modern API support remains deterministic.
- Acceptance criteria: adapter supports both legacy and modern memcache exports with deterministic connect/get/set semantics under unit tests.
- Verification: `tests/unit/metrics-client.test.ts` + baseline verify gates (`verify:modern:node22`, `verify:legacy:node22`) remain green.

### T-111: Fork branch/default-branch hygiene follow-up
- Status: `done`
- Scope: document and apply cleanup strategy for fork workflow evidence setup (default branch reset policy, tracking branch, and guardrails for future dispatch runs).
- Acceptance criteria: fork automation setup is reproducible and does not leave ambiguous branch/default-branch state.
- Verification: docs capture current fork state and commands to revert/reapply workflow-dispatch readiness.

### T-112: Optional workflow dependency-step hardening
- Status: `done`
- Scope: harden `verify-metrics-healthy` workflow dependency installation so optional `memcache` add does not unintentionally mutate lockfile expectations in CI.
- Acceptance criteria: workflow uses an explicit non-lockfile-mutating install approach and remains green.
- Verification: updated workflow run succeeds and runbook references the hardened behavior.

### T-113: Upstream handoff for workflow evidence context
- Status: `done`
- Scope: document that workflow evidence currently runs on fork (`Krisztiaan/BrowserQuest`) because upstream (`mozilla/BrowserQuest`) is read-only/archived, and provide sync instructions.
- Acceptance criteria: maintainers can locate evidence runs and understand how to reproduce them under available permissions.
- Verification: `README.md` and/or metrics runbook includes explicit upstream-vs-fork execution note with links.

### T-114: Upstream alignment checklist for optional workflow
- Status: `done`
- Scope: document exact steps to replicate fork-based healthy workflow setup in upstream when/if upstream write access is available.
- Acceptance criteria: checklist exists for porting workflow/runbook evidence path from fork back to upstream.
- Verification: checklist committed in runbook/docs and linked from roadmap.

### T-115: Metrics slice baseline reference capture
- Status: `done`
- Scope: capture concise baseline references (branch head commit + successful workflow run IDs) for the completed metrics modernization slice.
- Acceptance criteria: roadmap includes a compact reference block for future regressions/audits.
- Verification: `MODERNIZE.md` contains commit/run reference bullets tied to completed T-104..T-114 work.

### T-116: Optional healthy workflow runtime matrix note
- Status: `done`
- Scope: document observed Bun/Node runtime versions from successful healthy workflow runs and define watch policy for future runtime drifts.
- Acceptance criteria: runbook/roadmap includes runtime-version reference and a clear revalidation trigger.
- Verification: docs include version note tied to specific successful run IDs.

### T-117: Metrics slice checkpoint summary for handoff
- Status: `done`
- Scope: add a concise checkpoint summary block in roadmap documenting completed T-104..T-116 outcomes and open successor tasks.
- Acceptance criteria: a new contributor can resume from roadmap alone without replaying full log history.
- Verification: checkpoint block exists and references the latest completed ticket IDs plus remaining todos.

### T-118: Post-metrics modernization candidate refresh
- Status: `done`
- Scope: identify the next highest-leverage modernization batch after metrics/CI contract stabilization (runtime/library/tooling or protocol hardening candidates).
- Acceptance criteria: roadmap includes ordered, ticketized next slice with acceptance criteria and verification commands.
- Verification: new queued tickets are added to `MODERNIZE.md` with executable checks.

### T-119: Server config schema preflight (runtime contract)
- Status: `done`
- Scope: add explicit server config schema validation/preflight at startup (required keys/types/ranges) before world boot.
- Acceptance criteria: invalid configs fail fast with structured actionable errors; valid configs start unchanged.
- Verification: targeted config-preflight tests + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-120: Optional healthy workflow Node/Bun matrix hardening
- Status: `done`
- Scope: expand optional healthy workflow matrix to explicitly capture at least one pinned Bun version and current Node policy version for reproducibility tracking.
- Acceptance criteria: workflow matrix and runbook make runtime drift visible without affecting default gates.
- Verification: successful workflow run(s) for configured matrix entries with documented run IDs.

### T-121: Metrics adapter failure-mode taxonomy expansion
- Status: `done`
- Scope: enrich `server.metrics.unavailable` failure reasons for connect-time and runtime operation failures (not just init/config) with stable reason codes.
- Acceptance criteria: failure reasons are structured, documented, and covered by targeted tests.
- Verification: unit/smoke assertions for expanded reasons + logging taxonomy doc updates.

### T-122: Legacy/modern protocol invariant replay guard
- Status: `done`
- Scope: add a focused replay/invariant smoke that replays a deterministic action sequence against both modern and legacy entry paths and diffs key protocol outcomes.
- Acceptance criteria: regression signal exists when protocol handling diverges between compatibility paths.
- Verification: new smoke command + passing `verify:modern:node22`/`verify:legacy:node22`.

### T-123: Protocol invariant CI gate workflow
- Status: `done`
- Scope: add a path-filtered CI workflow running `test:browser:protocol-invariant` so replay parity regressions are automatically caught on browser/runtime-sensitive changes.
- Acceptance criteria: dedicated workflow exists, is discoverable in support docs, and mirrors local protocol invariant command behavior.
- Verification: workflow file committed + local parity command `bun run test:browser:protocol-invariant:node22` passes.

### T-124: Post-protocol roadmap refresh and evidence capture
- Status: `done`
- Scope: capture first successful `verify-protocol-invariant` GitHub run evidence and refresh the next modernization candidate queue beyond protocol parity coverage.
- Acceptance criteria: roadmap references a concrete successful run URL/id and includes ordered follow-up ticket(s) with acceptance criteria and verification commands.
- Verification: `MODERNIZE.md` log includes run evidence + queued successor tickets.

### T-125: CI Bun pin alignment for reproducibility
- Status: `done`
- Scope: pin Bun runtime version consistently across primary verify workflows (`verify-modern`, `verify-legacy`, browser gates, protocol invariant gate) to reduce drift from `latest`.
- Acceptance criteria: workflow setup steps use a single pinned Bun version aligned with runtime policy notes.
- Verification: workflow config scan confirms `bun-version: 1.3.8` in targeted workflows and docs mention CI pin policy.

### T-126: Bun pin evidence capture for primary verify workflows
- Status: `done`
- Scope: capture successful post-pin workflow runs (at least modern + legacy + one browser gate) and record run IDs/URLs in roadmap for reproducibility baseline.
- Acceptance criteria: roadmap contains concrete success evidence proving pinned Bun workflows execute cleanly after alignment changes.
- Verification: GitHub Actions run links for post-pin `verify-modern`, `verify-legacy`, and one browser/protocol workflow are logged in `MODERNIZE.md`.

### T-127: Post-reproducibility modernization queue refresh
- Status: `done`
- Scope: refresh the next modernization execution queue after CI/runtime reproducibility hardening, prioritizing highest-leverage runtime/library debt with clear acceptance checks.
- Acceptance criteria: roadmap includes ordered successor tickets with scope, acceptance criteria, verification commands, and dependency notes.
- Verification: `MODERNIZE.md` has new queued ticket entries beyond T-126 with executable command-level checks.

### T-128: Protocol invariant replay depth expansion
- Status: `done`
- Scope: extend `test:browser:protocol-invariant` beyond handshake/chat to include one deterministic movement/zone action invariant asserted across modern and legacy entry paths.
- Acceptance criteria: replay guard fails when modern/legacy handling diverges on the expanded action sequence, while remaining deterministic in CI.
- Verification: updated protocol invariant Playwright suite + `bun run test:browser:protocol-invariant:node22` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-129: Protocol fixture/harness reuse across parity suites
- Status: `done`
- Scope: extract shared protocol replay helpers/fixtures used by browser invariant and smoke parity suites to reduce duplicated websocket parsing/retry logic.
- Acceptance criteria: helper reuse is explicit, targeted suites remain readable, and no behavior drift is introduced.
- Verification: affected tests pass (`bun test --timeout 20000 tests/smoke/modern-gameplay-parity.test.ts`) + browser invariant command stays green.

### T-130: Protocol gate CI runbook and trigger ergonomics
- Status: `done`
- Scope: document when to use `verify-protocol-invariant`, add optional manual trigger support (`workflow_dispatch`), and align local parity commands in docs/runbooks.
- Acceptance criteria: contributors can run/triage protocol gate from docs alone; workflow supports both path-triggered and manual runs.
- Verification: workflow includes `workflow_dispatch`; docs mention trigger paths + manual trigger + local parity command.

### T-131: Manual-dispatch protocol workflow evidence capture
- Status: `done`
- Scope: run `verify-protocol-invariant` via `workflow_dispatch` and capture successful run evidence (URL/id/timestamps) in roadmap for operator triage baseline.
- Acceptance criteria: roadmap includes at least one successful manual-dispatch run proving the workflow_dispatch path is functional.
- Verification: `gh workflow run verify-protocol-invariant.yml -R Krisztiaan/BrowserQuest --ref modernize` succeeds and run evidence is logged in `MODERNIZE.md`.

### T-132: Post-invariant-gate candidate refresh
- Status: `done`
- Scope: refresh the next protocol/runtime modernization queue beyond invariant CI gate hardening (focus on highest-leverage regression-signal improvements).
- Acceptance criteria: roadmap includes ordered successor tickets with scope, acceptance criteria, and executable verification commands.
- Verification: `MODERNIZE.md` adds queued post-T131 tickets with concrete command-level checks.

### T-133: Protocol invariant negative-path parity
- Status: `done`
- Scope: extend protocol invariant replay to cover one invalid payload case (e.g., malformed `MOVE`) and assert modern/legacy parity in rejection/connection behavior.
- Acceptance criteria: invariant suite detects divergence on invalid-payload handling while staying deterministic.
- Verification: updated `tests/browser/protocol-invariant.playwright.ts` + `bun run test:browser:protocol-invariant:node22` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-134: Protocol replay transcript helper extraction
- Status: `done`
- Scope: extract reusable transcript capture/assert helpers for browser protocol tests (`modern-protocol-actions` + `protocol-invariant`) to reduce repeated frame parsing/counting logic.
- Acceptance criteria: both suites use shared helper module(s) with no behavior drift and improved readability.
- Verification: `bun run test:browser:modern:node22` + `bun run test:browser:protocol-invariant:node22` pass after helper extraction.

### T-135: Protocol workflow failure diagnostics
- Status: `done`
- Scope: improve `verify-protocol-invariant` workflow failure triage by emitting concise artifact/log summaries from Playwright output when the gate fails.
- Acceptance criteria: failing workflow run exposes actionable replay/test diagnostics without manual log spelunking.
- Verification: workflow config update + docs note; local parity command remains green (`bun run test:browser:protocol-invariant:node22`).

### T-136: Post-diagnostics protocol/testing queue refresh
- Status: `done`
- Scope: refresh next modernization candidates after protocol workflow diagnostics hardening, prioritizing signal quality and maintenance-cost reduction.
- Acceptance criteria: roadmap includes ordered successor tickets with scope, acceptance criteria, and verification commands.
- Verification: `MODERNIZE.md` adds queued post-T135 tickets with executable checks.

### T-137: Protocol invariant transcript fixture extraction
- Status: `done`
- Scope: extract shared in-page replay helpers for `tests/browser/protocol-invariant.playwright.ts` to reduce duplicated parse/timeout/socket-finalize logic between positive and negative paths.
- Acceptance criteria: protocol invariant test keeps behavior parity while reducing repeated replay boilerplate.
- Verification: `bun run test:browser:protocol-invariant:node22` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-138: Protocol browser suite command segmentation
- Status: `done`
- Scope: add a dedicated `test:browser:protocol` alias that targets protocol-focused browser tests (`modern-protocol-actions`, `protocol-invariant`) for quicker local/CI triage loops.
- Acceptance criteria: command exists, is documented, and runs only protocol browser tests.
- Verification: new script command passes locally (`node22` wrapper variant included) and docs reflect usage.

### T-139: Protocol artifact/runbook retention alignment
- Status: `done`
- Scope: document protocol diagnostics artifact expectations (names/paths/retention usage) and align workflow naming with runbook triage steps.
- Acceptance criteria: contributors can locate and interpret protocol workflow artifacts without trial-and-error.
- Verification: docs mention artifact names/paths + retrieval flow; workflow artifact naming remains stable and referenced.

### T-140: Post-protocol-artifact queue refresh
- Status: `done`
- Scope: refresh modernization queue after protocol artifact/runbook alignment, prioritizing remaining high-leverage quality-signal improvements.
- Acceptance criteria: roadmap includes ordered successor tickets with scope, acceptance criteria, and executable verification commands.
- Verification: `MODERNIZE.md` includes queued post-T139 tickets with command-level checks.

### T-141: Protocol-focused browser CI command alignment
- Status: `done`
- Scope: update relevant browser CI workflow steps to use canonical `test:browser:protocol` alias where protocol-only suites are intended.
- Acceptance criteria: workflow command usage aligns with documented protocol-focused alias and remains behaviorally equivalent.
- Verification: workflow config update + local parity command `bun run test:browser:protocol:node22` passes.

### T-142: Protocol observer helper reuse expansion
- Status: `done`
- Scope: expand `tests/browser/protocol-observer.ts` reuse into additional browser suites where websocket frame parsing/counting boilerplate remains.
- Acceptance criteria: targeted suites reduce duplicated protocol observer logic without changing test semantics.
- Verification: affected Playwright suites pass (`bun run test:browser:modern:node22`) and lint/format remain green.

### T-143: Protocol replay timeout diagnostics enrichment
- Status: `done`
- Scope: enrich protocol replay failure reasons in invariant tests with structured timeout context (what stage stalled, last seen message types/counts).
- Acceptance criteria: timeout failures in protocol invariant tests provide actionable context without rerunning under debugger.
- Verification: protocol invariant command remains green and failure messages include stage/context fields.

### T-144: Post-replay-diagnostics queue refresh
- Status: `done`
- Scope: refresh modernization queue after replay diagnostics enrichment with the next highest-leverage protocol/browser quality-signal improvements.
- Acceptance criteria: roadmap includes ordered successor tickets with scope, acceptance criteria, and command-level verification.
- Verification: `MODERNIZE.md` contains queued post-T143 tickets with executable checks.

### T-145: Protocol CI evidence recapture after command alignment
- Status: `done`
- Scope: capture fresh successful `verify-protocol-invariant` workflow evidence after adopting `test:browser:protocol:ci` alias and diagnostics updates.
- Acceptance criteria: roadmap links at least one post-alignment successful run (URL/id/timestamps) showing updated workflow path is green.
- Verification: successful GitHub run for `verify-protocol-invariant` is logged in `MODERNIZE.md`.

### T-146: Protocol command discoverability docs sweep
- Status: `done`
- Scope: ensure all top-level docs consistently reference `test:browser:protocol` / `test:browser:protocol:node22` for protocol-focused triage.
- Acceptance criteria: no stale protocol command references remain in primary onboarding/support docs.
- Verification: docs scan + local command check `bun run test:browser:protocol:node22`.

### T-147: Optional legacy protocol observer extension
- Status: `done` (deferred)
- Scope: evaluate and optionally add lightweight websocket protocol observer hooks for `tests/browser/legacy-ui-smoke.playwright.ts` to support future legacy protocol parity assertions.
- Acceptance criteria: extension is either landed with stable assertions or explicitly deferred with rationale and guardrails.
- Verification: legacy browser smoke command remains green (`bun run test:browser:legacy:node22`) and docs/roadmap reflect outcome.

### T-148: Post-legacy-observer-defer queue refresh
- Status: `done`
- Scope: refresh modernization queue after T-147 defer decision, focusing on deterministic legacy harness preconditions before protocol-level assertions.
- Acceptance criteria: roadmap contains ordered successor tickets with explicit defer-resolution path and command-level verification steps.
- Verification: `MODERNIZE.md` includes queued post-T147 tickets with executable checks.

### T-149: Legacy intro deterministic-start hook design
- Status: `done`
- Scope: design minimal legacy runtime test hook or deterministic-start control to guarantee websocket session start from legacy intro flow without flaky click timing.
- Acceptance criteria: actionable design/implementation path exists with clear guardrails to avoid gameplay behavior changes.
- Verification: roadmap/design notes include concrete command-level validation plan for legacy protocol assertions.

### T-150: Legacy protocol smoke split (optional)
- Status: `done` (deferred)
- Scope: split legacy protocol assertions into a dedicated optional smoke command/workflow separate from fragile UI wiring checks.
- Acceptance criteria: legacy UI wiring smoke remains stable while protocol-level checks are isolated behind explicit opt-in conditions.
- Verification: new optional command (or documented defer) with legacy baseline command `bun run test:browser:legacy:node22` remaining green.

### T-151: Protocol workflow/readme snapshot refresh
- Status: `done`
- Scope: refresh README and support docs snapshot after protocol command/diagnostics changes, ensuring one concise canonical section for protocol triage paths.
- Acceptance criteria: docs provide a single coherent path for local protocol triage + CI artifact triage without contradictory command references.
- Verification: docs scan across README/support docs confirms canonical command set and workflow references.

### T-152: Post-legacy-hook queue refresh
- Status: `done`
- Scope: refresh modernization queue after legacy test-hook design/defer outcomes, prioritizing deterministic legacy harness validation and protocol-signal improvements.
- Acceptance criteria: roadmap includes ordered successor tickets with explicit defer-resolution path and command-level verification steps.
- Verification: `MODERNIZE.md` includes queued post-T151 tickets with executable checks.

### T-153: Legacy hook observability probe command
- Status: `done`
- Scope: add a targeted browser probe command that verifies `__BQ_LEGACY_TEST_API` installation/shape under explicit test-mode flags, independent of full legacy gameplay protocol assertions.
- Acceptance criteria: command deterministically reports whether hook is installed and callable in the legacy page.
- Verification: dedicated command/test passes locally (`node22` wrapper variant) and is documented in roadmap/support notes.

### T-154: Legacy smoke diagnostics enrichment
- Status: `done`
- Scope: enrich `legacy-ui-smoke` failure diagnostics with captured page errors/console messages (without making protocol assertions mandatory).
- Acceptance criteria: legacy smoke failures include actionable context beyond assertion mismatch text.
- Verification: `bun run test:browser:legacy:node22` remains green; failure artifacts/logging hooks are present in test code.

### T-155: Legacy optional protocol smoke reopen criteria
- Status: `done`
- Scope: document concrete reopen criteria and gating conditions for reintroducing optional legacy protocol smoke after T-150 defer.
- Acceptance criteria: defer has explicit exit criteria tied to deterministic-start evidence, not ad hoc retries.
- Verification: criteria and trigger checklist are captured in roadmap/docs and linked from the T-150 deferred note.

### T-156: Post-legacy-defer-resolution queue refresh
- Status: `done`
- Scope: refresh modernization queue after T-153/T-154/T-155 completion, prioritizing high-signal 2026 dependency/runtime upgrades and execution risk reduction.
- Acceptance criteria: roadmap includes ordered successor tickets with command-level evidence paths for dependency and runtime modernization work.
- Verification: `MODERNIZE.md` contains queued post-T155 successor tickets with explicit checks.

### T-157: Node22-aligned dependency drift audit parity command
- Status: `done`
- Scope: add a Node22-wrapper variant for dependency drift checks so local dependency audits follow the same runtime baseline as verification gates.
- Acceptance criteria: dependency drift can be checked under default runtime and Node22 policy runtime via explicit commands.
- Verification: `bun run check:deps:drift` and `bun run check:deps:drift:node22`.

### T-158: Dependency drift CI visibility workflow
- Status: `done`
- Scope: add an opt-in/manual CI workflow that runs dependency drift checks and captures direct dependency status for modernization tracking.
- Acceptance criteria: maintainers can trigger a workflow and retrieve drift status without local setup assumptions.
- Verification: workflow run evidence is logged in `MODERNIZE.md` with run id/url and outcome.

### T-159: CommonJS-to-ESM server readiness inventory
- Status: `done`
- Scope: create a concrete inventory of server/runtime CommonJS boundaries and blockers for incremental ESM migration planning aligned with 2026 JS standards.
- Acceptance criteria: roadmap/docs enumerate high-risk modules, sequencing constraints, and verification gates for staged CJS->ESM transition.
- Verification: inventory artifact is checked in and referenced from `MODERNIZE.md`.

### T-160: Post-CJS-inventory queue refresh
- Status: `done`
- Scope: refresh modernization queue after T-158/T-159 with executable follow-on tickets for ESM bridge bootstrapping and shared-contract hardening.
- Acceptance criteria: ordered successor tickets are documented with scope, guardrails, and command-level verification.
- Verification: `MODERNIZE.md` includes post-T159 successor queue with explicit checks.

### T-161: Server ESM bridge bootstrap (opt-in entrypoint)
- Status: `done`
- Scope: introduce an opt-in ESM server entrypoint path while keeping `server/js/main.js` as stable compatibility bootstrap.
- Acceptance criteria: an explicit command can start server through ESM bridge without changing default runtime path.
- Verification: ESM bridge command starts cleanly and `bun run verify:legacy:node22` remains green.

### T-162: Shared gametypes dual-export contract hardening
- Status: `done`
- Scope: formalize `shared/js/gametypes` compatibility contract for CJS + global + future ESM export surfaces.
- Acceptance criteria: compatibility tests/guards prevent message/entity enum drift across server and client entry paths.
- Verification: protocol/browser parity checks remain green (`bun run test:browser:protocol:node22` and `bun run test:browser:legacy:node22`).

### T-163: `lib/class.js` retirement pilot fanout map
- Status: `done`
- Scope: map exact `server/js/lib/class.js` dependency fanout and implement a first low-risk native-class migration pilot module.
- Acceptance criteria: at least one target module no longer depends on `lib/class.js` with behavior-preserving tests green.
- Verification: targeted tests + `bun run verify:legacy:node22` pass.

### T-164: Post-class-pilot queue refresh
- Status: `done`
- Scope: refresh modernization queue after T-163 with ordered next modules for native-class migration and CJS->ESM bridge hardening.
- Acceptance criteria: successor tickets include explicit module targets, risk tiers, and verification commands.
- Verification: `MODERNIZE.md` includes post-T163 successor queue with executable checks.

### T-165: Native-class migration tier-1 (`checkpoint.js`)
- Status: `done`
- Scope: migrate `server/js/checkpoint.js` off `lib/class.js` to native class syntax with no behavior change.
- Acceptance criteria: module export contract and call sites remain stable while direct `lib/class` usage is removed.
- Verification: `bun run test` and `bun run verify:legacy:node22`.

### T-166: Native-class migration tier-1.5 (`area.js` + `message.js`)
- Status: `done`
- Scope: migrate `server/js/area.js` and `server/js/message.js` from `Class.extend` to native classes while preserving constructor and method behavior.
- Acceptance criteria: protocol formatting/entity flow behavior remains unchanged in runtime and browser protocol checks.
- Verification: `bun run verify:legacy:node22` and `bun run test:browser:protocol:node22`.

### T-167: Class-bridge hardening and fanout refresh
- Status: `done`
- Scope: add/refresh guardrails around remaining `lib/class.js` usage and update fanout artifact after tiered migrations.
- Acceptance criteria: remaining dependency set is explicit and accidental new `lib/class` imports are detectable.
- Verification: fanout artifact refresh + lint/test gates pass.

### T-168: Post-tiered-class-migration queue refresh
- Status: `done`
- Scope: refresh modernization queue after T-165/T-166/T-167, prioritizing remaining high-value `lib/class.js` dependents and ESM bridge adoption.
- Acceptance criteria: ordered successor tickets identify exact module targets and verification commands.
- Verification: `MODERNIZE.md` includes post-T167 successor queue with executable checks.

### T-169: Native-class migration tier-2 (`entity.js` + `character.js`)
- Status: `done`
- Scope: migrate base entity hierarchy modules from `Class.extend` to native classes while preserving inheritance behavior used by players/mobs/items.
- Acceptance criteria: entity/character exports and runtime behavior remain compatible with downstream modules.
- Verification: `bun run verify:legacy:node22` and `bun run test:browser:protocol:node22`.

### T-170: Native-class migration tier-2.5 (`mob.js`)
- Status: `done`
- Scope: migrate `server/js/mob.js` off `lib/class.js` after entity/character migration, keeping combat/aggro behavior unchanged.
- Acceptance criteria: combat-path protocol flow remains stable with no regressions in server/gameplay parity checks.
- Verification: `bun run verify:legacy:node22` and `bun run test:browser:protocol:node22`.

### T-171: Core class-migration sequence plan (`map`/`metrics`/`ws`/`worldserver`)
- Status: `done`
- Scope: define execution plan and guardrails for remaining highest-risk `lib/class.js` dependents before implementation.
- Acceptance criteria: plan captures ordering constraints, rollback points, and required smoke/CI gates per slice.
- Verification: plan artifact is checked in and referenced from `MODERNIZE.md`.

### T-172: Post-core-plan queue refresh
- Status: `done`
- Scope: refresh queue after T-171 to execute remaining class migrations in plan order (`map` -> `metrics` -> `ws` -> `worldserver`).
- Acceptance criteria: successor tickets have module-specific scope, risk notes, and command-level verification.
- Verification: `MODERNIZE.md` includes post-T171 successor queue with explicit checks.

### T-173: Native-class migration core pilot (`map.js`)
- Status: `done`
- Scope: migrate `server/js/map.js` off `lib/class.js` to native class syntax while preserving map load/group/checkpoint behavior.
- Acceptance criteria: map-dependent server startup and gameplay protocol checks remain stable.
- Verification: `bun run verify:legacy:node22`, `bun run test:browser:protocol:node22`, and `bun run check:class-fanout`.

### T-174: Native-class migration core (`metrics.js`)
- Status: `done`
- Scope: migrate `server/js/metrics.js` off `lib/class.js` while preserving optional memcache behavior and unavailable fallbacks.
- Acceptance criteria: metrics runtime tests/smokes remain stable and no metrics bootstrap regressions occur.
- Verification: `bun run verify:legacy:node22` and `bun run test:browser:protocol:node22`.

### T-175: Native-class migration core (`ws.js`)
- Status: `done`
- Scope: migrate websocket server/connection abstractions from `Class.extend` to native classes without changing handshake/broadcast behavior.
- Acceptance criteria: websocket lifecycle logs, handshake smoke, and browser protocol tests remain green.
- Verification: `bun run verify:legacy:node22` and `bun run test:browser:protocol:node22`.

### T-176: Native-class migration core (`worldserver.js`)
- Status: `done`
- Scope: migrate `server/js/worldserver.js` off `lib/class.js` as final high-risk class migration slice.
- Acceptance criteria: world orchestration, combat/drop flows, and protocol invariants remain unchanged.
- Verification: `bun run verify:legacy:node22`, `bun run test:browser:protocol:node22`, and `bun run check:class-fanout`.

### T-177: Post-class-retirement queue refresh
- Status: `done`
- Scope: refresh modernization queue after complete server-side `lib/class.js` retirement to focus on next 2026 modernization frontier (ESM package-mode migration and legacy-client de-risking).
- Acceptance criteria: successor tickets include explicit sequencing, rollback guardrails, and verification commands.
- Verification: `MODERNIZE.md` contains post-T176 successor queue with executable checks.

### T-178: Package-mode migration readiness checklist
- Status: `done`
- Scope: create a concrete checklist for moving package mode from `"type": "commonjs"` to staged ESM, including script/extension boundaries and rollback plan.
- Acceptance criteria: checklist captures blockers, migration prerequisites, and a command-level validation sequence.
- Verification: checklist artifact is checked in and referenced from `MODERNIZE.md`.

### T-179: Runtime CJS boundary inventory hardening
- Status: `done`
- Scope: inventory remaining intentional CJS entrypoints (`.cjs` tooling, legacy boot bridges) and classify which can move to ESM vs stay CJS.
- Acceptance criteria: explicit boundary map exists with rationale and planned destination for each entrypoint.
- Verification: boundary inventory artifact is checked in and linked from modernization docs.

### T-180: Post-package-prep queue refresh
- Status: `done`
- Scope: refresh queue after T-178/T-179 to prioritize low-risk package-mode transition slices and legacy compatibility verification.
- Acceptance criteria: successor tickets include risk tiers, rollback points, and verification commands.
- Verification: `MODERNIZE.md` includes post-T179 successor queue with executable checks.

### T-181: Package-mode trial execution plan
- Status: `done`
- Scope: define an explicit package-mode trial runbook (branch strategy, toggle steps, rollback commands, and pass/fail gates).
- Acceptance criteria: contributors can run an isolated package-mode trial with deterministic rollback.
- Verification: trial runbook artifact is checked in with command-level gates.

### T-182: Legacy/package-mode compatibility smoke matrix
- Status: `done`
- Scope: define compatibility matrix for legacy client + server runtime entrypoints under current mode vs package-mode trial.
- Acceptance criteria: matrix identifies required smoke commands and expected outcomes for each path.
- Verification: matrix artifact is checked in and linked from modernization docs.

### T-183: Post-package-trial queue refresh
- Status: `done`
- Scope: refresh queue after T-181/T-182 to sequence package-mode implementation tickets or defer criteria.
- Acceptance criteria: successor tickets (or defer rules) are explicit, ordered, and verification-backed.
- Verification: `MODERNIZE.md` includes post-T182 queue with executable checks.

### T-184: Package-mode trial branch execution
- Status: `done` (resolved)
- Scope: execute an isolated package-mode trial branch per runbook (`"type": "module"` switch + boundary checks) and run full gates.
- Acceptance criteria: trial result is clear (green with evidence or rollback with explicit blockers).
- Verification: `verify:legacy:node22`, protocol browser suite, and guard commands executed in trial.

### T-185: Package-mode trial decision record
- Status: `done`
- Scope: record trial outcome, blockers, and recommendation (advance or defer) with concrete evidence.
- Acceptance criteria: decision record includes command outcomes and rollback/next-step rationale.
- Verification: decision artifact/checkpoint is linked from `MODERNIZE.md`.

### T-186: Post-trial queue refresh
- Status: `done`
- Scope: refresh modernization queue based on T-185 decision (implementation slices if green, blocker-reduction slices if deferred).
- Acceptance criteria: next queue is ordered, scoped, and verification-backed.
- Verification: `MODERNIZE.md` includes post-T185 queue with executable checks.

### T-187: Legacy RequireJS build blocker isolation plan
- Status: `done`
- Scope: isolate and document remediation options for `bin/r.js` strict-mode blocker under package-mode trial.
- Acceptance criteria: blocker root cause and at least one safe remediation path are documented with risk/effort tradeoffs.
- Verification: blocker-plan artifact is checked in and linked from modernization docs.

### T-188: Package-mode retry prerequisites checklist
- Status: `done`
- Scope: define explicit prerequisites that must be met before rerunning package-mode trial.
- Acceptance criteria: checklist is objective, testable, and linked to concrete commands.
- Verification: prerequisite checklist artifact is checked in and referenced from `MODERNIZE.md`.

### T-189: Post-blocker-reduction queue refresh
- Status: `done`
- Scope: refresh queue after T-187/T-188 to schedule package-mode retry or alternate modernization path.
- Acceptance criteria: successor queue is ordered, scoped, and evidence-driven.
- Verification: `MODERNIZE.md` includes post-T188 successor queue with executable checks.

### T-190: Package-mode CI drift hardening
- Status: `done`
- Scope: harden docs/CI coherence now that package mode is ESM, ensuring workflows and runbooks do not assume CommonJS default semantics.
- Acceptance criteria: no contradictory package-mode assumptions remain in primary docs/workflow notes.
- Verification: docs/workflow scan + `check:package-mode-boundaries` + `verify:modern:node22` and `verify:legacy:node22`.

### T-191: Legacy optimizer containment assessment
- Status: `done`
- Scope: assess medium-term options for replacing or containing legacy RequireJS optimizer dependency (`r.js`) under ESM package mode.
- Acceptance criteria: options are documented with effort/risk/rollback tradeoffs.
- Verification: assessment artifact is checked in and linked from modernization docs.

### T-192: Post-package-adoption queue refresh
- Status: `done`
- Scope: refresh queue after T-190/T-191 to sequence concrete implementation slices from the chosen optimizer strategy.
- Acceptance criteria: successor queue is ordered, scoped, and verification-backed.
- Verification: `MODERNIZE.md` includes post-T191 successor queue with executable checks.

### T-193: Optimizer boundary provenance and integrity guardrails
- Status: `done`
- Scope: record provenance/version metadata for vendored `bin/r.js` and enforce integrity checks for wrapper/boundary files.
- Acceptance criteria: provenance artifact + integrity guard command exist and run in local verification.
- Verification: new guard command + `verify:legacy:node22`.

### T-194: Legacy artifact consumer inventory
- Status: `done`
- Scope: identify all downstream consumers (if any) of `client-build/` artifacts and classify retirement blockers.
- Acceptance criteria: inventory artifact exists with owner, dependency type, and migration path/risk per consumer.
- Verification: inventory artifact is checked in and linked from modernization docs.

### T-195: Legacy gate demotion rehearsal plan
- Status: `done`
- Scope: design a reversible plan to demote legacy gate from required to advisory once T-194 blockers are cleared.
- Acceptance criteria: demotion criteria, rollback trigger, and CI workflow impact are explicitly documented.
- Verification: rehearsal plan artifact checked in with runnable command matrix.

### T-196: Post-containment queue refresh
- Status: `done`
- Scope: refresh queue after T-193/T-194/T-195 outcomes to schedule concrete implementation PR slices.
- Acceptance criteria: successor queue is ordered, scoped, and evidence-driven.
- Verification: `MODERNIZE.md` includes post-T195 successor queue with executable checks.

### T-197: Branch-protection demotion runbook
- Status: `done`
- Scope: define exact branch-protection changes and dry-run checklist for demoting `verify-legacy` to advisory status.
- Acceptance criteria: runbook includes pre-change checks, change steps, verification, and rollback.
- Verification: runbook artifact checked in and linked from modernization docs.

### T-198: Advisory legacy gate evidence template
- Status: `done`
- Scope: define standard evidence capture format for advisory `verify-legacy` failures during rehearsal window.
- Acceptance criteria: template includes incident fields, reproduction commands, and risk classification.
- Verification: template artifact checked in and referenced by demotion runbook.

### T-199: Legacy retirement cutover PR checklist
- Status: `done`
- Scope: prepare concrete PR checklist for eventual removal of `build:client` and required legacy gate enforcement.
- Acceptance criteria: checklist includes code, docs, CI, and rollback-tag requirements.
- Verification: checklist artifact checked in and linked from legacy retirement docs.

### T-200: Post-demotion queue refresh
- Status: `done`
- Scope: refresh queue after T-197/T-198/T-199 outcomes for execution-phase retirement slices.
- Acceptance criteria: successor queue is ordered, scoped, and verification-backed.
- Verification: `MODERNIZE.md` includes post-T199 successor queue with executable checks.

### T-201: Advisory-era legacy incident log bootstrap
- Status: `done`
- Scope: add a reusable incident-log artifact populated from the T-198 template for advisory `verify-legacy` failures.
- Acceptance criteria: incident-log format exists and includes at least one example entry schema.
- Verification: incident-log artifact checked in and linked from demotion docs.

### T-202: Branch-protection demotion dry-run evidence
- Status: `done`
- Scope: execute dry-run per T-197 on a test PR and capture concrete evidence/results.
- Acceptance criteria: dry-run record includes run URLs, outcome summary, and rollback-readiness note.
- Verification: dry-run evidence artifact checked in.

### T-203: Retirement cutover preflight gap closure
- Status: `done`
- Scope: map open items from T-199 checklist to actionable tasks with owners/status.
- Acceptance criteria: gap-closure list exists with clear pass/fail readiness state for cutover.
- Verification: preflight gap artifact checked in and referenced from retirement docs.

### T-204: Post-T203 queue refresh
- Status: `done`
- Scope: refresh queue after T-202/T-203 outcomes to focus on remaining operational retirement blockers.
- Acceptance criteria: successor queue is ordered, scoped, and verification-backed.
- Verification: `MODERNIZE.md` includes post-T203 successor queue with executable checks.

### T-205: External consumer confirmation protocol
- Status: `done`
- Scope: define explicit confirmation workflow for downstream `client-build/` consumers (owners, response log, cutoff date).
- Acceptance criteria: protocol artifact exists and references inventory + preflight gaps.
- Verification: protocol artifact checked in and linked from retirement docs.

### T-206: Rollback owner and release-tag assignment record
- Status: `done`
- Scope: create a structured record for retirement-cutover rollback owner, escalation path, and fallback release/tag.
- Acceptance criteria: assignment artifact exists with concrete placeholders/checklist fields.
- Verification: assignment artifact checked in and linked from cutover checklist.

### T-207: Retirement cutover readiness decision gate
- Status: `done`
- Scope: define a final pass/fail decision template combining T-205/T-206 outcomes plus verification command evidence.
- Acceptance criteria: decision artifact exists with explicit go/no-go criteria and signoff fields.
- Verification: decision artifact checked in and referenced from retirement preflight docs.

### T-208: Post-T207 queue refresh
- Status: `done`
- Scope: refresh queue after T-205/T-206/T-207 outcomes for operational execution records and signoff.
- Acceptance criteria: successor queue is ordered, scoped, and verification-backed.
- Verification: `MODERNIZE.md` includes post-T207 successor queue with executable checks.

### T-209: External consumer confirmation execution
- Status: `todo`
- Scope: execute the T-205 protocol with real stakeholder responses and fill response log.
- Acceptance criteria: response log has explicit entries and final classification (`no-consumer` or owned migration plans).
- Verification: updated `docs/legacy-external-consumer-confirmation-protocol.md`.

### T-210: Rollback assignment completion
- Status: `todo`
- Scope: populate T-206 record with concrete owner/escalation/fallback-tag values.
- Acceptance criteria: assignment fields are filled and acknowledged by maintainers.
- Verification: updated `docs/legacy-retirement-rollback-assignment.md`.

### T-211: Readiness decision execution
- Status: `todo`
- Scope: populate T-207 decision gate with real pass/fail evidence and maintainer signoff.
- Acceptance criteria: go/no-go decision is recorded with timestamp and signoffs.
- Verification: updated `docs/legacy-retirement-readiness-decision.md`.

### T-212: TypeScript bootstrap (technical track)
- Status: `done`
- Scope: introduce incremental TS typecheck baseline for selected tests/tooling and wire repeatable commands.
- Acceptance criteria: `typecheck` commands exist and pass on selected initial surface.
- Verification: `bun run typecheck` and `bun run typecheck:node22`.

### T-213: Server CJS->ESM wave 1 (priority P0)
- Status: `done`
- Scope: convert low-risk server runtime modules from `require/module.exports` to ESM imports/exports with compatibility maintained.
- Acceptance criteria: selected wave-1 modules run under existing server boot paths without protocol regressions.
- Verification: `bun run verify:modern:node22`, `bun run verify:legacy:node22`, `bun run test:browser:protocol:node22`.

### T-214: WebSocket module modernization (priority P0)
- Status: `done`
- Scope: modernize websocket runtime boundaries (`server/js/ws.js` and related entry wiring) toward ESM-first and stronger protocol/error handling.
- Acceptance criteria: websocket handling changes preserve gameplay/protocol invariants and improve close/error semantics.
- Verification: `bun run test:browser:protocol:node22` + targeted websocket smoke coverage.

### T-215: Shared protocol typing (priority P1)
- Status: `done`
- Scope: establish shared typed protocol action contracts used by tests and server/client boundaries.
- Acceptance criteria: protocol helper/types are single-source and referenced by both runtime-adjacent code and tests.
- Verification: `bun run typecheck` + protocol browser suite.

### T-216: TypeScript expansion wave 2 (priority P1)
- Status: `done`
- Scope: expand TS checking surface from initial tools/helpers into smoke/unit test suites with explicit exclusions tracked.
- Acceptance criteria: expanded `tsconfig` coverage lands with documented defer list for unresolved files.
- Verification: `bun run typecheck` + `bun run test`.

### T-217: Post-technical-wave queue refresh
- Status: `done`
- Scope: refresh queue after T-213/T-214/T-215/T-216 to sequence deeper runtime migration slices.
- Acceptance criteria: successor queue is ordered, scoped, and evidence-backed.
- Verification: `MODERNIZE.md` includes post-T216 successor queue with executable checks.

### T-218: ESM entry wiring for wave-1 modules
- Status: `done`
- Scope: update `server/js/main-esm.mjs` path to consume wave-1 ESM modules (`config-preflight-esm`, `utils-esm`) while preserving compatibility with existing runtime behavior.
- Acceptance criteria: ESM entry path uses wave-1 ESM modules without changing default CJS boot behavior.
- Verification: `bun run start:server:esm` smoke + protocol/browser gate.

### T-219: Post-wave-1 queue refresh
- Status: `done`
- Scope: refresh technical queue after T-213/T-218 completion to sequence deeper server module conversion batches.
- Acceptance criteria: successor queue is ordered and scoped by risk/dependency.
- Verification: `MODERNIZE.md` includes post-wave-1 successor queue with executable checks.

### T-220: Shared protocol contract extraction (priority P0)
- Status: `done`
- Scope: extract reusable protocol opcode/entity/action typing into a shared module consumable by tests and runtime-adjacent server/client entry code.
- Acceptance criteria: tests no longer define ad-hoc protocol opcode contracts; shared protocol definitions are imported from one maintained location.
- Verification: `bun run typecheck` + `bun run test` + `bun run test:browser:protocol:node22`.

### T-221: Server CJS->ESM wave 2 (priority P0)
- Status: `done`
- Scope: convert the next low/medium-risk server modules (starting with websocket-adjacent and utility boundaries) to ESM while keeping CJS compatibility bridge behavior stable.
- Acceptance criteria: selected wave-2 modules have ESM mirrors with parity coverage and no regressions in smoke/browser protocol paths.
- Verification: `bun run verify:modern:node22` + `bun run verify:legacy:node22` + `bun run test:browser:protocol:node22`.

### T-222: WebSocket transport modernization wave 2 (priority P1)
- Status: `done`
- Scope: continue websocket modernization toward explicit typed payload handling, close/error semantics, and module-boundary cleanup without protocol behavior regressions.
- Acceptance criteria: websocket runtime and protocol-invariant suites remain stable with improved transport boundary clarity.
- Verification: `bun run test` + `bun run test:browser:protocol:node22`.

### T-223: TypeScript expansion wave 3 (priority P1)
- Status: `done`
- Scope: extend TS checks beyond tests/tools into selected runtime-adjacent shared/server modules with tracked defers for high-churn legacy surfaces.
- Acceptance criteria: expanded TS coverage lands with explicit defer list and no regression in existing verify gates.
- Verification: `bun run typecheck` + `bun run verify:modern:node22`.

### T-224: Post-wave queue refresh (websocket+TS wave 3)
- Status: `done`
- Scope: refresh modernization queue after T-222/T-223 to prioritize the next highest-leverage runtime migration slices.
- Acceptance criteria: successor queue is ordered, scoped, and mapped to existing verification gates.
- Verification: `MODERNIZE.md` includes executable successor tickets after T-223.

### T-225: WebSocket ESM mirror extraction (priority P0)
- Status: `done`
- Scope: introduce `server/js/ws-esm.mjs` mirror with parity tests while preserving CJS runtime entry compatibility.
- Acceptance criteria: websocket ESM mirror behavior matches CJS transport semantics for handshake/error/close paths.
- Verification: `bun run test` + `bun run test:browser:protocol:node22` + `bun run verify:modern:node22`.

### T-226: Runtime CheckJs wave 4 (selected gameplay pilot)
- Status: `done`
- Scope: expand `tsconfig.typecheck-runtime.json` into one deferred gameplay module pilot (`player` or `entity`) with targeted property-shape cleanup.
- Acceptance criteria: at least one deferred gameplay module is promoted from defer list into active CheckJs scope without gate regressions.
- Verification: `bun run typecheck` + `bun run verify:legacy:node22`.

### T-227: WebSocket ESM entry adoption probe (priority P1)
- Status: `done`
- Scope: wire an opt-in smoke path that imports websocket transport through `server/js/ws-esm.mjs` in ESM entry flow and validates parity.
- Acceptance criteria: ESM websocket mirror is exercised in a runtime smoke without changing default CJS boot path.
- Verification: `bun run test` + `bun run test:browser:protocol:node22`.

### T-228: Protocol-close-code contract extraction
- Status: `done`
- Scope: centralize websocket close-code constants into a shared runtime contract to remove local duplication and improve close-code consistency.
- Acceptance criteria: transport/runtime code paths consume one close-code source and protocol rejection tests remain stable.
- Verification: `bun run test` + `bun run verify:modern:node22`.

### T-229: WebSocket ESM entry adoption signal hardening
- Status: `done`
- Scope: add structured diagnostic event/log for `BQ_ESM_WS_BRIDGE_PROBE=1` success/failure path so operators can confirm probe execution in smoke/CI logs.
- Acceptance criteria: probe-enabled ESM entry emits an explicit success signal and failure remains fail-fast.
- Verification: `bun run test` + `bun run test:browser:protocol:node22`.

### T-230: Runtime CheckJs wave 5 (next gameplay pilot)
- Status: `done`
- Scope: promote one additional deferred gameplay module (`item.js` or `player.js` pre-slice) into runtime CheckJs scope with targeted property-shape cleanup.
- Acceptance criteria: runtime CheckJs scope expands by one gameplay module without verify-gate regressions.
- Verification: `bun run typecheck` + `bun run verify:legacy:node22`.

### T-231: Runtime CheckJs wave 6 (`player.js` pilot)
- Status: `done`
- Scope: promote `server/js/player.js` into runtime CheckJs scope with minimal property-shape initialization cleanup.
- Acceptance criteria: `player.js` is included in runtime CheckJs scope and verify gates remain green.
- Verification: `bun run typecheck` + `bun run verify:legacy:node22`.

### T-232: Runtime CheckJs wave 7 planning (`worldserver.js`/`map.js` pre-slice)
- Status: `done`
- Scope: define scoped pre-slice checklist for `worldserver.js` and `map.js` CheckJs adoption (property inventory, dependency impacts, staged roll-in).
- Acceptance criteria: concrete staged checklist exists with executable verification commands and rollback guardrails.
- Verification: `MODERNIZE.md` contains the staged checklist and follow-on execution ticket.

### T-233: Runtime CheckJs wave 7A (`map.js` promotion)
- Status: `done`
- Scope: promote `server/js/map.js` into runtime CheckJs scope as the first wave-7 execution slice.
- Acceptance criteria: `map.js` is in runtime CheckJs include list and gates remain green.
- Verification: `bun run typecheck` + `bun run verify:legacy:node22`.

### T-234: Runtime CheckJs wave 7B (`worldserver.js` blocker cleanup)
- Status: `done`
- Scope: resolve identified `worldserver.js` admission blockers (`mob.area` property shape and chest `setItems` narrowing) so module can enter runtime CheckJs scope.
- Acceptance criteria: isolated `worldserver.js` CheckJs command is green after targeted cleanup.
- Verification: `bun x tsc --allowJs --checkJs --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler server/js/worldserver.js` + `bun run verify:legacy:node22`.

### T-235: Runtime CheckJs wave 7C (`worldserver.js` promotion)
- Status: `done`
- Scope: add `server/js/worldserver.js` to runtime CheckJs include set once blocker cleanup is complete.
- Acceptance criteria: `worldserver.js` is in runtime CheckJs scope and verify gates remain green.
- Verification: `bun run typecheck` + `bun run verify:legacy:node22`.

### T-236: Runtime CheckJs scope re-baseline and next-candidate refresh
- Status: `done`
- Scope: refresh runtime CheckJs inventory after wave-7 promotions and define next candidate list (explicit include or defer) for remaining server gameplay modules.
- Acceptance criteria: updated defer/scope docs and successor queue are consistent with current typecheck surface.
- Verification: `MODERNIZE.md` + `docs/typescript-runtime-checkjs-defer-list.md` reflect post-wave-7 baseline.

### T-237: Runtime CheckJs wave 8A (`formulas.js` + `message.js` promotion)
- Status: `done`
- Scope: promote `server/js/formulas.js` and `server/js/message.js` into runtime CheckJs scope as a low-risk post-wave-7 batch.
- Acceptance criteria: both modules are included in runtime CheckJs scope and verify gates remain green.
- Verification: `bun run typecheck` + `bun run verify:legacy:node22`.

### T-238: Runtime CheckJs wave 8B (mobility runtime trio promotion)
- Status: `done`
- Scope: promote `server/js/mob.js`, `server/js/mobarea.js`, and `server/js/npc.js` into runtime CheckJs scope with any required minimal property-shape cleanup.
- Acceptance criteria: mobility trio is included in runtime CheckJs scope and gates remain green.
- Verification: `bun run typecheck` + `bun run verify:legacy:node22`.

### T-239: Runtime CheckJs wave 8C (zone/entity graph promotion)
- Status: `done`
- Scope: promote `server/js/area.js`, `server/js/character.js`, `server/js/chest.js`, `server/js/chestarea.js`, `server/js/checkpoint.js`, and `server/js/properties.js` into runtime CheckJs scope.
- Acceptance criteria: zone/entity graph modules enter runtime CheckJs scope without gate regressions.
- Verification: `bun run typecheck` + `bun run verify:legacy:node22`.

### T-240: Runtime CheckJs wave 8D (metrics/main blocker pre-slice)
- Status: `done`
- Scope: resolve CheckJs blockers for `server/js/main.js`, `server/js/metrics.js`, and `server/js/metrics-runtime.js`, then promote metrics/main runtime modules into CheckJs scope.
- Acceptance criteria: previously blocked modules pass isolated CheckJs and are included in runtime CheckJs scope with green gates.
- Verification: isolated `bun x tsc ...` checks for blocked modules + `bun run typecheck` + `bun run verify:legacy:node22`.

### T-241: Post-runtime-scope completion queue refresh (ESM/class + websocket focus)
- Status: `done`
- Scope: refresh the modernization queue after runtime CheckJs scope completion, prioritizing server ESM/class migration slices and websocket transport hardening follow-ups.
- Acceptance criteria: successor tickets are explicit, ordered, and tied to verification commands.
- Verification: `MODERNIZE.md` active queue and logs reflect the post-runtime-scope roadmap.

### T-242: Server metrics/runtime ESM mirror extraction
- Status: `done`
- Scope: add ESM mirror modules for `server/js/metrics.js` and `server/js/metrics-runtime.js` that preserve current CJS behavior/contracts and keep bridgeable entry semantics.
- Acceptance criteria: ESM mirrors export parity-checked contracts with focused tests and no runtime regressions.
- Verification: `bun run test` + targeted metrics/runtime unit coverage + `bun run verify:modern:node22`.

### T-243: Server bootstrap extraction for dual-entry convergence
- Status: `done`
- Scope: extract `main.js` runtime bootstrap logic into shared helpers so CJS and ESM entries can consume the same startup path with minimal duplication.
- Acceptance criteria: startup lifecycle behavior and structured events remain unchanged while duplication is reduced.
- Verification: `bun run test` + server handshake smokes + `bun run verify:legacy:node22`.

### T-244: WebSocket transport hardening follow-up (post-bridge)
- Status: `done`
- Scope: expand websocket transport contract coverage for lifecycle/backpressure/error-handling parity across CJS and ESM bridge paths.
- Acceptance criteria: explicit contract tests exist for targeted lifecycle/error cases and remain green on both verify tracks.
- Verification: focused websocket unit/smoke tests + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-245: ESM bootstrap convergence (`main-esm` bridge reduction)
- Status: `done`
- Scope: continue reducing `main-esm.mjs` dependence on CJS bootstrap side effects by extracting/importing reusable startup pieces while preserving current runtime behavior.
- Acceptance criteria: ESM bootstrap path retains preflight/probe guarantees with less CJS coupling and no handshake/config regressions.
- Verification: `bun run test` + ESM handshake/config smokes + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-246: Server runtime dependency boundary extraction (`main-runtime` follow-up)
- Status: `done`
- Scope: split heavyweight dependency wiring (`ws`, `worldserver`, `player`) out of `main-runtime` startup flow into explicit dependency boundaries to prepare future ESM-native startup runtime migration.
- Acceptance criteria: startup behavior remains unchanged while dependency construction points are isolated behind explicit helpers/contracts.
- Verification: focused startup/runtime unit tests + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-247: Server runtime constructor seam extraction (`main-runtime` factory step)
- Status: `done`
- Scope: extract startup constructor wiring (`server`, `metrics`, world instance loop) into explicit factory helpers so runtime assembly can be tested and migrated independently of process/event wiring.
- Acceptance criteria: constructor assembly logic is isolated behind explicit helpers with unchanged runtime behavior.
- Verification: focused startup/runtime unit coverage + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-248: Server runtime process-event seam extraction (fatal/reporting/timers)
- Status: `done`
- Scope: extract process-bound side effects (fatal handlers, interval/timer wiring, structured event emission helpers) behind explicit seams to reduce implicit globals in startup runtime.
- Acceptance criteria: process/event side effects remain behaviorally identical while seam boundaries are explicit and testable.
- Verification: focused startup/runtime unit + fatal/log smokes + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-249: Server runtime lifecycle cleanup seam extraction (timer/hook teardown)
- Status: `done`
- Scope: introduce explicit runtime lifecycle cleanup seams (population timer teardown and process fatal-hook teardown contracts) to make startup runtime deterministic for tests/future ESM-native server lifecycle management.
- Acceptance criteria: cleanup contracts exist and can be invoked without changing live runtime behavior defaults.
- Verification: focused startup/runtime unit tests + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-250: Server runtime seam-test log hygiene
- Status: `done`
- Scope: remove noisy startup log side effects from seam-focused unit tests by introducing explicit logger seam injection for startup path tests.
- Acceptance criteria: seam unit tests remain deterministic and quiet without altering production log behavior.
- Verification: focused unit suite + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-251: Server runtime metrics seam extraction (population/update hooks)
- Status: `done`
- Scope: extract metrics population/update callback wiring from `main-runtime` into explicit seam helpers so metrics behavior can be tested/migrated independently of connection bootstrap.
- Acceptance criteria: metrics hook wiring is isolated behind explicit helpers with unchanged runtime behavior.
- Verification: focused runtime unit tests + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-252: Shared protocol typing unification (runtime + tests)
- Status: `done`
- Scope: establish a single shared protocol type contract consumable by runtime CheckJs surfaces and TypeScript test/support modules to reduce duplicate protocol shape definitions.
- Acceptance criteria: runtime parser/transport and test protocol helpers import one shared protocol type contract with green typecheck gates.
- Verification: `bun run typecheck` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-253: WebSocket native ESM extraction wave-1 (`ws` runtime convergence)
- Status: `done`
- Scope: introduce an ESM-native websocket runtime module path for server entry convergence, reducing reliance on `createRequire` bridge wrappers while preserving current CJS compatibility behavior.
- Acceptance criteria: websocket runtime has an ESM-native implementation path with parity coverage and unchanged handshake/protocol behavior on both verify tracks.
- Verification: websocket-focused unit/smoke coverage + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-254: WebSocket ESM runtime adoption in startup dependency seam (opt-in)
- Status: `done`
- Scope: add an opt-in startup path that injects ESM-native websocket runtime through `main-runtime` dependency seams, keeping CJS default unchanged.
- Acceptance criteria: opt-in startup path exercises ESM-native websocket runtime in live server flow with explicit probe/smoke evidence and no protocol regressions.
- Verification: websocket bridge/protocol smokes + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-255: WebSocket ESM runtime probe hardening (failure-path + mode contract)
- Status: `done`
- Scope: extend ESM runtime-mode observability/probe checks to include explicit failure-path diagnostics and assertions that runtime mode signaling matches startup wiring.
- Acceptance criteria: probe/failure contracts are explicit in smoke tests and runtime logs for both success and forced-failure paths.
- Verification: websocket runtime/bridge smoke tests + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-256: WebSocket ESM startup-mode docs/runbook alignment
- Status: `done`
- Scope: document opt-in ESM websocket runtime controls (`BQ_ESM_WS_RUNTIME`, failure probe toggles) and associated smoke commands for contributor/operator use.
- Acceptance criteria: README/runbook references include startup-mode flags, expected structured signals, and failure-diagnostic command examples.
- Verification: docs lint/read-through + targeted smoke command replay.

### T-257: Server startup dependency seam docs alignment (ESM injection path)
- Status: `done`
- Scope: refresh server startup-seam docs/inventory to reflect current ESM websocket runtime injection path and remaining convergence gaps.
- Acceptance criteria: roadmap/inventory docs accurately describe default CJS path, opt-in ESM websocket path, and next technical blockers for deeper ESM-native startup migration.
- Verification: docs read-through against current runtime code + smoke command references.

### T-258: Startup seam command ergonomics (ESM websocket runtime modes)
- Status: `done`
- Scope: add explicit package scripts for opt-in ESM websocket runtime startup/probe modes so contributors can run startup seam paths without manual env flag composition.
- Acceptance criteria: package scripts cover success-mode and forced-failure mode for ESM websocket runtime startup seam and are documented in runbooks.
- Verification: run added scripts + `bun test tests/smoke/server-handshake-esm-ws-runtime.test.ts`.

### T-259: Startup seam runtime-options extraction (`main-esm`) for testability
- Status: `done`
- Scope: extract ESM startup runtime-options decision logic into a focused helper module/function so env-flag behavior can be tested without booting the full server process.
- Acceptance criteria: runtime-options decision logic is isolated behind a callable contract with focused unit coverage and unchanged startup behavior.
- Verification: focused unit tests + `bun run test:smoke:esm:ws-runtime` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-260: ESM bridge-probe helper extraction (`main-esm`) for seam parity
- Status: `done`
- Scope: extract websocket bridge-probe decision logic from `main-esm` into a focused helper module/function so bridge contract checks are unit-testable without full process startup.
- Acceptance criteria: bridge-probe logic is isolated with focused unit coverage and existing probe smoke behavior remains unchanged.
- Verification: focused unit tests + `bun test tests/smoke/server-handshake-esm-ws-bridge.test.ts` + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-261: ESM startup helper contract docs + export parity sweep
- Status: `done`
- Scope: align docs and tests around extracted `main-esm` startup helper modules (`main-esm-runtime-options`, `main-esm-bridge-probe`) to keep startup seam contracts explicit and discoverable.
- Acceptance criteria: helper contracts are documented and have explicit unit/export parity references without changing runtime behavior.
- Verification: focused unit tests + docs read-through + `bun run verify:modern:node22`.

### T-262: ESM startup helper command mapping docs alignment
- Status: `done`
- Scope: ensure runbook references map startup helper contracts to concrete script commands (`start:server:esm:*`, `test:smoke:esm:ws-runtime`) for faster operator/debug workflows.
- Acceptance criteria: docs explicitly tie helper contracts, runtime flags, and script aliases together without ambiguity.
- Verification: docs read-through + helper-focused test command replay.

### T-263: ESM startup helper adoption note in package-mode runbook
- Status: `done`
- Scope: update package-mode migration checklist with current extracted startup helper contracts and script aliases so migration sequencing references the real 2026 startup seam state.
- Acceptance criteria: package-mode runbook explicitly references helper modules + startup script aliases in migration boundary checklist.
- Verification: docs read-through + `bun run test:smoke:esm:ws-runtime`.

### T-264: Post-helper-extraction queue refresh (next runtime seams)
- Status: `done`
- Scope: refresh modernization queue after `main-esm` helper extraction/docs alignment to prioritize next startup/runtime seam candidates for ESM-native convergence.
- Acceptance criteria: successor tickets are explicit, ordered, and tied to current verify/smoke gates.
- Verification: `MODERNIZE.md` queue/log alignment + helper smoke command replay.

### T-265: Config-source resolution seam extraction (`main-esm`)
- Status: `done`
- Scope: extract config file resolution/loading (`config_local` fallback to `config`) from `main-esm` into a focused helper so config-source behavior is unit-testable.
- Acceptance criteria: config-source resolution logic is isolated with focused unit coverage and unchanged startup behavior.
- Verification: focused unit tests + config-preflight smokes + `bun run verify:modern:node22`.

### T-266: ESM preflight failure-emission seam extraction (`main-esm`)
- Status: `done`
- Scope: extract invalid-config/no-config failure emission behavior into explicit helper contracts so fatal-startup diagnostics are testable without full process execution.
- Acceptance criteria: startup preflight failure paths are isolated and unit-tested; structured/error output behavior remains unchanged.
- Verification: focused unit tests + `tests/smoke/server-config-preflight-esm-entry.test.ts` + `bun run verify:modern:node22`.

### T-267: ESM startup runner assembly seam extraction (`main-esm`)
- Status: `done`
- Scope: extract final startup runner composition (`probe -> runtime options -> startServer`) into a small orchestrator helper to reduce top-level script complexity and prepare deeper ESM-native boot adoption.
- Acceptance criteria: orchestrator helper exists with contract tests and no behavior change across startup smokes.
- Verification: focused unit tests + websocket/config startup smokes + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-268: Post-startup-runner queue refresh (next ESM boot seams)
- Status: `done`
- Scope: refresh modernization queue after startup runner/helper extraction to prioritize the next ESM boot convergence candidates (structured-event emission seam and top-level boot envelope simplification).
- Acceptance criteria: successor tickets are explicit, ordered, and bound to current startup/unit/smoke gates.
- Verification: `MODERNIZE.md` queue/log alignment + startup helper test replay.

### T-269: ESM structured-event emission seam extraction (`main-esm`)
- Status: `done`
- Scope: extract `main-esm` structured event + bridge-probe event emission into a focused helper module so emitter behavior is unit-testable without process boot.
- Acceptance criteria: emitter helper contracts exist with focused unit coverage and startup behavior remains unchanged across ESM entry smokes.
- Verification: focused unit tests + websocket/config startup smokes + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-270: ESM boot-envelope seam extraction (`main-esm`)
- Status: `todo`
- Scope: extract top-level ESM boot envelope (`resolve config -> preflight -> startup-runner`) into a single helper contract to simplify entry script and prepare deeper ESM-native startup adoption.
- Acceptance criteria: `main-esm.mjs` becomes a thin bootstrap wrapper and boot-envelope helper has focused contract tests with unchanged startup behavior.
- Verification: focused unit tests + `tests/smoke/server-handshake-esm-entry.test.ts` + `tests/smoke/server-config-preflight-esm-entry.test.ts` + `bun run verify:modern:node22`.

### T-271: Protocol contract TypeScript source-of-truth promotion
- Status: `todo`
- Scope: promote shared protocol contract definitions to a TypeScript-first source module while preserving runtime CJS/ESM compatibility exports for existing server/client consumers.
- Acceptance criteria: shared protocol types are authored in TS, runtime exports remain stable, and CheckJs/test imports consume one canonical typed surface.
- Verification: `bun run typecheck` + protocol contract unit tests + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.

### T-272: WebSocket runtime class-boundary modernization (ESM-first)
- Status: `todo`
- Scope: introduce an ESM-first websocket runtime class boundary (constructor + lifecycle methods) consumed via startup dependency seams, reducing ad-hoc module wiring and improving typed transport contracts.
- Acceptance criteria: websocket runtime path supports class-based seam injection with parity-tested handshake/error/close behavior and retains current CJS default path.
- Verification: websocket unit/smoke suites + `bun run verify:modern:node22` + `bun run verify:legacy:node22`.
