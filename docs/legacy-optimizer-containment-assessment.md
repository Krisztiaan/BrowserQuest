# Legacy Optimizer Containment Assessment (T-191)

Date: 2026-02-07

## Decision question

How should we handle the legacy RequireJS optimizer (`bin/r.js`) now that package mode is ESM (`"type": "module"`)?

## Current baseline

- Legacy build still depends on upstream `r.js` (`0.26.0`) through `bin/r.cjs`.
- Package-mode compatibility is currently preserved by compiling `bin/r.js` inside explicit CJS context.
- `verify:legacy` remains a required compatibility gate and includes `build:client`.

## Constraints

1. Keep `client/index.html` compatibility path working until formal retirement.
2. Keep rollback fast when legacy build breaks.
3. Avoid high-risk rewrites of legacy AMD runtime while modern path is still evolving.

## Option comparison

| Option | Summary | Effort | Risk | Rollback |
|---|---|---|---|---|
| A. Contain `r.js` behind explicit boundary (current path) | Keep `bin/r.cjs` wrapper + guardrails + docs/CI checks. | Low | Low | Trivial (`revert` boundary slice) |
| B. Replace optimizer while keeping AMD runtime | Re-implement RequireJS bundling/minification behavior via modern bundler plugins/custom scripts. | High | High | Medium (replacement fallback needs parallel upkeep) |
| C. Retire `build:client` and keep only modern artifacts | Remove AMD build distribution and complete legacy runtime retirement. | Medium/High | Medium | Medium (requires preserving releasable rollback tag/workflow) |

## Recommendation

Choose **Option A now**, and treat **Option C** as the strategic end state.

Reasoning:

1. It solves immediate package-mode compatibility risk with smallest change surface.
2. It keeps required legacy compatibility gates stable while modernization continues.
3. It avoids spending significant effort replacing tooling for a runtime we intend to retire.

## Execution guidance

1. Keep containment as policy:
   - `bin/r.js` remains vendored legacy artifact.
   - `bin/r.cjs` remains the only supported runtime wrapper.
   - `bun run check:package-mode-boundaries` remains in `verify:modern` and `verify:legacy`.
2. Avoid Option B unless Option C is blocked long-term by external consumers.
3. Drive toward Option C via explicit readiness checkpoints in `docs/legacy-retirement-checklist.md`.

## Revisit triggers

Re-open this assessment if any of these become true:

1. `build:client` starts failing repeatedly across Node/Bun updates despite containment.
2. A downstream consumer requires long-term support for `client-build/` artifacts.
3. Legacy retirement is delayed beyond planned modernization milestones.
