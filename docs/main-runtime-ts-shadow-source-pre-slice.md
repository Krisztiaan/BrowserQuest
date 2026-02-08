# Main Runtime TS Shadow-Source Pre-Slice (T-328/T-329)

Date: 2026-02-08

Status:

- Pre-slice complete (`T-328`)
- Shadow-source phase-1 execution complete (`T-329`)

## Objective

Define a low-risk, execution-ready pre-slice for promoting `server/js/main-runtime.js` to a TypeScript-authored shadow source while preserving default CJS startup behavior.

## Existing contract baseline

- Runtime seam contracts already extracted:
  - `server/js/main-runtime-types.ts`
- Runtime seam tests already in place:
  - `tests/unit/server-main-runtime-dependencies.test.ts`
  - `tests/unit/server-main-runtime-factories.test.ts`
  - `tests/unit/server-main-runtime-process.test.ts`
  - `tests/unit/server-main-runtime-lifecycle.test.ts`

## Current dependency inventory (`main-runtime.js`)

Static dependencies:

- `./config-preflight`
- `./metrics-runtime`
- `./log`

Runtime-injected dependencies via `createRuntimeDependencies(...)`:

- `./ws`
- `./worldserver`
- `./player`
- timer/process seams (`setInterval`, `setTimeout`, `clearInterval`, `process`)

## Shadow-source artifact strategy

1. Authoritative source:
   - `server/js/main-runtime.cts`
2. Generated runtime artifact:
   - `server/js/main-runtime.js`
3. Deterministic sync tooling:
   - `tools/sync-main-runtime.cjs`
   - `tsconfig.build-main-runtime.json`
4. Verify-gate wiring:
   - `check:main-runtime-sync` in `verify:modern` and `verify:legacy`

## Executed checklist (T-329)

1. Seed `server/js/main-runtime.cts` from current runtime file and preserve module export shape.
2. Introduce sync build/check tooling and generate `server/js/main-runtime.js`.
3. Update docs/runbooks to enforce `.cts` source-of-truth workflow.
4. Run full verification:
   - `bun run typecheck`
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`

## Rollback checklist

1. Revert `main-runtime` shadow-source files and sync gate wiring.
2. Restore known-good `server/js/main-runtime.js`.
3. Re-run:
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`
   - `bun run test:browser:protocol:node22`
