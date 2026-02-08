# Dependency Modernization Audit (2026-02-07)

## Runtime baseline

- Node runtime policy target: `22.x` (pinned in `.nvmrc`, `package.json#engines`, and CI)
- Bun runtime currently used locally: `1.3.3`
- Project package mode: `"type": "module"` (guarded by `bun run check:package-mode-boundaries`)

## Direct dependency status

- `ws@8.19.0`: current on latest major line.
- `jquery@4.0.0`: upgraded and now on latest major line.
- `eslint@10.0.0` and `@eslint/js@10.0.1`: upgraded and verified in this branch.
- Fresh drift snapshot (2026-02-07):
  - `bun run check:deps:drift` returns no direct dependency drift.
  - Node22 policy variant `bun run check:deps:drift:node22` is available for runtime-consistent local audits.
- Residual compatibility watch:
  - `@typescript-eslint` latest (`8.54.0`) still declares peer range `eslint: ^8.57.0 || ^9.0.0`, but lint/test/verify gates pass with `eslint@10.0.0` in this repo.

## Trial outcome

- Scoped `jquery@4` trial completed and landed.
- Scoped `eslint@10` + `@eslint/js@10` trial completed and landed.
- Verification evidence:
  - `bun run test:modern-browser` passed.
  - `bun run verify:modern` passed.
  - `bun run verify:legacy` passed.
  - `bun run lint` passed with upgraded lint toolchain.
  - `bun run check:deps:drift` returns no direct dependency drift.

## Node 22 baseline outcome

- Node 22 verification runtime used: `v22.22.0` (via `tools/node22-run.sh` shim resolution).
- Verification evidence:
  - `PATH=<node22-shim> bun run verify:modern` passed.
  - `PATH=<node22-shim> bun run verify:legacy` passed.
  - `PATH=<node22-shim> bun run test:modern-browser` passed.
  - `timeout 6s bash tools/node22-run.sh node --trace-warnings server/js/main.js server/config.json` showed clean startup with no runtime warnings before timeout shutdown.

## CI baseline enforcement

- Node 22 is now pinned in CI verification workflows:
  - `.github/workflows/verify-modern.yml`
  - `.github/workflows/verify-legacy.yml`
  - `.github/workflows/verify-modern-browser.yml`
  - `.github/workflows/verify-legacy-browser.yml`
- Runtime preflight runbook: `docs/runtime-preflight.md`
- Legacy jQuery migration risk scan: `docs/legacy-jquery4-risk-scan.md`
- Modern ESM jQuery surface audit: `docs/modern-jquery-surface-audit.md`

## Follow-up execution order

1. Track `@typescript-eslint` peer-range updates for explicit `eslint@10` support, and re-check lint behavior on each bump.
2. Keep modern jQuery-free guard (`check:modern-jquery-free`) and modern-first entry routing tests in default verification.
3. Watch for runtime regressions in modern and legacy paths after UI/runtime routing refactors.
4. Keep local runtime ergonomics aligned via `tools/node22-run.sh` helper and Node 22 CI baseline.

## Dependency watch cadence

- Weekly (or before release): `bun run check:deps:drift`.
- Runtime-policy parity check: `bun run check:deps:drift:node22`.
- If drift is reported:
  - create/refresh upgrade trial tickets in `MODERNIZE.md` with explicit verification gates.
  - run `bun run verify:modern:node22` and `bun run verify:legacy:node22` before keeping any upgrade.

Reference checklist: `docs/jquery4-readiness-checklist.md`
