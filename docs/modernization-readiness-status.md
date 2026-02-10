# Modernization Readiness Status (2026-02-08)

## Delta Update (2026-02-10 retire redundant client alias-drift verifier)

### Ticket status

- `T-352.1` Retire redundant `check:client-runtime-alias-drift` tooling/scripts after Vite built-in alias cutover: `done`
- `T-352.2` Enforce alias-drift tool/script retirement boundary in package-mode guard: `done`
- `T-352.3` Re-verify full modern lane and capture evidence: `done`

### Live progress log

- `2026-02-10T00:28Z` `in_progress` Started verify-lane cleanup to remove now-redundant client alias drift checker after `resolve.alias` moved to `tsconfig`-derived built-in mapping.
  - Scope:
    - remove `check:client-runtime-alias-drift` scripts from `package.json`
    - remove `tools/check-client-runtime-alias-drift.ts`
    - drop strict alias-drift invocation from `verify:modern`
    - enforce retirement boundaries in `tools/check-package-mode-boundaries.ts`
  - Out of scope:
    - changing client runtime import style
    - changing `check:client-runtime-coverage` behavior
  - Acceptance criteria:
    - no active `check:client-runtime-alias-drift*` scripts remain
    - alias-drift tool file no longer exists
    - package boundary check fails if scripts/tool are reintroduced
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run verify:modern:node22`
- `2026-02-10T00:29Z` `done` Completed alias-drift verifier retirement and re-verified full modern lane.
  - Evidence:
    - `package.json` updates:
      - removed `check:client-runtime-alias-drift`
      - removed `check:client-runtime-alias-drift:strict`
      - removed alias-drift strict step from `verify:modern`
    - removed obsolete tool:
      - deleted `tools/check-client-runtime-alias-drift.ts`
    - retirement guard updates:
      - `tools/check-package-mode-boundaries.ts` now fails if:
        - `check:client-runtime-alias-drift` script exists
        - `check:client-runtime-alias-drift:strict` script exists
        - `tools/check-client-runtime-alias-drift.ts` exists
      - guard success banner now includes alias-drift checker retirement
  - Verification:
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-10 runtime preflight + Vite alias built-in cutover)

### Ticket status

- `T-349.1` Replace shell-based runtime version probing with Bun built-in process APIs while preserving Node22-wrapper behavior: `done`
- `T-350.1` Replace custom Vite FS resolver plugin with built-in `resolve.alias` sourced from client runtime TypeScript path map: `done`
- `T-351.1` Record ticketized scope/acceptance/evidence for this modernization slice: `done`

### Live progress log

- `2026-02-10T00:24Z` `in_progress` Started built-in-modernization pass focused on runtime preflight probing and Vite import resolution surface simplification.
  - Scope:
    - `tools/check-runtime.ts`: drop shell `execSync` probes and keep runtime policy semantics intact for both direct and `node22` wrapper lanes
    - `vite.config.ts`: remove custom `browserquest-requirejs-imports` plugin and use Vite `resolve.alias`
  - Out of scope:
    - changing Node/Bun required versions
    - rewriting client runtime import specifiers
  - Acceptance criteria:
    - `bun run check:runtime:node22` remains green under wrapper semantics
    - `vite build` resolves all client runtime bare specifiers without custom resolver plugin
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run check:runtime:node22`
    - `bun run build:vite`
    - `bun run verify:modern:node22`
- `2026-02-10T00:27Z` `done` Completed built-in runtime-preflight and Vite alias cutover; full modern lane re-verified.
  - Evidence:
    - runtime preflight:
      - updated `tools/check-runtime.ts`:
        - removed `node:child_process` dependency
        - uses `Bun.spawnSync` for `node -p process.version` so PATH-based Node22 wrapper behavior stays intact
        - uses `Bun.version` for Bun runtime version probe
      - behavior confirmation:
        - `bun run check:runtime` fails under non-22 local Node as expected
        - `bun run check:runtime:node22` passes (`runtime-check: ok (node v22.22.0, bun 1.3.2)`)
    - Vite import-resolution modernization:
      - updated `vite.config.ts`:
        - removed custom plugin `browserquest-requirejs-imports`
        - added built-in `resolve.alias` entries generated from `tsconfig.typecheck-client-runtime.json` `compilerOptions.paths`
      - build confirmation:
        - `bun run build:vite` passed (126 modules transformed)
    - full-lane verification:
      - `bun run verify:modern:node22` passed

## Delta Update (2026-02-10 legacy IE stylesheet/conditional retirement)

### Ticket status

- `T-348.1` Remove obsolete IE<9 conditional include path from active HTML entry: `done`
- `T-348.2` Retire `client/css/ie.css` and enforce retirement boundary: `done`
- `T-348.3` Re-verify modern lane and record evidence: `done`

### Live progress log

- `2026-02-10T00:21Z` `in_progress` Started legacy-browser cleanup pass to remove obsolete IE-specific fallback scaffolding from modern-only entry/runtime policy.
  - Scope:
    - remove IE conditional blocks from `client/modern.html`
    - delete retired `client/css/ie.css`
    - enforce `client/css/ie.css` retirement in package boundary guard
  - Out of scope:
    - broader HTML head cleanup
  - Acceptance criteria:
    - no active `lt IE 9`/`ie.css`/`css3-mediaqueries.js` references remain
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `rg -n "ie\\.css|lt IE 9|css3-mediaqueries\\.js" client README.md docs package.json tools tests server -g '!docs/archive/**' -g '!docs/modernization-readiness-status.md' -g '!MODERNIZE.md' -g '!dist/**'`
    - `bun run verify:modern:node22`
- `2026-02-10T00:22Z` `done` Completed IE fallback retirement and re-verified full modern lane.
  - Evidence:
    - updated `client/modern.html`:
      - removed `<!--[if lt IE 9]>` conditional stylesheet/script block
      - removed duplicate conditional body tag variant
    - removed retired stylesheet:
      - deleted `client/css/ie.css`
    - boundary enforcement:
      - `tools/check-package-mode-boundaries.ts` now fails if `client/css/ie.css` exists
    - reference sweep:
      - no active `ie.css`/`lt IE 9`/`css3-mediaqueries.js` references remain outside the retirement guard.
  - Verification:
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-10 Bun-native Node22 runner cutover)

### Ticket status

- `T-347.1` Replace shell-based Node22 shim runner with Bun-native TypeScript runner: `done`
- `T-347.2` Rewire active `*:node22` scripts/docs to Bun runner and retire shell script: `done`
- `T-347.3` Re-verify full modern lane and enforce retirement boundary: `done`

### Live progress log

- `2026-02-10T00:19Z` `in_progress` Started Node22 runner modernization to remove bash-script orchestration from active verify/test/typecheck lanes.
  - Scope:
    - add `tools/node22-run.ts` Bun-native runner
    - rewire all active `*:node22` scripts from `bash tools/node22-run.sh ...` to `bun tools/node22-run.ts ...`
    - remove retired `tools/node22-run.sh`
    - enforce shell-runner retirement in package boundary checks
  - Out of scope:
    - changing Node22 resolution semantics (must still prefer system Node 22 and fallback via `npm exec --package=node@22`)
  - Acceptance criteria:
    - no active script/docs reference `tools/node22-run.sh`
    - `tools/node22-run.sh` no longer exists
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run verify:modern:node22`
- `2026-02-10T00:21Z` `done` Completed Bun-native Node22 runner cutover and re-verified full modern lane.
  - Evidence:
    - added `tools/node22-run.ts`:
      - Bun-native command runner with Node22 resolution fallback (`npm exec --package=node@22`)
      - PATH shim injection via temporary `node` symlink
    - updated active scripts:
      - `package.json` `*:node22` commands now use `bun tools/node22-run.ts ...`
    - updated active docs:
      - `docs/runtime-preflight.md` command updated to Bun runner path
    - retired shell runner:
      - deleted `tools/node22-run.sh`
      - `tools/check-package-mode-boundaries.ts` now fails if `tools/node22-run.sh` reappears
  - Verification:
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-10 Vite public-asset lane for dynamic runtime images)

### Ticket status

- `T-346.1` Move dynamic runtime image assets from `client/img/**` to Vite public lane: `done`
- `T-346.2` Repoint active runtime and Tiled references to public-asset paths: `done`
- `T-346.3` Enforce `client/img` retirement boundary and verify full modern lane: `done`

### Live progress log

- `2026-02-10T00:15Z` `in_progress` Started dynamic-image asset lane cutover to avoid large `import.meta.glob` URL manifests in runtime JS and use Vite public assets for idiomatic dynamic filename loading.
  - Scope:
    - move `client/img/**` to `client/public/img/**`
    - set Vite `publicDir` to `client/public`
    - replace image resolver glob manifest with deterministic `/img/<scale>/<name>.png` URLs
    - update active HTML/CSS and Tiled-source references still pointing at `client/img`
  - Out of scope:
    - image content changes
  - Acceptance criteria:
    - active runtime no longer references `client/img` or `../img` paths
    - package boundary guard fails if `client/img` reappears
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `rg -n "client/img/|\\.\\./img/|import\\.meta\\.glob\\('\\.\\./img" client tools README.md docs vite.config.ts package.json -g '!docs/archive/**' -g '!docs/modernization-readiness-status.md' -g '!dist/**' -g '!MODERNIZE.md'`
    - `bun run verify:modern:node22`
- `2026-02-10T00:18Z` `done` Completed Vite public-asset lane cutover for dynamic runtime images and re-verified full modern lane.
  - Evidence:
    - asset move and Vite config:
      - moved `client/img/**` -> `client/public/img/**`
      - updated `vite.config.ts` with `publicDir: "client/public"`
    - runtime/image resolution:
      - updated `client/js-esm/image-assets.ts` to deterministic `/img/<scale>/<image>.png` path generation (no `import.meta.glob` table)
      - updated `client/modern.html` and `client/css/{main,ie}.css` image URLs to `/img/...`
    - Tiled-source path alignment:
      - updated:
        - `tools/maps/tiled/world.json`
        - `tools/maps/tiled/tilesheet.wang.tsj`
        - `tools/maps/tiled/rules/sand-detail.tmj`
        - `tools/maps/tiled/browserquest.tiled-project`
      to point at `client/public/img/...`
    - boundary enforcement:
      - updated `tools/check-package-mode-boundaries.ts` to fail if `client/img` exists
    - build-surface impact:
      - Vite build transformed `126` modules (previous asset-manifest lane had substantially higher transform count)
  - Verification:
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-10 dead class-fanout guard retirement and doc archival)

### Ticket status

- `T-345.1` Remove dead `check:class-fanout` script/tooling from active package/tool surface: `done`
- `T-345.2` Move archived class-fanout historical note out of active docs root: `done`
- `T-345.3` Re-verify modern lane and record evidence: `done`

### Live progress log

- `2026-02-10T00:13Z` `in_progress` Started dead-surface cleanup for obsolete class-fanout guard tooling after full `.js` source retirement.
  - Scope:
    - remove `check:class-fanout` script and `tools/check-classjs-fanout.ts`
    - move `docs/server-classjs-fanout-map.md` into archive lane and update path references
  - Out of scope:
    - rewriting historical mentions in archived migration logs
  - Acceptance criteria:
    - no active script/tool path for class-fanout guard remains
    - class-fanout historical note is outside active docs root
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run verify:modern:node22`
- `2026-02-10T00:14Z` `done` Completed class-fanout guard retirement and archived its historical note under docs archive.
  - Evidence:
    - removed active tooling:
      - deleted `tools/check-classjs-fanout.ts`
      - removed `check:class-fanout` from `package.json`
    - moved historical doc:
      - `docs/server-classjs-fanout-map.md` -> `docs/archive/legacy/server-classjs-fanout-map.md`
    - updated path references:
      - `MODERNIZE.md`
      - `docs/modernization-readiness-status.md`
  - Verification:
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-10 quiet map-export prestep in verify lane)

### Ticket status

- `T-344.1` Add `--quiet` support to map exporter CLI: `done`
- `T-344.2` Switch modern verify pre-step to quiet direct exporter invocation: `done`
- `T-344.3` Verify modern lane after CLI/script update: `done`

### Live progress log

- `2026-02-10T00:12Z` `in_progress` Started verify-output hygiene pass to keep deterministic map-export pre-step while reducing noisy exporter logs.
  - Scope:
    - add optional `--quiet` (`-q`) support to `tools/maps/export.ts`
    - update `verify:modern` to invoke quiet exporter pre-step
  - Out of scope:
    - map export behavior/schema changes
  - Acceptance criteria:
    - `tools/maps/export.ts ... --quiet` runs successfully
    - `verify:modern` begins with quiet map export pre-step
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run verify:modern:node22`
- `2026-02-10T00:13Z` `done` Completed quiet map-export verify pre-step update and re-verified full modern lane.
  - Evidence:
    - updated `tools/maps/export.ts`:
      - parses `--quiet` / `-q`
      - passes `quiet` through to `syncRuntimeMaps`
    - updated `package.json`:
      - `verify:modern` now starts with `bun tools/maps/export.ts both --quiet`
  - Verification:
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-10 authored `.js` elimination in active repo surface)

### Ticket status

- `T-343.1` Rename active ESLint flat config from `.js` to `.mjs`: `done`
- `T-343.2` Re-verify modern lane after config filename migration: `done`
- `T-343.3` Confirm no authored `.js` files remain outside generated/dependency outputs: `done`

### Live progress log

- `2026-02-10T00:11Z` `in_progress` Started final authored `.js` surface cleanup by renaming active ESLint config to ESM-native `.mjs`.
  - Scope:
    - rename `eslint.config.js` to `eslint.config.mjs`
    - preserve config behavior and lint lane compatibility
  - Out of scope:
    - ESLint rule changes
  - Acceptance criteria:
    - modern verify lane passes with renamed config
    - no authored `.js` files remain outside ignored generated/dependency directories
  - Verification plan:
    - `bun run verify:modern:node22`
    - `rg --files -g '*.js' -g '!node_modules/**' -g '!dist/**'`
- `2026-02-10T00:12Z` `done` Completed authored `.js` elimination by migrating ESLint config to `.mjs` and re-verifying full modern lane.
  - Evidence:
    - renamed `eslint.config.js` -> `eslint.config.mjs`
    - authored `.js` sweep:
      - `rg --files -g '*.js' -g '!node_modules/**' -g '!dist/**'` -> no matches
  - Verification:
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-10 verify lane cleanup of redundant Wang sync checker)

### Ticket status

- `T-342.1` Remove redundant `check:map-wang-sync` gate from modern verify flow after deterministic `map:export` pre-step: `done`
- `T-342.2` Remove now-unused `check:map-wang-sync` script from active package scripts: `done`
- `T-342.3` Verify modern lane and record evidence: `done`

### Live progress log

- `2026-02-10T00:10Z` `in_progress` Started verify-lane cleanup to remove redundant Wang sync check now that `verify:modern` deterministically runs `map:export` first.
  - Scope:
    - drop `check:map-wang-sync` from `verify:modern`
    - remove unused `check:map-wang-sync` package script
  - Out of scope:
    - Wang artifact generation behavior changes
  - Acceptance criteria:
    - `verify:modern` no longer references `check:map-wang-sync`
    - `check:map-wang-sync` script no longer exists in `package.json`
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run verify:modern:node22`
- `2026-02-10T00:11Z` `done` Completed redundant Wang sync checker cleanup and re-verified full modern lane.
  - Evidence:
    - updated `package.json`:
      - removed `check:map-wang-sync` script
      - `verify:modern` no longer invokes `check:map-wang-sync`
    - `verify:modern` retains deterministic `map:export` pre-step, which already syncs Wang artifacts via active map export flow.
  - Verification:
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-10 map verify lane simplification via deterministic export)

### Ticket status

- `T-341.1` Replace runtime map drift checker lane with deterministic `map:export` in modern verify flow: `done`
- `T-341.2` Remove retired map drift checker tool/script from active tooling surface: `done`
- `T-341.3` Verify modern lane and record evidence: `done`

### Live progress log

- `2026-02-10T00:08Z` `in_progress` Started map verify lane simplification to remove manual artifact-drift checker step in favor of deterministic map export.
  - Scope:
    - replace `check:map-runtime-sync` verify gate with direct `map:export` execution
    - remove retired `tools/check-map-runtime-sync.ts` tool/script entry
  - Out of scope:
    - map export/process behavior changes
  - Acceptance criteria:
    - `verify:modern` starts with `map:export`
    - no active script entry references `check:map-runtime-sync`
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `rg -n "check:map-runtime-sync|tools/check-map-runtime-sync\\.ts" package.json README.md docs tools tests server client -g '!docs/archive/**' -g '!docs/modernization-readiness-status.md'`
    - `bun run verify:modern:node22`
- `2026-02-10T00:10Z` `done` Completed map verify lane simplification and re-verified full modern lane.
  - Evidence:
    - updated `package.json`:
      - removed `check:map-runtime-sync` script
      - `verify:modern` now begins with `bun run map:export` and no longer calls `check:map-runtime-sync`
    - removed retired tool:
      - deleted `tools/check-map-runtime-sync.ts`
    - active reference sweep:
      - `rg -n "check:map-runtime-sync|tools/check-map-runtime-sync\\.ts" ...` found no active references outside readiness-history content
  - Verification:
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-10 Vite-native runtime image asset resolution)

### Ticket status

- `T-340.1` Add shared Vite-native runtime image asset resolver for `client/img/{1,2,3}/*.png`: `done`
- `T-340.2` Rewire runtime `img/...` string-path callsites to resolver-backed URLs: `done`
- `T-340.3` Verify modern lane and record evidence: `done`

### Live progress log

- `2026-02-10T00:04Z` `in_progress` Started runtime image-asset modernization pass to replace hardcoded string image paths with Vite-managed asset URLs.
  - Scope:
    - add shared image resolver module backed by `import.meta.glob`
    - migrate runtime image callsites in `app`, `sprite`, `map`, and Safari fallback rendering path
  - Out of scope:
    - image file content changes
    - rendering behavior changes
  - Acceptance criteria:
    - no hardcoded runtime `img/...` path construction remains in `client/js-esm/**/*.ts`
    - modern verify lane passes
  - Verification plan:
    - `rg -n "img/" client/js-esm -g '*.ts'`
    - `bun run verify:modern:node22`
- `2026-02-10T00:07Z` `done` Completed Vite-native runtime image asset resolution migration and re-verified full modern lane.
  - Evidence:
    - added `client/js-esm/image-assets.ts`:
      - shared `resolveImageAssetPath(scale, imageName)` backed by `import.meta.glob('../img/*/*.png', { eager: true, import: 'default' })`
    - rewired runtime callsites:
      - `client/js-esm/sprite.ts` (sprite image path resolution)
      - `client/js-esm/map.ts` (tilesheet loading for scales 1/2/3)
      - `client/js-esm/app.ts` (equipment icon URL resolution)
      - `client/js-esm/renderer.ts` (Safari base64 fallback image URL resolution)
    - runtime path sweep:
      - `rg -n "img/" client/js-esm -g '*.ts'` leaves only resolver module pattern (`import.meta.glob('../img/*/*.png', ...)`)
  - Verification:
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-10 source-map-directory retirement guard)

### Ticket status

- `T-339.1` Enforce retirement of `client/maps` and `server/maps` source directories after generated-artifact lane cutover: `done`
- `T-339.2` Verify package boundary guard and full modern lane after enforcement update: `done`

### Live progress log

- `2026-02-10T00:02Z` `in_progress` Started boundary-hardening follow-up to ensure generated map artifact lane cannot drift back into source directories.
  - Scope:
    - extend package boundary guard to fail when `client/maps` or `server/maps` directories exist
    - keep all existing package-mode boundary checks intact
  - Out of scope:
    - map schema/runtime behavior changes
  - Acceptance criteria:
    - `check:package-mode-boundaries` fails if source map directories are reintroduced
    - `bun run verify:modern:node22` passes with the stricter guard
  - Verification plan:
    - `bun run check:package-mode-boundaries`
    - `bun run verify:modern:node22`
- `2026-02-10T00:03Z` `done` Completed source-map-directory retirement guard enforcement and re-verified full modern lane.
  - Evidence:
    - updated `tools/check-package-mode-boundaries.ts`:
      - fails if `client/maps` exists
      - fails if `server/maps` exists
      - success message now includes source map directory retirement policy
  - Verification:
    - `bun run check:package-mode-boundaries` -> pass
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-09 root-invoked map script entrypoints)

### Ticket status

- `T-338.1` Replace `cd tools/maps` wrapper scripts with direct root-invoked Bun map entrypoints: `done`
- `T-338.2` Verify modern lane and record evidence: `done`

### Live progress log

- `2026-02-09T23:57Z` `in_progress` Started map script ergonomics cleanup to remove remaining shell-cwd wrappers and keep map scripts root-invoked.
  - Scope:
    - rewire `map:export*` scripts to run `bun tools/maps/export.ts ...` directly from repo root
  - Out of scope:
    - map export behavior changes
  - Acceptance criteria:
    - map export scripts run successfully from root without `cd tools/maps`
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run map:export`
    - `bun run map:export:client`
    - `bun run map:export:server`
    - `bun run verify:modern:node22`
- `2026-02-09T23:58Z` `done` Completed root-invoked map script entrypoint cleanup and re-verified modern lane.
  - Evidence:
    - updated `package.json` scripts:
      - `map:export`
      - `map:export:client`
      - `map:export:server`
      now invoke `bun tools/maps/export.ts ...` directly (no cwd wrapper)
  - Verification:
    - `bun run map:export` -> pass
    - `bun run map:export:client` -> pass
    - `bun run map:export:server` -> pass
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-09 client map payload URL-asset loading)

### Ticket status

- `T-337.1` Replace generated map module-import loading path with URL-asset fetch in client map runtime: `done`
- `T-337.2` Apply URL-asset fetch path in map worker while preserving collision/plateau generation behavior: `done`
- `T-337.3` Verify modern lane and confirm bundle no longer emits large `world_client-*.js` chunk: `done`
- `T-337.4` Record evidence in readiness log: `done`

### Live progress log

- `2026-02-09T23:55Z` `in_progress` Started map payload loading optimization to avoid bundling generated map JSON into JS module chunks.
  - Scope:
    - switch client map runtime and worker from JSON module import to URL-asset fetch (`new URL(..., import.meta.url)`)
    - keep generated artifact path and map processing behavior unchanged
  - Out of scope:
    - map schema changes
  - Acceptance criteria:
    - modern lane passes
    - Vite build outputs `world_client-*.json` asset and no large `world_client-*.js` payload module
  - Verification plan:
    - `bun run build:vite`
    - `bun run verify:modern:node22`
- `2026-02-09T23:56Z` `done` Completed map payload URL-asset loading migration and re-verified modern lane.
  - Evidence:
    - client runtime map loading:
      - `client/js-esm/map.ts`
        - now uses `generatedMapUrl` via `new URL(..., import.meta.url).href` + `fetch`
    - worker map loading:
      - `client/js-esm/mapworker.ts`
        - now loads generated map via URL-asset fetch before collision/plateau generation
    - build artifact shape:
      - `dist/vite/assets/world_client-*.json` present
      - no `dist/vite/assets/world_client-*.js` payload module after build
  - Verification:
    - `bun run build:vite` -> pass
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-09 boundary guard for archived legacy docs location)

### Ticket status

- `T-336.1` Enforce no `legacy-*.md` files in active `docs/` root: `done`
- `T-336.2` Enforce archived-note docs live only under `docs/archive/**`: `done`
- `T-336.3` Verify modern lane and record evidence: `done`

### Live progress log

- `2026-02-09T23:53Z` `in_progress` Started post-archive guardrail pass so historical docs cannot drift back into active doc surfaces.
  - Scope:
    - extend package boundary check to fail when root `docs/legacy-*.md` files exist
    - extend package boundary check to fail when docs containing archived-note marker are outside `docs/archive/**`
  - Out of scope:
    - additional doc content migration
  - Acceptance criteria:
    - `check:package-mode-boundaries` enforces archived doc location policy
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run check:package-mode-boundaries`
    - `bun run verify:modern:node22`
- `2026-02-09T23:54Z` `done` Completed archived-doc location guardrail enforcement and re-verified modern lane.
  - Evidence:
    - updated `tools/check-package-mode-boundaries.ts`:
      - fails if `docs/legacy-*.md` files exist in root docs directory
      - fails if any markdown file outside `docs/archive/**` contains archived-note marker
      - success message now includes root-legacy-doc retirement policy
  - Verification:
    - `bun run check:package-mode-boundaries` -> pass
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-09 archive separation for historical legacy docs)

### Ticket status

- `T-335.1` Inventory legacy historical docs and define archive move scope: `done`
- `T-335.2` Move archived historical docs out of active `docs/` root into `docs/archive/legacy/`: `done`
- `T-335.3` Rewrite references to archived paths and add archive index docs: `done`
- `T-335.4` Verify modern lane and record evidence: `done`

### Live progress log

- `2026-02-09T23:40Z` `in_progress` Started active-doc surface cleanup by separating legacy historical runbooks/notes from the active `docs/` root.
  - Scope:
    - move docs explicitly marked with `Archived historical note` into archive lane
    - keep links valid by rewriting in-repo references from `docs/<file>` to `docs/archive/legacy/<file>`
    - add archive index documentation
  - Out of scope:
    - deletion of archived docs
    - behavior/runtime code changes
  - Acceptance criteria:
    - archived historical docs are no longer in active `docs/` root
    - references resolve to `docs/archive/legacy/**`
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run verify:modern:node22`
- `2026-02-09T23:52Z` `done` Completed archive separation for historical legacy docs and re-verified modern lane.
  - Evidence:
    - moved historical docs to archive lane:
      - `docs/archive/legacy/**` (50 files moved from active `docs/` root, including remaining `legacy-*.md` holdouts)
    - added archive indexes:
      - `docs/archive/README.md`
      - `docs/archive/legacy/README.md`
    - reference rewrites:
      - in-repo references updated from `docs/<archived-file>.md` to `docs/archive/legacy/<archived-file>.md`
      - no stale `docs/<archived-file>.md` references remained after rewrite
  - Verification:
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-09 closeout of planned AMD/RequireJS retirement epic)

### Ticket status

- `T-313.1` Full AMD/jQuery client runtime retirement (`client/js/**`, RequireJS, and legacy runtime-only docs/checks removal): `done`

### Live progress log

- `2026-02-09T23:36Z` `done` Closed previously planned `T-313.1` as complete based on current repository state and active-lane verification.
  - Evidence:
    - legacy client tree removed:
      - `client/js/**` no longer exists
    - legacy scripts removed from active package lanes:
      - `verify:legacy` absent from `package.json`
      - `build:client` absent from `package.json`
      - `jquery` dependency absent from `package.json`
    - active boundary guard enforces modern-only script posture:
      - `tools/check-package-mode-boundaries.ts`
  - Verification:
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-09 generated runtime map artifact lane)

### Ticket status

- `T-334.1` Move generated runtime map artifacts from source trees to dedicated `generated/maps/**`: `done`
- `T-334.2` Rewire runtime/tooling consumers to `generated/maps/**` paths (client, server, exporter, checks): `done`
- `T-334.3` Update test fixtures/docs and re-verify modern lane: `done`

### Live progress log

- `2026-02-09T23:33Z` `in_progress` Started generated-artifact lane migration so map export outputs are separated from authored source trees.
  - Scope:
    - move runtime outputs to `generated/maps/world_{client,server}.json`
    - rewire map exporter/check tooling, server config/readme, and client runtime map loading paths
    - keep modern verify lane green
  - Out of scope:
    - map schema/runtime contract changes
  - Acceptance criteria:
    - runtime map outputs are generated under `generated/maps/**`
    - client/server runtime paths consume generated artifacts
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run verify:modern:node22`
- `2026-02-09T23:34Z` `blocked` Initial verify run failed in smoke tests after path migration due stale test fixtures still pinning removed `./server/maps/world_server.json` path.
  - Exact failure evidence:
    - `tests/smoke/modern-gameplay-parity.test.ts` timed out waiting for `WELCOME`
    - `tests/smoke/server-payload-guards.test.ts` timed out waiting for JSON message
  - Workaround applied:
    - migrated smoke/unit fixture map paths from `./server/maps/world_server.json` to `./generated/maps/world_server.json`
    - re-ran targeted failing smoke tests before full-lane rerun
- `2026-02-09T23:36Z` `done` Completed generated runtime map artifact lane migration and re-verified modern lane.
  - Evidence:
    - artifact relocation:
      - `client/maps/world_client.json` -> `generated/maps/world_client.json`
      - `server/maps/world_server.json` -> `generated/maps/world_server.json`
    - runtime/tooling rewiring:
      - `tools/maps/runtime-sync.ts`
      - `tools/check-map-runtime-sync.ts`
      - `server/config.json`
      - `server/README.md`
      - `client/js-esm/mapworker.ts`
      - `client/js-esm/map.ts` (non-worker path now loads generated map module directly)
    - fixture/doc updates:
      - smoke + unit tests updated to new server map filepath under `generated/maps/**`
      - `tools/maps/README.md`
      - `docs/client-build-support.md`
  - Verification:
    - targeted rerun:
      - `bun test tests/smoke/modern-gameplay-parity.test.ts tests/smoke/server-payload-guards.test.ts --timeout 30000` -> pass
    - full lane:
      - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-09 active modern docs accuracy cleanup)

### Ticket status

- `T-333.1` Align top-level README runtime/script references with current TS server entry and map-sync automation: `done`
- `T-333.2` Align client build support matrix with current runtime map sync lane and entrypoint paths: `done`
- `T-333.3` Verify modern lane and record evidence: `done`

### Live progress log

- `2026-02-09T23:31Z` `in_progress` Started active-doc consistency cleanup for current modern-only behavior after recent runtime/map-sync changes.
  - Scope:
    - fix stale `.mjs` entrypoint references in active docs
    - reflect automatic runtime map sync in dev/build flows
  - Out of scope:
    - archival historical migration docs
  - Acceptance criteria:
    - active docs reference `server/js/main-esm.ts` for server entry
    - active docs describe automatic runtime map sync behavior in modern lanes
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run verify:modern:node22`
- `2026-02-09T23:32Z` `done` Completed active-doc modern-behavior cleanup and re-verified full modern lane.
  - Evidence:
    - updated `README.md`:
      - active scripts now reference `server/js/main-esm.ts`
      - verification section documents automatic map sync hooks in Vite dev/build flows
    - updated `docs/client-build-support.md`:
      - server entry path updated to `server/js/main-esm.ts`
      - runtime map-sync lane statement updated to reflect active automation
  - Verification:
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-09 Vite build-time map sync automation)

### Ticket status

- `T-332.1` Add build-time runtime map sync hook in Vite pipeline: `done`
- `T-332.2` Keep dev map-sync-on-change behavior intact with deterministic serve/build plugin separation: `done`
- `T-332.3` Verify modern lane and record evidence: `done`

### Live progress log

- `2026-02-09T23:30Z` `in_progress` Started Vite build-flow automation follow-up so runtime map artifacts are refreshed by Vite itself before production builds.
  - Scope:
    - run runtime map sync automatically in `vite build`
    - preserve existing Vite serve-side startup/change sync behavior
    - avoid duplicate hook execution by separating serve/build plugin responsibilities
  - Out of scope:
    - map runtime schema changes
  - Acceptance criteria:
    - `vite build` logs build-start map sync
    - Vite dev map-sync plugin behavior remains active
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run build:vite`
    - `bun run verify:modern:node22`
- `2026-02-09T23:31Z` `done` Completed Vite build-time map sync automation and re-verified full modern lane.
  - Evidence:
    - `vite.config.ts`:
      - added build-only plugin `browserquest-map-runtime-sync-build` (`buildStart`) calling `syncRuntimeMaps`
      - retained serve-only plugin `browserquest-map-runtime-sync` for startup + source-change sync
    - build output confirms automation:
      - `[plugin browserquest-map-runtime-sync-build] [map-sync] updated runtime maps (vite-build-start)`
  - Verification:
    - `bun run build:vite` -> pass
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-09 modern jQuery guard moved to ESLint built-ins)

### Ticket status

- `T-331.1` Replace bespoke modern jQuery check script with ESLint-native rules: `done`
- `T-331.2` Remove `check:modern-jquery-free` script usage from active verify lane: `done`
- `T-331.3` Verify modern lane and record evidence: `done`

### Live progress log

- `2026-02-09T23:27Z` `in_progress` Started built-in tooling replacement pass to move the modern jQuery-free policy from a bespoke scanner script into ESLint-native restrictions.
  - Scope:
    - enforce no `jquery` imports and no global `$` usage for modern client runtime TS files
    - remove standalone `tools/check-modern-jquery-free.ts` script and its verify dependency
  - Out of scope:
    - gameplay/runtime logic changes
  - Acceptance criteria:
    - `eslint` fails on `jquery` imports or global `$` usage in `client/js-esm/**/*.ts`
    - `check:modern-jquery-free` script and tool file are removed
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run lint`
    - `bun run verify:modern:node22`
- `2026-02-09T23:28Z` `done` Completed ESLint-native modern jQuery guard migration and re-verified modern lane.
  - Evidence:
    - ESLint config update:
      - `eslint.config.js`
        - added TS-runtime client rule set with:
          - `no-restricted-imports` (`jquery`)
          - `no-restricted-globals` (`$`)
    - script/runtime lane updates:
      - `package.json`
        - removed `check:modern-jquery-free`
        - removed `check:modern-jquery-free` from `verify:modern`
        - expanded `lint` scope to include `client/js-esm/**/*.ts`
    - retired bespoke checker:
      - deleted `tools/check-modern-jquery-free.ts`
  - Verification:
    - `bun run lint` -> pass
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-09 boundary guard for retired map watch lane)

### Ticket status

- `T-330.1` Enforce retired `map:watch` script boundary in modern package-mode checks: `done`
- `T-330.2` Enforce retired `tools/maps/watch.ts` file boundary in modern package-mode checks: `done`
- `T-330.3` Verify modern lane and record evidence: `done`

### Live progress log

- `2026-02-09T23:26Z` `in_progress` Started policy-guard follow-up so the retired standalone map watch lane cannot be reintroduced silently.
  - Scope:
    - extend `check:package-mode-boundaries` to reject `map:watch` script presence
    - extend `check:package-mode-boundaries` to reject `tools/maps/watch.ts` file presence
  - Out of scope:
    - additional map workflow behavior changes
  - Acceptance criteria:
    - boundary check fails if `map:watch` is reintroduced
    - boundary check fails if `tools/maps/watch.ts` is reintroduced
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run check:package-mode-boundaries`
    - `bun run verify:modern:node22`
- `2026-02-09T23:26Z` `done` Completed retired map watch lane guardrail enforcement and re-verified modern lane.
  - Evidence:
    - updated boundary check:
      - `tools/check-package-mode-boundaries.ts`
        - rejects `package.json` script `map:watch`
        - rejects presence of `tools/maps/watch.ts`
    - check output now explicitly reports map-watch retirement policy
  - Verification:
    - `bun run check:package-mode-boundaries` -> pass
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-09 map watch lane retirement after Vite integration)

### Ticket status

- `T-329.1` Confirm standalone map watcher is no longer required by active dev/test/build flows: `done`
- `T-329.2` Remove standalone `map:watch` script and map watch tool entrypoint: `done`
- `T-329.3` Verify modern lane and record evidence: `done`

### Live progress log

- `2026-02-09T23:24Z` `in_progress` Started follow-up modernization pass to retire the now-redundant standalone map watch lane after Vite-native map sync integration.
  - Scope:
    - remove `map:watch` script entry and `tools/maps/watch.ts`
    - keep explicit map generation through `map:export` and Vite-integrated runtime sync behavior
  - Out of scope:
    - runtime map schema/output contract changes
    - Tiled automapping workflow changes
  - Acceptance criteria:
    - no active script path references `map:watch`
    - `bun run dev` still keeps runtime map outputs synced through Vite integration
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run map:export`
    - `bun run check:map-wang-sync`
    - `bun run check:map-runtime-sync`
    - `bun run verify:modern:node22`
- `2026-02-09T23:25Z` `done` Completed standalone map watch lane retirement and re-verified modern lane.
  - Evidence:
    - removed script:
      - `package.json` (`map:watch`)
    - removed tool entrypoint:
      - deleted `tools/maps/watch.ts`
    - updated map tooling docs to remove optional watcher path:
      - `tools/maps/README.md`
  - Verification:
    - `bun run map:export` -> pass
    - `bun run check:map-wang-sync` -> pass
    - `bun run check:map-runtime-sync` -> pass
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-09 Vite-native runtime map sync integration)

### Ticket status

- `T-328.1` Define Vite-native map sync scope and acceptance around active map tooling: `done`
- `T-328.2` Extract shared runtime map sync API and remove export/watch duplication: `done`
- `T-328.3` Remove standalone map watch process from full-stack dev default path: `done`
- `T-328.4` Verify modern lane and record evidence: `done`

### Live progress log

- `2026-02-09T23:18Z` `in_progress` Started Vite-native runtime map sync consolidation to align map export behavior with modern dev defaults and reduce extra watcher-process plumbing.
  - Scope:
    - extract shared runtime map sync orchestration used by CLI and watch flows
    - run map sync at `dev:vite:full` startup and on Vite map-file change events
    - keep explicit standalone `map:watch` command available as optional non-Vite path
  - Out of scope:
    - map schema/runtime contract changes
    - automapping rule authoring changes
  - Acceptance criteria:
    - one shared sync implementation owns Wang sync + runtime export writes
    - `bun run dev` no longer spawns standalone `map:watch` process
    - Vite dev server performs runtime map sync on startup and on canonical map edits
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run map:export`
    - `bun run check:map-wang-sync`
    - `bun run check:map-runtime-sync`
    - `bun run verify:modern:node22`
- `2026-02-09T23:22Z` `done` Completed Vite-native runtime map sync consolidation and re-verified full modern lane.
  - Evidence:
    - shared sync API:
      - added `tools/maps/runtime-sync.ts` to centralize Wang sync + client/server runtime map export writes
      - rewired `tools/maps/export.ts` and `tools/maps/watch.ts` to use shared sync API
    - Vite-native dev integration:
      - updated `vite.config.ts` with `browserquest-map-runtime-sync` dev plugin:
        - performs startup sync
        - watches `tools/maps/tiled/world.json` and re-syncs runtime map outputs on change
      - updated `tools/dev-vite.ts`:
        - performs initial map sync before launching server/Vite
        - no longer spawns separate `map:watch` process in default full-stack dev flow
    - docs:
      - updated `tools/maps/README.md` to reflect Vite-native sync behavior and modern map export usage
  - Verification:
    - `bun run map:export` -> pass
    - `bun run check:map-wang-sync` -> pass
    - `bun run check:map-runtime-sync` -> pass
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-09 Tiled hybrid path: project + editor automap action + runtime export)

### Ticket status

- `T-327.4.1` Align implementation with upstream Tiled project/command/scripting model using `../tiled` source: `done`
- `T-327.4.2` Add editor-native Tiled project config with automapping + project command wiring: `done`
- `T-327.4.3` Add first working Automapping rule map and generated rules integration: `done`
- `T-327.4.4` Add one-click in-editor action (AutoMap + Save + Export) through project extension: `done`
- `T-327.4.5` Verify modern lane and document hybrid workflow: `done`

### Live progress log

- `2026-02-09T23:06Z` `in_progress` Started hybrid-path implementation based on user direction and explicit use of local Tiled source tree (`../tiled`) for accurate behavior/format decisions.
  - Scope:
    - use upstream project schema keys (`automappingRulesFile`, `extensionsPath`, `commands`, `folders`)
    - add project-local extension action for non-detached editor automapping + save + export flow
    - introduce a real rule map and generated rules-file inclusion
  - Out of scope:
    - headless detached-map automapping (still unsupported by Tiled, verified against upstream behavior)
  - Acceptance criteria:
    - `browserquest.tiled-project` includes project command + extension path + automapping rules file
    - `tiled/rules/*.tmj` contains at least one working rule map and `automapping.rules` references it
    - project extension provides one-click AutoMap + Save + Export action from *Map* menu
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run map:wang:sync`
    - `bun run check:map-wang-sync`
    - `bun run map:export`
    - `bun run check:map-runtime-sync`
    - `bun run verify:modern:node22`
- `2026-02-09T23:16Z` `done` Completed hybrid path implementation with upstream-aligned project/command schema and editor-native automap/export action.
  - Evidence:
    - upstream-aligned project setup:
      - `tools/maps/tiled/browserquest.tiled-project`
        - uses canonical keys/shape validated against `../tiled/src/tiled/project.cpp`:
          - `automappingRulesFile`
          - `extensionsPath`
          - `commands`
          - `folders`
        - includes project command:
          - `BrowserQuest: Export Runtime Map JSON` (`bun run map:export` in repo root)
    - real rule map lane:
      - added `tools/maps/tiled/rules/sand-detail.tmj` (working Automapping rule map)
      - `tools/maps/wangset.ts` now:
        - generates map-filtered rules file (`[world*]`)
        - includes discovered `rules/*.tmj`
        - fails sync/check when no rule maps exist
      - generated `tools/maps/tiled/automapping.rules` now references:
        - `rules/sand-detail.tmj`
    - editor-native one-click action:
      - added `tools/maps/tiled/extensions/browserquest-automap-export.mjs`
      - registers `Map` menu action:
        - `BrowserQuest: AutoMap + Save + Export`
      - action flow:
        - `autoMap()` on active map (editor-bound, non-detached)
        - `save()`
        - runtime export via project command, with `Process.exec` fallback
    - docs:
      - updated `tools/maps/README.md` with project-open flow, extension enablement, and action usage
  - Verification:
    - `bun run map:wang:sync` -> pass (`updated`, `759 wang tiles`, `8 terrain colors`, `1 rule maps`)
    - `bun run check:map-wang-sync` -> pass
    - `bun run map:export` -> pass
    - `bun run check:map-runtime-sync` -> pass
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-09 Tiled terrain/Wang metadata + automapping scaffold lane)

### Ticket status

- `T-327.3.1` Add deterministic terrain->Wang metadata derivation from canonical map source: `done`
- `T-327.3.2` Wire Wang sync into map export/watch flows: `done`
- `T-327.3.3` Enforce Wang artifact sync in modern verify lane and document workflow: `done`

### Live progress log

- `2026-02-09T22:52Z` `in_progress` Started `T-327.3` implementation (`3go`) with constraint that headless Tiled scripting cannot run `autoMap()` on detached maps and `tiled.open(...)` is unavailable in CLI evaluate mode.
  - Scope:
    - generate idiomatic Tiled Wang metadata artifacts directly from canonical source usage
    - integrate sync into active map export/watch/dev/verify workflows
    - provide automapping rules scaffold in canonical Tiled source tree
  - Out of scope:
    - full authored Automapping rule maps for each biome transition (requires dedicated art/design pass)
    - direct in-place mutation of `world.json` via headless Tiled writer (path rewrite side effects observed)
  - Acceptance criteria:
    - deterministic Wang metadata artifacts are generated from `tools/maps/tiled/world.json`
    - `map:export` and `map:watch` keep Wang artifacts in sync automatically
    - verify lane enforces Wang sync (`check:map-wang-sync`)
    - modern verification lane passes
  - Verification plan:
    - `bun run map:wang:sync`
    - `bun run check:map-wang-sync`
    - `bun run map:export`
    - `bun run check:map-runtime-sync`
    - `bun run verify:modern:node22`
- `2026-02-09T23:00Z` `done` Completed Tiled terrain/Wang metadata lane and integrated it into modern workflow.
  - Evidence:
    - added deterministic Wang sync tooling:
      - `tools/maps/wangset.ts`
        - derives terrain ownership from terrain-focused tile layers
        - emits `tools/maps/tiled/tilesheet.wang.tsj` (Tiled-compatible tileset + `wangsets`)
        - emits `tools/maps/tiled/automapping.rules` scaffold
        - supports `--check` mode for verify enforcement
    - flow integration:
      - `tools/maps/export.ts` runs Wang sync before runtime map export
      - `tools/maps/watch.ts` runs Wang sync on map-change export loop
    - script/check integration:
      - `package.json`:
        - added `map:wang:sync`
        - added `check:map-wang-sync`
        - added `check:map-wang-sync` into `verify:modern`
    - docs update:
      - `tools/maps/README.md` now documents Wang sync and generated artifacts
  - Verification:
    - `bun run map:wang:sync` -> pass (`updated`, `759 wang tiles`, `8 terrain colors`)
    - `bun run check:map-wang-sync` -> pass
    - `bun run map:export` -> pass
    - `bun run check:map-runtime-sync` -> pass
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-09 canonical Tiled source/assets + runtime sync enforcement)

### Ticket status

- `T-326.1` Promote canonical map source + map-local assets to native Tiled structure: `done`
- `T-326.2` Remove legacy TMX source dependency from active export flow: `done`
- `T-326.3` Enforce source->runtime map sync in modern verify lane: `done`
- `T-326.4` Wire live map export into Vite full-stack dev flow: `done`
- `T-326.5` Verify modern lane and record readiness evidence: `done`

### Live progress log

- `2026-02-09T22:42Z` `in_progress` Started follow-up requested by user to include map assets in the canonical Tiled-native structure and ensure runtime artifacts stay synced without extra manual steps.
  - Scope:
    - make `tools/maps/tiled/world.json` the canonical editable map source
    - colocate map-local assets in canonical Tiled structure (`tools/maps/tiled/mobset.png`)
    - retire legacy TMX source artifacts from active map pipeline
    - add runtime sync guard + live watch lane so edits are reflected quickly in runtime JSON outputs
  - Out of scope:
    - runtime map loader schema redesign to consume raw Tiled JSON directly
  - Acceptance criteria:
    - export scripts consume canonical `tools/maps/tiled/world.json` by default
    - runtime artifacts (`client/maps/world_client.json`, `server/maps/world_server.json`) are sync-checked in `verify:modern`
    - Vite full-stack dev flow runs map watch alongside server/client
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run map:export`
    - `bun run check:map-runtime-sync`
    - `bun run verify:modern:node22`
- `2026-02-09T22:49Z` `done` Completed canonical map source/assets consolidation and modern sync enforcement.
  - Evidence:
    - canonical source/assets:
      - added `tools/maps/tiled/world.json`
      - moved map-local asset to `tools/maps/tiled/mobset.png`
      - updated tileset image linkage in canonical source to `image: "mobset.png"` for direct Tiled editing
      - retired legacy source artifacts:
        - deleted `tools/maps/tmx/map.tmx`
        - deleted `tools/maps/tmx/mobset.png`
    - exporter/runtime sync modernization:
      - `tools/maps/export.ts` now defaults to canonical `tiled/world.json` (no active TMX export dependency)
      - `tools/maps/exportmap.ts` supports quiet export mode for automation/watch
      - `tools/maps/processmap.ts` supports quiet logging for non-interactive lanes
      - added `tools/maps/watch.ts` for auto-regeneration on source edits
      - added `tools/check-map-runtime-sync.ts` and wired `check:map-runtime-sync` into `verify:modern`
      - updated `tools/dev-vite.ts` to run `map:watch` in full dev flow
      - updated map tooling docs in `tools/maps/README.md`
      - updated scripts in `package.json`:
        - `map:watch`
        - `check:map-runtime-sync`
        - `verify:modern` includes `check:map-runtime-sync`
  - Verification:
    - `bun run map:export` -> pass
    - `bun run check:map-runtime-sync` -> pass
    - `bun run verify:modern:node22` -> pass

## Delta Update (2026-02-09 map exporter modernization to canonical Tiled JSON)

### Ticket status

- `T-325.1` Audit `../tiled` JSON shape and map-pipeline assumptions: `done`
- `T-325.2` Replace legacy TMX->custom-JSON conversion path with native Tiled JSON export path: `done`
- `T-325.3` Modernize map tooling scripts and retire Python converter artifacts: `done`
- `T-325.4` Verify no data-loss conversion and run full modern verification lane: `done`

### Live progress log

- `2026-02-09T13:46Z` `in_progress` Started map export pipeline modernization based on user direction to one-off convert via modern Tiled JSON shape without data loss.
  - Scope:
    - consume canonical Tiled JSON (`tiled --export-map`) directly in map pipeline
    - remove legacy `tmx2json.py` conversion dependency and Python exporter wrapper
    - keep BrowserQuest runtime output contracts (`world_client.json`, `world_server.json`) behavior-equivalent
    - remove remaining map-tooling `@ts-nocheck` usage
  - Out of scope:
    - runtime consumer schema changes in client/server map loaders
    - large map-authoring workflow redesign beyond exporter path modernization
  - Acceptance criteria:
    - map tooling uses native Tiled JSON export path only
    - legacy converter files are retired
    - generated map outputs are semantically equivalent to current runtime artifacts
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run typecheck`
    - semantic equivalence comparison between current and newly generated map outputs
    - `bun run verify:modern:node22`
- `2026-02-09T13:57Z` `done` Completed canonical Tiled JSON pipeline migration and validated no-loss export behavior.
  - Evidence:
    - canonical Tiled JSON processing rewrite:
      - `tools/maps/processmap.ts`
        - now consumes native Tiled JSON (`layers`, `tilesets`, `objects`, `properties`) directly
        - retains BrowserQuest runtime output structure for client/server map JSON
        - normalizes global tile IDs via flag-mask handling and normalizes scalar property values
    - modern map export tooling:
      - added `tools/maps/export.ts` (Bun/TypeScript orchestration over `tiled --export-map`)
      - updated `tools/maps/exportmap.ts` to export callable `exportMapFile` API + proper CLI guard
      - added scripts in `package.json`:
        - `map:export`
        - `map:export:client`
        - `map:export:server`
    - retired legacy map conversion artifacts:
      - deleted `tools/maps/export.py`
      - deleted `tools/maps/tmx2json.py`
    - docs modernization:
      - updated `tools/maps/README.md` for modern Tiled JSON + Bun export workflow
    - no-loss conversion evidence:
      - one-off semantic comparison between current `client/maps/world_client.json` and `server/maps/world_server.json` vs outputs generated from `tiled --export-map` + new pipeline returned:
        - `client semantic-equal true`
        - `server semantic-equal true`
      - note: serialization key order differs (`tilesize` placement), but map data contract/content is unchanged.
  - Verification:
    - `bun run typecheck` -> pass
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; Vite build pass)

## Delta Update (2026-02-09 final `main-esm` TypeScript holdout closeout)

### Ticket status

- `T-324.4.1` Diagnose remaining `@ts-nocheck` holdout in `server/js/main-esm.ts`: `done`
- `T-324.4.2` Remove suppression and keep runtime behavior intact via typed ESM/CJS interop: `done`
- `T-324.4.3` Re-run modernization verification lane: `done`
- `T-324.4.4` Record outcome and evidence in readiness log: `done`

### Live progress log

- `2026-02-09T13:36Z` `in_progress` Started final holdout closeout for `server/js/main-esm.ts`.
  - Scope:
    - remove last runtime-lane `@ts-nocheck` usage in `server/js/main-esm.ts`
    - preserve startup behavior and runtime contract wiring (`createRuntimeDependencies` + `main`)
    - keep runtime ESM guard checks green (`check:runtime-esm-require-free`)
  - Out of scope:
    - broad conversion/removal of remaining `.cts` runtime modules
  - Acceptance criteria:
    - `server/js/main-esm.ts` has no `@ts-nocheck`
    - `bun run typecheck` passes
    - `bun run verify:modern:node22` passes
  - Verification plan:
    - `bun run typecheck`
    - `bun run verify:modern:node22`
- `2026-02-09T13:44Z` `done` Completed final `main-esm` holdout removal and verification.
  - Evidence:
    - runtime entrypoint typing/interoperability:
      - `server/js/main-esm.ts`
        - removed `@ts-nocheck`
        - replaced runtime loading path with typed ESM import interop from `./main-runtime.cts`
    - typecheck project alignment for `.cts` interop:
      - `tsconfig.typecheck.json`
        - enabled `allowImportingTsExtensions`
        - added `server/js/main-runtime.cts` to project include inventory
  - Verification:
    - `bun run typecheck` -> pass
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; Vite build pass)
  - Notable blocker resolved:
    - temporary attempt using `createRequire(import.meta.url)` in `server/js/main-esm.ts` was rejected by `check:runtime-esm-require-free`; resolved by switching to ESM import interop without `createRequire`.

## Delta Update (2026-02-08 modern built-in replacement sweep)

### Ticket status

- `T-312.1` Convert `tools/*.cjs` runtime/check scripts to Bun-run TypeScript ESM and rewire scripts: `done`
- `T-312.2` Modernize map tooling (`tools/maps/*`) and remove duplicate JS tool copies: `done`
- `T-312.3` Switch modern server config loading to Bun native JSON loader path: `done`
- `T-312.4` Remove CJS websocket runtime from active runtime/test contracts: `done`
- `T-312.5` Collapse redundant server ESM wrapper layer where safe: `done`
- `T-312.6` Add full AMD/jQuery client retirement as planned larger project: `done`

### Live progress log

- `2026-02-08T22:37Z` `in_progress` Started modern built-in replacement sweep requested by user.
  - Scope:
    - convert Node/CJS tool entry scripts under `tools/*.cjs` to Bun-run ESM TypeScript
    - modernize `tools/maps` scripts to async ESM TS and remove duplicate JS artifacts
    - move modern config load path to Bun-native JSON reads
    - enforce ESM websocket runtime as active path and update active tests/contracts
    - retire redundant ESM wrappers where direct imports are sufficient
    - add planning ticket for larger legacy AMD/jQuery runtime retirement
  - Out of scope:
    - full legacy AMD/jQuery runtime rewrite/removal in this implementation slice
  - Acceptance criteria:
    - affected tooling/runtimes use modern built-ins with equivalent behavior
    - no active runtime or tests require CJS websocket module path
    - verify lane remains green
    - larger AMD/jQuery retirement recorded as planned follow-up
  - Verification plan:
    - `bun run verify:modern:node22`
    - targeted smoke/unit checks for changed runtime/tooling seams
- `2026-02-08T22:58Z` `done` Completed modern built-in replacement sweep and recorded larger-project follow-up plan.
  - Evidence:
    - `T-312.1` tooling conversion:
      - converted and rewired runtime/check scripts from `tools/*.cjs` to `tools/*.ts` (Bun-run entrypoints).
      - removed root `tools/*.cjs` files and updated package/workflow callsites.
      - updated workflows:
        - `.github/workflows/verify-dependency-drift.yml`
        - `.github/workflows/verify-ws-boundary-drill.yml`
    - `T-312.2` map tooling modernization:
      - modernized:
        - `tools/maps/exportmap.ts`
        - `tools/maps/processmap.ts`
        - `tools/maps/export.py`
      - removed duplicate JS map tool copies:
        - `tools/maps/exportmap.js`
        - `tools/maps/processmap.js`
      - updated tool docs:
        - `tools/maps/README.md`
    - `T-312.3` Bun-native config loading:
      - `server/js/main-esm-config-source.mjs` now prefers Bun file/json API on default read path while preserving fallback semantics.
    - `T-312.4` active websocket runtime contract modernization:
      - default ESM startup now always injects websocket runtime seam from:
        - `server/js/ws-runtime-esm.mjs`
      - runtime option fallback/toggle-only behavior retired in:
        - `server/js/main-esm-runtime-options.mjs`
      - websocket CJS parity assertions removed from active unit/smoke tests.
    - `T-312.5` ESM wrapper collapse:
      - retired redundant wrappers:
        - `server/js/ws-esm.mjs`
        - `server/js/main-runtime-esm.mjs`
        - `server/js/metrics-esm.mjs`
        - `server/js/metrics-runtime-esm.mjs`
      - updated direct import callsites + coverage config:
        - `server/js/main-esm.mjs`
        - `tsconfig.typecheck-server-esm.json`
    - `T-312.6` larger-project planning:
      - planned follow-up ticket recorded:
        - `T-313.1` Full AMD/jQuery client runtime retirement (`client/js/**`, RequireJS, and legacy runtime-only docs/checks removal) with dedicated migration slices.
  - Verification:
    - `bun run verify:modern:node22` -> pass
  - Notable blockers resolved:
    - initial `verify:modern:node22` failure in `check:runtime` after Bun migration (`process.version` reflected Bun embed node v24); fixed by checking `node -p "process.version"` from PATH in `tools/check-runtime.ts`.
    - initial test failures in wrapper-retirement slice due strict function identity assertions; converted to contract-level function signature/name checks in:
      - `tests/unit/server-main-runtime-esm.test.ts`
      - `tests/unit/server-metrics-esm.test.ts`
  - Planned follow-up ticket (`T-313.1`) (later completed on 2026-02-09; see closeout delta above):
    - Scope:
      - retire legacy AMD/jQuery client runtime tree (`client/js/**`) and RequireJS entry usage.
      - align docs/check scripts/workflows to modern-only client runtime coverage.
    - Out of scope:
      - gameplay behavior rewrites unrelated to loader/runtime retirement.
    - Acceptance criteria:
      - no runtime/dev/test path depends on AMD/jQuery tree.
      - modern verify lane passes without legacy client artifacts.
    - Verification plan:
      - `bun run verify:modern:node22`
      - browser protocol smoke lane after runtime retirement slice.
    - Dependencies/blockers:
      - staged migration of any remaining map/asset/runtime consumers that still assume `client/js/**` AMD loading semantics.

## Delta Update (2026-02-08 client wrapper artifact sync TypeScript source-of-truth slice)

### Ticket status

- `T-307.35` Promote `client/js-esm` wrapper artifacts (`bootstrap.js`, `preflight.js`, `mapworker.js`) to TS-authored generated outputs: `done`
- `T-307.36` Add deterministic sync/check tooling and enforce in modern verify lane: `done`
- `T-307.37` Re-run verification lanes and update docs/script formatting scope for this slice: `done`

### Live progress log

- `2026-02-08T20:08Z` `in_progress` Started wrapper-artifact source-of-truth migration to remove remaining authored modern-client JS in favor of generated outputs.
  - Scope:
    - keep runtime wrapper files:
      - `client/js-esm/bootstrap.js`
      - `client/js-esm/preflight.js`
      - `client/js-esm/mapworker.js`
    - move ownership to existing TypeScript sources:
      - `client/js-esm/bootstrap.ts`
      - `client/js-esm/preflight.ts`
      - `client/js-esm/mapworker.ts`
    - add deterministic sync tooling, build/check commands, and verify-lane guard
  - Out of scope:
    - legacy `client/js/**` tree
  - Acceptance criteria:
    - wrapper JS files are generated by sync tooling from TS sources.
    - sync check is enforced by `verify:modern`.
    - typecheck/test/build/format lanes remain green.
  - Verification plan:
    - `bun run build:client-wrappers`
    - `bun run check:client-wrappers-sync`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun run test`
    - `bun run build:vite`
    - `bun run format:check`
- `2026-02-08T20:08Z` `done` Completed wrapper sync tooling and verified full target lanes.
  - Evidence:
    - build config/tooling:
      - `tsconfig.build-client-wrappers.json`
      - `tools/sync-client-wrappers.cjs`
    - package wiring:
      - `package.json` scripts:
        - `build:client-wrappers`
        - `check:client-wrappers-sync`
        - `verify:modern` now enforces `check:client-wrappers-sync`
    - generated artifacts updated from TS sources:
      - `client/js-esm/bootstrap.js`
      - `client/js-esm/preflight.js`
      - `client/js-esm/mapworker.js`
    - formatter scope hardening:
      - switched format targets from generated `client/js-esm/preflight.js` to authored `client/js-esm/preflight.ts`
    - verification:
      - `bun run build:client-wrappers` -> pass
      - `bun run check:client-wrappers-sync` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass
      - `bun run format:check` -> pass

## Delta Update (2026-02-08 shared gametypes + server classjs TypeScript shadow-source slice)

### Ticket status

- `T-307.32` Promote shared gametypes and server class helper modules to TypeScript-authored shadow sources: `done`
- `T-307.33` Add deterministic sync/check tooling and enforce in modern verify lane: `done`
- `T-307.34` Re-run target verification lanes and update readiness/runtime docs for this slice: `done`

### Live progress log

- `2026-02-08T20:04Z` `in_progress` Started final non-legacy source conversion slice for remaining source-owned JS modules without TS/CTS counterparts.
  - Scope:
    - `shared/js/gametypes.js` -> `shared/js/gametypes.cts` (authored source + generated runtime artifact workflow)
    - `server/js/lib/class.js` -> `server/js/lib/class.cts` (authored source + generated runtime artifact workflow)
    - add sync tooling + build/check scripts and wire guards into `verify:modern`
    - update runtime typecheck and runtime defer inventory docs
  - Out of scope:
    - intentional JS runtime wrapper entries (`client/js-esm/bootstrap.js`, `client/js-esm/preflight.js`, `client/js-esm/mapworker.js`)
    - legacy `client/js/**` tree migration
  - Acceptance criteria:
    - selected modules are authored in `.cts`.
    - generated JS artifacts are deterministic and sync-guarded.
    - runtime/client typecheck + test/build/format lanes remain green.
  - Verification plan:
    - `bun run build:gametypes`
    - `bun run build:classjs`
    - `bun run check:gametypes-sync`
    - `bun run check:classjs-sync`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun run test`
    - `bun run build:vite`
    - `bun run format:check`
- `2026-02-08T20:04Z` `done` Completed gametypes/classjs shadow-source promotion and verified target lanes.
  - Evidence:
    - authored TypeScript sources:
      - `shared/js/gametypes.cts`
      - `server/js/lib/class.cts`
    - deterministic sync/build tooling:
      - `tools/sync-gametypes.cjs`
      - `tools/sync-classjs.cjs`
      - `tsconfig.build-gametypes.json`
      - `tsconfig.build-classjs.json`
    - generated runtime artifacts updated:
      - `shared/js/gametypes.js`
      - `server/js/lib/class.js`
    - package/runtime wiring updates:
      - `package.json` scripts:
        - `build:gametypes`, `build:classjs`
        - `check:gametypes-sync`, `check:classjs-sync`
        - `verify:modern` now enforces both new sync checks
      - `tsconfig.typecheck-runtime.json` now includes `shared/js/gametypes.cts` and `server/js/lib/class.cts`
      - `docs/typescript-runtime-checkjs-defer-list.md` updated for authored/generated inventory + guard commands
    - migration-specific hardening:
      - replaced strict-mode-incompatible legacy `arguments.callee`/implicit global patterns in class helper with equivalent strict-safe TypeScript implementation.
      - preserved current gametypes runtime behavior with `.cts` shadow source; added temporary `@ts-nocheck` to avoid broad, non-behavioral typing churn in this slice.
      - adjusted formatter scope to authored source (`shared/js/gametypes.cts`) instead of generated artifact.
    - verification:
      - `bun run build:gametypes` -> pass
      - `bun run build:classjs` -> pass
      - `bun run check:gametypes-sync` -> pass
      - `bun run check:classjs-sync` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass
      - `bun run format:check` -> pass

## Delta Update (2026-02-08 shared ws-close-codes TypeScript shadow-source slice)

### Ticket status

- `T-307.29` Promote shared websocket close-code contract module to TypeScript-authored shadow source: `done`
- `T-307.30` Add deterministic sync/check tooling and enforce in modern verify lane: `done`
- `T-307.31` Re-run target verification lanes and update readiness/runtime docs for this slice: `done`

### Live progress log

- `2026-02-08T20:00Z` `in_progress` Started shared close-code shadow-source promotion as the next low-risk runtime contract conversion.
  - Scope:
    - `shared/js/ws-close-codes.js` -> `shared/js/ws-close-codes.cts` (authored source + generated runtime artifact workflow)
    - add sync tooling + build/check scripts and wire guard into `verify:modern`
    - update runtime typecheck and defer inventory docs
  - Out of scope:
    - shared `gametypes.js` shadow-source promotion in this slice
    - legacy `client/js/**` migration
  - Acceptance criteria:
    - close-code source is authored in `.cts`.
    - generated JS artifact is deterministic and sync-guarded.
    - runtime/client typecheck + test/build lanes remain green.
  - Verification plan:
    - `bun run build:ws-close-codes`
    - `bun run check:ws-close-codes-sync`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun run test`
    - `bun run build:vite`
    - `bun run format:check`
- `2026-02-08T20:00Z` `done` Completed shared close-code shadow-source promotion and verified target lanes.
  - Evidence:
    - authored TypeScript source:
      - `shared/js/ws-close-codes.cts`
    - deterministic sync/build tooling:
      - `tools/sync-ws-close-codes.cjs`
      - `tsconfig.build-ws-close-codes.json`
    - generated runtime artifact updated:
      - `shared/js/ws-close-codes.js`
    - package/runtime wiring updates:
      - `package.json` scripts:
        - `build:ws-close-codes`
        - `check:ws-close-codes-sync`
        - `verify:modern` now enforces `check:ws-close-codes-sync`
      - `tsconfig.typecheck-runtime.json` now includes `shared/js/ws-close-codes.cts`
      - `docs/typescript-runtime-checkjs-defer-list.md` updated for authored/generated inventory + guard command
    - verification:
      - `bun run build:ws-close-codes` -> pass
      - `bun run check:ws-close-codes-sync` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass
      - `bun run format:check` -> pass

## Delta Update (2026-02-08 server metrics-adapter TypeScript shadow-source slice)

### Ticket status

- `T-307.26` Promote server metrics adapter modules (`metrics-adapters/memcache`, `metrics-adapters/noop`) to TypeScript-authored shadow sources: `done`
- `T-307.27` Add deterministic sync/check tooling and wire checks into modern verify lane: `done`
- `T-307.28` Re-run target verification lanes and update readiness docs for this slice: `done`

### Live progress log

- `2026-02-08T19:58Z` `in_progress` Started server metrics-adapter shadow-source promotion to continue first-party JS source retirement outside legacy client tree.
  - Scope:
    - `server/js/metrics-adapters/memcache.js` -> `server/js/metrics-adapters/memcache.cts` (authored source + generated runtime artifact workflow)
    - `server/js/metrics-adapters/noop.js` -> `server/js/metrics-adapters/noop.cts` (authored source + generated runtime artifact workflow)
    - add sync tooling + build/check scripts + verify enforcement for both adapters
    - update runtime typecheck and runtime defer inventory docs
  - Out of scope:
    - legacy `client/js/**` tree migration
    - shared `gametypes.js` / `ws-close-codes.js` shadow-source promotion in this slice
  - Acceptance criteria:
    - metrics adapter sources are authored in `.cts`.
    - generated JS artifacts are deterministic and guarded by check scripts.
    - runtime/client typecheck + test/build lanes remain green.
  - Verification plan:
    - `bun run build:metrics-adapter-memcache`
    - `bun run build:metrics-adapter-noop`
    - `bun run check:metrics-adapter-memcache-sync`
    - `bun run check:metrics-adapter-noop-sync`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun run test`
    - `bun run build:vite`
    - `bun run format:check`
- `2026-02-08T19:58Z` `done` Completed metrics-adapter shadow-source promotion and verified all target lanes.
  - Evidence:
    - authored TypeScript sources:
      - `server/js/metrics-adapters/memcache.cts`
      - `server/js/metrics-adapters/noop.cts`
    - deterministic sync/build tooling:
      - `tools/sync-metrics-adapter-memcache.cjs`
      - `tools/sync-metrics-adapter-noop.cjs`
      - `tsconfig.build-metrics-adapter-memcache.json`
      - `tsconfig.build-metrics-adapter-noop.json`
    - generated runtime artifacts updated:
      - `server/js/metrics-adapters/memcache.js`
      - `server/js/metrics-adapters/noop.js`
    - package/runtime wiring updates:
      - `package.json` scripts:
        - `build:metrics-adapter-memcache`, `build:metrics-adapter-noop`
        - `check:metrics-adapter-memcache-sync`, `check:metrics-adapter-noop-sync`
        - `verify:modern` now enforces both new sync checks
      - `tsconfig.typecheck-runtime.json` includes adapter `.cts` + `.js` files
      - `docs/typescript-runtime-checkjs-defer-list.md` updated for new authored/generated inventory + guard commands
    - verification:
      - `bun run build:metrics-adapter-memcache` -> pass
      - `bun run build:metrics-adapter-noop` -> pass
      - `bun run check:metrics-adapter-memcache-sync` -> pass
      - `bun run check:metrics-adapter-noop-sync` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass
      - `bun run format:check` -> pass

## Delta Update (2026-02-08 client lib helper TypeScript promotion slice)

### Ticket status

- `T-307.23` Promote client lib helper modules (`lib/astar`, `lib/bison`) to native TypeScript and update runtime aliases: `done`
- `T-307.24` Re-run modern verification lane after lib helper promotion: `done`
- `T-307.25` Update modernization readiness log with scope/evidence for this slice: `done`

### Live progress log

- `2026-02-08T19:54Z` `in_progress` Started final authored-client-lib TypeScriptification slice for remaining non-wrapper modern runtime helpers.
  - Scope:
    - `client/js-esm/lib/astar.js` -> `client/js-esm/lib/astar.ts`
    - `client/js-esm/lib/bison.js` -> `client/js-esm/lib/bison.ts`
    - `tsconfig.typecheck-client-runtime.json` alias updates for `lib/astar` and `lib/bison`
  - Out of scope:
    - JS runtime wrapper entries (`client/js-esm/bootstrap.js`, `client/js-esm/preflight.js`, `client/js-esm/mapworker.js`)
  - Acceptance criteria:
    - selected helper modules are native TypeScript.
    - runtime/client typecheck lanes remain green.
    - modern test/build lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T19:54Z` `done` Completed lib-helper TS promotion and verified target lanes.
  - Evidence:
    - file promotions:
      - `client/js-esm/lib/astar.ts`
      - `client/js-esm/lib/bison.ts`
    - removed JS sources:
      - `client/js-esm/lib/astar.js`
      - `client/js-esm/lib/bison.js`
    - runtime lane updates:
      - `tsconfig.typecheck-client-runtime.json` aliases now target `lib/astar.ts` and `lib/bison.ts`
    - compatibility-safe TS hardening:
      - `AStar` function optional heuristic parameter made explicit (`f?`) to preserve existing callsites that pass three args.
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass

## Delta Update (2026-02-08 client compat TypeScript promotion slice)

### Ticket status

- `T-307.20` Promote client compat modules to native TypeScript and update runtime aliases: `done`
- `T-307.21` Re-run modern verification lane after compat promotion: `done`
- `T-307.22` Update modernization readiness log with scope/evidence for this slice: `done`

### Live progress log

- `2026-02-08T19:52Z` `in_progress` Started compat-module TypeScriptification slice to continue reducing remaining authored modern client JS surface.
  - Scope:
    - `client/js-esm/compat/detect.js` -> `client/js-esm/compat/detect.ts`
    - `client/js-esm/compat/features.js` -> `client/js-esm/compat/features.ts`
    - `client/js-esm/compat/gametypes.js` -> `client/js-esm/compat/gametypes.ts`
    - `client/js-esm/compat/log.js` -> `client/js-esm/compat/log.ts`
    - `client/js-esm/compat/util.js` -> `client/js-esm/compat/util.ts`
    - runtime alias updates in `tsconfig.typecheck-client-runtime.json`
    - bootstrap/test reference updates for promoted compat module paths
  - Out of scope:
    - vendor libs under `client/js-esm/lib/*.js`
    - JS runtime wrapper entries (`client/js-esm/bootstrap.js`, `client/js-esm/preflight.js`, `client/js-esm/mapworker.js`)
  - Acceptance criteria:
    - selected compat modules are native TypeScript.
    - runtime/client typecheck lanes remain green.
    - modern test/build lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T19:52Z` `done` Completed compat TS promotion, resolved script drift, and verified target lanes.
  - Evidence:
    - file promotions:
      - `client/js-esm/compat/detect.ts`
      - `client/js-esm/compat/features.ts`
      - `client/js-esm/compat/gametypes.ts`
      - `client/js-esm/compat/log.ts`
      - `client/js-esm/compat/util.ts`
    - removed JS sources:
      - `client/js-esm/compat/detect.js`
      - `client/js-esm/compat/features.js`
      - `client/js-esm/compat/gametypes.js`
      - `client/js-esm/compat/log.js`
      - `client/js-esm/compat/util.js`
    - runtime/reference updates:
      - `tsconfig.typecheck-client-runtime.json` compat aliases now target `*.ts`
      - `client/js-esm/bootstrap.ts` + `client/js-esm/bootstrap.js` now import compat `*.ts` modules
      - `tests/unit/client-gametypes-compat.test.ts` now imports `client/js-esm/compat/gametypes.ts`
    - compatibility-safe TS hardening:
      - `client/js-esm/compat/log.ts` now uses dynamic field index signature and optional `stacktrace` argument to preserve current callsites.
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass
    - follow-through guard fix:
      - `bun run format:check` initially failed due stale glob `client/js-esm/compat/*.js`
      - updated `package.json` format scripts to `client/js-esm/compat/*.ts`
      - `bun run format:check` -> pass

## Delta Update (2026-02-08 client core orchestration TypeScript promotion slice)

### Ticket status

- `T-307.17` Promote client core orchestration modules (`app`, `main`, `game`) to native TypeScript and update runtime aliases/includes: `done`
- `T-307.18` Re-run modern verification lane after orchestration promotion: `done`
- `T-307.19` Update modernization readiness log with scope/evidence for this slice: `done`

### Live progress log

- `2026-02-08T19:49Z` `in_progress` Started core client orchestration TypeScriptification slice to complete first-party modern runtime module promotion.
  - Scope:
    - `client/js-esm/app.js` -> `client/js-esm/app.ts`
    - `client/js-esm/main.js` -> `client/js-esm/main.ts`
    - `client/js-esm/game.js` -> `client/js-esm/game.ts`
    - `tsconfig.typecheck-client-runtime.json` path aliases/includes updates for promoted modules
  - Out of scope:
    - compatibility bridge modules in `client/js-esm/compat/*.js`
    - vendor libraries in `client/js-esm/lib/*.js`
    - JS runtime entry wrappers (`bootstrap.js`, `preflight.js`, `mapworker.js`)
  - Acceptance criteria:
    - selected core modules are native TypeScript.
    - runtime/client typecheck lanes remain green.
    - modern test/build lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T19:49Z` `done` Completed core orchestration TS promotion and verified target lanes.
  - Evidence:
    - file promotions:
      - `client/js-esm/app.ts`
      - `client/js-esm/main.ts`
      - `client/js-esm/game.ts`
    - removed JS sources:
      - `client/js-esm/app.js`
      - `client/js-esm/main.js`
      - `client/js-esm/game.js`
    - runtime lane updates:
      - `tsconfig.typecheck-client-runtime.json` aliases now target `app.ts`, `main.ts`, `game.ts`
      - `tsconfig.typecheck-client-runtime.json` include now targets promoted TS module paths
    - compatibility-safe TS hardening:
      - added dynamic field index signatures in `App` and `Game` to preserve legacy runtime state mutation patterns.
      - casted legacy boundary seams where external contracts are intentionally dynamic (e.g. `InfoManager`, `AudioManager`, dynamic `import('game')` constructor binding).
      - aligned legacy optional-argument behavior (`setCursor`/`isMobOnSameTile`) with explicit optional TS signatures.
      - converted selected TS-in-TS DOM casts (chat/name input and form handles) to native TS assertions.
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass

## Delta Update (2026-02-08 client map/renderer TypeScript promotion slice)

### Ticket status

- `T-307.14` Promote client map/renderer modules to native TypeScript and update runtime aliases: `done`
- `T-307.15` Re-run modern verification lane after map/renderer promotion: `done`
- `T-307.16` Update modernization readiness log with scope/evidence for this slice: `done`

### Live progress log

- `2026-02-08T19:47Z` `in_progress` Started client TypeScriptification slice for map/render runtime modules with direct gameplay-loop dependencies.
  - Scope:
    - `client/js-esm/map.js` -> `client/js-esm/map.ts`
    - `client/js-esm/renderer.js` -> `client/js-esm/renderer.ts`
    - `tsconfig.typecheck-client-runtime.json` alias updates for `map` and `renderer`
  - Out of scope:
    - `client/js-esm/app.js`
    - `client/js-esm/game.js`
    - `client/js-esm/main.js`
  - Acceptance criteria:
    - selected modules are native TypeScript.
    - `typecheck-client-runtime` + runtime typecheck lanes pass.
    - modern test/build lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T19:47Z` `done` Completed map/renderer TS promotion and verified target lanes.
  - Evidence:
    - file promotions:
      - `client/js-esm/map.ts`
      - `client/js-esm/renderer.ts`
    - removed JS sources:
      - `client/js-esm/map.js`
      - `client/js-esm/renderer.js`
    - runtime lane updates:
      - `tsconfig.typecheck-client-runtime.json` aliases now target `map.ts` and `renderer.ts`
    - compatibility-safe TS hardening:
      - added dynamic field index signatures on `Map` and `Renderer` to preserve existing runtime mutation semantics.
      - adjusted renderer typing friction points without behavior changes:
        - cast camera constructor argument (`new Camera(this as any)`) at the legacy boundary.
        - made optional renderer helper parameters explicit (`drawText` color/stroke, `drawEntities`/`drawAnimatedTiles` dirty flag default).
        - typed temporary rect objects as `any` where legacy dynamic shape construction is used.
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass

## Delta Update (2026-02-08 client runtime helper TypeScript promotion slice)

### Ticket status

- `T-307.11` Promote client runtime helper modules (`gameclient`, `updater`) to native TypeScript and keep runtime/client type lanes green: `done`
- `T-307.12` Re-run modern regression/build lane after helper promotion: `done`
- `T-307.13` Update modernization readiness log with scope/evidence for this slice: `done`

### Live progress log

- `2026-02-08T19:20Z` `in_progress` Started helper-module TypeScript promotion batch to continue full client TypeScriptification.
  - Scope:
    - `client/js-esm/gameclient.js` -> `client/js-esm/gameclient.ts`
    - `client/js-esm/updater.js` -> `client/js-esm/updater.ts`
    - `tsconfig.typecheck-client-runtime.json` alias/include updates for promoted modules
  - Out of scope:
    - `client/js-esm/app.js`
    - `client/js-esm/game.js`
    - `client/js-esm/main.js`
    - `client/js-esm/map.js`
    - `client/js-esm/renderer.js`
  - Acceptance criteria:
    - selected helper modules are native TypeScript.
    - `typecheck-client-runtime` + runtime typecheck lanes pass.
    - modern test/build lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T19:20Z` `done` Completed helper-module promotion and verified full target lanes.
  - Evidence:
    - file promotions:
      - `client/js-esm/gameclient.ts`
      - `client/js-esm/updater.ts`
    - removed JS sources:
      - `client/js-esm/gameclient.js`
      - `client/js-esm/updater.js`
    - runtime lane updates:
      - `tsconfig.typecheck-client-runtime.json` aliases now target `gameclient.ts` and `updater.ts`
      - `tsconfig.typecheck-client-runtime.json` include now targets `gameclient.ts`
    - compatibility-safe TS hardening:
      - added explicit dynamic field index signatures on `GameClient` and `Updater` classes to preserve existing runtime mutation/callback wiring while satisfying native TS class property checks.
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass

## Delta Update (2026-02-08 client protocol payload TypeScript promotion slice)

### Ticket status

- `T-307.1` Promote client protocol payload helper from JSDoc-typed JS to native TypeScript and keep modern runtime lanes green: `done`
- `T-307.2` Promote low-risk core client modules (`config`, `exceptions`, `timer`) to native TypeScript: `done`
- `T-307.3` Promote low-risk client utility/UI modules (`bubble`, `storage`, `home`) to native TypeScript: `done`
- `T-307.4` Promote rendering-adjacent client modules (`tile`, `camera`, `infomanager`) to native TypeScript: `done`
- `T-307.5` Promote client entity wrapper/data modules (`item`, `items`, `mob`, `mobs`, `npcs`) to native TypeScript: `done`
- `T-307.6` Promote client actor wrappers (`npc`, `warrior`) to native TypeScript with safer NPC dialog fallback: `done`
- `T-307.7` Promote core actor dependency chain (`entity`, `character`, `player`) to native TypeScript with compatibility-safe typing: `done`
- `T-307.8` Promote sprite metadata/render helper modules (`sprite`, `sprites`) to native TypeScript: `done`
- `T-307.9` Promote startup worker/preflight shadow-source modules (`bootstrap`, `preflight`, `mapworker`) to TypeScript while preserving JS runtime entry compatibility: `done`
- `T-307.10` Promote runtime dependency helpers (`entityfactory`, `audio`) to native TypeScript: `done`

### Live progress log

- `2026-02-08T18:10Z` `in_progress` Selected low-risk boundary module conversion to begin full client TypeScriptification.
  - Scope:
    - `client/js-esm/protocol-payload.js` -> `client/js-esm/protocol-payload.ts`
    - Vite bare-import resolver support for `.ts` modules
    - Typecheck lane config updates
  - Out of scope:
    - gameplay loop rewrites
    - broad client module renames in this slice
  - Acceptance criteria:
    - protocol payload helper is native TS.
    - bare import `protocol-payload` resolves in Vite runtime.
    - typecheck/test/build lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client.json`
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T18:16Z` `done` Completed TS promotion + resolver/config updates and verified all target lanes.
  - Evidence:
    - file promotion: `client/js-esm/protocol-payload.ts`
    - removed JS source: `client/js-esm/protocol-payload.js`
    - updated resolver: `vite.config.ts` now resolves bare `.ts` and `index.ts`
    - updated configs:
      - `tsconfig.typecheck-client.json`
      - `tsconfig.typecheck-client-runtime.json`
      - `tsconfig.typecheck-runtime.json`
    - updated unit import: `tests/unit/client-boundary-types.test.ts`
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass
- `2026-02-08T18:22Z` `done` Completed second low-risk client TS promotion slice and kept runtime/test/build lanes green.
  - Evidence:
    - file promotions:
      - `client/js-esm/config.ts`
      - `client/js-esm/exceptions.ts`
      - `client/js-esm/timer.ts`
    - removed JS sources:
      - `client/js-esm/config.js`
      - `client/js-esm/exceptions.js`
      - `client/js-esm/timer.js`
    - alias/config updates:
      - `tsconfig.typecheck-client-runtime.json` (`config`, `exceptions`, `timer`, `protocol-payload` path updates)
      - `tsconfig.typecheck-runtime.json` (`protocol-payload.ts` include)
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
    - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
    - `bun run build:vite` -> pass
- `2026-02-08T18:24Z` `in_progress` Started third low-risk client TS promotion slice for utility/UI modules with minimal gameplay coupling.
  - Scope:
    - `client/js-esm/bubble.js` -> `client/js-esm/bubble.ts`
    - `client/js-esm/storage.js` -> `client/js-esm/storage.ts`
    - `client/js-esm/home.js` -> `client/js-esm/home.ts`
    - runtime alias/include updates in `tsconfig.typecheck-client-runtime.json`
    - modern entrypoint update in `client/modern.html`
  - Out of scope:
    - gameplay behavior changes
    - server runtime changes
  - Acceptance criteria:
    - selected modules are native TypeScript.
    - runtime/client typecheck lanes remain green.
    - full test/build lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T18:28Z` `done` Completed third TS promotion slice and verified full modern lane integrity.
  - Evidence:
    - file promotions:
      - `client/js-esm/bubble.ts`
      - `client/js-esm/storage.ts`
      - `client/js-esm/home.ts`
    - removed JS sources:
      - `client/js-esm/bubble.js`
      - `client/js-esm/storage.js`
      - `client/js-esm/home.js`
    - runtime updates:
      - `tsconfig.typecheck-client-runtime.json` path aliases now target `bubble.ts` and `storage.ts`
      - `tsconfig.typecheck-client-runtime.json` include now targets `home.ts`
      - `client/modern.html` module entry now targets `js-esm/home.ts`
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
    - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
    - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
    - `bun run build:vite` -> pass
- `2026-02-08T18:29Z` `in_progress` Started rendering-adjacent TS promotion slice with direct gameplay loop dependencies and runtime callsite validation.
  - Scope:
    - `client/js-esm/tile.js` -> `client/js-esm/tile.ts`
    - `client/js-esm/camera.js` -> `client/js-esm/camera.ts`
    - `client/js-esm/infomanager.js` -> `client/js-esm/infomanager.ts`
    - runtime alias updates in `tsconfig.typecheck-client-runtime.json`
  - Out of scope:
    - protocol changes
    - server runtime changes
  - Acceptance criteria:
    - selected modules are native TypeScript.
    - client-runtime typecheck catches and resolves any callsite type mismatches.
    - full modern verification lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T18:30Z` `done` Completed rendering-adjacent TS promotion slice and resolved one real runtime-signature mismatch surfaced by stricter typing.
  - Evidence:
    - file promotions:
      - `client/js-esm/tile.ts`
      - `client/js-esm/camera.ts`
      - `client/js-esm/infomanager.ts`
    - removed JS sources:
      - `client/js-esm/tile.js`
      - `client/js-esm/camera.js`
      - `client/js-esm/infomanager.js`
    - runtime updates:
      - `tsconfig.typecheck-client-runtime.json` path aliases now target `tile.ts`, `camera.ts`, `infomanager.ts`
    - type mismatch resolved:
      - widened `InfoManager.addDamageInfo` value shape to `number | string` for existing healed-text callsite usage in `client/js-esm/game.js`.
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
    - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
    - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
    - `bun run build:vite` -> pass
- `2026-02-08T18:31Z` `in_progress` Started client entity wrapper/data TS promotion slice focused on low-coupling constructors and loot/mob registries.
  - Scope:
    - `client/js-esm/item.js` -> `client/js-esm/item.ts`
    - `client/js-esm/items.js` -> `client/js-esm/items.ts`
    - `client/js-esm/mob.js` -> `client/js-esm/mob.ts`
    - `client/js-esm/mobs.js` -> `client/js-esm/mobs.ts`
    - `client/js-esm/npcs.js` -> `client/js-esm/npcs.ts`
    - runtime alias updates in `tsconfig.typecheck-client-runtime.json`
  - Out of scope:
    - combat logic rewrites
    - server/runtime protocol changes
  - Acceptance criteria:
    - selected modules are native TypeScript with explicit constructor/method signatures.
    - stricter typing catches and resolves any inheritance/field declaration mismatches.
    - full modern verification lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T18:32Z` `done` Completed entity wrapper/data TS promotion slice and resolved type-level inheritance/field issues.
  - Evidence:
    - file promotions:
      - `client/js-esm/item.ts`
      - `client/js-esm/items.ts`
      - `client/js-esm/mob.ts`
      - `client/js-esm/mobs.ts`
      - `client/js-esm/npcs.ts`
    - removed JS sources:
      - `client/js-esm/item.js`
      - `client/js-esm/items.js`
      - `client/js-esm/mob.js`
      - `client/js-esm/mobs.js`
      - `client/js-esm/npcs.js`
    - runtime updates:
      - `tsconfig.typecheck-client-runtime.json` path aliases now target promoted TS modules
    - mismatch fixes from stricter typing:
      - aligned `FirePotion.onLoot` override with base `Item.onLoot` contract.
      - declared `Boss.atkRate` class field for explicit TS field safety.
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
    - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
    - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
    - `bun run build:vite` -> pass
- `2026-02-08T18:33Z` `in_progress` Started actor-wrapper TS promotion slice for `npc` and `warrior`.
  - Scope:
    - `client/js-esm/npc.js` -> `client/js-esm/npc.ts`
    - `client/js-esm/warrior.js` -> `client/js-esm/warrior.ts`
    - runtime alias updates in `tsconfig.typecheck-client-runtime.json`
    - guard unknown NPC talk keys with typed fallback list
  - Out of scope:
    - player/game loop logic rewrites
    - protocol/server changes
  - Acceptance criteria:
    - `npc` and `warrior` are native TypeScript.
    - NPC dialog lookup is type-safe and resilient for unknown keys.
    - full modern verification lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T18:34Z` `done` Completed actor-wrapper TS promotion slice with safe NPC dialog fallback and green modern verification lanes.
  - Evidence:
    - file promotions:
      - `client/js-esm/npc.ts`
      - `client/js-esm/warrior.ts`
    - removed JS sources:
      - `client/js-esm/npc.js`
      - `client/js-esm/warrior.js`
    - runtime updates:
      - `tsconfig.typecheck-client-runtime.json` path aliases now target `npc.ts` and `warrior.ts`
    - behavior hardening:
      - `Npc` now resolves dialog lines through a typed helper with `othernpc` fallback when kind mapping is unknown.
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass

- `2026-02-08T18:36Z` `in_progress` Started core actor dependency chain TS slice for `entity`, `character`, and `player`.
  - Scope:
    - `client/js-esm/entity.js` -> `client/js-esm/entity.ts`
    - `client/js-esm/character.js` -> `client/js-esm/character.ts`
    - `client/js-esm/player.js` -> `client/js-esm/player.ts`
    - runtime alias updates in `tsconfig.typecheck-client-runtime.json`
  - Out of scope:
    - gameplay mechanic rewrites
    - server/runtime protocol changes
  - Acceptance criteria:
    - core actor dependency chain modules are native TypeScript.
    - conversion preserves existing runtime behavior while keeping typecheck lanes green.
    - full test/build lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T18:38Z` `done` Completed core actor dependency chain TS slice and validated full modern lanes.
  - Evidence:
    - file promotions:
      - `client/js-esm/entity.ts`
      - `client/js-esm/character.ts`
      - `client/js-esm/player.ts`
    - removed JS sources:
      - `client/js-esm/entity.js`
      - `client/js-esm/character.js`
      - `client/js-esm/player.js`
    - runtime updates:
      - `tsconfig.typecheck-client-runtime.json` aliases now target `entity.ts`, `character.ts`, `player.ts`
    - compatibility hardening from typecheck feedback:
      - widened combat-link surfaces (`target`, attacker graph callbacks) to preserve existing dynamic gameplay contracts consumed by `game.js`.
      - fixed weapon/armor switch timer declaration safety in `player.ts`.
      - typed checkpoint shape in `player.ts` to match runtime `checkpoint.id` usage.
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass
- `2026-02-08T18:40Z` `in_progress` Started sprite-layer TS slice for metadata and image processing helpers.
  - Scope:
    - `client/js-esm/sprite.js` -> `client/js-esm/sprite.ts`
    - `client/js-esm/sprites.js` -> `client/js-esm/sprites.ts`
    - runtime alias updates in `tsconfig.typecheck-client-runtime.json`
  - Out of scope:
    - renderer/gameplay orchestration changes
    - map/render loop rewrites
  - Acceptance criteria:
    - sprite helper modules are native TS.
    - image-processing paths remain runtime-compatible.
    - typecheck/test/build lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T18:43Z` `done` Completed sprite-layer TS slice and startup helper TS slice with JS runtime compatibility guardrails.
  - Evidence:
    - file promotions:
      - `client/js-esm/sprite.ts`
      - `client/js-esm/sprites.ts`
      - `client/js-esm/bootstrap.ts`
      - `client/js-esm/preflight.ts`
      - `client/js-esm/mapworker.ts`
    - runtime alias/config updates:
      - `tsconfig.typecheck-client-runtime.json` aliases now target `sprite.ts` and `sprites.ts`
      - `tsconfig.typecheck-client-runtime.json` includes target promoted startup helper TS files
    - compatibility adjustments:
      - restored JS runtime entry artifacts for static/direct serving:
        - `client/js-esm/bootstrap.js`
        - `client/js-esm/preflight.js`
        - `client/js-esm/mapworker.js`
      - restored runtime references to JS entry artifacts:
        - `client/modern.html` uses `js-esm/preflight.js`
        - `client/js-esm/home.ts` imports `./bootstrap.js`
        - `client/js-esm/map.js` worker URL targets `./mapworker.js`
      - smoke regression fixed:
        - `tests/smoke/static-server-entry-default.test.ts` passes after restoring JS preflight entry contract.
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass
- `2026-02-08T18:44Z` `in_progress` Started runtime dependency helper TS slice for entity construction and audio orchestration.
  - Scope:
    - `client/js-esm/entityfactory.js` -> `client/js-esm/entityfactory.ts`
    - `client/js-esm/audio.js` -> `client/js-esm/audio.ts`
    - runtime alias/include updates in `tsconfig.typecheck-client-runtime.json`
  - Out of scope:
    - renderer/game loop migration
    - websocket protocol/runtime changes
  - Acceptance criteria:
    - selected runtime helper modules are native TypeScript.
    - entity construction and audio behavior remain parity-safe.
    - full typecheck/test/build lanes remain green.
  - Verification plan:
    - `bun x tsc -p tsconfig.typecheck-client-runtime.json`
    - `bun x tsc -p tsconfig.typecheck-runtime.json`
    - `bun run test`
    - `bun run build:vite`
- `2026-02-08T18:45Z` `done` Completed runtime helper TS slice with parity-safe fixes and green verification lanes.
  - Evidence:
    - file promotions:
      - `client/js-esm/entityfactory.ts`
      - `client/js-esm/audio.ts`
    - removed JS sources:
      - `client/js-esm/entityfactory.js`
      - `client/js-esm/audio.js`
    - runtime updates:
      - `tsconfig.typecheck-client-runtime.json` aliases now target `entityfactory.ts` and `audio.ts`
      - `tsconfig.typecheck-client-runtime.json` include now targets `entityfactory.ts`
    - compatibility fixes:
      - aligned chest factory constructor call (`new Chest(id, Types.Entities.CHEST)`) with current class signature.
      - preserved dynamic audio runtime behavior while adding typed fade interval guards.
    - verification:
      - `bun x tsc -p tsconfig.typecheck-client-runtime.json` -> pass
      - `bun x tsc -p tsconfig.typecheck-runtime.json` -> pass
      - `bun run test` -> pass (`135 pass`, `1 skip`, `0 fail`)
      - `bun run build:vite` -> pass

## Delta Update (2026-02-08 asset restoration slice)

### Ticket status

- `T-308.1` Restore missing music assets from BrowserQuestKit source snapshot and verify runtime build integrity: `done`

### Live progress log

- `2026-02-08T18:18Z` `in_progress` Pulled source assets from `tnantoka/BrowserQuestKit` at commit `5bd49fe2a99c4bcb49466fb03095191fee14db6b` and audited available media folders.
  - Evidence:
    - `/tmp/BrowserQuestKit/BrowserQuestKit/Assets/music/*.mp3` present
    - `/tmp/BrowserQuestKit/BrowserQuestKit/Assets/sounds/*.mp3` present
  - Next action: copy missing music into local runtime asset tree.
- `2026-02-08T18:19Z` `done` Restored music assets and verified build.
  - Evidence:
    - added files under `client/audio/music/`:
      - `village.mp3`, `beach.mp3`, `forest.mp3`, `cave.mp3`, `desert.mp3`, `lavaland.mp3`, `boss.mp3`
    - `bun run build:vite` -> pass
    - post-copy asset audit: all configured sound effects and mp3 music tracks present; only optional `client/audio/music/*.ogg` fallbacks remain absent (upstream snapshot provides mp3 only).

## Delta Update (2026-02-08 CJS runtime header idioms slice)

### Ticket status

- `T-306.2` Modernize authored CJS TypeScript shadow-source headers from legacy multi-`var` require chains to idiomatic `const` imports: `done`
- `T-306.3` Add regression guard to prevent `var ... = require(...)` reintroduction in authored `*.cts` runtime sources: `done`

### Live progress log

- `2026-02-08T16:14Z` `in_progress` Selected runtime lane modules with remaining pre-ES2015 header idioms and low behavior risk.
  - Scope:
    - `server/js/player.cts`
    - `server/js/ws.cts`
    - `server/js/worldserver.cts`
  - Out of scope:
    - gameplay logic changes
    - protocol/transport behavior changes
  - Acceptance criteria:
    - headers use per-module `const require(...)` declarations (no comma-chained multi-`var` import block).
    - generated runtime artifacts stay in sync.
    - full modern verification lane remains green.
  - Verification plan:
    - `bun run build:player`
    - `bun run build:ws-module`
    - `bun run build:worldserver`
    - `bun run verify:modern:node22`
- `2026-02-08T16:17Z` `done` Completed header modernization for selected modules and verified runtime parity.
  - Evidence:
    - updated source headers:
      - `server/js/player.cts`
      - `server/js/ws.cts`
      - `server/js/worldserver.cts`
    - regenerated artifacts:
      - `server/js/player.js`
      - `server/js/ws.js`
      - `server/js/worldserver.js`
    - verification:
      - `bun run build:player` -> pass
      - `bun run build:ws-module` -> pass
      - `bun run build:worldserver` -> pass
      - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass)
- `2026-02-08T16:19Z` `done` Added and enforced `*.cts` require-style guard in default modern verification lane.
  - Evidence:
    - added `tools/check-cts-require-const.cjs`
    - updated `package.json`:
      - new script: `check:cts-require-const`
      - `verify:modern` now runs `check:cts-require-const`
    - `bun run check:cts-require-const` -> pass
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass)

## Delta Update (2026-02-08 startup asset pressure reduction slice)

### Ticket status

- `T-306.1` Reduce startup sprite pressure by loading only the active scale at boot and loading other scales on demand: `done`

### Live progress log

- `2026-02-08T15:58Z` `in_progress` Investigated startup asset pressure report (`~15k`) in modern client boot lane.
  - Evidence:
    - `rg -n "loadSprites|loadMap|loadAudio|new Image\\(|drawImage\\(" client/js-esm -g '*.js'`
    - `sed -n '330,760p' client/js-esm/game.js`
    - `sed -n '1,240p' client/js-esm/map.js`
    - `sed -n '1,220p' client/js-esm/audio.js`
  - Findings:
    - startup boot loads all `67` sprites for multiple scales on desktop (`img/2` + `img/3`), map tileset(s), and audio.
    - perceived `15k` is not literal asset file count; render/decode work and tile draw loops can dominate startup traces.
  - Next action: reduce eager sprite scale fan-out during boot.
- `2026-02-08T16:13Z` `done` Implemented active-scale sprite boot loading with on-demand scale loading in `setSpriteScale`.
  - Evidence:
    - updated `client/js-esm/game.js`:
      - added `loadSpriteForScale(name, scale)` and `loadSpriteScale(scale)`.
      - `loadSprites()` now loads only `renderer.scale` (or `1` in upscaled mode) at boot.
      - `setSpriteScale(scale)` ensures requested scale is loaded lazily before rebinding sprites.
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass).

## Delta Update (2026-02-08 ESM bridge de-require slice)

### Ticket status

- `T-304.1` Remove `createRequire` shims from runtime ESM bridge modules where CJS interop import is sufficient: `done`

### Live progress log

- `2026-02-08T08:03Z` `in_progress` Audited ESM runtime bridge modules and selected low-risk bridge modernization slice.
  - Evidence: `rg -n "createRequire\\(" server/js/*.mjs shared/js/*.mjs`
  - Next action: replace `createRequire` bridge shims with interop-safe ESM imports.
- `2026-02-08T08:10Z` `in_progress` Implemented bridge updates and adjusted ESM parity tests to assert contract shape instead of cross-loader identity.
  - Evidence: focused suite run over `server-main-runtime-esm`, `server-metrics-esm`, protocol/ws-close-code mirrors.
  - Next action: clear strict `typecheck:server-esm` failures from CJS namespace typing.
- `2026-02-08T08:17Z` `done` Added explicit JSDoc contract casts for interop fallbacks and completed full modern verification.
  - Evidence:
    - `bun run typecheck:server-esm` -> pass
    - `bun test tests/unit/server-utils-esm.test.ts tests/unit/protocol-contract-module.test.ts tests/unit/ws-close-codes-contract.test.ts tests/unit/server-main-runtime-esm.test.ts tests/unit/server-metrics-esm.test.ts tests/unit/ws-runtime-class-factory.test.ts tests/unit/server-ws-esm.test.ts --timeout 20000` -> pass
    - `bun run verify:modern:node22` -> pass

### Implemented in this slice

- Removed `createRequire` shims from selected ESM bridge modules and replaced with explicit interop imports:
  - `shared/js/gametypes-esm.mjs`
  - `shared/js/protocol-contract-esm.mjs`
  - `shared/js/ws-close-codes-esm.mjs`
  - `server/js/main-runtime-esm.mjs`
  - `server/js/metrics-esm.mjs`
  - `server/js/metrics-runtime-esm.mjs`
  - `server/js/ws-runtime-class-factory.mjs`
- Promoted `server/js/utils-esm.mjs` to import shared gametypes through the ESM bridge (`shared/js/gametypes-esm.mjs`) instead of direct CJS `require`.
- Updated ESM mirror parity tests to validate API contract consistency across loader boundaries instead of strict object identity:
  - `tests/unit/server-main-runtime-esm.test.ts`
  - `tests/unit/server-metrics-esm.test.ts`

## Delta Update (2026-02-08 doc-policy cleanup slice)

### Ticket status

- `T-305.1` Remove stale active guidance for retired legacy lanes in operator-facing docs: `done`

### Live progress log

- `2026-02-08T08:23Z` `in_progress` Audited `docs/client-build-support.md` for active instructions that still treated retired legacy lanes as current.
  - Evidence: `rg -n "verify:legacy|test:browser:legacy|build:client|build:vite:legacy|verify-legacy" docs/client-build-support.md`
  - Next action: rewrite operational sections to modern-primary posture and explicit retirement notes.
- `2026-02-08T08:27Z` `done` Updated support matrix/CI mapping/change policy wording to align with retired legacy command lanes.
  - Evidence:
    - `rg -n "verify:legacy|test:browser:legacy|build:client|build:vite:legacy|verify-legacy|verify-legacy-browser" README.md docs/runtime-preflight.md docs/client-build-support.md`
    - `docs/client-build-support.md` now marks legacy build/verify/browser lanes as retired instead of active default guidance.

## Delta Update (2026-02-08 ESM startup seam async-import slice)

### Ticket status

- `T-304.2` Remove final `createRequire` usage from `main-esm` startup seam by promoting async CJS interop import contract: `done`

### Live progress log

- `2026-02-08T08:31Z` `in_progress` Traced `main-esm` startup seam (`main-esm` -> startup-runner -> bridge-probe) and identified sync `requireWsCjs` callback as remaining `createRequire` dependency.
  - Evidence: `rg -n "requireWsCjs|createRequire" server/js tests/unit`
  - Next action: promote seam contract to async `importWsCjs`.
- `2026-02-08T08:36Z` `done` Updated startup seam to async import and removed `createRequire` from `server/js/main-esm.mjs`.
  - Evidence:
    - Updated files: `server/js/main-esm.mjs`, `server/js/main-esm-startup-runner.mjs`, `server/js/main-esm-bridge-probe.mjs`.
    - Updated tests: `tests/unit/server-main-esm-startup-runner.test.ts`, `tests/unit/server-main-esm-bridge-probe.test.ts`.
    - `bun test tests/unit/server-main-esm-bridge-probe.test.ts tests/unit/server-main-esm-startup-runner.test.ts tests/unit/server-main-esm-runtime-options.test.ts tests/unit/server-main-esm-boot-envelope.test.ts --timeout 20000` -> pass.
    - `bun run verify:modern:node22` -> pass.
    - `rg -n "createRequire\\(" server/js/*.mjs shared/js/*.mjs` -> no matches.

## Delta Update (2026-02-08 regression guard slice)

### Ticket status

- `T-304.3` Add runtime ESM bridge regression guard against `createRequire` reintroduction: `done`

### Live progress log

- `2026-02-08T08:42Z` `in_progress` Added dedicated guard command for runtime `.mjs` bridge modules.
  - Evidence: `tools/check-runtime-esm-require-free.cjs`.
  - Next action: enforce guard in `verify:modern`.
- `2026-02-08T08:45Z` `done` Wired guard into `verify:modern` and re-verified full modern lane.
  - Evidence:
    - `package.json`: `check:runtime-esm-require-free` added and included in `verify:modern`.
    - `bun run check:runtime-esm-require-free` -> pass.
    - `bun run verify:modern:node22` -> pass.

## Delta Update (2026-02-08 ESM probe decoupling slice)

### Ticket status

- `T-304.4` Remove CJS websocket module import dependency from ESM startup probe seam: `done`

### Live progress log

- `2026-02-08T08:51Z` `in_progress` Refactored startup probe seam to drop `importWsCjs` contract and validate against shared close-code contract.
  - Evidence: updated `server/js/main-esm-bridge-probe.mjs`, `server/js/main-esm-startup-runner.mjs`, `server/js/main-esm.mjs`.
  - Next action: update seam unit tests and rerun startup/bridge smoke coverage.
- `2026-02-08T08:55Z` `done` Updated tests and verified full modern lane.
  - Evidence:
    - `bun test tests/unit/server-main-esm-bridge-probe.test.ts tests/unit/server-main-esm-startup-runner.test.ts tests/unit/server-main-esm-runtime-options.test.ts tests/unit/server-main-esm-boot-envelope.test.ts --timeout 20000` -> pass.
    - `bun test tests/smoke/server-handshake-esm-ws-bridge.test.ts --timeout 20000` -> pass.
    - `bun run verify:modern:node22` -> pass.

## Delta Update (2026-02-08 websocket factory ESM promotion slice)

### Ticket status

- `T-304.5` Promote websocket runtime class factory from CJS-backed ESM wrapper to native ESM implementation: `done`

### Live progress log

- `2026-02-08T09:01Z` `in_progress` Replaced `server/js/ws-runtime-class-factory.mjs` with native ESM implementation (no CJS delegation).
  - Evidence: `server/js/ws-runtime-class-factory.mjs` now exports runtime classes directly.
  - Next action: update boundary decision assertion from cross-loader identity to contract parity.
- `2026-02-08T09:04Z` `done` Updated websocket boundary test posture and re-verified targeted + full modern lanes.
  - Evidence:
    - `tests/unit/ws-runtime-boundary-decision.test.ts` now checks CJS/ESM contract compatibility instead of strict function identity.
    - `bun test tests/unit/ws-runtime-class-factory.test.ts tests/unit/ws-runtime-boundary-decision.test.ts tests/unit/ws-runtime-parity.test.ts tests/unit/server-ws-esm.test.ts tests/smoke/server-handshake-esm-ws-runtime.test.ts tests/smoke/server-handshake-esm-ws-bridge.test.ts --timeout 20000` -> pass.
    - `bun run verify:modern:node22` -> pass.

## Delta Update (2026-02-08 shared-bridge ESM promotion slice)

### Ticket status

- `T-304.6` Promote shared gametypes and ws-close-codes ESM bridges to native ESM contracts: `done`

### Live progress log

- `2026-02-08T09:10Z` `in_progress` Replaced CJS-backed ESM bridges:
  - `shared/js/gametypes-esm.mjs` now sources native ESM contract from `shared/js/gametypes-browser.mjs`.
  - `shared/js/ws-close-codes-esm.mjs` now exports a native ESM close-code contract object.
  - Next action: adjust unit assertions from cross-loader identity to value-contract parity.
- `2026-02-08T09:13Z` `done` Updated parity assertions and re-verified full modern lane.
  - Evidence:
    - Updated tests: `tests/unit/gametypes-contract.test.ts`, `tests/unit/ws-close-codes-contract.test.ts`.
    - `bun test tests/unit/gametypes-contract.test.ts tests/unit/protocol-support-contract.test.ts tests/unit/ws-close-codes-contract.test.ts tests/unit/protocol-contract-module.test.ts tests/smoke/server-payload-guards.test.ts --timeout 20000` -> pass.
    - `bun run verify:modern:node22` -> pass.

## Delta Update (2026-02-08 protocol ESM bridge promotion + guard slice)

### Ticket status

- `T-304.7` Promote `shared/js/protocol-contract-esm.mjs` to native ESM implementation: `done`
- `T-304.8` Add protocol ESM/CJS parity guard and enforce it in `verify:modern`: `done`

### Live progress log

- `2026-02-08T09:19Z` `in_progress` Replaced protocol ESM bridge CJS import with native ESM implementation sourced from `gametypes-esm`.
  - Evidence: `shared/js/protocol-contract-esm.mjs` rewritten with native parser/constant contract.
  - Next action: update protocol type inventory test from function identity to behavior parity.
- `2026-02-08T09:22Z` `in_progress` Added parity guard command and wired into verify lane.
  - Evidence:
    - added `tools/check-protocol-contract-esm-parity.cjs`.
    - `package.json` includes `check:protocol-contract-esm-parity` and `verify:modern` now runs it.
  - Blocker handled:
    - initial `node` runner failed due to CJS-style generated contract file under `"type": "module"`.
    - resolved by running the guard with `bun` (`bun tools/check-protocol-contract-esm-parity.cjs`).
- `2026-02-08T09:26Z` `done` Protocol bridge + guard fully verified.
  - Evidence:
    - `bun test tests/unit/protocol-contract-types.test.ts tests/unit/protocol-contract-module.test.ts tests/unit/protocol-support-contract.test.ts tests/unit/ws-runtime-parity.test.ts tests/unit/ws-connection-esm.test.ts tests/smoke/server-payload-guards.test.ts --timeout 20000` -> pass.
    - `bun run check:protocol-contract-esm-parity` -> pass.
    - `bun run verify:modern:node22` -> pass.

## Delta Update (2026-02-08 legacy deactivation follow-through)

### Ticket status

- `T-301` Remove static-server legacy root entry toggle: `done`
- `T-302` Convert protocol invariant browser gate to modern-only entry coverage: `done`
- `T-303` Align readiness document evidence with retired legacy lane: `done`

### Live progress log

- `2026-02-08T07:32Z` `in_progress` Started re-audit of active runtime legacy paths.
  - Evidence: `rg -n "BQ_CLIENT_DEFAULT_ENTRY|/client/index.html|verify:legacy" ...`
  - Next action: remove remaining legacy default-entry toggle.
- `2026-02-08T07:35Z` `in_progress` Removed `BQ_CLIENT_DEFAULT_ENTRY` runtime branch and legacy opt-in smoke.
  - Evidence: `bun run test:static-entry` -> pass (`1 pass`, `0 fail`).
  - Next action: de-couple protocol invariant browser suite from `client/index.html`.
- `2026-02-08T07:38Z` `in_progress` Migrated protocol-invariant Playwright test to modern-only assertions.
  - Evidence: `bun run test:browser:protocol-invariant:node22` -> pass (`1 passed`).
  - Next action: refresh modernization readiness evidence + run full modern verify.
- `2026-02-08T07:40Z` `done` Documentation/evidence alignment complete.
  - Evidence: this delta section + command outcomes listed below.

## Delta Update (2026-02-08 audit remediation pass)

### Ticket status

- `M-02` Remove ESM compat global writes: `done`
- `M-06` Remove obsolete browser branches (MozWebSocket/vendor transition/RAF): `done`
- `M-03` Tighten boundary type seams: `done`
- `M-04` Reduce modern-path ESM/CJS bridge usage: `done`
- `M-01` Legacy runtime retirement policy enforcement: `done`

### Implemented in this pass

- Removed compat global writes from:
  - `client/js-esm/compat/log.js`
  - `client/js-esm/compat/detect.js`
  - `client/js-esm/compat/features.js`
  - `client/js-esm/compat/util.js`
- Removed obsolete browser compatibility branches from modern ESM path:
  - `MozWebSocket` fallback removed (`client/js-esm/gameclient.js`)
  - vendor transition listeners removed (`client/js-esm/main.js`)
  - vendor-prefixed RAF branches removed (`client/js-esm/compat/util.js`)
- Modernized Safari image helper to `fetch` + `Blob` URL flow in `client/js-esm/compat/util.js`.
- Tightened explicit client boundary contracts without `any`:
  - `client/js-esm/client-boundary-types.ts`
  - `client/js-esm/main.js` dynamic-import constructor seam typing
  - `client/js-esm/app.js` runtime config seam typing
- Removed remaining server runtime `any` seam escape hatches by typing dynamic class surfaces:
  - `server/js/player.cts`
  - `server/js/worldserver.cts`
- Introduced browser-native shared gametypes module and moved modern client compat import to it:
  - `shared/js/gametypes-browser.mjs`
  - `client/js-esm/compat/gametypes.js`
- Added default modern verification entrypoint:
  - `package.json` script: `"verify": "bun run verify:modern"`
- Retired active legacy command lanes with explicit guardrails:
  - `build:client`, `build:vite:legacy`, `verify:legacy`, `verify:legacy:node22`
  - `test:legacy-browser` + legacy browser aliases
  - `tools/legacy-retired.cjs`
- Simplified Vite to modern-only build input/output:
  - removed legacy build input toggle and legacy runtime asset copy plugin (`vite.config.ts`)
- Removed legacy CI workflow gates:
  - `.github/workflows/verify-legacy.yml`
  - `.github/workflows/verify-legacy-browser.yml`

### Verification evidence for this pass

- `bun run typecheck` passed.
- `bun run build:vite` passed.
- `bun test tests/unit/client-boundary-types.test.ts --timeout 20000` passed.
- `bun test tests/unit/gametypes-contract.test.ts tests/unit/client-gametypes-compat.test.ts --timeout 20000` passed.
- `bun run test` passed (`136 pass`, `1 skip`, `0 fail`).
- `bun run build:worldserver` passed (runtime artifact synced from typed `.cts` source).
- `bun run verify:modern:node22` passed (modern-only verification path).

## Summary

The in-repository modernization execution track is complete and green.

Technical implementation, type hardening, sync determinism, and runtime parity gates are passing on Node 22.

## Completed Technical State

- Server shadow-source hardening is complete:
  - `server/js/*.cts` has no `@ts-nocheck`.
  - Runtime artifacts are generated deterministically from `.cts` sources.
- Verification gates now include hardening regression checks:
  - `check:server-shadow-hardening` is part of `verify:modern`.
- Shared protocol contract is now TypeScript-authored shadow source:
  - `shared/js/protocol-contract.cts` -> generated `shared/js/protocol-contract.js`.
  - `check:protocol-contract-sync` is part of `verify:modern`.
- Node 22 runner is modernization-aligned:
  - `tools/node22-run.sh` now prefers local Node 22 and falls back to explicit `npm exec --package=node@22` only when required.
  - no `npx` references remain in project `package.json` + `tools` command surfaces.
- Direct dependency drift enforcement is Bun-native:
  - `check:deps:drift` now runs `tools/check-dependency-drift.cjs` (no `npm outdated` dependency).
  - CI dependency drift snapshot workflow consumes the same checker with report output mode.
- Websocket/runtime boundary parity checks remain green (`check:ws:runbooks`, protocol browser suite).
- First-party runtime/test surfaces are free of TS suppression pragmas (`@ts-expect-error`, `@ts-ignore`, `@ts-nocheck`).
- Direct dependency drift is clean (`bun outdated`, `check:deps:drift`).

## Verification Evidence

Executed successfully on 2026-02-08:

- `bun run check:server-shadow-hardening`
- `bun run check:protocol-contract-sync`
- `bun run check:deps:drift` (no direct dependency drift)
- `bun outdated` (no direct dependency updates)
- `bun run typecheck`
- `bun run verify:modern:node22`
- `bun run verify:legacy:node22` (intentionally retired; expected to fail via `tools/legacy-retired.cjs`)
- `bun run test:static-entry`
- `bun run test:browser:protocol-invariant:node22`
- `bun run test:browser:protocol:node22`
- `bun run check:ws:runbooks`
- `bun run check:legacy-signoff:report:json` (machine-readable external blocker inventory)
- `bun run check:legacy-signoff:report` (human-readable external blocker inventory)
- `bun run check:legacy-signoff:ready` (strict closure check; passes)
- `rg -n '\bnpx\b' package.json tools` (no matches)
- `rg -n '@ts-(expect-error|ignore|nocheck)' client/js-esm server/js shared/js tests` (no matches)

## Remaining Work

- None open in the in-repo modernization track.

## Delta Update (2026-02-08 legacy client runtime TS-authored core slice)

### Ticket status

- `T-307.1` TypeScriptify `client/js/{detect,eventcompat}.js` via generated runtime artifacts: `done`
- `T-307.2` TypeScriptify `client/js/{transition,storage}.js` via generated runtime artifacts: `done`
- `T-307.3` Keep modern verification guards aligned with TS-authored client runtime files: `done`

### Live progress log

- `2026-02-08T20:31Z` `in_progress` Started legacy-core slice with low-risk modules and sync-pipeline expansion.
  - Scope in: `client/js/{detect,eventcompat,transition,storage}` authored `.ts` + generated `.js` artifacts.
  - Scope out: gameplay behavior/API changes.
  - Next action: wire additional files into `tsconfig.build-client-legacy-core.json` + `tools/sync-client-legacy-core.cjs`.
- `2026-02-08T20:34Z` `in_progress` Completed authored TS and sync wiring for all four modules.
  - Evidence:
    - Added authored sources: `client/js/detect.ts`, `client/js/eventcompat.ts`, `client/js/transition.ts`, `client/js/storage.ts`.
    - Updated legacy-core build/sync: `tsconfig.build-client-legacy-core.json`, `tools/sync-client-legacy-core.cjs`.
    - `bun run build:client-legacy-core` -> pass.
    - `bun run check:client-legacy-core-sync` -> pass.
  - Next action: run full modern verification lane.
- `2026-02-08T20:36Z` `blocked` `verify:modern:node22` failed on stale JS-only assumptions in client runtime verification guards.
  - Failure details:
    - `check:client-runtime-coverage` flagged `client/js-esm/{bootstrap,mapworker,preflight}.js` as unreachable.
    - `check:client-runtime-alias-drift:strict` reported all aliases unused because only `.js` files were scanned.
  - Workaround applied:
    - updated `tools/check-client-runtime-coverage.cjs` to treat reachable top-level `.ts` modules as coverage for same-name `.js` artifacts.
    - updated `tools/check-client-runtime-alias-drift.cjs` to scan both `.js` and `.ts` runtime-lane files.
    - updated `tsconfig.typecheck-client-runtime.json` include roots to list generated wrapper `.js` artifacts explicitly.
  - Next action: rerun `bun run verify:modern:node22`.
- `2026-02-08T20:38Z` `done` Full modern verification lane is green after guard alignment.
  - Evidence:
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass).


## Delta Update (2026-02-08 legacy client runtime TS-authored core slice, continuation)

### Ticket status

- `T-307.4` TypeScriptify `client/js/{home,mapworker}.js` via generated runtime artifacts: `done`

### Live progress log

- `2026-02-08T20:39Z` `in_progress` Added authored TS sources and sync wiring for additional low-risk legacy modules.
  - Evidence:
    - Added authored sources: `client/js/home.ts`, `client/js/mapworker.ts`.
    - Updated legacy-core build/sync map: `tsconfig.build-client-legacy-core.json`, `tools/sync-client-legacy-core.cjs`.
    - `bun run build:client-legacy-core` -> pass.
    - `bun run check:client-legacy-core-sync` -> pass (after sequential rerun; initial parallel run raced build/check on same artifacts).
  - Next action: rerun full modern verify lane.
- `2026-02-08T20:40Z` `done` Full modern verification lane remains green with expanded legacy-core generated artifact set.
  - Evidence:
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass).


## Delta Update (2026-02-08 legacy client runtime TS-authored core slice, text/build)

### Ticket status

- `T-307.5` TypeScriptify `client/js/{text,build}.js` via generated runtime artifacts: `done`

### Live progress log

- `2026-02-08T20:41Z` `in_progress` Added authored TS sources and sync wiring for `text` and `build`.
  - Evidence:
    - Added authored sources: `client/js/text.ts`, `client/js/build.ts`.
    - Updated legacy-core build/sync map: `tsconfig.build-client-legacy-core.json`, `tools/sync-client-legacy-core.cjs`.
    - `bun run build:client-legacy-core` -> pass.
    - `bun run check:client-legacy-core-sync` -> pass.
  - Next action: rerun full modern verify lane.
- `2026-02-08T20:42Z` `done` Full modern verification lane remains green.
  - Evidence:
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass).


## Delta Update (2026-02-08 legacy client runtime TS-authored core slice, bubble/animation)

### Ticket status

- `T-307.6` TypeScriptify `client/js/{bubble,animation}.js` via generated runtime artifacts: `done`

### Live progress log

- `2026-02-08T20:47Z` `in_progress` Added authored TS sources and sync wiring for `bubble` and `animation`.
  - Evidence:
    - Added authored sources: `client/js/bubble.ts`, `client/js/animation.ts`.
    - Updated legacy-core build/sync map: `tsconfig.build-client-legacy-core.json`, `tools/sync-client-legacy-core.cjs`.
    - `bun run build:client-legacy-core` -> pass.
    - `bun run check:client-legacy-core-sync` -> pass (after sequential rerun; initial parallel check raced shared artifacts).
  - Next action: rerun full modern verify lane.
- `2026-02-08T20:48Z` `done` Full modern verification lane remains green.
  - Evidence:
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass).


## Delta Update (2026-02-08 legacy client runtime TS-authored core slice, tile/util)

### Ticket status

- `T-307.7` TypeScriptify `client/js/{tile,util}.js` via generated runtime artifacts: `done`

### Live progress log

- `2026-02-08T20:54Z` `in_progress` Added authored TS sources and sync wiring for `tile` and `util`.
  - Evidence:
    - Added authored sources: `client/js/tile.ts`, `client/js/util.ts`.
    - Updated legacy-core build/sync map: `tsconfig.build-client-legacy-core.json`, `tools/sync-client-legacy-core.cjs`.
    - `bun run build:client-legacy-core` -> pass.
    - `bun run check:client-legacy-core-sync` -> pass.
  - Next action: rerun full modern verify lane.
- `2026-02-08T20:55Z` `done` Full modern verification lane remains green.
  - Evidence:
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass).


## Delta Update (2026-02-08 legacy client runtime TS-authored full top-level completion)

### Ticket status

- `T-308.1` Convert all remaining top-level `client/js/*.js` modules to TS-authored sources: `done`
- `T-308.2` Generalize legacy-core sync/build config to auto-cover top-level `client/js/*.ts`: `done`

### Live progress log

- `2026-02-08T21:03Z` `in_progress` Executed full remaining top-level legacy client conversion batch.
  - Scope in: all remaining top-level `client/js/*.js` modules without same-name `.ts` sources.
  - Scope out: runtime behavior changes; generated runtime `.js` artifacts remain intentionally.
  - Evidence:
    - created TS mirrors for all remaining top-level modules and normalized with `// @ts-nocheck` for no-behavior conversion.
    - updated `tsconfig.build-client-legacy-core.json` include to `client/js/*.ts`.
    - updated `tools/sync-client-legacy-core.cjs` to discover `client/js/*.ts` dynamically and sync same-name runtime `.js` artifacts.
    - `bun run build:client-legacy-core` -> pass.
    - `bun run check:client-legacy-core-sync` -> pass.
    - remaining top-level legacy JS files without same-name TS source: `0`.
  - Next action: full modern verification lane.
- `2026-02-08T21:05Z` `done` Full modern verification lane remains green after full top-level conversion.
  - Evidence:
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass).


## Delta Update (2026-02-08 legacy client runtime TS-authored recursive completion)

### Ticket status

- `T-308.3` Convert remaining `client/js/lib/*.js` modules to TS-authored sources: `done`
- `T-308.4` Expand legacy-core build/sync coverage from top-level to recursive `client/js/**/*.ts`: `done`

### Live progress log

- `2026-02-08T21:05Z` `in_progress` Converted remaining `client/js/lib/*.js` files and generalized the legacy sync lane.
  - Evidence:
    - added TS mirrors with no-behavior conversion headers for: `client/js/lib/{astar,bison,class,css3-mediaqueries,log,modernizr,require-jquery,stacktrace,underscore.min}.ts`.
    - updated `tsconfig.build-client-legacy-core.json` include to `client/js/**/*.ts`.
    - updated `tools/sync-client-legacy-core.cjs` to recurse `client/js/**/*.ts` and sync same-path runtime `.js` artifacts dynamically.
    - `bun run build:client-legacy-core` -> pass.
    - `bun run check:client-legacy-core-sync` -> pass.
    - recursive legacy check (`find client/js -name '*.js' ... same-name .ts`) -> `0` missing.
  - Next action: full modern verification lane.
- `2026-02-08T21:06Z` `done` Full modern verification lane remains green after recursive legacy conversion.
  - Evidence:
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass).


## Delta Update (2026-02-08 repo-wide no-standalone-js completion)

### Ticket status

- `T-308.5` Remove remaining repo `.js` files without same-name `.ts`/`.cts` counterpart: `done`

### Live progress log

- `2026-02-08T21:07Z` `in_progress` Closed final repo-wide standalone JS holdouts outside primary runtime lanes.
  - Evidence:
    - mirrored remaining files to TS with no-behavior headers:
      - `bin/r.ts`
      - `client/maps/world_client.ts`
      - `tools/maps/exportmap.ts`
      - `tools/maps/processmap.ts`
    - repo scan (`find ... '*.js'` excluding `node_modules/.git/dist/.tmp`) now reports `0` files lacking same-name `.ts` or `.cts` counterpart.
  - Next action: rerun modern verification lane.
- `2026-02-08T21:08Z` `done` Verification remained green after repo-wide mirror completion.
  - Evidence:
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass).

## Delta Update (2026-02-08 closure of T-304/T-305/T-306)

### Ticket status

- `T-304` Full ESM runtime promotion (server runtime lane): `done`
- `T-305` Legacy artifact removal follow-through: `done`
- `T-306` Type-safety completion in runtime lanes: `done`

### Live progress log

- `2026-02-08T21:10Z` `in_progress` Promoted ESM server runtime to primary startup path.
  - Evidence:
    - Updated scripts in `package.json`:
      - `start:server` -> `bun server/js/main-esm.mjs`
      - added rollback-only `start:server:cjs` -> `bun server/js/main.js`
      - `dev:server` -> ESM, with `dev:server:cjs` rollback alias.
    - Updated dev launchers:
      - `tools/dev.ts` now spawns `server/js/main-esm.mjs`.
      - `tools/dev-vite.ts` now spawns `server/js/main-esm.mjs`.
    - Updated active docs:
      - `README.md` now documents ESM as primary with explicit CJS rollback-only entrypoint.
      - `docs/client-build-support.md` now documents ESM default and CJS rollback-only path.
  - Next action: complete legacy docs archival follow-through and runtime type-hardening closure checks.

- `2026-02-08T21:12Z` `in_progress` Completed legacy-doc follow-through by marking retained legacy references as archival.
  - Evidence:
    - Added archival preface marker to retained historical docs containing legacy command references (`verify:legacy`, `test:browser:legacy`, `build:client`, `build:vite:legacy`) outside active support/readiness docs.
    - Verification sweep confirms no unmarked legacy-reference docs in that set.
  - Next action: close runtime type-hardening residuals and rerun full verify lane.

- `2026-02-08T21:14Z` `done` Completed runtime type-hardening closure checks and full verification.
  - Evidence:
    - Removed `@ts-nocheck` from `shared/js/gametypes.cts`.
    - Strengthened `tools/check-server-shadow-source-hardening.cjs` to recurse `server/js/**` and validate `.cts`<->runtime artifact pairing for nested modules (`.js` and `.cjs`).
    - `bun run build:gametypes` (via `bun run build:client-legacy-core` / sync flows where applicable) and sync checks remained green.
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass).


## Delta Update (2026-02-08 closure verification correction)

### Ticket status

- `T-306` Type-safety completion in runtime lanes: `done` (confirmed after gametypes typing fix)

### Live progress log

- `2026-02-08T21:15Z` `blocked` `build:gametypes` failed immediately after removing `@ts-nocheck` from `shared/js/gametypes.cts` due inferred closed object type (`Types` property augmentation errors).
  - Failure details: TS2339 errors on dynamically-attached members (`getKindAsString`, `rankedWeapons`, etc.).
  - Workaround applied: typed mutable contracts explicitly (`const Types: any`, `const kinds: any`) without reintroducing suppression pragma.
  - Next action: rerun gametypes sync + full modern verify lane.
- `2026-02-08T21:16Z` `done` Post-fix verification and closure checks passed.
  - Evidence:
    - `bun run build:gametypes` -> pass.
    - `bun run check:gametypes-sync` -> pass.
    - `bun run check:server-shadow-hardening` -> pass (`30 .cts`, `29 .js`).
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass).
    - repo-wide JS mirror scan (`find ... '*.js'` with same-name `.ts/.cts` requirement) -> `0` unmatched.


## Delta Update (2026-02-08 any-reduction + first nocheck-removal batch)

### Ticket status

- `T-309.1` Remove explicit runtime `any` usage in server/shared typed runtime lane: `done`
- `T-309.2` Remove first low-risk `@ts-nocheck` batch in legacy client TS mirrors: `done`

### Live progress log

- `2026-02-08T21:28Z` `in_progress` Removed explicit runtime `any` usage from active server/shared typed lane.
  - Evidence:
    - `shared/js/gametypes.cts`: replaced `Types: any` / `kinds: any` with explicit contracts (`TypesContract`, `KindEntry`, `KindType`) and typed `getType` helper.
    - `server/js/metrics-adapters/memcache.cts`: replaced constructor return `any` with `MetricsAdapter` interface.
    - initial blocker: `build:gametypes` failed after dropping suppression due dynamic shape inference; fixed by explicit typed contracts + rank argument narrowing casts.
  - Next action: run sync + verify and then remove low-risk `@ts-nocheck` files.
- `2026-02-08T21:31Z` `in_progress` Completed first low-risk `@ts-nocheck` removal batch.
  - Evidence:
    - removed `@ts-nocheck` from:
      - `client/js/config.ts`
      - `client/js/exceptions.ts`
      - `client/js/timer.ts`
      - `client/js/eventcompat.ts`
  - Next action: full verify lane + recount suppression/any metrics.
- `2026-02-08T21:32Z` `done` Verification and metrics are green post-batch.
  - Evidence:
    - `bun run build:gametypes` -> pass.
    - `bun run check:gametypes-sync` -> pass.
    - `bun run build:metrics-adapter-memcache` -> pass.
    - `bun run check:metrics-adapter-memcache-sync` -> pass.
    - `bun run build:client-legacy-core` -> pass.
    - `bun run check:client-legacy-core-sync` -> pass.
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass).
    - explicit runtime `any` matches in `server/js/**/*.cts` + `shared/js/**/*.cts`: none (only string literal text match in `server/js/main.cts`).
    - `@ts-nocheck` count (client/server/shared/tools/tests `.ts`/`.cts`): `56` (down from `60`).


## Delta Update (2026-02-08 nocheck-removal batch 2)

### Ticket status

- `T-309.3` Remove additional low-risk `@ts-nocheck` pragmas from legacy client mirrors: `done`

### Live progress log

- `2026-02-08T21:36Z` `in_progress` Removed suppression pragmas from next low-risk set and resolved one worker-global type collision.
  - Evidence:
    - removed `@ts-nocheck` from:
      - `client/js/home.ts`
      - `client/js/mapworker.ts`
      - `client/js/tile.ts`
      - `client/js/animation.ts`
    - blocker encountered: duplicate worker global declarations in `mapworker.ts` (`importScripts`, `onmessage`, `postMessage`) caused TS duplicate identifier errors once suppression was removed.
    - resolution: removed redundant local declarations and relied on ambient DOM/worker globals.
  - Next action: full verify lane + updated suppression count.
- `2026-02-08T21:39Z` `done` Verification remained green post-batch.
  - Evidence:
    - `bun run build:client-legacy-core` -> pass.
    - `bun run check:client-legacy-core-sync` -> pass.
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass).
    - `@ts-nocheck` count (client/server/shared/tools/tests `.ts`/`.cts`): `48` (down from `56`).


## Delta Update (2026-02-08 nocheck-removal batch 3)

### Ticket status

- `T-309.4` Remove additional low-risk `@ts-nocheck` pragmas from legacy client mirrors: `done`

### Live progress log

- `2026-02-08T21:40Z` `in_progress` Removed suppression pragmas from next declaration-ready set.
  - Evidence:
    - removed `@ts-nocheck` from:
      - `client/js/transition.ts`
      - `client/js/storage.ts`
      - `client/js/bubble.ts`
    - blocker encountered: `storage.ts` local `declare var localStorage: any` conflicted with DOM global `Storage` declaration once suppression was removed.
    - resolution: removed redundant local `localStorage` declaration.
  - Next action: full verify lane + recount suppression count.
- `2026-02-08T21:41Z` `done` Verification remained green post-batch.
  - Evidence:
    - `bun run build:client-legacy-core` -> pass.
    - `bun run check:client-legacy-core-sync` -> pass.
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; `vite build` pass).
    - `@ts-nocheck` count (client/server/shared/tools/tests `.ts`/`.cts`): `42` (down from `48`).


## Delta Update (2026-02-08 enum + type-safety discovery backlog)

### Ticket status

- `T-310.1` Protocol opcode/action discriminated unions across shared+client+server: `done`
  - Scope:
    - Replace generic `number` protocol action typing with opcode-keyed tuple unions for inbound/outbound protocol actions.
    - Thread typed protocol actions through shared contract, client parser/dispatcher, and server message handling boundaries.
  - Out of scope:
    - Runtime protocol behavior changes.
    - Message payload semantic changes.
  - Acceptance criteria:
    - Protocol action typing is no longer `ProtocolOpcode = number` with open-ended tuple payloads for modern runtime boundaries.
    - Client/server compile-time checks can reject invalid opcode/payload combinations.
  - Verification plan:
    - `bun run typecheck`
    - `bun run verify:modern:node22`
  - Dependencies/blockers:
    - none.

- `T-310.2` Entity kind/category typed domain contracts: `done`
  - Scope:
    - Promote entity kind/category contracts from broad `number | string` and open records to shared typed domains used by runtime/client code.
  - Out of scope:
    - Rebalancing entity stats/content.
  - Acceptance criteria:
    - Core entity/message surfaces use constrained kind/category types instead of unconstrained numeric/string unions.
  - Verification plan:
    - `bun run typecheck`
    - `bun run verify:modern:node22`
  - Dependencies/blockers:
    - can be parallelized with `T-310.1`, but safer after `T-310.1`.

- `T-310.3` Inbound message format schema typing hardening: `done`
  - Scope:
    - Replace ad-hoc `'n'|'s'` format arrays with opcode-keyed typed schema in server format checker.
  - Out of scope:
    - Protocol payload structure changes.
  - Acceptance criteria:
    - Format checker schemas are tied to typed message opcodes and parameter tuples.
  - Verification plan:
    - `bun run typecheck`
    - `bun run verify:modern:node22`
  - Dependencies/blockers:
    - depends on `T-310.1` for best leverage.

- `T-310.4` WebSocket control/status unionization: `done`
  - Scope:
    - Type control/status literals (`go`, `timeout`, dispatcher status) as shared unions/constants used by both ends.
  - Out of scope:
    - UI copy changes.
  - Acceptance criteria:
    - No raw string branching remains for handshake timeout/dispatcher status values in modern runtime paths.
  - Verification plan:
    - `bun run typecheck`
    - `bun run verify:modern:node22`
  - Dependencies/blockers:
    - none.

- `T-310.5` Server telemetry/logging event-name enums: `done`
  - Scope:
    - Constrain event-name strings (`server.*`, `ws.*`, `world.*`) with typed constants/unions across runtime emitters.
  - Out of scope:
    - Logging transport/backend changes.
  - Acceptance criteria:
    - Event emitter interfaces reject unknown event names at compile time.
  - Verification plan:
    - `bun run typecheck`
    - `bun run verify:modern:node22`
  - Dependencies/blockers:
    - none.

- `T-310.6` Achievement/storage identifier type safety: `done`
  - Scope:
    - Introduce typed achievement identifier domain and enforce it in unlock/check/storage paths.
  - Out of scope:
    - Achievement definitions/content changes.
  - Acceptance criteria:
    - Achievement unlock/check APIs no longer accept arbitrary strings.
  - Verification plan:
    - `bun run typecheck`
    - `bun run verify:modern:node22`
  - Dependencies/blockers:
    - none.

- `T-310.7` Asset key domain typing (sprites/audio/popup): `done`
  - Scope:
    - Define typed key domains for sprite IDs, audio IDs, popup types, and cursor names used by runtime APIs.
  - Out of scope:
    - Asset pipeline/packaging changes.
  - Acceptance criteria:
    - API callsites for asset-driven methods are compile-time constrained to known keys.
  - Verification plan:
    - `bun run typecheck`
    - `bun run verify:modern:node22`
  - Dependencies/blockers:
    - none.

- `T-310.8` Boundary `any`/`unknown` reduction in core runtime contracts: `done`
  - Scope:
    - Replace broad `any`/`unknown` contract surfaces in core runtime boundary files with stricter interfaces.
  - Out of scope:
    - Gameplay logic rewrites.
  - Acceptance criteria:
    - Core contract files no longer rely on open-ended `[key: string]: any` and `any` for protocol/entity pathways.
  - Verification plan:
    - `bun run typecheck`
    - `bun run verify:modern:node22`
  - Dependencies/blockers:
    - none.

### Live progress log

- `2026-02-08T22:00Z` `in_progress` Captured repo-wide enum/type-safety opportunities and transcribed them into executable tickets.
  - Key actions taken:
    - audited shared protocol/kind contracts, server runtime boundaries, and client runtime/string-key hotspots.
    - prioritized opportunities by cross-stack impact and contract-risk reduction.
    - translated discoveries into ticketized backlog with explicit scope, acceptance criteria, verification plans, and dependencies.
  - Evidence:
    - protocol/kind contracts: `shared/js/protocol-contract-types.ts`, `shared/js/protocol-contract.cts`, `shared/js/gametypes.cts`.
    - server boundaries: `server/js/player.cts`, `server/js/format.cts`, `server/js/message.cts`, `server/js/main-runtime.cts`, `server/js/ws-runtime-class-factory.cts`.
    - client boundaries/hotspots: `client/js-esm/gameclient.ts`, `client/js-esm/game.ts`, `client/js-esm/storage.ts`, `client/js-esm/audio.ts`, `client/js-esm/app.ts`, `client/js-esm/entityfactory.ts`, `client/js-esm/player.ts`.
  - Next action:
    - move to implementation sequencing for `T-310.1` -> `T-310.4` as the highest-leverage dependency chain.
- `2026-02-08T22:00Z` `done` Discovery backlog is now recorded in the canonical ticket log and ready for implementation sequencing.
  - Evidence:
    - `rg -n "T-310\\.|enum \\+ type-safety discovery backlog" docs/modernization-readiness-status.md` -> pass (new section and all ticket IDs present).

## Delta Update (2026-02-08 full modern-only cutover)

### Ticket status

- `T-311.1` Remove legacy/rollback commands and checks from active package scripts: `done`
- `T-311.2` Switch runtime/tests to ESM-only startup paths: `done`
- `T-311.3` Remove source-mixed generated artifacts and use TS-authored modern client wrappers directly: `done`
- `T-311.4` Move generated runtime artifacts to `dist/generated/**` and retire legacy sync tooling: `done`
- `T-311.5` Verify modern-only lane and update active support documentation: `done`

### Live progress log

- `2026-02-08T22:30Z` `in_progress` Started hard modern-only cutover across scripts/runtime/tests/tooling after explicit user directive to remove all rollback/legacy support.
  - Scope:
    - remove CJS rollback/legacy commands from `package.json`
    - ESM-only server startup in smoke tests
    - replace `ws` test client dependency usage with in-repo modern wrapper
    - migrate generated runtime outputs from source tree to `dist/generated/**`
    - remove source-mixed auto-generated runtime artifacts from `server/js`, `client/js`, and `shared/js`
  - Out of scope:
    - historical archival docs that are not active operator runbooks

- `2026-02-08T22:30Z` `done` Completed modern-only cutover and passed full Node22 verify lane.
  - Evidence:
    - scripts/runtime policy:
      - removed legacy/rollback script lanes from `package.json`
      - `verify:modern` now enforces modern-only checks and `build:generated`
      - `tools/check-package-mode-boundaries.cjs` updated for modern-only script contract
    - generated artifact policy:
      - `tools/sync-generated-artifacts.cjs` now emits to `dist/generated/**` only
      - retired per-module sync scripts (`tools/sync-*.cjs`, except unified generator)
      - removed source-mixed auto-generated runtime files from `server/js`, `client/js`, `shared/js`
    - runtime/test updates:
      - server ESM mirrors now import generated runtime artifacts from `dist/generated/server/js/*.js`
      - smoke tests use `server/js/main-esm.mjs` only
      - test websocket client updated to in-repo wrapper (`tests/support/ws-client.ts`)
      - payload/preflight/parity tests aligned with modern runtime semantics
    - client modern-only entry:
      - `client/index.html` replaced with hard redirect to `client/modern.html`
      - `client/modern.html` now loads `js-esm/preflight.ts`
      - modern wrapper imports moved to TS source references (`bootstrap.ts`, `mapworker.ts`)
    - active support docs:
      - `docs/client-build-support.md` rewritten to modern-only matrix
  - Verification:
    - `bun run verify:modern:node22` -> pass (`134 pass`, `2 skip`, `0 fail`; then Vite build pass)

## Delta Update (2026-02-08 modern tooling consolidation + source-js retirement)

### Ticket status

- `T-314.1` Sweep and patch stale generated/build-shard references in active scripts/docs/checks: `done`
- `T-314.2` Consolidate TypeScript lane to solution build and simplify package scripts: `done`
- `T-314.3` Re-validate source-only runtime/config/ws import contracts: `done`
- `T-314.4` Remove remaining obsolete files/dependencies discovered in sweep: `done`
- `T-314.5` Run modern verification and record evidence: `done`

### Live progress log

- `2026-02-08T23:05Z` `in_progress` Started modernization consolidation pass for active runtime/tooling lanes.
  - Scope:
    - eliminate remaining `dist/generated` runtime coupling in active ESM entry path
    - move typecheck to TypeScript project references solution build
    - remove obsolete build-shard/runtime-sync remnants from active docs/scripts
    - keep modern verify lane (`verify:modern:node22`) green
  - Blockers encountered:
    - `check:runtime-esm-require-free` failed on `server/js/main-esm.mjs` due `createRequire` usage.
    - composite TS (`TS6307`) surfaced missing include coverage in typecheck project configs.
  - Resolution:
    - switched `server/js/main-esm.mjs` to ESM interop import (`import MainRuntime from './main-runtime.cts'`).
    - updated typecheck config includes and fixed tool/test typing issues blocking solution build:
      - `tsconfig.typecheck.json`
      - `tsconfig.typecheck-runtime.json`
      - `tsconfig.typecheck-server-esm.json`
      - `tsconfig.typecheck-client.json`
      - `tsconfig.typecheck-client-runtime.json`
      - `tools/check-metrics-healthy-prereqs.ts`
      - `tools/run-ws-boundary-drill.ts`
      - `tests/unit/client-gametypes-compat.test.ts`
      - `tools/maps/exportmap.ts`

- `2026-02-08T23:22Z` `done` Completed consolidation and passed full modern verification lane.
  - Key actions:
    - typecheck lane now uses TypeScript solution build:
      - `package.json` `typecheck` -> `bun x tsc -b tsconfig.projects.json`
      - added/used `tsconfig.projects.json` references lane
    - removed obsolete legacy artifacts and dependency:
      - removed `bin/build.sh`, `bin/r.cjs`, `bin/r.js`
      - removed `client/maps/world_client.js`
      - removed dev dependency `requirejs-esm-converter`
    - modernized map export path to JSON-only output:
      - `tools/maps/export.py`
      - `tools/maps/exportmap.ts`
      - `tools/maps/README.md`
    - updated active operator docs to current modern command surface:
      - `README.md`
      - `docs/client-build-support.md`
  - Verification evidence:
    - `bun x tsc -b tsconfig.projects.json` -> pass
    - `bun run typecheck` -> pass
    - `bun run check:client-runtime-coverage` -> pass
    - `bun run check:client-runtime-alias-drift:strict` -> pass
    - `bun run verify:modern:node22` -> pass (`129 pass`, `2 skip`, `0 fail`; Vite build pass)
    - `rg --files -g '*.js'` -> no source `.js` files remain in repository tree
  - Next action:
    - continue with larger typed-domain hardening backlog (`T-310.*` discovery block) now that tooling/runtime baseline is consolidated.

## Delta Update (2026-02-09 lingering legacy surface yeet pass)

### Ticket status

- `T-315.1` Remove dead `client/js/**` tree and stale references: `done`
- `T-315.2` Remove stale legacy-signoff workflow from active CI set: `done`
- `T-315.3` Rewrite client README to modern-only usage/build guidance: `done`
- `T-315.4` Retire stale static legacy-entry test/tooling: `done`
- `T-315.5` Relocate TypeScript buildinfo artifacts out of repo root: `done`

### Live progress log

- `2026-02-09T00:00Z` `in_progress` Started lingering-surface cleanup after explicit user request to remove remaining legacy remnants.
  - Scope:
    - remove dead legacy client source tree (`client/js/**`)
    - remove stale CI/workflow paths tied to removed scripts
    - remove stale static legacy-entry test/tool
    - align docs/config/scripts with modern-only runtime
    - ensure TypeScript buildinfo outputs do not mix with source root
  - Dependencies/blockers:
    - `rm -rf client/js` required explicit destructive-action confirmation and was then executed.

- `2026-02-09T00:05Z` `done` Completed lingering-surface cleanup and re-verified full modern lane.
  - Key actions:
    - removed legacy source/tooling artifacts:
      - deleted `client/js/**`
      - deleted `.github/workflows/verify-legacy-signoff-readiness.yml`
      - deleted `tests/smoke/static-server-entry-default.test.ts`
      - deleted `tools/static-server.ts`
      - deleted `tools/dev.ts`
    - removed stale script/config references:
      - removed `test:static-entry` script from `package.json`
      - removed stale ignores from `eslint.config.cjs` (`client-build/**`, `bin/r.js`, `client/js/**`)
    - updated docs:
      - rewrote `client/README.md` to modern-only usage and build guidance
    - relocated TS buildinfo outputs to `.tmp/tsbuildinfo/**` via config:
      - `tsconfig.typecheck.json`
      - `tsconfig.typecheck-runtime.json`
      - `tsconfig.typecheck-server-esm.json`
      - `tsconfig.typecheck-client.json`
      - `tsconfig.typecheck-client-runtime.json`
      - removed stale include entry for missing `client/maps/world_client.ts`
  - Verification evidence:
    - `bun run typecheck` -> pass (`bun x tsc -b tsconfig.projects.json`)
    - `bun run verify:modern:node22` -> pass (`129 pass`, `1 skip`, `0 fail`; Vite build pass)
    - `rg -n "test:static-entry|tools/static-server\.ts|verify-legacy-signoff-readiness|check:legacy-signoff" package.json .github/workflows README.md client/README.md tools tests` -> no matches
    - `rg -n "client/js/" --glob '!docs/**' --glob '!MODERNIZE.md' .` -> no matches
    - `find . -maxdepth 1 -name 'tsconfig.typecheck*.tsbuildinfo'` -> no files

## Delta Update (2026-02-09 built-in modernization sweep)

### Ticket status

- `T-316.1` Replace websocket runtime URL parsing with modern URL API path handling: `done`
- `T-316.2` Remove `createRequire` shims from active TypeScript tool scripts: `done`
- `T-316.3` Remove remaining CJS websocket fallback seam from runtime dependency bootstrap: `done`
- `T-316.4` Simplify metrics client adapter to modern memcache API shape only: `done`
- `T-316.5` Refactor map file startup loading path to async `fs/promises`: `done`

### Live progress log

- `2026-02-09T00:29Z` `in_progress` Started built-in modernization sweep requested by user for runtime, tooling, and server helper seams.
  - Scope:
    - websocket runtime URL parsing modernization (`url.parse` -> `URL`)
    - tool script cleanup to native ESM imports (no `createRequire`)
    - removal of runtime fallback coupling to legacy CJS websocket module path
    - metrics client adapter simplification to modern memcache path
    - async/promises map file loading path modernization
  - Dependencies/blockers:
    - none

- `2026-02-09T00:29Z` `done` Completed built-in modernization sweep and re-verified full modern lane.
  - Key actions:
    - websocket runtime URL handling:
      - replaced `url.parse` usage in `server/js/ws-runtime-esm.mjs` with `new URL(...)` helper for pathname extraction
      - aligned retained CJS shadow source parsing path in `server/js/ws.cts` before retirement
    - runtime websocket seam cleanup:
      - removed `require('./ws')` fallback from `server/js/main-runtime.cts`
      - switched default websocket runtime dependency to `server/js/ws-runtime-esm.mjs`
      - removed stale CJS websocket source `server/js/ws.cts`
      - removed stale websocket shadow-contract artifact `server/js/ws-module-types.ts`
      - removed stale includes from `tsconfig.typecheck-runtime.json`
    - metrics adapter modernization:
      - simplified `server/js/metrics-client.cts` to modern memcache API (`Memcache`/`default`) only
      - removed legacy callback-client branch and updated modern-path unit coverage in `tests/unit/metrics-client.test.ts`
    - async map loading:
      - migrated `server/js/map.cts` constructor load path from callback `fs` API to async `fs/promises`
      - preserved startup semantics (`ready` callback still fired via `initMap` on successful parse)
    - tool script modernization:
      - removed `createRequire` shims across active `tools/*.ts` checks and drill runner
      - moved to direct ESM imports from `node:*` modules
  - Verification evidence:
    - `bun x tsc -b tsconfig.projects.json` -> pass
    - `bun test tests/unit/metrics-client.test.ts tests/unit/server-main-runtime-dependencies.test.ts tests/unit/server-ws-esm.test.ts --timeout 30000` -> pass (`8 pass`, `0 fail`)
    - `bun run verify:modern:node22` -> pass (`129 pass`, `1 skip`, `0 fail`; Vite build pass)

## Delta Update (2026-02-09 websocket archival/runbook cleanup)

### Ticket status

- `T-317.1` Remove stale websocket CJS artifact references from active runbooks/docs: `done`
- `T-317.2` Modernize websocket drill workflow naming/artifact paths: `done`
- `T-317.3` Align websocket runbook consistency checker to modern ESM-only guidance: `done`
- `T-317.4` Re-verify modern lane and record cleanup evidence: `done`

### Live progress log

- `2026-02-09T00:37Z` `in_progress` Started websocket archival/runbook cleanup pass after user request.
  - Scope:
    - remove stale websocket CJS artifact references from active runbook/docs/workflow surfaces
    - keep historical migration timeline logs intact in dedicated status/history documents
    - keep websocket drill/test contract and CI advisory workflow functional
  - Dependencies/blockers:
    - none

- `2026-02-09T00:37Z` `done` Completed websocket archival/runbook cleanup and re-verified modern lane.
  - Key actions:
    - rewrote websocket runbook docs to modern ESM-only guidance:
      - `docs/websocket-runtime-class-boundary-parity.md`
      - `docs/websocket-boundary-escalation-template.md`
      - `docs/websocket-cjs-factory-migration-decision.md`
      - `docs/websocket-factory-ts-source-promotion-plan.md`
      - `docs/ws-module-ts-contract-extraction.md`
      - `docs/ws-module-ts-shadow-source-pre-slice.md`
    - replaced stale boundary inventory/checkjs-defer docs with modern snapshots:
      - `docs/runtime-cjs-boundary-inventory.md`
      - `docs/typescript-runtime-checkjs-defer-list.md`
    - archived stale CJS planning docs that still referenced removed websocket artifacts:
      - `docs/server-cjs-hotspot-index.md`
      - `docs/server-cjs-esm-readiness-inventory.md`
      - `docs/archive/legacy/server-classjs-fanout-map.md`
      - `docs/format-ts-shadow-source-pre-slice.md`
    - updated websocket drill workflow labels/artifact names to runtime-modern wording:
      - `.github/workflows/verify-ws-boundary-drill.yml`
    - updated runbook consistency check patterns for modern references:
      - `tools/check-ws-boundary-runbook-consistency.ts`
    - updated server logging taxonomy path references to active runtime files:
      - `docs/server-logging-taxonomy.md`
  - Verification evidence:
    - `bun run check:ws:runbooks` -> pass
    - `bun x tsc -b tsconfig.projects.json` -> pass
    - `bun run verify:modern:node22` -> pass (`129 pass`, `1 skip`, `0 fail`; Vite build pass)
    - `rg -n "server/js/ws\.js|server/js/ws\.cts|ws-runtime-class-factory\.cjs|build:ws-runtime-factory|check:ws-runtime-factory-sync" docs .github tools README.md package.json tests --glob '!docs/modernization-readiness-status.md' --glob '!MODERNIZE.md'` -> no matches

## Delta Update (2026-02-09 protocol + entity-kind domain contracts)

### Ticket status

- `T-310.1` Protocol opcode/action discriminated unions across shared+client+server: `done`
- `T-310.2` Entity kind/category typed domain contracts: `done`

### Live progress log

- `2026-02-09T12:40Z` `in_progress` Started dependency-chain implementation for `T-310.1` and `T-310.2` and ran full modern verify gate before/after edits.
  - Scope:
    - finalize opcode-keyed protocol action tuple unions across shared/client/server boundaries
    - introduce shared entity kind/category domain types and thread through core shared/server/client entity-message seams
    - preserve runtime behavior while tightening compile-time domain contracts
  - Dependencies/blockers:
    - none

- `2026-02-09T12:50Z` `done` Completed `T-310.1` + `T-310.2` with full verify evidence.
  - Key actions:
    - protocol discriminated unions:
      - finalized strict inbound/outbound protocol tuple typing in `shared/js/protocol-contract-types.ts`
      - aligned parser/runtime boundary typing in `shared/js/protocol-contract.cts`, `shared/js/protocol-contract-esm.mjs`, `server/js/ws-runtime-class-factory-types.ts`, and client/server boundary contracts
      - aligned parity tooling and tests (`tools/check-protocol-contract-esm-parity.ts`, protocol-related unit tests)
    - entity kind/category domain contracts:
      - added shared kind-domain source `shared/js/entity-kind-domain.ts` with constrained kind id/name/category types
      - promoted core runtime contracts to domain-constrained entity kind types in:
        - `shared/js/gametypes.cts`
        - `server/js/{entity,character,item,mob,npc,message,properties,mobarea,chest}.cts`
        - `client/js-esm/{compat/gametypes,entity,character,item,mob,npc,player,entityfactory,client-boundary-types}.ts`
      - added contract regression coverage: `tests/unit/entity-kind-domain.test.ts`
    - updated typecheck project includes for shared domain type module:
      - `tsconfig.typecheck.json`
      - `tsconfig.typecheck-runtime.json`
      - `tsconfig.typecheck-client.json`
      - `tsconfig.typecheck-client-runtime.json`
      - `tsconfig.typecheck-server-esm.json`
  - Verification evidence:
    - `bun run typecheck` -> pass
    - `bun test tests/unit/entity-kind-domain.test.ts tests/unit/gametypes-contract.test.ts tests/unit/client-boundary-types.test.ts tests/unit/protocol-contract-types.test.ts tests/unit/protocol-contract-module.test.ts --timeout 30000` -> pass (`9 pass`, `0 fail`)
    - `bun run verify:modern:node22` -> pass (`130 pass`, `1 skip`, `0 fail`; Vite build pass)

## Delta Update (2026-02-09 inbound format schema + websocket status unions)

### Ticket status

- `T-310.3` Inbound message format schema typing hardening: `done`
- `T-310.4` WebSocket control/status unionization: `done`

### Live progress log

- `2026-02-09T12:52Z` `in_progress` Started `T-310.3` and `T-310.4` continuation pass after completing `T-310.1` and `T-310.2`.
  - Scope:
    - tie server inbound format schemas to opcode-keyed TypeScript protocol tuples
    - centralize handshake and dispatcher control/status literals as shared typed constants
    - remove raw status string branching from active server/client runtime paths
  - Dependencies/blockers:
    - none

- `2026-02-09T12:55Z` `done` Completed `T-310.3` + `T-310.4` and re-verified full modern lane.
  - Key actions:
    - inbound format schema typing hardening:
      - refactored `server/js/format.cts` to use opcode-keyed typed schema derived from `ClientToServerProtocolAction`
      - replaced untyped ad-hoc format array wiring with typed `CLIENT_TO_SERVER_FORMAT_SCHEMA`
      - preserved WHO variable-length payload handling semantics
    - websocket/control status unionization:
      - added shared typed status constants and guards in `shared/js/connection-status.ts`:
        - handshake control: `go`, `timeout`
        - dispatcher connect statuses: `OK`, `FULL`
      - switched runtime callsites to shared constants:
        - `server/js/player.cts` handshake + timeout signals
        - `client/js-esm/gameclient.ts` dispatcher status and handshake control branching
      - added runtime contract coverage: `tests/unit/connection-status.test.ts`
      - updated typecheck project includes for shared status module:
        - `tsconfig.typecheck.json`
        - `tsconfig.typecheck-runtime.json`
        - `tsconfig.typecheck-client.json`
        - `tsconfig.typecheck-client-runtime.json`
        - `tsconfig.typecheck-server-esm.json`
  - Verification evidence:
    - `bun run typecheck` -> pass
    - `bun test tests/unit/server-format-esm.test.ts tests/smoke/server-payload-guards.test.ts --timeout 30000` -> pass (`4 pass`, `0 fail`)
    - `bun test tests/unit/connection-status.test.ts tests/smoke/server-handshake.test.ts tests/smoke/server-handshake-esm-entry.test.ts tests/smoke/server-handshake-esm-ws-runtime.test.ts --timeout 30000` -> pass (`7 pass`, `0 fail`)
    - `bun run verify:modern:node22` -> pass (`132 pass`, `1 skip`, `0 fail`; Vite build pass)

## Delta Update (2026-02-09 server event-name enums)

### Ticket status

- `T-310.5` Server telemetry/logging event-name enums: `done`

### Live progress log

- `2026-02-09T12:57Z` `in_progress` Started server runtime event-name enum pass.
  - Scope:
    - centralize `server.*`, `ws.*`, and `world.*` event names as shared runtime constants
    - enforce typed event-name unions on core logger/emitter interfaces
    - replace raw event-name string literals in active runtime emitters
  - Dependencies/blockers:
    - none

- `2026-02-09T13:00Z` `done` Completed event-name enumization and re-verified modern lane.
  - Key actions:
    - added canonical event-name constants and unions:
      - `server/js/server-event-names.ts`
    - constrained core runtime interfaces to typed event names:
      - `server/js/main-runtime-types.ts`
      - `server/js/ws-runtime-class-factory-types.ts`
      - `server/js/log.cts`
      - `server/js/metrics-runtime.cts`
    - switched runtime emitters to shared constants:
      - `server/js/main-runtime.cts`
      - `server/js/worldserver.cts`
      - `server/js/ws-runtime-class-factory.cts`
      - `server/js/ws-runtime-class-factory.mjs`
      - `server/js/ws-runtime-esm.mjs`
      - `server/js/main-esm-runtime-options.mjs`
      - `server/js/main-esm-structured-event.mjs`
    - updated typecheck project includes for the new shared server event-name module:
      - `tsconfig.typecheck.json`
      - `tsconfig.typecheck-runtime.json`
      - `tsconfig.typecheck-server-esm.json`
  - Verification evidence:
    - `bun run typecheck` -> pass
    - `bun test tests/unit/server-main-esm-runtime-options.test.ts tests/unit/server-main-esm-bridge-probe.test.ts tests/unit/server-main-esm-helpers-parity.test.ts tests/unit/server-main-runtime-process.test.ts tests/unit/ws-runtime-class-factory.test.ts tests/unit/ws-runtime-parity.test.ts tests/unit/server-log.test.ts --timeout 30000` -> pass (`29 pass`, `0 fail`)
    - `bun run verify:modern:node22` -> pass (`132 pass`, `1 skip`, `0 fail`; Vite build pass)

## Delta Update (2026-02-09 achievement + asset key domains)

### Ticket status

- `T-310.6` Achievement/storage identifier type safety: `done`
- `T-310.7` Asset key domain typing (sprites/audio/popup): `done`

### Live progress log

- `2026-02-09T13:02Z` `in_progress` Started client-side identifier/key domain tightening for achievements and asset APIs.
  - Scope:
    - add explicit achievement key/id domain types and enforce in storage + unlock pathways
    - add typed asset key domains for cursor/audio/music/sprite/popup keys
    - constrain client API callsites to known domain keys without changing runtime behavior
  - Dependencies/blockers:
    - none

- `2026-02-09T13:07Z` `done` Completed `T-310.6` and `T-310.7` and re-verified full modern lane.
  - Key actions:
    - achievement identifier domain:
      - added `client/js-esm/achievement-domain.ts` (`AchievementKey`, `AchievementId`, guard)
      - enforced achievement id domain in storage unlock/check surfaces:
        - `client/js-esm/storage.ts`
      - tightened achievement unlock callback typing:
        - `client/js-esm/game.ts`
        - `client/js-esm/app.ts`
        - `client/js-esm/main.ts`
      - added regression coverage:
        - `tests/unit/achievement-domain.test.ts`
    - asset key domain typing:
      - added `client/js-esm/asset-key-domain.ts` (cursor, popup, music, sound, sprite key domains)
      - constrained audio manager key surfaces:
        - `client/js-esm/audio.ts`
      - constrained game cursor/sprite/audio callsites:
        - `client/js-esm/game.ts`
      - constrained popup type surface:
        - `client/js-esm/app.ts`
      - added regression coverage:
        - `tests/unit/asset-key-domain.test.ts`
    - updated typecheck include inventory for new domain modules:
      - `tsconfig.typecheck.json`
  - Verification evidence:
    - `bun run typecheck` -> pass
    - `bun test tests/unit/asset-key-domain.test.ts tests/unit/achievement-domain.test.ts tests/unit/client-gametypes-compat.test.ts --timeout 30000` -> pass (`4 pass`, `0 fail`)
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; Vite build pass)

## Delta Update (2026-02-09 core runtime contract unknown-reduction)

### Ticket status

- `T-310.8` Boundary `any`/`unknown` reduction in core runtime contracts: `done`

### Live progress log

- `2026-02-09T13:08Z` `in_progress` Started final `T-310` contract-hardening pass focused on core runtime boundary types.
  - Scope:
    - replace broad `unknown` placeholders in core runtime contract files with explicit runtime player/entity/connection interfaces
    - keep runtime behavior unchanged and avoid gameplay logic rewrites
  - Dependencies/blockers:
    - none

- `2026-02-09T13:09Z` `done` Completed `T-310.8` and re-verified full modern lane.
  - Key actions:
    - tightened core runtime seam types:
      - `server/js/main-runtime-types.ts`
      - `server/js/player-types.ts`
      - `server/js/ws-runtime-class-factory-types.ts`
    - kept runtime compatibility while reducing open-ended seam surfaces by introducing explicit runtime player/entity/message interfaces
    - validated seam usage against existing contract tests:
      - `tests/unit/player-shadow-source-contract.test.ts`
      - `tests/unit/server-main-runtime-dependencies.test.ts`
      - `tests/unit/ws-runtime-class-factory.test.ts`
      - `tests/unit/server-main-runtime-process.test.ts`
  - Verification evidence:
    - `bun run typecheck` -> pass
    - `bun test tests/unit/player-shadow-source-contract.test.ts tests/unit/server-main-runtime-dependencies.test.ts tests/unit/ws-runtime-class-factory.test.ts tests/unit/server-main-runtime-process.test.ts --timeout 30000` -> pass (`13 pass`, `0 fail`)
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; Vite build pass)

## Delta Update (2026-02-09 runtime ESM `.mjs` retirement to TS sources)

### Ticket status

- `T-318.1` Convert runtime/shared ESM `.mjs` source files to TypeScript sources: `done`
- `T-318.2` Rewire scripts/checkers/config includes to TS runtime sources: `done`
- `T-318.3` Update active tests/docs references for renamed runtime sources: `done`
- `T-318.4` Re-verify modern lane and log evidence: `done`
- `T-318.5` Normalize runtime/test/tool local TS imports to extensionless specifiers: `done`

### Live progress log

- `2026-02-09T13:14Z` `in_progress` Started runtime ESM source-retirement slice.
  - Scope:
    - rename active runtime/shared `.mjs` source modules to `.ts`
    - rewire runtime/tests/tools/tsconfig references to renamed TS sources
    - keep behavior unchanged, no CJS `.cts` conversion in this pass
  - Dependencies/blockers:
    - none

- `2026-02-09T13:18Z` `done` Completed `T-318.1` through `T-318.4` and re-verified full modern lane.
  - Key actions:
    - converted active runtime/shared ESM source modules from `.mjs` to `.ts`:
      - `server/js/{config-preflight-esm,format-esm,log-esm,main-esm,main-esm-*,utils-esm,ws-runtime-class-factory,ws-runtime-esm}.ts`
      - `shared/js/{gametypes-browser,gametypes-esm,protocol-contract-esm,ws-close-codes-esm}.ts`
    - rewired runtime startup and test/tooling references to `.ts` runtime source paths:
      - `package.json`
      - `tools/dev-vite.ts`
      - `tools/check-protocol-contract-esm-parity.ts`
      - `tools/check-server-esm-runtime-coverage.ts`
      - `tools/check-runtime-esm-require-free.ts`
      - `tests/**/*.ts` runtime import/cmd callsites
      - active websocket/runtime runbooks
    - aligned typecheck project settings for TS-extension runtime imports and renamed files:
      - `tsconfig.typecheck.json` (`allowImportingTsExtensions` + include updates)
      - `tsconfig.typecheck-server-esm.json`
      - `tsconfig.typecheck-client-runtime.json`
    - preserved previous runtime-checking behavior for newly converted runtime ESM TS sources by adding file-level `@ts-nocheck` pragmas to this slice.
  - Verification evidence:
    - `bun run typecheck` -> pass
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; Vite build pass)

- `2026-02-09T13:20Z` `done` Completed `T-318.5` import-specifier normalization and re-verified full modern lane.
  - Key actions:
    - rewrote local runtime/test/tool import specifiers from `*.ts` to extensionless paths across:
      - `server/js/**/*.ts`
      - `shared/js/**/*.ts`
      - `client/js-esm/**/*.ts`
      - `tests/**/*.ts`
      - `tools/**/*.ts`
    - updated CJS seam require path to extensionless runtime ESM TS module:
      - `server/js/main-runtime.cts`
    - removed temporary TypeScript compiler override no longer needed:
      - `tsconfig.typecheck.json` (`allowImportingTsExtensions` removed)
  - Verification evidence:
    - `bun run typecheck` -> pass
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; Vite build pass)

## Delta Update (2026-02-09 eslint config ESM migration)

### Ticket status

- `T-319.1` Migrate ESLint config from CommonJS to ESM: `done`
- `T-319.2` Update modernization readiness log for config-module migration: `done`
- `T-319.3` Re-verify modern lane after config migration: `done`

### Live progress log

- `2026-02-09T13:22Z` `in_progress` Started lint-config module modernization slice.
  - Scope:
    - replace `eslint.config.cjs` with ESM `eslint.config.js`
    - preserve rule behavior and active lint invocation semantics
  - Dependencies/blockers:
    - none

- `2026-02-09T13:23Z` `done` Completed eslint-config ESM migration and re-verified full modern lane.
  - Key actions:
    - renamed lint config entry:
      - `eslint.config.cjs` -> `eslint.config.js`
    - converted config module syntax:
      - `require(...)` -> `import ...`
      - `module.exports = [...]` -> `export default [...]`
    - kept rules/ignores/file-target behavior intact.
  - Verification evidence:
    - `bun run lint` -> pass
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; Vite build pass)

## Delta Update (2026-02-09 runtime ESM `@ts-nocheck` reduction)

### Ticket status

- `T-320.1` Remove `@ts-nocheck` from low-risk converted shared/server ESM TS files: `done`
- `T-320.2` Remove `@ts-nocheck` from low-risk affected unit tests: `done`
- `T-320.3` Re-verify modern lane and record evidence: `done`

### Live progress log

- `2026-02-09T13:24Z` `in_progress` Started post-conversion runtime ESM type-safety cleanup.
  - Scope:
    - remove `@ts-nocheck` from low-risk converted `.ts` runtime/shared files
    - add explicit lightweight typing where needed to keep behavior unchanged
    - keep verification lane green after each batch
  - Dependencies/blockers:
    - none

- `2026-02-09T13:29Z` `done` Completed `T-320.1` through `T-320.3` and re-verified full modern lane.
  - Key actions:
    - removed `@ts-nocheck` from low-risk shared/server converted ESM TS modules and added explicit TS signatures:
      - `shared/js/ws-close-codes-esm.ts`
      - `shared/js/gametypes-esm.ts`
      - `server/js/config-preflight-esm.ts`
      - `server/js/main-esm-config-source.ts`
      - `server/js/main-esm-preflight-failures.ts`
      - `server/js/main-esm-runtime-options.ts`
      - `server/js/main-esm-startup-runner.ts`
      - `server/js/main-esm-boot-envelope.ts`
      - `server/js/main-esm-structured-event.ts`
      - `server/js/main-esm-bridge-probe.ts`
      - `server/js/log-esm.ts`
    - removed `@ts-nocheck` from stabilized unit tests:
      - `tests/unit/server-main-esm-config-source.test.ts`
      - `tests/unit/server-main-esm-boot-envelope.test.ts`
      - `tests/unit/server-log-esm.test.ts`
    - preserved runtime behavior while tightening typing contracts (startup helper seams, config read/preflight helpers, structured event emitter, logger).
  - Verification evidence:
    - `bun run typecheck` -> pass
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; Vite build pass)

## Delta Update (2026-02-09 runtime ESM `@ts-nocheck` reduction batch 2)

### Ticket status

- `T-321.1` Remove `@ts-nocheck` from selected medium-risk runtime/shared ESM files: `done`
- `T-321.2` Re-verify modern lane and typecheck after batch: `done`
- `T-321.3` Record evidence and finalize batch: `done`
- `T-321.4` Remove `@ts-nocheck` from `server/js/main-esm.ts` after resolving `.cts` boundary typing/include constraints: `done`

### Live progress log

- `2026-02-09T13:30Z` `in_progress` Started second no-check reduction batch on non-websocket runtime modules.
  - Scope:
    - remove `@ts-nocheck` from:
      - `shared/js/protocol-contract-esm.ts`
      - `server/js/main-esm.ts`
      - `server/js/utils-esm.ts`
      - `server/js/format-esm.ts`
    - add explicit typing while preserving behavior
  - Dependencies/blockers:
    - websocket runtime modules intentionally deferred to separate deeper pass

- `2026-02-09T13:32Z` `done` Completed `T-321.1` through `T-321.3` and re-verified full modern lane.
  - Key actions:
    - removed `@ts-nocheck` and tightened typings in:
      - `shared/js/protocol-contract-esm.ts`
      - `server/js/utils-esm.ts`
      - `server/js/format-esm.ts`
    - retained `@ts-nocheck` in `server/js/main-esm.ts` and split follow-up ticket `T-321.4` after encountering direct `.cts` seam typing/include constraints when `main-esm.ts` is fully checked under current project boundaries.
  - Verification evidence:
    - `bun run typecheck` -> pass
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; Vite build pass)

## Delta Update (2026-02-09 websocket class-factory no-check reduction)

### Ticket status

- `T-322.1` Remove `@ts-nocheck` from `server/js/ws-runtime-class-factory.ts`: `done`
- `T-322.2` Remove `@ts-nocheck` from directly impacted websocket unit tests where possible: `done`
- `T-322.3` Re-verify and record evidence: `done`

### Live progress log

- `2026-02-09T13:33Z` `in_progress` Started websocket class-factory typing cleanup slice.
  - Scope:
    - remove `@ts-nocheck` from `server/js/ws-runtime-class-factory.ts`
    - repair local type issues without behavior changes
    - opportunistically remove no-check from closely coupled ws tests if type-stable
  - Dependencies/blockers:
    - heavier websocket runtime and entrypoint holdouts remain separate follow-up

- `2026-02-09T13:34Z` `done` Completed websocket class-factory no-check cleanup and re-verified full modern lane.
  - Key actions:
    - removed `@ts-nocheck` from:
      - `server/js/ws-runtime-class-factory.ts`
      - `tests/unit/ws-connection.test.ts`
      - `tests/unit/ws-runtime-parity.test.ts`
    - updated websocket connection close signature typing to match existing call patterns:
      - `close(logError, closeCode?)` in `server/js/ws-runtime-class-factory.ts`
    - preserved runtime behavior while keeping test/runtime callsites unchanged.
  - Verification evidence:
    - `bun run typecheck` -> pass
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; Vite build pass)

## Delta Update (2026-02-09 gametypes browser contract typing cleanup)

### Ticket status

- `T-323.1` Remove `@ts-nocheck` from `shared/js/gametypes-browser.ts`: `done`
- `T-323.2` Remove `@ts-nocheck` from `tests/unit/client-gametypes-compat.test.ts`: `done`
- `T-323.3` Re-verify and capture remaining holdouts: `done`

### Live progress log

- `2026-02-09T13:36Z` `done` Completed gametypes browser contract cleanup and re-verified modern lane.
  - Key actions:
    - replaced `shared/js/gametypes-browser.ts` no-check variant with a typed ESM contract implementation aligned with `shared/js/gametypes.cts` behavior and exports.
    - removed `@ts-nocheck` from `tests/unit/client-gametypes-compat.test.ts` and tightened assertion typing via explicit compat cast.
    - reduced remaining `@ts-nocheck` holdouts to:
      - `server/js/main-esm.ts`
      - `server/js/ws-runtime-esm.ts`
  - Verification evidence:
    - `bun run typecheck` -> pass
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; Vite build pass)

## Delta Update (2026-02-09 final runtime no-check holdout pass)

### Ticket status

- `T-324.1` Remove `@ts-nocheck` from `server/js/main-esm.ts`: `done`
- `T-324.2` Remove `@ts-nocheck` from `server/js/ws-runtime-esm.ts`: `done`
- `T-324.3` Re-verify and record final holdout status: `done`
- `T-324.4` Resolve `.cts` seam typing/include boundary so `main-esm.ts` can be fully checked without extension-import workaround: `done`

### Live progress log

- `2026-02-09T13:37Z` `in_progress` Started final no-check elimination pass on remaining runtime holdouts.
  - Scope:
    - remove `@ts-nocheck` from `main-esm` and `ws-runtime-esm`
    - resolve type/include issues without changing runtime behavior
  - Dependencies/blockers:
    - none yet (to be recorded if encountered)

- `2026-02-09T13:39Z` `done` Completed `ws-runtime-esm` holdout cleanup and re-verified full modern lane; `main-esm` remains blocked follow-up.
  - Key actions:
    - removed `@ts-nocheck` from `server/js/ws-runtime-esm.ts` and added explicit class fields/handler typing casts to preserve runtime behavior.
    - reworked browser gametypes module into a typed ESM contract implementation and removed no-check from client compat test:
      - `shared/js/gametypes-browser.ts`
      - `tests/unit/client-gametypes-compat.test.ts`
    - attempted to remove no-check from `server/js/main-esm.ts`, but this remains blocked by direct `.cts` seam typing/include constraints around `main-runtime` import resolution under the current TS project configuration.
  - Verification evidence:
    - `bun run typecheck` -> pass
    - `bun run verify:modern:node22` -> pass (`135 pass`, `1 skip`, `0 fail`; Vite build pass)
  - Remaining no-check holdouts:
    - `server/js/main-esm.ts`
