# Websocket Runtime Class-Boundary Parity

## Current runtime boundary state

- `server/js/ws.js` (CJS runtime): class assembly is delegated to shared `createWebSocketRuntimeClasses(...)`.
- `server/js/ws-runtime-esm.mjs` (ESM runtime): class assembly is delegated to the same shared factory seam.
- Canonical authored source: `server/js/ws-runtime-class-factory.cts`.
- Generated runtime artifact: `server/js/ws-runtime-class-factory.cjs`.
- ESM bridge export: `server/js/ws-runtime-class-factory.mjs`.

## Single-source seam policy

Both CJS and ESM runtime paths must use the same class-factory source to prevent protocol/close-code drift.
Wrapper modules should remain dependency-wiring layers only.
Use `bun run build:ws-runtime-factory` + `bun run check:ws-runtime-factory-sync` for source/artifact workflow enforcement.

Decision record: `docs/websocket-cjs-factory-migration-decision.md`
Escalation template: `docs/websocket-boundary-escalation-template.md`

## Parity guardrail commands

- Scripted drill summary: `bun run test:ws:runtime:drill`
  - optional local summary file:
    - `BQ_WS_DRILL_SUMMARY_PATH=artifacts/ws-boundary-drill-summary.json BQ_WS_DRILL_MARKDOWN_PATH=artifacts/ws-boundary-drill-summary.md bun run test:ws:runtime:drill`
  - optional forced-failure simulation:
    - `BQ_WS_DRILL_FORCE_FAIL_CHECK=parity BQ_WS_DRILL_SUMMARY_PATH=artifacts/ws-boundary-drill-summary.json BQ_WS_DRILL_MARKDOWN_PATH=artifacts/ws-boundary-drill-summary.md bun run test:ws:runtime:drill || true`
    - failure metadata is emitted under:
      - `failureSnapshot.failedCheckKeys`
      - `failureSnapshot.failedChecks[*].exitCode`
      - `failureSnapshot.failedChecks[*].logTailHint`
- Focused parity: `bun run test:ws:runtime:parity`
- Decision contract: `bun run test:ws:runtime:decision`
- Full modern gate: `bun run verify:modern:node22`
- Full legacy gate: `bun run verify:legacy:node22`
