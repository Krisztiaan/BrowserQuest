# Websocket Factory TS Source Promotion Plan (T-313)

Date: 2026-02-08

## Objective

Promote websocket runtime class-factory implementation ownership from CJS-only source to TypeScript source while preserving:

- synchronous CJS default startup path (`server/js/main.js` -> `server/js/ws.js`)
- ESM runtime wrapper parity (`server/js/ws-runtime-class-factory.mjs`, `server/js/ws-esm.mjs`)
- existing websocket handshake/protocol behavior

## Current baseline

- Canonical authored source: `server/js/ws-runtime-class-factory.cts`
- Generated runtime artifact: `server/js/ws-runtime-class-factory.cjs`
- CJS wrapper consumer: `server/js/ws.js`
- ESM wrapper consumer: `server/js/ws-runtime-class-factory.mjs`
- Typed contract surface exists: `server/js/ws-runtime-class-factory-types.ts`
- Sync workflow guardrails:
  - regenerate artifact: `bun run build:ws-runtime-factory`
  - validate sync: `bun run check:ws-runtime-factory-sync`

## Constraints

1. CJS startup must remain synchronous.
2. No runtime dependency on TS transpilers at startup.
3. CJS and ESM wrappers must keep one shared class-factory behavior source.
4. Modern/legacy/protocol parity gates remain mandatory.

## Proposed rollout

### Phase 1: TS source shadow + deterministic sync (safe pre-promotion)

- Add TypeScript source file: `server/js/ws-runtime-class-factory.cts`.
- Generate/update runtime artifact: `server/js/ws-runtime-class-factory.cjs`.
- Add deterministic sync tooling:
  - build command to regenerate CJS artifact from `.cts`.
  - check command to fail if committed `.cjs` diverges from generated output.
- Keep runtime wrappers unchanged (still consuming `.cjs`).

Exit criteria:

- Sync command and check command pass.
- Websocket parity and verify gates remain green.

Status: complete (T-314).

### Phase 2: TS source ownership switch

- Declare `.cts` as source-of-truth in docs and file header comments.
- Enforce sync check in `verify:modern`.
- Keep generated `.cjs` committed for CJS runtime compatibility.

Exit criteria:

- No direct behavior edits occur in `.cjs` without corresponding `.cts` regeneration.
- Parity tests confirm unchanged protocol behavior.

Status: complete (T-315/T-317 policy+workflow alignment).

### Phase 3: Optional future runtime simplification

- Re-assess whether CJS artifact can be retired after default startup leaves CJS mode.
- Until then, keep generated `.cjs` artifact as compatibility boundary.

## Verification matrix

Required for each phase:

1. `bun run typecheck`
2. `bun run test:ws:runtime:decision`
3. `bun run test:ws:runtime:parity`
4. `bun run check:ws:runbooks`
5. `bun run verify:modern:node22`
6. `bun run verify:legacy:node22`
7. `bun run test:browser:protocol:node22`

## Rollback plan

If TS-source promotion introduces regressions:

1. Revert websocket factory promotion slice commits.
2. Restore prior known-good `server/js/ws-runtime-class-factory.cjs`.
3. Re-run:
   - `bun run test:ws:runtime:decision`
   - `bun run test:ws:runtime:parity`
   - `bun run verify:modern:node22`
   - `bun run verify:legacy:node22`

## Ownership

- Primary owners: server-runtime maintainers.
- Boundary docs to keep aligned:
  - `docs/websocket-cjs-factory-migration-decision.md`
  - `docs/websocket-runtime-class-boundary-parity.md`
  - `docs/runtime-cjs-boundary-inventory.md`
