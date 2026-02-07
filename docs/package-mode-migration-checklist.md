# Package-Mode Migration Checklist (`commonjs` -> staged ESM)

Date: 2026-02-07

## Objective

Prepare a low-risk path to eventually change `package.json` from `"type": "commonjs"` to `"type": "module"` without breaking runtime, tests, or legacy compatibility workflows.

## Prerequisites

- Server-side `lib/class.js` retirement complete in `server/js`.
- Protocol and legacy verification gates must stay green before and after each package-mode slice:
  - `bun run verify:legacy:node22`
  - `bun run test:browser:protocol:node22`
  - `bun run check:class-fanout`

## Boundary checklist

1. Identify scripts that should stay CJS and keep `.cjs` extension:
   - `tools/check-runtime.cjs`
   - `tools/check-modern-jquery-free.cjs`
   - `tools/check-metrics-healthy-prereqs.cjs`
   - `tools/check-classjs-fanout.cjs`
2. Identify bridge files already ESM-ready:
   - `server/js/main-esm.mjs`
   - `shared/js/gametypes-esm.mjs`
3. Confirm server runtime entry commands and fallback:
   - default: `bun run start:server` (`server/js/main.js`)
   - opt-in ESM bridge: `bun run start:server:esm`
4. Record import/export conversion blockers (if any) in server/runtime files before package flip.
5. Ensure tests using `require(...)` are intentionally CJS-compatible or migrated to `import`.

## Migration sequence

1. Keep package mode as CommonJS while converting any remaining ambiguous boundary files.
2. Add package-mode trial ticket with explicit rollback:
   - switch `"type"` in a dedicated branch/slice,
   - run full verification matrix,
   - revert quickly if legacy/test runners regress.
3. After successful trial, lock follow-up guardrails and update docs/CI references.

## Rollback plan

- If any gate fails during package-mode trial:
  - revert only package-mode flip + directly related boundary edits,
  - re-run `verify:legacy:node22` and protocol browser suite to confirm baseline restoration.
