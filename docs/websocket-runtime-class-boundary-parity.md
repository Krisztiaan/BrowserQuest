# WebSocket Runtime Parity Runbook

Status date: 2026-02-09

## Active runtime boundary state

- Runtime server websocket implementation: `server/js/ws-runtime-esm.ts`
- Shared runtime class factory seam: `server/js/ws-runtime-class-factory.ts`
- Authored websocket factory source: `server/js/ws-runtime-class-factory.cts`
- Startup entry: `server/js/main-esm.ts`

No active CJS websocket runtime path is supported.

## Guardrail commands

1. Scripted drill summary:
   - `bun run test:ws:runtime:drill`
2. Focused parity:
   - `bun run test:ws:runtime:parity`
3. Decision contract:
   - `bun run test:ws:runtime:decision`
4. Full gate:
   - `bun run verify:modern:node22`

## Optional local drill artifacts

```bash
BQ_WS_DRILL_SUMMARY_PATH=artifacts/ws-runtime-drill-summary.json \
BQ_WS_DRILL_MARKDOWN_PATH=artifacts/ws-runtime-drill-summary.md \
bun run test:ws:runtime:drill
```

Escalation template: `docs/websocket-boundary-escalation-template.md`
