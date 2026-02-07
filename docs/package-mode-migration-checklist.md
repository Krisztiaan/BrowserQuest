# Package-Mode Migration Checklist (Post-Adoption)

Date: 2026-02-07

## Objective

Maintain and harden package mode (`"type": "module"`) without breaking runtime, tests, or legacy compatibility workflows.

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
   - opt-in ESM websocket runtime seam: `BQ_ESM_WS_RUNTIME=1 bun run start:server:esm`
   - script aliases for startup seam modes:
     - `bun run start:server:esm:ws-bridge:probe`
     - `bun run start:server:esm:ws-runtime`
     - `bun run start:server:esm:ws-runtime:fail`
   - extracted startup helper contracts:
     - `server/js/main-esm-bridge-probe.mjs`
     - `server/js/main-esm-runtime-options.mjs`
4. Record import/export conversion blockers (if any) in server/runtime files before package flip.
5. Ensure tests using `require(...)` are intentionally CJS-compatible or migrated to `import`.
6. Keep websocket boundary decision checks aligned with runtime mode docs:
   - decision record: `docs/websocket-cjs-factory-migration-decision.md`
   - decision/parity checks:
     - `bun run test:ws:runtime:drill`
     - `bun run test:ws:runtime:decision`
     - `bun run test:ws:runtime:parity`

## Migration sequence (completed + ongoing)

1. Keep intentional CJS boundaries explicit (`.cjs`) and documented.
2. Re-run package-mode verification matrix on boundary/tooling changes.
3. Keep rollback steps ready for any future regression in legacy build/runtime paths.

## Rollback plan

- If any package-mode boundary change causes gate failures:
  - revert only the boundary change + directly related edits,
  - re-run `verify:legacy:node22` and protocol browser suite to confirm baseline restoration.
