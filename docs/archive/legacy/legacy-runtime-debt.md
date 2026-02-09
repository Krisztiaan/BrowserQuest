> Archived historical note: this document is retained for migration history. Legacy command references (for example, `verify:legacy` or `build:client`) are non-active and may be retired.

# Legacy Runtime Debt Triage (T-019)

Date: 2026-02-06

## Current debt inventory

1. Dual client runtimes remain active
- Legacy AMD runtime (`client/index.html` + `client/js/**`) still boots through global scripts (`modernizr`, `detect`, `log`, `require-jquery`).
- Modern ESM runtime (`client/modern.html` + `client/js-esm/**`) is primary, but legacy fallback is still built and shipped.

2. Duplicated gameplay code paths
- Legacy JS modules: 49 files in `client/js`.
- ESM modules: 46 files in `client/js-esm`.
- This creates drift risk and doubles maintenance effort for gameplay-side fixes.

3. Global/classic module conventions still present in server runtime
- Multiple server modules still use implicit global assignment pattern:
  - `module.exports = Name = ...`
- The runtime still depends on globally-available base classes in some paths (`Class`, entity classes), which increases load-order coupling.

4. Duplicate protocol/type sources
- `shared/js/gametypes.js` (legacy/global/CJS style) and `client/js-esm/compat/gametypes.js` (ESM compat copy) both exist.
- Type/protocol updates risk divergence unless both are kept in sync manually.

5. Legacy build-time coupling
- Vite legacy-inclusive mode (`build:vite:legacy`) still emits expected non-module warnings due script-tag legacy boot constraints.
- RequireJS optimizer output (`build:client`) remains a separate distribution pipeline.

## Priority and execution order

1. P1: Server module de-globalization
- Convert `module.exports = Name = ...` to explicit local declarations + export only.
- Remove reliance on implicit global class availability in server modules.
- Goal: deterministic module loading and easier future CJS->ESM migration.

2. P1: Shared types single-source
- Make `shared/js/gametypes` the single source and generate/adapt ESM import surface from it.
- Remove duplicated logic body in `client/js-esm/compat/gametypes.js`.

3. P2: Legacy client build boundary tightening
- Keep `verify:legacy` but narrow the files copied/served in legacy mode to what is strictly required.
- Document explicit sunset criteria for legacy runtime.

4. P2: Legacy AMD boot dependency reduction
- Remove or isolate remaining non-essential global scripts from `client/index.html` where behavior permits.
- Keep compatibility behavior unchanged while reducing runtime global surface.

5. P3: Full legacy runtime retirement planning
- Define preconditions to stop producing `client-build/` artifacts.
- Gate retirement on parity checks + release sign-off.

## Proposed follow-up tickets

- `T-020`: Server export/global cleanup (CJS deterministic modules)
- `T-021`: Shared gametypes single-source adapter
- `T-022`: Legacy build boundary tightening and asset-copy minimization
- `T-023`: Legacy `index.html` boot globals reduction
- `T-024`: Legacy runtime retirement checklist + cutover plan
